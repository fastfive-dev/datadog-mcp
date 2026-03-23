# Datadog MCP Server on AWS - Design Spec

## Overview

Datadog의 Metrics와 Logs 데이터를 Claude에서 읽기 전용으로 조회할 수 있는 MCP 서버.
AWS Lambda + API Gateway에 배포하고, 팀원 누구나 공용 API Key로 접근 가능.

## Architecture

```
[Claude Desktop/Code]
        │
        │  HTTPS POST /mcp
        │  Header: x-api-key: {shared-key}
        ▼
[API Gateway (REST API)]
        │
        │  API Key + Usage Plan 인증
        ▼
[Lambda Function (Node.js 20)]
        │
        │  MCP Streamable HTTP Transport (stateless)
        │  sessionIdGenerator: undefined
        │
        ├─ query_metrics   → Datadog v1/query
        ├─ list_metrics    → Datadog v1/metrics
        ├─ get_metric_metadata → Datadog v1/metrics/{metric}
        ├─ search_logs     → Datadog v2/logs/events/search
        └─ list_log_indexes → Datadog v1/logs/config/indexes
        ▼
[Datadog API (datadoghq.com)]
```

## Technology Stack

| Component | Choice | Rationale |
|-----------|--------|-----------|
| Runtime | Node.js 20 | MCP SDK TypeScript 네이티브 지원 |
| MCP SDK | `@modelcontextprotocol/sdk` | 공식 SDK. `McpServer`, `StreamableHTTPServerTransport` 포함 |
| HTTP Client | `axios` | Datadog API 호출 |
| IaC | AWS SAM | Lambda + API Gateway 원클릭 배포 |
| Auth | API Gateway API Key | 팀 공용 키. 별도 계정 불필요 |
| Credentials | Lambda 환경변수 | `DD_API_KEY`, `DD_APP_KEY`, `DD_SITE` |

## Project Structure

```
datadog-mcp/
├── src/
│   ├── index.ts              # Lambda 핸들러 + MCP 서버 설정
│   ├── tools/
│   │   ├── metrics.ts        # query_metrics, list_metrics, get_metric_metadata
│   │   └── logs.ts           # search_logs, list_log_indexes
│   └── lib/
│       └── datadog-client.ts # Datadog API 호출 래퍼
├── template.yaml             # SAM 템플릿
├── samconfig.toml            # SAM 배포 설정
├── tsconfig.json
├── package.json
└── README.md                 # 팀원 온보딩 가이드
```

## MCP Tools Specification

### 1. query_metrics

Datadog 메트릭 시계열 데이터를 조회한다.

- **Datadog API**: `GET /api/v1/query`
- **Input Schema**:
  - `query` (string, required): Datadog 메트릭 쿼리. e.g. `avg:system.cpu.user{env:production}`
  - `from` (string, required): 시작 시간. epoch seconds 또는 상대 시간 (e.g. `1h`, `30m`, `1d`)
  - `to` (string, optional, default: "now"): 종료 시간
- **Output**: 시계열 데이터 포인트 (timestamp, value 배열)
- **구현 노트**: 상대 시간 문자열을 epoch seconds로 변환하는 헬퍼 필요

### 2. list_metrics

사용 가능한 메트릭 이름을 검색한다.

- **Datadog API**: `GET /api/v1/metrics`
- **Input Schema**:
  - `query` (string, required): 검색 패턴. e.g. `system.cpu.*`
  - `from` (string, required): 해당 시점 이후 활성 메트릭만 반환. epoch seconds 또는 상대 시간 (e.g. `1h`, `1d`)
- **Output**: 매칭되는 메트릭 이름 목록

### 3. get_metric_metadata

특정 메트릭의 메타데이터를 조회한다.

- **Datadog API**: `GET /api/v1/metrics/{metric_name}`
- **Input Schema**:
  - `metric_name` (string, required): 메트릭 이름
- **Output**: 단위, 타입, 설명 등

### 4. search_logs

로그를 검색한다.

- **Datadog API**: `POST /api/v2/logs/events/search`
- **Input Schema**:
  - `query` (string, required): Datadog 로그 쿼리. e.g. `status:error service:api`
  - `from` (string, required): 시작 시간
  - `to` (string, optional, default: "now"): 종료 시간
  - `limit` (number, optional, default: 50, max: 200): 반환할 로그 수
  - `sort` (string, optional, default: "-timestamp"): 정렬 순서. `"timestamp"` (오름차순) 또는 `"-timestamp"` (내림차순)
- **Output**: 로그 이벤트 목록 (timestamp, message, attributes)

### 5. list_log_indexes

로그 인덱스 목록을 조회한다.

- **Datadog API**: `GET /api/v1/logs/config/indexes`
- **Input Schema**: 없음
- **Output**: 인덱스 이름, 필터, 보존 기간 목록

## Lambda Handler Design

Lambda는 stateless MCP 서버로 동작한다. 핵심 설계:

```typescript
// src/index.ts 의사 코드
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';

// MCP 서버 인스턴스 (Lambda 콜드스타트 시 1회 생성)
const server = new McpServer({
  name: 'datadog-mcp',
  version: '1.0.0',
});

// Tool 등록 (metrics.ts, logs.ts에서 가져옴)
registerMetricsTools(server);
registerLogsTools(server);

// Lambda 핸들러
export const handler = async (event, context) => {
  // API Gateway 이벤트 → Node.js HTTP 요청/응답으로 변환
  const { req, res } = convertApiGatewayToNodeHttp(event);

  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined, // stateless - 세션 없음
  });
  await server.connect(transport);

  // MCP 프로토콜 처리 (req.body를 반드시 전달)
  await transport.handleRequest(req, res, req.body);
  return convertNodeHttpToApiGatewayResponse(res);
};
```

**주요 결정사항:**
- `sessionIdGenerator: undefined` → stateless 모드. Lambda에 적합
- MCP 서버 인스턴스는 모듈 스코프에 생성 → 콜드스타트 시 1회만 초기화, 웜 인스턴스에서 재사용
- API Gateway 이벤트를 Node.js HTTP 요청으로 변환하는 어댑터 필요

## Datadog Client

```typescript
// src/lib/datadog-client.ts 의사 코드
import axios from 'axios';

const DD_SITE = process.env.DD_SITE || 'datadoghq.com';
const DD_API_KEY = process.env.DD_API_KEY;
const DD_APP_KEY = process.env.DD_APP_KEY;

const client = axios.create({
  baseURL: `https://api.${DD_SITE}`,
  headers: {
    'DD-API-KEY': DD_API_KEY,
    'DD-APPLICATION-KEY': DD_APP_KEY,
  },
});

export async function queryMetrics(query: string, from: number, to: number) {
  const { data } = await client.get('/api/v1/query', {
    params: { query, from, to },
  });
  return data;
}

// ... 나머지 API 함수들
```

## SAM Template

```yaml
AWSTemplateFormatVersion: '2010-09-09'
Transform: AWS::Serverless-2016-10-31
Description: Datadog MCP Server

Globals:
  Function:
    Timeout: 30
    MemorySize: 256
    Runtime: nodejs20.x

Resources:
  McpApi:
    Type: AWS::Serverless::Api
    Properties:
      StageName: prod
      Auth:
        ApiKeyRequired: true

  McpFunction:
    Type: AWS::Serverless::Function
    Metadata:
      BuildMethod: esbuild
      BuildProperties:
        Minify: false
        Target: es2022
        Sourcemap: true
        EntryPoints:
          - src/index.ts
    Properties:
      Handler: index.handler
      CodeUri: .
      Environment:
        Variables:
          DD_API_KEY: !Ref DatadogApiKey
          DD_APP_KEY: !Ref DatadogAppKey
          DD_SITE: datadoghq.com
      Events:
        McpPost:
          Type: Api
          Properties:
            RestApiId: !Ref McpApi
            Path: /mcp
            Method: POST
        McpGet:
          Type: Api
          Properties:
            RestApiId: !Ref McpApi
            Path: /mcp
            Method: GET
        McpDelete:
          Type: Api
          Properties:
            RestApiId: !Ref McpApi
            Path: /mcp
            Method: DELETE

  ApiKey:
    Type: AWS::ApiGateway::ApiKey
    DependsOn: McpApiprodStage
    Properties:
      Name: datadog-mcp-team-key
      Enabled: true
      StageKeys:
        - RestApiId: !Ref McpApi
          StageName: prod

  UsagePlan:
    Type: AWS::ApiGateway::UsagePlan
    Properties:
      UsagePlanName: datadog-mcp-plan
      Throttle:
        BurstLimit: 50
        RateLimit: 20
      Quota:
        Limit: 10000
        Period: DAY
      ApiStages:
        - ApiId: !Ref McpApi
          Stage: prod

  UsagePlanKey:
    Type: AWS::ApiGateway::UsagePlanKey
    Properties:
      KeyId: !Ref ApiKey
      KeyType: API_KEY
      UsagePlanId: !Ref UsagePlan

Parameters:
  DatadogApiKey:
    Type: String
    NoEcho: true
  DatadogAppKey:
    Type: String
    NoEcho: true

Outputs:
  McpEndpoint:
    Description: MCP Server URL
    Value: !Sub 'https://${McpApi}.execute-api.${AWS::Region}.amazonaws.com/prod/mcp'
  ApiKeyId:
    Description: API Key ID (use aws apigateway get-api-key to retrieve value)
    Value: !Ref ApiKey
```

**SAM 템플릿 노트:**
- POST, GET, DELETE 3개 메서드 등록 (MCP Streamable HTTP 프로토콜 요구사항)
- API Key는 `NoEcho: true`로 파라미터에서 받음
- Usage Plan으로 rate limiting (하루 10,000 요청, 초당 20 요청)

## Authentication Flow

```
1. 관리자: sam deploy 시 DD_API_KEY, DD_APP_KEY 파라미터로 전달
2. 관리자: 배포 후 API Gateway API Key 값 확인
   $ aws apigateway get-api-key --api-key {ApiKeyId} --include-value
3. 관리자: 팀원들에게 MCP 엔드포인트 URL + API Key 공유
4. 팀원: Claude 설정에 추가하고 바로 사용
```

## Team Onboarding (Claude 설정)

팀원은 Claude Desktop 설정 또는 Claude Code 프로젝트 설정에 다음을 추가:

```json
{
  "mcpServers": {
    "datadog": {
      "type": "url",
      "url": "https://{api-id}.execute-api.{region}.amazonaws.com/prod/mcp",
      "headers": {
        "x-api-key": "{shared-api-key}"
      }
    }
  }
}
```

## Error Handling

| 시나리오 | 처리 방식 |
|----------|----------|
| Datadog API 인증 실패 | MCP error 응답 + "DD_API_KEY/DD_APP_KEY 확인 필요" 메시지 |
| Datadog API rate limit | MCP error 응답 + 재시도 안내 |
| 잘못된 쿼리 문법 | Datadog 에러 메시지를 그대로 전달 |
| Lambda 타임아웃 (30s) | API Gateway가 504 반환 |
| API Key 누락 | API Gateway가 403 반환 (Lambda 도달 전 차단) |

## Security Considerations

- **Datadog 키**: Lambda 환경변수에 저장. `lambda:GetFunctionConfiguration` 권한이 있으면 평문 조회 가능하므로 IAM 접근 제어 필수. 보안 강화가 필요하면 v2에서 SSM Parameter Store SecureString으로 전환 권장
- **API Key**: API Gateway 레벨 인증. 키 없이는 Lambda에 도달 불가
- **읽기 전용**: 쓰기/수정/삭제 API는 의도적으로 구현하지 않음
- **Rate Limiting**: Usage Plan으로 남용 방지
- **Datadog App Key 권한**: 최소 권한 원칙. Metrics Read + Logs Read 스코프만 부여 권장

## Deployment Steps

```bash
# 1. 빌드
npm install
npm run build

# 2. SAM 빌드
sam build

# 3. 첫 배포 (guided)
sam deploy --guided
# → Stack Name: datadog-mcp
# → Region: ap-northeast-2 (또는 원하는 리전)
# → DatadogApiKey: {your-dd-api-key}
# → DatadogAppKey: {your-dd-app-key}

# 4. API Key 확인
aws apigateway get-api-key --api-key {출력된 ApiKeyId} --include-value

# 5. 엔드포인트 확인
# Outputs에서 McpEndpoint 값 확인
```

## Out of Scope (v1)

- 쓰기 API (모니터 생성, 대시보드 수정 등)
- Events, Incidents, Synthetics 등 추가 Datadog 기능
- 사용자별 인증/권한 분리
- CloudWatch 로깅/모니터링 (필요 시 v2에서 추가)
- CI/CD 파이프라인 (수동 배포)

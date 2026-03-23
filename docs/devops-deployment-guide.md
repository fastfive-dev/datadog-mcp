# Datadog MCP Server — DevOps 배포 요청

## 요약

팀에서 Claude (Desktop/Code)를 통해 Datadog 메트릭과 로그를 읽기 전용으로 조회할 수 있는 MCP 서버를 만들었습니다. AWS Lambda + API Gateway에 배포하려고 하며, DevOps 팀의 리뷰와 배포 지원을 요청합니다.

## 이게 뭔가요?

[MCP (Model Context Protocol)](https://modelcontextprotocol.io/)는 Claude 같은 AI 모델이 외부 데이터를 조회할 수 있게 해주는 표준 프로토콜입니다. 이 서버를 배포하면 팀원 누구나 Claude에서 자연어로 Datadog 데이터를 조회할 수 있습니다.

**예시:**
- "최근 1시간 CPU 사용률 보여줘" → Datadog Metrics API 호출
- "production 환경 ERROR 로그 검색해줘" → Datadog Logs API 호출

## 아키텍처

```
[Claude Desktop/Code]
        │
        │  HTTPS POST /mcp
        │  Header: x-api-key: {shared-key}
        ▼
[API Gateway (REST API)]
        │  API Key + Usage Plan 인증
        │  Rate Limit: 20 req/s, 10,000 req/day
        ▼
[Lambda (Node.js 20)]
        │  MCP 프로토콜 처리
        │  읽기 전용 API만 호출
        ▼
[Datadog API (US1)]
```

## 인프라 구성

| 리소스 | 설정 |
|--------|------|
| **Lambda** | Node.js 20, 256MB, 30s timeout, esbuild 번들링 |
| **API Gateway** | REST API, `POST/GET/DELETE /mcp` |
| **인증** | API Gateway API Key (팀 공용 1개) |
| **Rate Limiting** | Usage Plan — burst 50, rate 20/s, 일 10,000건 |
| **환경변수** | `DD_API_KEY`, `DD_APP_KEY`, `DD_SITE` |

## 보안 사항

- **읽기 전용**: Datadog 쓰기/수정/삭제 API는 일체 사용하지 않음
- **API Key 인증**: 키 없으면 Lambda에 도달 불가 (API Gateway에서 차단)
- **Datadog 키**: Lambda 환경변수 저장. `lambda:GetFunctionConfiguration` IAM 권한 제어 필요
  - 보안 강화가 필요하면 SSM Parameter Store SecureString으로 전환 가능
- **Datadog App Key 스코프**: Metrics Read + Logs Read만 부여 권장
- **Usage Plan**: 남용 방지용 rate limit 설정됨

## 필요한 것

### 1. Datadog API Key / App Key
- Datadog Admin에서 발급 필요
- App Key에는 **Metrics Read + Logs Read** 스코프만 부여

### 2. AWS 배포 환경
- SAM CLI 설치된 환경
- 배포 대상 AWS 계정/리전 결정

### 3. 배포 명령

```bash
# 리포 클론
git clone https://github.com/calvinjkim/datadog-mcp.git
cd datadog-mcp

# 의존성 설치
npm install

# SAM 빌드 & 배포
sam build
sam deploy --guided
# → Stack Name: datadog-mcp
# → Region: (결정된 리전)
# → DatadogApiKey: (발급받은 API Key)
# → DatadogAppKey: (발급받은 App Key)
# → DatadogSite: datadoghq.com
```

### 4. 배포 후 확인

```bash
# 엔드포인트 URL 확인
sam list stack-outputs --stack-name datadog-mcp

# API Key 값 확인 (팀원에게 공유할 값)
aws apigateway get-api-key --api-key <출력된 ApiKeyId> --include-value

# 엔드포인트 동작 확인
curl -X POST https://<endpoint>/prod/mcp \
  -H "Content-Type: application/json" \
  -H "x-api-key: <api-key-value>" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"test","version":"1.0.0"}}}'
```

정상이면 `serverInfo.name: "datadog-mcp"` 포함된 JSON 응답이 옵니다.

## 배포 후 팀원 온보딩

배포가 완료되면 팀원들에게 아래 정보를 공유합니다:

1. **MCP Endpoint URL**: `https://<api-id>.execute-api.<region>.amazonaws.com/prod/mcp`
2. **API Key**: `<shared-api-key>`

팀원은 Claude 설정에 아래만 추가하면 됩니다:

```json
{
  "mcpServers": {
    "datadog": {
      "type": "url",
      "url": "https://<api-id>.execute-api.<region>.amazonaws.com/prod/mcp",
      "headers": {
        "x-api-key": "<shared-api-key>"
      }
    }
  }
}
```

## 사용 가능한 기능

| Tool | 설명 | Datadog API |
|------|------|-------------|
| `query_metrics` | 메트릭 시계열 데이터 조회 | `GET /api/v1/query` |
| `list_metrics` | 메트릭 이름 검색 | `GET /api/v1/metrics` |
| `get_metric_metadata` | 메트릭 메타데이터 조회 | `GET /api/v1/metrics/{name}` |
| `search_logs` | 로그 검색 | `POST /api/v2/logs/events/search` |
| `list_log_indexes` | 로그 인덱스 목록 | `GET /api/v1/logs/config/indexes` |

## 비용 예상

- Lambda: 프리티어 범위 (월 100만 요청 무료)
- API Gateway: 월 100만 요청까지 $3.50
- 실사용량 기준 거의 무료 수준

## 리포지토리

https://github.com/calvinjkim/datadog-mcp

질문이나 우려사항 있으면 알려주세요.

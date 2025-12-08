# 뿌리오 API 구현 점검 및 수정 계획

## 📋 API 문서 분석

### 1. 토큰 발급 API (`POST /v1/token`)
- **인증**: Basic Authentication (계정:뿌리오 개발 인증키를 Base64 인코딩)
- **응답**: `{ token, type: "Bearer", expired }`
- **유효기간**: 1일

### 2. 메시지 발송 API (`POST /v1/message`)
- **인증**: Bearer Token (발급받은 토큰)
- **요청 형식**:
  ```json
  {
    "account": "뿌리오 계정",
    "messageType": "SMS|LMS|MMS",
    "content": "메시지 내용",
    "from": "발신 번호",
    "duplicateFlag": "Y|N",
    "targetCount": 1,
    "targets": [{ "to": "수신번호", "name": "이름", "changeWord": {...} }],
    "refKey": "고객사 키",
    "rejectType": "AD",
    "sendTime": "yyyy-MM-ddTHH:mm:ss",
    "subject": "제목",
    "files": [{ "name": "...", "size": 0, "data": "..." }]
  }
  ```
- **응답**: `{ code: 1000, description: "ok", refKey, messageKey }`

### 3. 예약발송 취소 API (`POST /v1/cancel`)
- **인증**: Bearer Token
- **요청**: `{ account, messageKey }`
- **응답**: `{ code: 1000, description: "ok" }`

## 🔍 현재 구현 문제점

### 1. 토큰 발급 API 누락 ❌
- 현재 구현에는 토큰 발급 로직이 없음
- 직접 메시지 발송만 시도하고 있음

### 2. 인증 방식 불일치 ❌
- **현재**: `X-PPURIO-USER-ID`, `X-PPURIO-API-KEY` 헤더 사용
- **문서**: Basic Auth (토큰 발급) → Bearer Token (메시지 발송)

### 3. API 엔드포인트 불일치 ❌
- **현재**: `/v1/send`
- **문서**: `/v1/token` (토큰 발급), `/v1/message` (메시지 발송)

### 4. 요청 형식 불일치 ❌
- **현재**: `{ phone, message, sender }`
- **문서**: `{ account, messageType, content, from, duplicateFlag, targetCount, targets, refKey, ... }`

### 5. 응답 형식 불일치 ❌
- **현재**: `{ result_code, message, msg_id }`
- **문서**: `{ code, description, refKey, messageKey }`

## ✅ 수정 계획

### 1. 토큰 발급 함수 추가
```typescript
async function getAccessToken(): Promise<string>
```

### 2. 토큰 캐싱 구현
- 토큰 유효기간(1일) 고려
- 메모리 캐시 또는 Redis 사용

### 3. 메시지 발송 함수 수정
- 토큰 발급 후 Bearer Token 사용
- 문서에 맞는 요청/응답 형식으로 변경

### 4. 예약발송 취소 함수 추가
```typescript
async function cancelScheduledMessage(messageKey: string): Promise<boolean>
```

### 5. 환경 변수 확인
- `PPURIO_ACCOUNT`: 뿌리오 계정
- `PPURIO_AUTH_KEY`: 뿌리오 개발 인증키
- `PPURIO_API_BASE_URL`: API 기본 URL (기본값: `https://message.ppurio.com`)

## 🔧 수정 필요 사항 상세

### 환경 변수 변경
- `PPURIO_USER_ID` → `PPURIO_ACCOUNT` (뿌리오 계정)
- `PPURIO_API_KEY` → `PPURIO_AUTH_KEY` (뿌리오 개발 인증키)
- `PPURIO_SENDER_NUMBER` → 유지 (발신 번호)
- `PPURIO_API_ENDPOINT` → `PPURIO_API_BASE_URL` (기본값: `https://message.ppurio.com`)

### 구현 순서
1. 토큰 발급 함수 구현 (`getAccessToken`)
2. 토큰 캐싱 (메모리 또는 Redis)
3. 메시지 발송 함수 수정 (`sendSMS`)
4. 예약발송 취소 함수 추가 (`cancelScheduledMessage`)
5. 환경 변수 스키마 업데이트

## 📝 작업 일시
2025-01-07


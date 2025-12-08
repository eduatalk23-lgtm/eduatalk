# SMS 응답 code 타입 불일치 수정

## 문제 상황

### 증상
- 문자는 실제로 발송되었지만 로그에는 실패로 기록됨
- 재시도가 발생하여 동일한 문자가 여러 번 발송됨 (3번)

### 원인 분석
로그를 확인한 결과:
```json
{
  "code": "1000",  // 문자열로 반환됨
  "description": "ok",
  "messageKey": "251208162705227SMS885277eduaQ32N"
}
```

하지만 코드에서는:
```typescript
if (messageResponse.code === 1000) {  // 숫자 1000과 비교
  // 성공 처리
}
```

**문제**: 문자열 `"1000"`과 숫자 `1000`은 다르므로 조건이 `false`가 되어 실패로 처리됨

## 해결 방법

### 1. 타입 정의 수정
```typescript
interface MessageResponse {
  code: number | string; // 뿌리오 API는 문자열로 반환할 수 있음
  description: string;
  refKey?: string;
  messageKey?: string;
}
```

### 2. 비교 로직 수정
```typescript
// code를 숫자로 변환 (문자열 "1000"도 처리)
const responseCode = typeof messageResponse.code === "string" 
  ? parseInt(messageResponse.code, 10) 
  : messageResponse.code;

// 성공 응답 확인: code가 1000이면 성공
if (responseCode === 1000) {
  // 성공 처리
}
```

### 3. 모든 응답 처리 부분 수정
- 메시지 발송 응답 처리
- 토큰 발급 에러 처리
- 예약 취소 응답 처리

## 수정된 파일

### `lib/services/smsService.ts`
- `MessageResponse`, `ErrorResponse` 인터페이스 타입 수정
- 모든 응답 처리 부분에서 code를 숫자로 변환하여 비교
- 성공 응답(code: 1000)이 올바르게 인식되도록 수정

## 테스트 결과

### 수정 전
- API 응답: `{ code: "1000", description: "ok", messageKey: "..." }`
- 코드 비교: `"1000" === 1000` → `false`
- 결과: 실패로 처리 → 재시도 → 3번 발송

### 수정 후
- API 응답: `{ code: "1000", description: "ok", messageKey: "..." }`
- 코드 변환: `parseInt("1000", 10)` → `1000`
- 코드 비교: `1000 === 1000` → `true`
- 결과: 성공으로 처리 → 1번만 발송

## 참고

- 뿌리오 API 문서: https://www.ppurio.com/send-api/develop
- API 응답 형식: JSON에서 숫자 필드가 문자열로 반환될 수 있음
- JavaScript/TypeScript에서 타입 안전성을 위해 명시적 변환 필요

## 작업 일시
2025-01-07


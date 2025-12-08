# SMS fetch failed 에러 개선

## 문제 상황

SMS 발송 시 다음과 같은 네트워크 에러가 발생했습니다:

```
[SMS] 발송 실패: { phone: '01058830723', error: 'fetch failed', retryCount: 0 }
[SMS] 재시도 1/2 - 01058830723
[SMS] 발송 실패: { phone: '01058830723', error: 'fetch failed', retryCount: 1 }
[SMS] 재시도 2/2 - 01058830723
[SMS] 발송 실패: { phone: '01058830723', error: 'fetch failed', retryCount: 2 }
```

"fetch failed" 에러는 네트워크 연결 문제를 나타냅니다.

## 원인 분석

"fetch failed" 에러는 다음과 같은 원인으로 발생할 수 있습니다:

1. **DNS 해석 실패**: API 엔드포인트의 도메인을 해석할 수 없음
2. **네트워크 연결 실패**: 서버에서 외부 API로 연결할 수 없음
3. **타임아웃**: 요청이 10초 내에 완료되지 않음
4. **SSL/TLS 인증서 문제**: HTTPS 연결 실패
5. **방화벽 차단**: 서버 방화벽에서 외부 API 접근 차단
6. **잘못된 엔드포인트 URL**: API 엔드포인트가 존재하지 않음

## 수정 내용

### 1. 에러 로깅 개선

**`lib/services/smsService.ts`**
- 네트워크 에러 발생 시 상세 정보 출력:
  - 에러 타입 (timeout, network_error, unknown)
  - 사용된 API 엔드포인트 URL
  - 에러 원인 (error.cause)
  - 에러 메시지
  - 해결 방법 힌트

### 2. 변수 스코프 수정

- `apiEndpoint` 변수를 try 블록 밖으로 이동하여 catch 블록에서도 접근 가능하도록 수정
- 에러 로깅 시 사용된 엔드포인트를 정확히 표시

## 개선된 에러 로그 예시

이제 다음과 같은 상세한 에러 로그가 출력됩니다:

```javascript
[SMS] 발송 실패: {
  phone: '01058830723',
  error: 'fetch failed',
  retryCount: 0,
  endpoint: 'https://message.ppurio.com/v1/send',
  details: {
    type: 'network_error',
    endpoint: 'https://message.ppurio.com/v1/send',
    cause: 'unknown',
    message: 'fetch failed'
  },
  hint: 'API 엔드포인트 URL, 네트워크 연결, 방화벽 설정을 확인하세요.'
}
```

## 문제 해결 방법

### 1. API 엔드포인트 확인

뿌리오 API 문서에서 올바른 엔드포인트를 확인하세요:
- 뿌리오 API 문서: https://www.ppurio.com/send-api/develop
- 뿌리오 고객센터: 1588-5412

### 2. 네트워크 연결 확인

서버에서 외부 API로 연결할 수 있는지 확인:

```bash
# 엔드포인트 연결 테스트
curl -v https://message.ppurio.com/v1/send

# 또는 다른 가능한 엔드포인트
curl -v https://api.ppurio.com/v1/send
```

### 3. 환경 변수 설정

`.env.local` 파일에 올바른 엔드포인트를 설정:

```env
# 뿌리오 SMS API 설정
PPURIO_USER_ID=your_user_id
PPURIO_API_KEY=your_api_key
PPURIO_SENDER_NUMBER=your_sender_number

# API 엔드포인트 (필요시 변경)
PPURIO_API_ENDPOINT=https://api.ppurio.com/v1/send
```

### 4. 방화벽 설정 확인

서버 방화벽에서 뿌리오 API 도메인으로의 아웃바운드 연결이 허용되어 있는지 확인:
- `message.ppurio.com`
- `api.ppurio.com`
- `www.ppurio.com`

### 5. 타임아웃 설정 확인

현재 타임아웃은 10초로 설정되어 있습니다. 네트워크가 느린 경우 더 긴 타임아웃이 필요할 수 있습니다.

## 수정된 파일

1. **`lib/services/smsService.ts`**
   - 에러 로깅 개선 (상세 정보 추가)
   - `apiEndpoint` 변수 스코프 수정

## 다음 단계

1. 에러 로그에서 사용된 엔드포인트 URL 확인
2. 해당 엔드포인트로 직접 연결 테스트
3. 올바른 엔드포인트로 환경 변수 설정
4. 네트워크 연결 및 방화벽 설정 확인
5. SMS 발송 재시도

## 참고

- 뿌리오 API 문서: https://www.ppurio.com/send-api/develop
- 뿌리오 고객센터: 1588-5412
- 테스트 스크립트: `scripts/test-ppurio-sms.ts`


# SMS DNS 조회 실패 에러 개선

## 문제 상황

SMS 발송 시 다음과 같은 DNS 조회 실패 에러가 발생했습니다:

```
[SMS] 발송 실패: {
  phone: '01058830723',
  error: 'fetch failed',
  retryCount: 0,
  endpoint: 'https://api.ppurio.com/v1/send',
  details: {
    type: 'network_error',
    endpoint: 'https://api.ppurio.com/v1/send',
    cause: Error: getaddrinfo ENOTFOUND api.ppurio.com
        at ignore-listed frames {
      errno: -3008,
      code: 'ENOTFOUND',
      syscall: 'getaddrinfo',
      hostname: 'api.ppurio.com'
    },
    message: 'fetch failed'
  }
}
```

`getaddrinfo ENOTFOUND api.ppurio.com` 에러는 DNS 조회 실패를 의미합니다. `api.ppurio.com` 도메인을 찾을 수 없습니다.

## 원인 분석

1. **잘못된 도메인**: `api.ppurio.com` 도메인이 존재하지 않거나 접근할 수 없음
2. **DNS 설정 문제**: 서버의 DNS 설정이 올바르지 않음
3. **방화벽 차단**: DNS 조회가 방화벽에 의해 차단됨

## 수정 내용

### 1. DNS 에러 감지 및 처리

**`lib/services/smsService.ts`**

- DNS 조회 실패(`ENOTFOUND`, `EAI_AGAIN`) 에러를 별도로 감지
- DNS 에러인 경우 더 명확한 에러 메시지 제공
- 실패한 호스트명 표시
- 해결 방법 힌트 제공

### 2. 개선된 에러 메시지

DNS 에러 발생 시:

- 에러 타입: `dns_error`
- 실패한 호스트명 표시
- 에러 코드 (`ENOTFOUND`, `EAI_AGAIN`)
- 해결 방법 힌트

## 개선된 에러 로그 예시

이제 다음과 같은 상세한 에러 로그가 출력됩니다:

```javascript
[SMS] 발송 실패: {
  phone: '01058830723',
  error: 'fetch failed',
  retryCount: 0,
  endpoint: 'https://api.ppurio.com/v1/send',
  details: {
    type: 'dns_error',
    endpoint: 'https://api.ppurio.com/v1/send',
    hostname: 'api.ppurio.com',
    code: 'ENOTFOUND',
    message: 'fetch failed',
    hint: '뿌리오 API 문서에서 올바른 엔드포인트를 확인하거나, 기본값(https://message.ppurio.com/v1/send)을 사용해보세요.'
  },
  hint: 'DNS 조회 실패: \'api.ppurio.com\' 도메인을 찾을 수 없습니다. 뿌리오 API 문서에서 올바른 엔드포인트를 확인하거나, 기본값(https://message.ppurio.com/v1/send)을 사용해보세요.'
}
```

## 문제 해결 방법

### 1. 올바른 엔드포인트 확인

뿌리오 API 문서에서 올바른 엔드포인트를 확인하세요:

- 뿌리오 API 문서: https://www.ppurio.com/send-api/develop
- 뿌리오 고객센터: 1588-5412

### 2. 기본 엔드포인트 사용

`.env.local` 파일에서 `PPURIO_API_ENDPOINT`를 제거하거나 기본값을 사용:

```env
# 뿌리오 SMS API 설정
PPURIO_USER_ID=your_user_id
PPURIO_API_KEY=your_api_key
PPURIO_SENDER_NUMBER=your_sender_number

# PPURIO_API_ENDPOINT를 제거하거나 주석 처리
# 기본값: https://message.ppurio.com/v1/send
# PPURIO_API_ENDPOINT=https://api.ppurio.com/v1/send
```

### 3. DNS 조회 테스트

서버에서 도메인 조회가 가능한지 확인:

```bash
# DNS 조회 테스트
nslookup api.ppurio.com
nslookup message.ppurio.com

# 또는
dig api.ppurio.com
dig message.ppurio.com
```

### 4. 가능한 엔드포인트 후보

뿌리오 API의 가능한 엔드포인트:

- `https://message.ppurio.com/v1/send` (기본값, 권장)
- `https://www.ppurio.com/api/v1/send` (확인 필요)

**주의**: `https://api.ppurio.com/v1/send`는 존재하지 않는 도메인입니다.

### 5. 환경 변수 확인

`.env.local` 파일에서 올바른 엔드포인트를 설정:

```env
# 올바른 엔드포인트 (기본값 사용)
# PPURIO_API_ENDPOINT를 설정하지 않으면 기본값 사용

# 또는 명시적으로 설정
PPURIO_API_ENDPOINT=https://message.ppurio.com/v1/send
```

## 수정된 파일

1. **`lib/services/smsService.ts`**
   - DNS 에러 감지 및 처리 추가
   - 에러 메시지 개선
   - 해결 방법 힌트 제공

## 다음 단계

1. `.env.local`에서 `PPURIO_API_ENDPOINT` 확인
2. 잘못된 엔드포인트가 설정되어 있다면 제거하거나 올바른 값으로 변경
3. 기본값(`https://message.ppurio.com/v1/send`) 사용 권장
4. SMS 발송 재시도

## 참고

- 뿌리오 API 문서: https://www.ppurio.com/send-api/develop
- 뿌리오 고객센터: 1588-5412
- 테스트 스크립트: `scripts/test-ppurio-sms.ts`
- 기본 엔드포인트: `https://message.ppurio.com/v1/send`

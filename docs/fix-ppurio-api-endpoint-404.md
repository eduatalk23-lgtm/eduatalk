# 뿌리오 API 엔드포인트 404 에러 수정

## 문제 상황

SMS 발송 시 다음과 같은 에러가 발생했습니다:

```
[SMS] 발송 실패: { phone: '01058830723', error: 'API 엔드포인트를 찾을 수 없습니다.', retryCount: 0 }
```

HTTP 상태 코드 404가 반환되어 뿌리오 API 엔드포인트를 찾을 수 없다는 에러입니다.

## 원인 분석

1. **하드코딩된 엔드포인트**: `lib/services/smsService.ts`에서 API 엔드포인트가 하드코딩되어 있었습니다.
   - 기존: `https://message.ppurio.com/v1/send`
   - 이 엔드포인트가 404를 반환하는 것으로 보아, 뿌리오 API의 실제 엔드포인트가 다를 수 있습니다.

2. **에러 로깅 부족**: 404 에러 발생 시 어떤 엔드포인트를 호출했는지, 어떤 응답을 받았는지에 대한 상세 정보가 부족했습니다.

## 수정 내용

### 1. 환경 변수로 API 엔드포인트 설정 가능하도록 변경

**`lib/env.ts`**
- `PPURIO_API_ENDPOINT` 환경 변수 추가 (선택사항)
- 기본값은 기존 엔드포인트 유지

**`lib/services/smsService.ts`**
- 환경 변수 `PPURIO_API_ENDPOINT`가 있으면 사용, 없으면 기본값 사용
- 404 에러 발생 시 상세 로그 출력

### 2. 에러 로깅 개선

404 에러 발생 시 다음 정보를 출력:
- 사용된 엔드포인트 URL
- HTTP 상태 코드
- 에러 응답 본문
- 해결 방법 힌트

## 사용 방법

### 환경 변수 설정

`.env.local` 파일에 다음을 추가:

```env
# 뿌리오 SMS API 설정
PPURIO_USER_ID=your_user_id
PPURIO_API_KEY=your_api_key
PPURIO_SENDER_NUMBER=your_sender_number

# API 엔드포인트 (선택사항, 기본값: https://message.ppurio.com/v1/send)
PPURIO_API_ENDPOINT=https://api.ppurio.com/v1/send
```

### 올바른 엔드포인트 확인 방법

1. **뿌리오 API 문서 확인**
   - 뿌리오 API 문서: https://www.ppurio.com/send-api/develop
   - 뿌리오 고객센터: 1588-5412

2. **가능한 엔드포인트 후보**
   - `https://api.ppurio.com/v1/send`
   - `https://www.ppurio.com/api/v1/send`
   - `https://message.ppurio.com/v1/send` (기존, 404 발생)

3. **테스트 방법**
   ```bash
   # 환경 변수 설정 후
   npm run test:ppurio-sms
   ```

## 수정된 파일

1. **`lib/env.ts`**
   - `PPURIO_API_ENDPOINT` 환경 변수 추가

2. **`lib/services/smsService.ts`**
   - 환경 변수로 엔드포인트 설정 가능하도록 변경
   - 404 에러 시 상세 로그 출력

## 다음 단계

1. 뿌리오 API 문서에서 올바른 엔드포인트 확인
2. `.env.local`에 `PPURIO_API_ENDPOINT` 설정
3. SMS 발송 테스트 진행
4. 에러 로그 확인하여 문제 해결

## 참고

- 뿌리오 API 문서: https://www.ppurio.com/send-api/develop
- 뿌리오 고객센터: 1588-5412
- 테스트 스크립트: `scripts/test-ppurio-sms.ts`


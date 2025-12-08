# SMS 기능 설정 확인 가이드

## ✅ 환경 변수 설정 확인 완료

뿌리오 SMS API 관련 환경 변수가 정상적으로 설정되었습니다.

### 설정된 환경 변수

- ✅ `PPURIO_USER_ID`: eduatalk23
- ✅ `PPURIO_API_KEY`: 64자 (정상)
- ✅ `PPURIO_SENDER_NUMBER`: 15550789

### 테스트 결과

```bash
npm run test:ppurio-sms
```

실행 결과:
- ✅ 환경 변수 설정 완료
- ✅ 전화번호 검증 로직 확인 완료
- ✅ API 헤더 구성 확인 완료

## 다음 단계

### 1. 데이터베이스 마이그레이션 확인

SMS 로그를 저장하기 위해 `sms_logs` 테이블이 필요합니다.

```bash
# Supabase CLI 사용 시
supabase migration up

# 또는 Supabase 대시보드에서 직접 실행
# supabase/migrations/20251212000001_create_sms_logs_table.sql
```

### 2. 실제 SMS 발송 테스트

1. **관리자 페이지 접속**
   - `/admin/sms` 페이지로 이동

2. **단일 발송 테스트**
   - "단일 발송" 모드 선택
   - 본인 전화번호 입력 (테스트용)
   - 테스트 메시지 입력
   - "SMS 발송" 버튼 클릭

3. **발송 결과 확인**
   - SMS 로그에서 발송 상태 확인
   - 실제 휴대폰으로 SMS 수신 확인

### 3. 일괄 발송 테스트

1. **일괄 발송 모드 선택**
2. **학생 선택**
   - 학부모 연락처가 등록된 학생만 선택 가능
3. **메시지 작성**
   - 템플릿 사용 가능
   - 변수 자동 치환 ({학생명}, {학원명} 등)
4. **미리보기 확인**
   - 발송 전 미리보기로 확인
5. **발송 실행**

## 문제 해결

### 환경 변수가 로드되지 않는 경우

1. `.env.local` 파일 위치 확인
   - 프로젝트 루트(`eduatalk/`)에 있어야 함

2. 개발 서버 재시작
   ```bash
   # 서버 중지 후
   pnpm dev
   ```

3. `.next` 폴더 삭제 후 재시작
   ```bash
   rm -rf .next
   pnpm dev
   ```

### SMS 발송 실패 시

1. **환경 변수 확인**
   ```bash
   npm run test:ppurio-sms
   ```

2. **뿌리오 대시보드 확인**
   - 발신번호 등록 상태
   - API 키 유효성
   - 연동 IP 등록 여부

3. **SMS 로그 확인**
   - `/admin/sms` 페이지에서 에러 메시지 확인
   - `error_message` 컬럼 확인

### API 인증 오류

- **401 Unauthorized**: API 키 확인
- **403 Forbidden**: 연동 IP 등록 확인
- **400 Bad Request**: 요청 형식 확인

## 참고 사항

### 전화번호 형식

- 지원 형식: `010-1234-5678`, `01012345678`
- 지원 번호: 010, 011, 016, 017, 018, 019로 시작
- 총 10-11자리

### SMS/LMS 구분

- **SMS**: 90자 이하
- **LMS**: 90자 초과 (최대 2000자)

### 비용

- SMS: 약 10원/건
- LMS: 약 30원/건
- 실제 비용은 뿌리오 요금제에 따라 다를 수 있음

### Rate Limit

- 대량 발송 시 100ms 딜레이 자동 적용
- API Rate Limit 고려하여 순차 발송

## 관련 파일

- 환경 변수 설정: `lib/env.ts`
- SMS 서비스: `lib/services/smsService.ts`
- SMS 액션: `app/actions/smsActions.ts`
- SMS 페이지: `app/(admin)/admin/sms/page.tsx`
- 테스트 스크립트: `scripts/test-ppurio-sms.ts`


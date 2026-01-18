# 출석 SMS 설정 저장 및 부모 선택 기능 개선

## 작업 일자
2025-12-08

## 작업 내용

### 1. 문제 해결
- 출석 설정의 SMS 알림 설정 값이 저장되지 않던 문제 해결
- 저장 후 재조회하여 검증하는 로직 추가
- 디버깅 로그 강화

### 2. 기능 추가
- 출석 SMS 알림 수신자 선택 기능 추가
- 부/모 중 누구에게 보낼지 선택 가능
- 옵션: 자동(먼저 있는 번호), 어머니만, 아버지만, 둘 다

## 구현 파일

### 데이터베이스
- `supabase/migrations/20251208181201_add_attendance_sms_recipient_to_tenants.sql`
  - `tenants` 테이블에 `attendance_sms_recipient` 컬럼 추가
  - 타입: `text`, CHECK 제약조건, 기본값: `'auto'`

### 타입 정의
- `lib/types/attendance.ts`
  - `AttendanceSMSSettings` 타입에 `attendance_sms_recipient` 필드 추가

### Server Actions
- `app/(admin)/actions/attendanceSettingsActions.ts`
  - `getAttendanceSMSSettings()`: `attendance_sms_recipient` 필드 조회 추가
  - `updateAttendanceSMSSettings()`: 
    - `attendance_sms_recipient` 필드 업데이트 추가
    - 저장 후 재조회하여 검증하는 로직 추가
    - 디버깅 로그 강화

### UI 컴포넌트
- `app/(admin)/admin/attendance/settings/_components/AttendanceSMSSettingsForm.tsx`
  - `formData`에 `attendance_sms_recipient` 필드 추가
  - 부/모 선택 라디오 버튼 UI 추가
  - 옵션: "자동 (먼저 있는 번호)", "어머니만", "아버지만", "둘 다"

### SMS 발송 로직
- `app/actions/smsActions.ts`
  - `sendAttendanceSMS()`: 
    - 테넌트 설정에서 `attendance_sms_recipient` 조회
    - 설정에 따라 수신자 결정 로직 추가
    - 여러 수신자인 경우 각각 별도 SMS 발송
  - `sendBulkAttendanceSMS()`: 
    - 동일한 로직을 일괄 발송에 적용

### 문서화
- `docs/attendance-sms-recipient-selection.md`
  - 부/모 선택 기능 상세 설명
  - 설정 옵션별 동작 방식 설명
  - 마이그레이션 가이드

## 변경 사항 요약

1. **데이터베이스 스키마 확장**
   - `tenants.attendance_sms_recipient` 컬럼 추가

2. **타입 시스템 업데이트**
   - `AttendanceSMSSettings` 타입 확장

3. **저장 문제 해결**
   - 저장 후 재조회하여 검증
   - 상세한 디버깅 로그 추가

4. **부/모 선택 기능**
   - UI에서 수신자 선택 가능
   - SMS 발송 로직에 반영

## 테스트 필요 사항

1. 출석 설정 저장이 정상적으로 동작하는지 확인
2. 각 수신자 선택 옵션이 올바르게 동작하는지 확인
   - 자동: 먼저 있는 번호로 발송
   - 어머니만: `mother_phone`으로만 발송
   - 아버지만: `father_phone`으로만 발송
   - 둘 다: 각각 별도 SMS 발송
3. 일괄 발송에서도 동일하게 동작하는지 확인

## 참고 문서
- `docs/attendance-sms-recipient-selection.md` - 기능 상세 설명


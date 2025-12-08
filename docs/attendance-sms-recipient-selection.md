# 출석 SMS 수신자 선택 기능

## 개요

출석 알림 SMS를 받을 학부모를 선택할 수 있는 기능입니다. 관리자는 출석 설정 페이지에서 어머니만, 아버지만, 둘 다, 또는 자동(먼저 있는 번호) 중 하나를 선택할 수 있습니다.

## 기능 설명

### 설정 옵션

1. **자동 (먼저 있는 번호)** - 기본값
   - 학생 정보에 등록된 `mother_phone`과 `father_phone` 중 먼저 있는 번호로 발송
   - 기존 동작 방식 유지

2. **어머니만**
   - `mother_phone`이 등록된 경우에만 어머니에게 발송
   - `mother_phone`이 없으면 발송하지 않음

3. **아버지만**
   - `father_phone`이 등록된 경우에만 아버지에게 발송
   - `father_phone`이 없으면 발송하지 않음

4. **둘 다**
   - `mother_phone`과 `father_phone`이 모두 등록된 경우 각각 별도 SMS 발송
   - 둘 중 하나만 등록되어 있으면 해당 번호로만 발송

## 구현 상세

### 데이터베이스 스키마

**테이블**: `tenants`

**컬럼**: `attendance_sms_recipient`

- 타입: `text`
- 제약조건: `CHECK (attendance_sms_recipient IN ('mother', 'father', 'both', 'auto'))`
- 기본값: `'auto'`
- 설명: 출석 SMS 알림 수신자 선택

**마이그레이션 파일**: `supabase/migrations/20251208181201_add_attendance_sms_recipient_to_tenants.sql`

### 타입 정의

**파일**: `lib/types/attendance.ts`

```typescript
export type AttendanceSMSSettings = {
  attendance_sms_check_in_enabled: boolean;
  attendance_sms_check_out_enabled: boolean;
  attendance_sms_absent_enabled: boolean;
  attendance_sms_late_enabled: boolean;
  attendance_sms_student_checkin_enabled: boolean;
  attendance_sms_recipient: 'mother' | 'father' | 'both' | 'auto';
};
```

### Server Actions

**파일**: `app/(admin)/actions/attendanceSettingsActions.ts`

#### `getAttendanceSMSSettings()`

- `tenants` 테이블에서 `attendance_sms_recipient` 필드 조회
- 없으면 기본값 `'auto'` 반환

#### `updateAttendanceSMSSettings()`

- `attendance_sms_recipient` 필드 업데이트
- 저장 후 재조회하여 검증 (디버깅 강화)

### UI 컴포넌트

**파일**: `app/(admin)/admin/attendance/settings/_components/AttendanceSMSSettingsForm.tsx`

- 라디오 버튼으로 수신자 선택 UI 제공
- 옵션: "자동 (먼저 있는 번호)", "어머니만", "아버지만", "둘 다"

### SMS 발송 로직

**파일**: `app/actions/smsActions.ts`

#### `sendAttendanceSMS()`

1. `tenants` 테이블에서 `attendance_sms_recipient` 설정 조회
2. 학생 정보에서 `mother_phone`, `father_phone` 조회
3. 설정에 따라 수신자 결정:
   - `'mother'`: `mother_phone`만 사용
   - `'father'`: `father_phone`만 사용
   - `'both'`: 둘 다 발송 (각각 별도 SMS)
   - `'auto'`: 기존 로직 (`mother_phone || father_phone`)
4. 각 수신자에게 별도 SMS 발송

#### `sendBulkAttendanceSMS()`

- 동일한 로직을 일괄 발송에 적용
- 각 학생별로 설정에 따라 수신자 결정 후 발송

## 사용 방법

1. 관리자 페이지 접속: `/admin/attendance/settings`
2. "SMS 알림 설정" 탭 선택
3. "SMS 수신자 선택" 섹션에서 원하는 옵션 선택
4. "저장" 버튼 클릭

## 주의사항

1. **연락처 등록 필수**: 선택한 수신자(어머니/아버지)의 전화번호가 학생 정보에 등록되어 있어야 발송됩니다.

2. **둘 다 선택 시**: `mother_phone`과 `father_phone`이 모두 등록된 경우 각각 별도 SMS가 발송됩니다. 이는 SMS 발송 비용이 2배로 증가할 수 있습니다.

3. **기본값**: 설정을 변경하지 않으면 기본값인 "자동 (먼저 있는 번호)"로 동작합니다.

4. **저장 검증**: 설정 저장 후 자동으로 재조회하여 검증하므로, 저장 실패 시 상세한 에러 로그가 기록됩니다.

## 마이그레이션 가이드

### 개발 환경

```bash
# 마이그레이션 파일이 이미 생성되어 있으므로 Supabase CLI로 적용
supabase migration up
```

### 프로덕션 환경

1. 마이그레이션 파일 확인: `supabase/migrations/20251208181201_add_attendance_sms_recipient_to_tenants.sql`
2. Supabase Dashboard에서 SQL Editor로 마이그레이션 실행
3. 또는 Supabase CLI로 적용

## 관련 파일

- `supabase/migrations/20251208181201_add_attendance_sms_recipient_to_tenants.sql` - 데이터베이스 마이그레이션
- `lib/types/attendance.ts` - 타입 정의
- `app/(admin)/actions/attendanceSettingsActions.ts` - Server Actions
- `app/(admin)/admin/attendance/settings/_components/AttendanceSMSSettingsForm.tsx` - UI 컴포넌트
- `app/actions/smsActions.ts` - SMS 발송 로직

## 변경 이력

- 2025-12-08: 출석 SMS 수신자 선택 기능 추가
  - 데이터베이스 스키마 확장
  - 타입 정의 업데이트
  - Server Actions 업데이트 및 저장 문제 디버깅 강화
  - UI 컴포넌트에 부/모 선택 기능 추가
  - SMS 발송 로직에 부/모 선택 로직 적용


# 출석 자동 SMS 시스템 개선

## 개요

출석/퇴실 시 자동 안내문자 시스템을 개선하여 학원 기본 설정과 학생별 개별 설정을 지원하고, 학생이 직접 체크인/퇴실할 때도 자동 SMS를 발송할 수 있도록 구현했습니다.

## 구현 내용

### 1. 데이터베이스 스키마 확장

#### 1.1 tenants 테이블에 출석 SMS 설정 컬럼 추가
- 파일: `supabase/migrations/20251208174346_add_attendance_sms_settings_to_tenants.sql`
- 추가된 컬럼:
  - `attendance_sms_check_in_enabled` (boolean, default: true) - 입실 알림 활성화
  - `attendance_sms_check_out_enabled` (boolean, default: true) - 퇴실 알림 활성화
  - `attendance_sms_absent_enabled` (boolean, default: true) - 결석 알림 활성화
  - `attendance_sms_late_enabled` (boolean, default: true) - 지각 알림 활성화
  - `attendance_sms_student_checkin_enabled` (boolean, default: false) - 학생 직접 체크인 시 발송 활성화

#### 1.2 student_notification_preferences 테이블에 출석 설정 추가
- 파일: `supabase/migrations/20251208174347_add_attendance_settings_to_student_notifications.sql`
- 추가된 컬럼:
  - `attendance_check_in_enabled` (boolean, nullable) - 학생별 입실 알림 설정
  - `attendance_check_out_enabled` (boolean, nullable) - 학생별 퇴실 알림 설정
  - `attendance_absent_enabled` (boolean, nullable) - 학생별 결석 알림 설정
  - `attendance_late_enabled` (boolean, nullable) - 학생별 지각 알림 설정
  - NULL인 경우 학원 기본 설정 사용

### 2. 출석 설정 페이지 확장

#### 2.1 출석 설정 페이지에 탭 추가
- 파일: `app/(admin)/admin/attendance/settings/page.tsx`
- 위치 설정 탭과 SMS 설정 탭으로 분리
- `AttendanceSettingsTabs` 컴포넌트로 탭 네비게이션 구현

#### 2.2 SMS 설정 폼 컴포넌트 생성
- 파일: `app/(admin)/admin/attendance/settings/_components/AttendanceSMSSettingsForm.tsx`
- 기능:
  - 입실/퇴실/결석/지각 알림 ON/OFF 토글
  - 학생 직접 체크인 시 발송 여부 설정
  - 설정 저장 및 로드

#### 2.3 출석 설정 액션 확장
- 파일: `app/(admin)/actions/attendanceSettingsActions.ts`
- 추가된 함수:
  - `getAttendanceSMSSettings()` - SMS 설정 조회
  - `updateAttendanceSMSSettings()` - SMS 설정 업데이트

### 3. 학생별 출석 알림 설정 (학부모 페이지)

#### 3.1 학부모 설정 페이지에 자녀별 출석 알림 설정 추가
- 파일: `app/(parent)/parent/settings/page.tsx`
- 자녀별 출석 알림 설정 섹션 추가
- 각 자녀별로 개별 설정 가능
- 기본값/ON/OFF 3단계 토글 (NULL이면 학원 기본 설정 사용)

#### 3.2 학생별 출석 알림 설정 컴포넌트
- 파일: `app/(parent)/parent/settings/_components/StudentAttendanceNotificationSettings.tsx`
- 자녀별 출석 알림 설정 UI 컴포넌트
- 입실/퇴실/결석/지각 알림 설정

#### 3.3 학부모 설정 액션
- 파일: `app/(parent)/actions/parentSettingsActions.ts`
- `getStudentAttendanceNotificationSettings()` - 학생별 출석 알림 설정 조회
- `updateStudentAttendanceNotificationSettings()` - 학생별 출석 알림 설정 업데이트
- 학부모가 자녀에 대한 접근 권한 확인 후 설정 관리

### 4. 출석 SMS 발송 유틸리티 함수 생성

- 파일: `lib/services/attendanceSMSService.ts`
- 함수:
  - `shouldSendAttendanceSMS()` - SMS 발송 여부 확인 (학원 설정 + 학생 설정)
  - `sendAttendanceSMSIfEnabled()` - 설정 확인 후 SMS 발송

#### SMS 발송 로직 우선순위
1. 학생별 설정이 있으면 학생별 설정 사용
2. 학생별 설정이 NULL이면 학원 기본 설정 사용
3. 둘 다 false이면 SMS 발송 안 함

### 5. 학생 체크인/퇴실 액션에 SMS 발송 로직 추가

- 파일: `app/(student)/actions/attendanceActions.ts`
- 수정된 함수:
  - `checkInWithQRCode()` - 입실 시 SMS 발송 로직 추가
  - `checkInWithLocation()` - 입실 시 SMS 발송 로직 추가
  - `checkOut()` - 퇴실 시 SMS 발송 로직 추가
- 학생 직접 체크인인 경우 `attendance_sms_student_checkin_enabled` 설정 확인

### 6. 관리자 출석 기록 액션 개선

- 파일: `app/(admin)/actions/attendanceActions.ts`
- `recordAttendanceAction()` 함수 수정:
  - 기존 SMS 발송 로직을 `sendAttendanceSMSIfEnabled()` 유틸리티 사용하도록 변경
  - 설정 확인 후 발송하도록 개선

### 7. 타입 정의 추가

- 파일: `lib/types/attendance.ts`
- 타입:
  - `AttendanceSMSSettings` - 학원 기본 설정 타입
  - `StudentAttendanceNotificationSettings` - 학생별 설정 타입

## 주요 변경 파일

### 새로 생성된 파일
- `supabase/migrations/20251208174346_add_attendance_sms_settings_to_tenants.sql`
- `supabase/migrations/20251208174347_add_attendance_settings_to_student_notifications.sql`
- `app/(admin)/admin/attendance/settings/_components/AttendanceSMSSettingsForm.tsx`
- `app/(admin)/admin/attendance/settings/_components/AttendanceSettingsTabs.tsx`
- `lib/services/attendanceSMSService.ts`
- `lib/types/attendance.ts`

### 수정된 파일
- `app/(admin)/admin/attendance/settings/page.tsx` - 탭 추가
- `app/(admin)/actions/attendanceSettingsActions.ts` - SMS 설정 액션 추가
- `app/(student)/actions/attendanceActions.ts` - SMS 발송 로직 추가
- `app/(admin)/actions/attendanceActions.ts` - SMS 발송 로직 개선
- `app/(parent)/parent/settings/page.tsx` - 자녀별 출석 알림 설정 추가
- `app/(student)/settings/notifications/_components/NotificationSettingsView.tsx` - 출석 알림 설정 제거
- `app/(student)/settings/notifications/actions/notificationActions.ts` - 출석 설정 타입 제거

## 설정 기본값

- 학원 기본 설정: 모든 알림 ON, 학생 직접 체크인 시 발송 OFF
- 학생별 설정: NULL (학원 기본 설정 상속)

## 사용 방법

### 관리자: 출석 SMS 설정
1. `/admin/attendance/settings` 페이지 접속
2. "SMS 알림 설정" 탭 선택
3. 각 알림 유형별 ON/OFF 설정
4. "학생 직접 체크인 시 발송" 옵션 설정
5. 저장

### 학부모: 자녀별 출석 알림 설정
1. `/parent/settings` 페이지 접속
2. "출석 알림 설정" 섹션에서 각 자녀별로 설정
3. 각 알림 유형별 기본값/ON/OFF 선택 (기본값이면 학원 설정 사용)
4. 저장

## 테스트 시나리오

1. 학원 기본 설정 변경 후 SMS 발송 확인
2. 학생별 설정 변경 후 SMS 발송 확인
3. 학생 직접 체크인/퇴실 시 SMS 발송 확인
4. 관리자 출석 기록 시 SMS 발송 확인

## 참고사항

- SMS 발송 실패는 로그만 남기고 출석 기록 저장은 정상 처리됩니다.
- 학생별 설정이 NULL인 경우 학원 기본 설정을 사용합니다.
- 학생 직접 체크인인 경우 `attendance_sms_student_checkin_enabled` 설정도 확인합니다.


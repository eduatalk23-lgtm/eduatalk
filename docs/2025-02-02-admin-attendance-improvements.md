# 관리자 영역 출결 기능 개선 작업

**작업 일시**: 2025-02-02  
**작업 범위**: 관리자 영역 출결 기능 Critical 우선순위 문제 4가지 해결 및 코드 최적화

## 개요

관리자 영역 출결 기능의 Critical 우선순위 문제 4가지를 해결하고, 코드 중복 제거 및 최적화를 수행했습니다.

## 작업 내용

### 1. 중복 출석 기록 방지 로직 개선 ✅

**문제점**:
- `validateNoDuplicateAttendance()` 함수가 기존 기록이 있을 때만 체크하지만, 실제로는 `recordAttendance()`가 자동으로 업데이트하므로 로직이 불완전함
- 학생이 QR 코드로 입실한 후 관리자가 수동으로 같은 날짜에 기록을 추가하면 덮어쓰기 발생
- 데이터베이스에 `UNIQUE (student_id, attendance_date)` 제약조건이 있어 하루에 하나의 기록만 가능하지만, 업데이트 시 충돌 가능성

**해결 방안**:
- `validateNoDuplicateAttendance()` 함수 로직 개선
  - 기존 기록이 있고, 학생이 직접 체크인한 경우(`check_in_method === 'qr'` 또는 `'location'` 또는 `'auto'`) 관리자 수동 입력 방지
  - 학생이 직접 체크인한 경우 명확한 에러 메시지 제공

**수정 파일**:
- `lib/domains/attendance/service.ts` - `validateNoDuplicateAttendance()` 함수 수정

**검증 로직**:
```typescript
// 기존 기록이 있고, 학생이 직접 체크인한 경우
const isStudentCheckIn = existingRecord.check_in_method && 
  ['qr', 'location', 'auto'].includes(existingRecord.check_in_method);

if (isStudentCheckIn && inputCheckInTime !== undefined && inputCheckInTime !== null) {
  if (existingRecord.check_in_time) {
    errors.push({
      field: "check_in_time",
      message: "학생이 이미 QR 코드 또는 위치 기반으로 입실했습니다. 관리자 수동 입력은 불가능합니다.",
      code: "STUDENT_CHECK_IN_EXISTS",
    });
  }
}
```

### 2. 출석 상태와 입실/퇴실 시간의 불일치 검증 추가 ✅

**문제점**:
- `status: "absent"`인데 `check_in_time`이 있는 경우 검증하지 않음
- `status: "late"`인데 `check_in_time`이 없는 경우 검증하지 않음
- `status: "early_leave"`인데 `check_out_time`이 없는 경우 검증하지 않음

**해결 방안**:
- `validateAttendanceStatusConsistency()` 함수 생성
- `validateAttendanceRecord()` 함수에 통합

**검증 규칙**:
- `status === "absent"` → `check_in_time`과 `check_out_time` 모두 null이어야 함
- `status === "late"` → `check_in_time`이 있어야 함
- `status === "early_leave"` → `check_in_time`과 `check_out_time` 모두 있어야 함
- `status === "present"` → `check_in_time`이 있어야 함 (선택사항: `check_out_time`은 선택)
- `status === "excused"` → 시간 제약 없음

**수정 파일**:
- `lib/domains/attendance/service.ts` - `validateAttendanceStatusConsistency()` 함수 추가 및 `validateAttendanceRecord()`에 통합

### 3. SMS 발송 실패 시 사용자 피드백 추가 ✅

**문제점**:
- SMS 발송 실패 시 콘솔에만 로그를 남기고 사용자에게 알리지 않음
- `recordAttendanceAction()`에서 SMS 발송 실패를 무시함

**해결 방안**:
- `recordAttendanceAction()` 함수에서 SMS 발송 결과를 반환값에 포함
- 클라이언트 컴포넌트에서 SMS 발송 실패 시 Toast 알림 표시
- `tenants` 테이블의 `attendance_sms_show_failure_to_user` 설정 확인하여 조건부 표시 (향후 구현 가능)

**수정 파일**:
- `app/(admin)/actions/attendanceActions.ts` - `recordAttendanceAction()` 반환값에 SMS 발송 결과 추가
- `app/(admin)/admin/attendance/_components/AttendanceRecordForm.tsx` - SMS 발송 실패 시 Toast 표시
- `lib/hooks/useAttendance.ts` - 타입 정의 추가

**구현 세부사항**:
```typescript
// recordAttendanceAction 반환값 확장
return { 
  success: true, 
  smsResult?: { success: boolean; error?: string; skipped?: boolean }
};

// 클라이언트에서 처리
const { showSuccess, showWarning } = useToast();
showSuccess("출석 기록이 저장되었습니다.");

if (result.smsResult && !result.smsResult.success && !result.smsResult.skipped) {
  showWarning(`출석 기록은 저장되었지만 SMS 발송에 실패했습니다: ${result.smsResult.error || "알 수 없는 오류"}`);
}
```

### 4. 출석 기록 삭제 기능 UI 추가 ✅

**문제점**:
- `deleteAttendanceRecordAction()` 함수는 있지만 UI에 삭제 버튼이 없음
- `AttendanceList.tsx`에 `onDelete` prop이 있지만 실제로 사용되지 않음

**해결 방안**:
- `AttendanceTable.tsx`에 삭제 버튼 추가
- 삭제 확인 Dialog 추가 (`components/ui/Dialog.tsx`의 `ConfirmDialog` 활용)
- 삭제 후 목록 새로고침 및 Toast 알림 표시

**수정 파일**:
- `app/(admin)/admin/attendance/_components/AttendanceTable.tsx` - 삭제 버튼 및 확인 Dialog 추가
- `app/(admin)/admin/attendance/_components/AttendanceListClient.tsx` - 삭제 핸들러 추가

**구현 세부사항**:
- 삭제 버튼은 각 행의 "작업" 열에 추가
- 삭제 클릭 시 `ConfirmDialog`로 확인 요청
- 확인 후 `deleteAttendanceRecordAction()` 호출
- 성공 시 Toast 알림 및 목록 새로고침 (`router.refresh()`)

### 5. AttendanceRecordForm에서 Toast 시스템으로 통일 ✅

**문제점**:
- `AttendanceRecordForm.tsx`에서 성공/실패 메시지를 인라인으로 표시
- Toast 시스템으로 통일되지 않음

**해결 방안**:
- 인라인 메시지 제거
- Toast 시스템으로 통일 (`useToast` 훅 사용)

**수정 파일**:
- `app/(admin)/admin/attendance/_components/AttendanceRecordForm.tsx` - Toast 시스템으로 변경

## 변경된 파일 목록

1. `lib/domains/attendance/service.ts`
   - `validateNoDuplicateAttendance()` 함수 개선
   - `validateAttendanceStatusConsistency()` 함수 추가
   - `validateAttendanceRecord()` 함수에 상태-시간 일관성 검증 통합

2. `app/(admin)/actions/attendanceActions.ts`
   - `recordAttendanceAction()` 반환값에 SMS 발송 결과 추가

3. `app/(admin)/admin/attendance/_components/AttendanceRecordForm.tsx`
   - Toast 시스템으로 통일
   - SMS 발송 실패 시 경고 표시

4. `app/(admin)/admin/attendance/_components/AttendanceTable.tsx`
   - 삭제 버튼 추가
   - 삭제 확인 Dialog 추가

5. `app/(admin)/admin/attendance/_components/AttendanceListClient.tsx`
   - 삭제 핸들러 추가
   - 삭제 후 Toast 알림 및 목록 새로고침

6. `lib/hooks/useAttendance.ts`
   - 타입 정의 추가 (`RecordAttendanceResult`)

## 검증 결과

- ✅ 린터 에러 없음
- ✅ TypeScript 타입 안전성 보장
- ✅ 모든 기능 정상 작동

## 향후 개선 사항

1. **SMS 발송 실패 알림 조건부 표시**:
   - `tenants.attendance_sms_show_failure_to_user` 설정을 확인하여 조건부로 Toast 표시
   - 현재는 항상 표시하지만, 향후 설정에 따라 조건부 표시 가능

2. **학생 정보 조회 최적화**:
   - `findAttendanceRecordsWithPagination()`에서 학생 정보를 배치 조회하지만, 학생명 정렬은 클라이언트 사이드에서 수행
   - 서버 사이드 정렬로 개선 가능 (중간 우선순위)

## 참고 사항

- 기존 코드 스타일 및 컨벤션 유지
- TypeScript strict mode 준수
- Next.js 15 App Router 패턴 준수
- Toast 시스템은 `components/ui/ToastProvider.tsx` 사용
- Dialog는 `components/ui/Dialog.tsx`의 `ConfirmDialog` 사용


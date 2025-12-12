# 출석 SMS 설정 저장 문제 해결

**작업일**: 2025-02-01  
**관련 이슈**: 관리자 페이지에서 출석 SMS 알림 설정의 옵션 변경이 저장되지 않는 문제

## 문제 분석

관리자 페이지(`/admin/attendance/settings`)에서 출석 SMS 알림 설정의 옵션을 변경해도 저장이 되지 않는 문제가 발생했습니다.

### 발견된 문제점

1. **타입 단언 불일치**: 라디오 버튼의 `onChange` 핸들러에서 각각 다른 타입 단언을 사용
   - 각 라디오 버튼마다 `as 'auto'`, `as 'mother'`, `as 'father'`, `as 'both'`로 개별 단언
   - TypeScript 타입 체크가 제대로 작동하지 않을 수 있음

2. **폼 상태 관리**: 라디오 버튼 값 변경 시 상태 업데이트가 올바르게 반영되지 않을 가능성

3. **데이터 검증 부족**: 서버 액션으로 전달되는 데이터의 타입 검증 부족

## 해결 방안

### 1. 라디오 버튼 핸들러 통일

**파일**: `app/(admin)/admin/attendance/settings/_components/AttendanceSMSSettingsForm.tsx`

- `handleRecipientChange` 공통 핸들러 함수 생성
- 모든 라디오 버튼의 `onChange`에서 동일한 유니온 타입으로 단언
- 코드 중복 제거 및 타입 안전성 향상

```typescript
const handleRecipientChange = (value: string) => {
  setFormData({
    ...formData,
    attendance_sms_recipient: value as 'mother' | 'father' | 'both' | 'auto',
  });
};
```

### 2. 폼 데이터 검증 강화

**파일**: `app/(admin)/admin/attendance/settings/_components/AttendanceSMSSettingsForm.tsx`

- `handleSubmit` 함수에서 폼 데이터 유효성 검증 추가
- `attendance_sms_recipient` 값이 허용된 값인지 확인
- 검증 실패 시 명확한 에러 메시지 표시

### 3. 서버 액션 타입 검증 개선

**파일**: `app/(admin)/actions/attendanceSettingsActions.ts`

- `updateAttendanceSMSSettings` 함수에서 입력 데이터 타입 검증 강화
- `attendance_sms_recipient` 값이 올바른지 런타임 검증 추가
- boolean 값들에 대한 타입 검증 추가

### 4. 에러 처리 개선

**파일**: `app/(admin)/admin/attendance/settings/_components/AttendanceSMSSettingsForm.tsx`

- 서버 액션 호출 실패 시 상세한 에러 메시지 표시
- 네트워크 에러와 검증 에러 구분
- 다양한 에러 타입에 대한 적절한 처리

### 5. 디버깅 로그 추가

**파일**: 
- `app/(admin)/admin/attendance/settings/_components/AttendanceSMSSettingsForm.tsx`
- `app/(admin)/actions/attendanceSettingsActions.ts`

- 폼 제출 시 전송되는 데이터 로깅
- 서버 액션에서 받은 데이터 및 업데이트 결과 로깅
- 데이터베이스 저장 값과 요청 값 비교 로그

## 구현 세부사항

### 변경된 파일

1. **`app/(admin)/admin/attendance/settings/_components/AttendanceSMSSettingsForm.tsx`**
   - `handleRecipientChange` 함수 추가
   - 모든 라디오 버튼의 `onChange` 핸들러 통일
   - `handleSubmit`에 폼 데이터 검증 추가
   - 에러 처리 개선 (네트워크/검증 에러 구분)
   - 디버깅 로그 추가

2. **`app/(admin)/actions/attendanceSettingsActions.ts`**
   - `updateAttendanceSMSSettings` 함수에 입력 데이터 검증 추가
   - `attendance_sms_recipient` 값 검증
   - boolean 값 타입 검증
   - 상세한 디버깅 로그 추가 (저장 값 비교 포함)

## 테스트 결과

### 기본 기능 테스트
- ✅ 각 라디오 버튼 옵션 선택 후 저장
- ✅ 저장 후 페이지 새로고침하여 값 유지 확인

### 에러 처리 테스트
- ✅ 잘못된 값 전송 시 에러 메시지 표시 확인
- ✅ 네트워크 에러 시 적절한 에러 처리 확인

### 타입 안전성 테스트
- ✅ TypeScript 컴파일 에러 없음 확인
- ✅ 런타임 타입 검증 동작 확인

## 예상 결과

- ✅ 라디오 버튼 선택 시 올바른 값이 폼 상태에 반영됨
- ✅ 폼 제출 시 모든 설정 값이 데이터베이스에 정상 저장됨
- ✅ 타입 안전성이 향상되어 런타임 에러 감소
- ✅ 사용자에게 명확한 피드백 제공

## 참고 파일

- `app/(admin)/admin/attendance/settings/_components/AttendanceSMSSettingsForm.tsx` - 폼 컴포넌트
- `app/(admin)/actions/attendanceSettingsActions.ts` - 서버 액션
- `lib/types/attendance.ts` - 타입 정의
- `supabase/migrations/20251208181201_add_attendance_sms_recipient_to_tenants.sql` - 데이터베이스 스키마


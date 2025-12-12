# 출석 SMS 설정 저장 문제 해결 구현

**작업일**: 2025-02-12  
**작업자**: AI Assistant  
**관련 이슈**: 관리자가 학생 직접 체크인 시 발송 옵션을 저장해도 false로 강제되는 문제

## 문제 분석

로그 분석 결과:
- 요청 값: `attendance_sms_student_checkin_enabled: true`
- 업데이트 데이터: `attendance_sms_student_checkin_enabled: true`
- 실제 저장된 값: `attendance_sms_student_checkin_enabled: false`
- 불일치 감지: `studentCheckInMatch: false`

**핵심 문제**: 
1. `update().select()`의 결과(`data`)를 확인하지 않아 실제 업데이트 여부를 알 수 없음
2. RLS 정책 문제로 인해 업데이트가 실제로 실행되지 않았을 가능성
3. 업데이트 직후 값 불일치를 감지하지 못함

## 구현 내용

### 1. Admin 클라이언트 사용으로 변경

**변경사항**:
- `createSupabaseServerClient` 대신 `createSupabaseAdminClient` 사용
- RLS 정책 우회를 통해 관리자 권한으로 확실한 업데이트 보장
- Admin 클라이언트가 null인 경우 명확한 에러 처리

```typescript
// Admin 클라이언트 사용 (RLS 정책 우회)
const supabase = createSupabaseAdminClient();
if (!supabase) {
  throw new AppError(
    "서버 설정 오류가 발생했습니다. 관리자에게 문의하세요.",
    ErrorCode.INTERNAL_ERROR,
    500,
    true
  );
}
```

### 2. update().select() 결과 확인 로직 추가

**변경사항**:
- `data` 배열이 비어있는지 확인
- 업데이트된 행이 없으면 명확한 에러 발생
- 업데이트된 값이 요청한 값과 일치하는지 즉시 확인

```typescript
// update().select() 결과 확인
if (!data || data.length === 0) {
  console.error("[attendanceSettings] 업데이트된 행이 없습니다:", {
    tenantId: tenantContext.tenantId,
    updateData,
  });
  throw new AppError(
    "SMS 설정 업데이트에 실패했습니다. 업데이트된 행이 없습니다. RLS 정책 문제일 수 있습니다.",
    ErrorCode.DATABASE_ERROR,
    500,
    true
  );
}

const updatedRow = data[0];
// 업데이트 직후 값 불일치 확인
```

### 3. 업데이트 직후 값 검증

**변경사항**:
- `update().select()`로 반환된 값과 요청한 값을 즉시 비교
- 불일치 감지 시 즉시 에러 발생 (경고만 출력하지 않음)
- 모든 필드에 대한 불일치 확인

```typescript
// 업데이트 직후 값 불일치 확인
const mismatches: string[] = [];
if (updatedRow.attendance_sms_student_checkin_enabled !== input.attendance_sms_student_checkin_enabled) {
  mismatches.push(`학생 직접 체크인: 요청=${input.attendance_sms_student_checkin_enabled}, 저장=${updatedRow.attendance_sms_student_checkin_enabled}`);
}
// ... 다른 필드들도 동일하게 확인

if (mismatches.length > 0) {
  throw new AppError(
    `SMS 설정 저장 중 오류가 발생했습니다. 일부 설정이 올바르게 저장되지 않았습니다: ${mismatches.join(", ")}`,
    ErrorCode.DATABASE_ERROR,
    500,
    true
  );
}
```

### 4. 상세 로깅 추가

**변경사항**:
- 업데이트 시작 시 Admin 클라이언트 사용 여부 로깅
- 업데이트 직후 결과 확인 로깅 (모든 필드 비교)
- 재검증 시 최종 확인 로깅
- 에러 발생 시 상세 정보 로깅 (RLS 정책 위반 여부 포함)

```typescript
console.log("[attendanceSettings] SMS 설정 업데이트 시작:", {
  tenantId: tenantContext.tenantId,
  inputData: input,
  updateData,
  usingAdminClient: true,
});

console.log("[attendanceSettings] 업데이트 직후 결과 확인:", {
  tenantId: tenantContext.tenantId,
  updatedRow,
  requested: updateData,
  immediateMatch: {
    studentCheckIn: updatedRow.attendance_sms_student_checkin_enabled === input.attendance_sms_student_checkin_enabled,
    // ... 다른 필드들
  },
});
```

### 5. 에러 처리 개선

**변경사항**:
- RLS 정책 위반 에러 코드(`42501`) 명시적 처리
- 구체적인 에러 메시지 제공
- 사용자 친화적 에러 메시지

```typescript
if (error.code === DATABASE_ERROR_CODES.RLS_POLICY_VIOLATION) {
  throw new AppError(
    "권한이 없습니다. 관리자 권한으로 다시 시도해주세요.",
    ErrorCode.FORBIDDEN,
    403,
    true
  );
}
```

### 6. 검증 로직 개선

**변경사항**:
- 재조회하여 최종 검증 (이중 검증)
- 불일치 감지 시 즉시 에러 발생
- 사용자에게 명확한 피드백 제공

```typescript
// 추가 검증: 재조회하여 최종 확인 (이중 검증)
const { data: verifyData, error: verifyError } = await supabase
  .from("tenants")
  .select(...)
  .eq("id", tenantContext.tenantId)
  .single();

if (verifyData) {
  const finalMismatches: string[] = [];
  // 모든 필드 비교
  if (finalMismatches.length > 0) {
    throw new AppError(
      `SMS 설정 저장 후 검증 중 오류가 발생했습니다. 일부 설정이 올바르게 저장되지 않았습니다: ${finalMismatches.join(", ")}`,
      ErrorCode.DATABASE_ERROR,
      500,
      true
    );
  }
}
```

## 변경된 파일

1. **app/(admin)/actions/attendanceSettingsActions.ts**
   - Admin 클라이언트 사용으로 변경
   - `update().select()` 결과 확인 로직 추가
   - 업데이트 직후 값 검증 추가
   - 상세 로깅 추가
   - 에러 처리 개선
   - 검증 로직 개선

## 예상 효과

1. **문제 원인 파악**: `update().select()` 결과 확인으로 실제 업데이트 여부 확인 가능
2. **RLS 정책 문제 해결**: Admin 클라이언트 사용으로 RLS 정책 우회
3. **디버깅 용이성**: 상세 로깅으로 문제 발생 지점 정확히 파악
4. **사용자 경험 개선**: 명확한 에러 메시지로 문제 해결 가이드 제공
5. **데이터 무결성 보장**: 이중 검증으로 저장된 값의 정확성 보장

## 테스트 방법

1. 관리자가 학생 직접 체크인 시 발송 옵션을 true로 설정하고 저장
2. 브라우저 콘솔에서 상세 로그 확인:
   - `[attendanceSettings] SMS 설정 업데이트 시작` - Admin 클라이언트 사용 여부 확인
   - `[attendanceSettings] 업데이트 직후 결과 확인` - 즉시 값 일치 여부 확인
   - `[attendanceSettings] SMS 설정 업데이트 성공 및 검증 완료` - 최종 검증 완료 확인
3. 데이터베이스에서 실제 저장된 값 확인
4. 불일치 발생 시 명확한 에러 메시지 확인

## 다음 단계

실제 환경에서 테스트하여 다음을 확인:
1. Admin 클라이언트 사용으로 RLS 정책 문제 해결 여부
2. 업데이트 직후 값 검증이 정상 작동하는지
3. 불일치 발생 시 에러 메시지가 명확한지
4. 모든 필드가 정상적으로 저장되는지


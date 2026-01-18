# 플랜 삭제 에러 수정 작업 문서

## 작업 일자
2025-02-01

## 문제 분석

### 발견된 문제점

1. **테이블 이름 불일치 (치명적)**
   - `generatePlansRefactored.ts`에서 `plans` 테이블 사용
   - 실제 데이터베이스에는 `student_plan` 테이블만 존재
   - 다른 모든 파일들은 `student_plan` 사용 중

2. **에러 로깅 부족**
   - 삭제 실패 시 상세 에러 정보가 로그에 출력되지 않음
   - 디버깅이 어려움

3. **중복 코드**
   - `lib/domains/plan/repository.ts`에 `deleteStudentPlansByGroupId` 함수 존재
   - `generatePlansRefactored.ts`에서 직접 삭제 쿼리 작성 (중복)

## 수정 내용

### 1. 테이블 이름 수정

**파일**: `app/(student)/actions/plan-groups/generatePlansRefactored.ts`

- Line 348-351: `plans` → `student_plan` 변경
- Line 497: `plans` → `student_plan` 변경

### 2. 삭제 전 검증 및 로깅 추가

- 삭제 전 기존 플랜 존재 여부 확인 로직 추가
- 삭제 대상 플랜 수 로깅

### 3. 에러 로깅 개선

- 삭제 에러 발생 시 상세 정보 로깅:
  - `error.message`
  - `error.code`
  - `error.details`
  - `error.hint`
  - `groupId`
  - 삭제 대상 플랜 수

### 4. 삭제 결과 로깅

- 삭제 성공 시 삭제된 레코드 수 로깅 추가
- `.select()`를 사용하여 삭제된 레코드 반환

### 5. 에러 메시지 개선

- 사용자에게 제공하는 에러 메시지에 구체적인 에러 정보 포함
- `deleteError.message` 또는 `deleteError.code` 포함

## 수정된 코드

### 삭제 로직 개선

```typescript
// 11. 기존 플랜 삭제
// 삭제 전 기존 플랜 확인 (디버깅용)
const { data: existingPlans, error: checkError } = await supabase
  .from("student_plan")
  .select("id")
  .eq("plan_group_id", groupId)
  .limit(1);

if (checkError) {
  console.error("[_generatePlansFromGroupRefactored] 기존 플랜 확인 실패:", checkError);
}

console.log("[_generatePlansFromGroupRefactored] 삭제 대상 플랜 수:", existingPlans?.length || 0);

const { error: deleteError, data: deletedData } = await supabase
  .from("student_plan")
  .delete()
  .eq("plan_group_id", groupId)
  .select(); // 삭제된 레코드 반환

if (deleteError) {
  console.error("[_generatePlansFromGroupRefactored] 플랜 삭제 에러 상세:", {
    message: deleteError.message,
    code: deleteError.code,
    details: deleteError.details,
    hint: deleteError.hint,
    groupId,
    existingPlansCount: existingPlans?.length || 0,
  });

  throw new AppError(
    `기존 플랜 삭제에 실패했습니다: ${deleteError.message || deleteError.code || "알 수 없는 오류"}`,
    ErrorCode.INTERNAL_ERROR,
    500,
    true
  );
}

console.log("[_generatePlansFromGroupRefactored] 삭제된 플랜 수:", deletedData?.length || 0);
```

### Insert 쿼리 수정

```typescript
// 13. 플랜 일괄 저장
const { error: insertError } = await supabase.from("student_plan").insert(planPayloads);
```

## 검증 사항

1. ✅ 테이블 이름이 올바르게 변경되었는지 확인
2. ✅ 삭제 에러 발생 시 상세 로그가 출력되는지 확인
3. ✅ 삭제 성공 시 삭제된 레코드 수가 로그에 출력되는지 확인
4. ✅ 다른 파일들과의 일관성 확인 (`student_plan` 사용)

## 참고사항

- `lib/domains/plan/repository.ts`의 `deleteStudentPlansByGroupId` 함수는 `studentId`를 필수로 요구
- 현재 코드에서는 `studentId`를 사용할 수 있으므로, 향후 리팩토링 시 이 함수 활용 고려 가능
- RLS 정책 확인 필요: `student_plan` 테이블의 RLS 정책이 `plan_group_id` 기반 삭제를 허용하는지 확인

## 테스트 권장사항

1. 플랜 생성 시 기존 플랜이 정상적으로 삭제되는지 확인
2. 삭제 실패 시나리오 테스트 (RLS 정책 위반 등)
3. 로그 출력 확인 (삭제 전/후 플랜 수, 에러 상세 정보)


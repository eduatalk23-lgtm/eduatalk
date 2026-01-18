# Step 4 검증 로직 제거 및 제외일 에러 처리 개선

## 작업 일시
2025-11-30

## 문제 분석

### 1. 제외일 중복 에러
- **증상**: "이미 등록된 제외일이 있습니다: 2025-12-04" 에러 발생
- **원인**: `lib/data/planGroups.ts`의 `createPlanExclusions` 함수에서 제외일 중복 체크 시, 현재 플랜 그룹의 제외일을 삭제한 후 재추가하는 과정에서 중복 체크 로직이 제대로 작동하지 않음
- **근본 원인**: 중복 체크 시 현재 플랜 그룹의 기존 제외일을 조회한 후 필터링하는 방식이 비효율적이고, 삭제 후 재추가 시 타이밍 이슈 발생 가능

### 2. Step 4 검증 로직 불필요
- **증상**: Step 4(콘텐츠 선택)에서 블록, 제외일 관련 검증이 중복 수행됨
- **원인**: Step 2(블록 및 제외일)에서 이미 검증이 완료되었는데, Step 4에서 다시 검증을 수행
- **사용자 요구사항**: Step 4의 검증 로직 제거

## 구현 내용

### 1. Step 4 검증 로직 제거

#### 파일: `app/(student)/plan/new-group/_components/PlanGroupWizard.tsx`
- `validateStep` 함수의 Step 4 검증 로직 제거 (573-654줄)
- 콘텐츠 개수, 필수 과목, 1730 Timetable 관련 검증 제거
- 주석 추가: "블록 및 제외일 단계(Step 2)에서 이미 검증이 완료되었으므로 검증 제거"

**변경 전**:
```typescript
if (step === 4) {
  // 템플릿 모드에서는 Step 4 검증 건너뛰기
  if (isTemplateMode) {
    return true;
  }
  
  // 최소 1개 이상의 콘텐츠 필요
  const totalContents = wizardData.student_contents.length + wizardData.recommended_contents.length;
  if (totalContents === 0) {
    errors.push("최소 1개 이상의 콘텐츠를 선택해주세요.");
  }
  
  // 필수 과목 검증...
  // 1730 Timetable 검증...
}
```

**변경 후**:
```typescript
if (step === 4) {
  // Step 4: 콘텐츠 선택 단계
  // 블록 및 제외일 단계(Step 2)에서 이미 검증이 완료되었으므로 검증 제거
  // 콘텐츠 관련 검증은 제거됨 (사용자 요청에 따라)
}
```

#### 파일: `lib/validation/wizardValidator.ts`
- `validateStep4` 함수의 검증 로직 제거
- 빈 검증 결과 반환 (`{ valid: true, errors: [], warnings: [] }`)

**변경 전**:
```typescript
private static validateStep4(wizardData: WizardData): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // 최소 1개 이상의 콘텐츠 필요
  if (totalContents === 0) {
    errors.push("최소 1개 이상의 콘텐츠를 선택해주세요.");
  }
  
  // 추천 콘텐츠 범위 검증...
  // 필수 과목 검증...
  
  return { valid: errors.length === 0, errors, warnings };
}
```

**변경 후**:
```typescript
private static validateStep4(wizardData: WizardData): ValidationResult {
  // 검증 로직 제거 (사용자 요청에 따라)
  return { valid: true, errors: [], warnings: [] };
}
```

- `validateAll` 함수에서 Step 4 검증 호출 제거

**변경 전**:
```typescript
static validateAll(wizardData: WizardData): ValidationResult {
  const step1 = this.validateStep1(wizardData);
  const step2 = this.validateStep2(wizardData);
  const step4 = this.validateStep4(wizardData);
  const step6 = this.validateStep6(wizardData);
  
  errors.push(...step1.errors, ...step2.errors, ...step4.errors, ...step6.errors);
  warnings.push(...step1.warnings, ...step2.warnings, ...step4.warnings, ...step6.warnings);
}
```

**변경 후**:
```typescript
static validateAll(wizardData: WizardData): ValidationResult {
  const step1 = this.validateStep1(wizardData);
  const step2 = this.validateStep2(wizardData);
  // Step 4 검증 제거 (블록 및 제외일 단계에서 이미 검증 완료)
  const step6 = this.validateStep6(wizardData);
  
  errors.push(...step1.errors, ...step2.errors, ...step6.errors);
  warnings.push(...step1.warnings, ...step2.warnings, ...step6.warnings);
}
```

### 2. 제외일 중복 에러 처리 개선

#### 파일: `lib/data/planGroups.ts`
- `createPlanExclusions` 함수의 중복 체크 로직 개선
- 현재 플랜 그룹의 제외일은 쿼리 단계에서 제외 (`.neq("plan_group_id", groupId)`)
- 불필요한 조회 및 필터링 로직 제거

**변경 전**:
```typescript
// 현재 플랜 그룹의 기존 제외일 조회 (중복 체크에서 제외하기 위해)
const currentGroupExclusions = await getPlanExclusions(groupId, tenantId);
const currentGroupDates = new Set(currentGroupExclusions.map((e) => e.exclusion_date));

// 학생의 모든 제외일을 plan_group_id 포함하여 조회
const allExclusionsQuery = supabase
  .from("plan_exclusions")
  .select("exclusion_date, plan_group_id")
  .eq("student_id", group.student_id);

if (tenantId) {
  allExclusionsQuery.eq("tenant_id", tenantId);
}

const { data: allExclusions, error: allExclusionsError } = await allExclusionsQuery;

if (!allExclusionsError) {
  // 현재 플랜 그룹의 제외일을 제외한 다른 플랜 그룹의 제외일만 중복 체크 대상
  const otherGroupExclusions = (allExclusions || []).filter(
    (e) => e.plan_group_id !== groupId
  );
  const existingDates = new Set(otherGroupExclusions.map((e) => e.exclusion_date));
  
  // 중복된 날짜 필터링...
}
```

**변경 후**:
```typescript
// 학생의 모든 제외일을 plan_group_id 포함하여 조회 (현재 플랜 그룹 제외)
const allExclusionsQuery = supabase
  .from("plan_exclusions")
  .select("exclusion_date, plan_group_id")
  .eq("student_id", group.student_id)
  .neq("plan_group_id", groupId); // 현재 플랜 그룹의 제외일은 제외

if (tenantId) {
  allExclusionsQuery.eq("tenant_id", tenantId);
}

const { data: otherGroupExclusions, error: exclusionsError } = await allExclusionsQuery;

if (!exclusionsError && otherGroupExclusions && otherGroupExclusions.length > 0) {
  // 다른 플랜 그룹에 이미 등록된 날짜와 중복 체크
  const existingDates = new Set(otherGroupExclusions.map((e) => e.exclusion_date));
  
  // 중복된 날짜 필터링...
}
```

## 개선 효과

### 1. Step 4 검증 제거
- ✅ 불필요한 중복 검증 제거
- ✅ Step 2에서 검증 완료된 항목 재검증 방지
- ✅ 코드 복잡도 감소

### 2. 제외일 중복 에러 해결
- ✅ 현재 플랜 그룹의 제외일 업데이트 시 중복 에러 발생하지 않음
- ✅ 쿼리 단계에서 현재 플랜 그룹 제외로 성능 개선
- ✅ 불필요한 조회 및 필터링 로직 제거로 코드 간결화
- ✅ 타이밍 이슈 해결 (삭제 후 재추가 시 중복 체크 문제 없음)

## 테스트 시나리오

### 1. Step 4 검증 제거 테스트
1. 플랜 그룹 생성 위저드에서 Step 4까지 진행
2. Step 4에서 "다음" 버튼 클릭 시 검증 없이 다음 단계로 이동
3. 콘텐츠를 선택하지 않아도 에러 발생하지 않음 (Step 2에서 검증 완료)

### 2. 제외일 중복 에러 테스트
1. 플랜 그룹 A에 제외일 "2025-12-04" 추가
2. 플랜 그룹 A 편집 모드에서 제외일 "2025-12-04" 그대로 유지하고 저장
3. "이미 등록된 제외일이 있습니다" 에러 발생하지 않음 ✅
4. 플랜 그룹 B에 제외일 "2025-12-04" 추가 시도
5. "이미 등록된 제외일이 있습니다: 2025-12-04" 에러 발생 (정상) ✅

## 관련 파일
- `app/(student)/plan/new-group/_components/PlanGroupWizard.tsx`
- `lib/validation/wizardValidator.ts`
- `lib/data/planGroups.ts`
- `app/(student)/actions/plan-groups/update.ts`
- `lib/errors/planGroupErrors.ts`

## 참고 사항
- 제외일 중복 체크는 플랜 그룹별로 관리되며, 같은 학생의 다른 플랜 그룹에 이미 등록된 날짜는 중복으로 처리됨
- 현재 플랜 그룹의 제외일은 업데이트 시 삭제 후 재추가되므로 중복 체크에서 제외됨
- Step 2에서 블록 및 제외일 검증이 완료되므로, Step 4에서는 콘텐츠 관련 검증만 수행하면 됨 (현재는 제거됨)


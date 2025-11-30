# 제외일 중복 에러 수정 작업

**날짜**: 2025-01-30  
**작업자**: AI Assistant  
**이슈**: 시간 관리에서 제외일 불러올 때 "이미 등록된 제외일이 있습니다" 에러 발생

---

## 🔍 문제 분석

### 에러 발생 상황

```
Error Type: Console PlanGroupError
Error Message: 이미 등록된 제외일이 있습니다: 2025-12-04
  at toPlanGroupError (lib/errors/planGroupErrors.ts:131:12)
  at PlanGroupWizard.useCallback[handleSaveDraft] (app/(student)/plan/new-group/_components/PlanGroupWizard.tsx:798:54)
```

### 에러 추적 경로

1. **UI 레벨** (`ExclusionsPanel.tsx:254`)
   - 사용자가 "시간 관리에서 불러오기" 버튼 클릭
   - `syncFromTimeManagement` 함수 실행

2. **Action 레벨** (`plan-groups/exclusions.ts:17`)
   - `_syncTimeManagementExclusions` 함수 실행
   - 시간 관리에서 제외일 목록 조회 성공

3. **모달 선택** (`ExclusionImportModal.tsx`)
   - 사용자가 제외일 선택
   - `handleImportExclusions` 콜백 호출

4. **Draft 저장** (`PlanGroupWizard.tsx:798`)
   - `handleSaveDraft` 함수 실행
   - `updatePlanGroupDraftAction` 호출

5. **DB 레벨** (`plan-groups/update.ts:211` → `lib/data/planGroups.ts:894`)
   - `createPlanExclusions` 함수에서 중복 체크
   - **문제 발생 지점**: 같은 플랜 그룹 내에서 업데이트할 때 중복 에러 발생

---

## 🔧 근본 원인

### `createPlanExclusions` 함수의 중복 체크 로직

**파일**: `lib/data/planGroups.ts:920-953`

```typescript
// 중복 체크: 같은 학생의 같은 날짜 제외일이 이미 있는지 확인
// 제외일은 플랜 그룹별로 관리되므로, 다른 플랜 그룹에 이미 등록된 날짜만 중복으로 처리
// 현재 플랜 그룹의 제외일은 업데이트 시 삭제 후 재추가되므로 중복 체크에서 제외

// 학생의 모든 제외일을 plan_group_id 포함하여 조회 (현재 플랜 그룹 제외)
const allExclusionsQuery = supabase
  .from("plan_exclusions")
  .select("exclusion_date, plan_group_id")
  .eq("student_id", group.student_id)
  .neq("plan_group_id", groupId); // 현재 플랜 그룹의 제외일은 제외

// ... 중복 체크 로직
const duplicates = exclusions.filter((e) => existingDates.has(e.exclusion_date));
if (duplicates.length > 0) {
  const duplicateDates = duplicates.map((e) => e.exclusion_date).join(", ");
  return {
    success: false,
    error: `이미 등록된 제외일이 있습니다: ${duplicateDates}`,
  };
}
```

### 문제점

1. **제외일의 범위**:
   - 제외일은 **학생 전역**으로 관리되어야 함 (시간 관리 메뉴에서 한 번 등록하면 모든 플랜에 적용)
   - 현재 로직은 플랜 그룹별로 제외일을 관리하려고 시도

2. **중복 체크의 모순**:
   - 주석에는 "현재 플랜 그룹의 제외일은 업데이트 시 삭제 후 재추가"라고 되어 있음
   - 하지만 `updatePlanGroupDraftAction`에서는 **삭제 → 재추가 순서가 보장되지 않음**

3. **실제 시나리오**:
   ```
   1. 시간 관리에서 2025-12-04를 제외일로 등록
   2. 플랜 그룹 A를 생성하면서 해당 제외일 불러오기
   3. 플랜 그룹 A를 수정하면서 다시 불러오기 시도
   4. 삭제가 완료되기 전에 중복 체크가 실행되어 에러 발생
   ```

---

## ✅ 해결 방안

### 옵션 1: 제외일을 플랜 그룹과 독립적으로 관리 (권장)

**개념**: 제외일은 학생의 전역 설정으로 관리하고, 플랜 그룹에서는 참조만 함

**장점**:
- 시간 관리 메뉴와 일관성 유지
- 중복 문제 근본 해결
- 제외일 수정 시 모든 플랜에 자동 반영

**단점**:
- 대규모 스키마 변경 필요
- 기존 데이터 마이그레이션 필요

**구현 난이도**: 높음 (스키마 변경 + 마이그레이션)

---

### 옵션 2: 중복 체크 로직 개선 (현실적)

**개념**: `createPlanExclusions`에서 현재 플랜 그룹의 기존 제외일은 중복으로 간주하지 않음

**변경 내용**:

```typescript
// 기존 코드 (920-953줄)를 다음과 같이 수정

// 학생의 모든 제외일을 plan_group_id 포함하여 조회
const allExclusionsQuery = supabase
  .from("plan_exclusions")
  .select("exclusion_date, plan_group_id")
  .eq("student_id", group.student_id);

if (tenantId) {
  allExclusionsQuery.eq("tenant_id", tenantId);
}

const { data: allExclusions, error: exclusionsError } = await allExclusionsQuery;

if (exclusionsError) {
  console.error("[data/planGroups] 제외일 조회 실패 (중복 체크용)", exclusionsError);
  // 조회 실패 시 중복 체크를 건너뛰고 계속 진행 (데이터베이스 레벨 제약조건에서 처리)
} else if (allExclusions && allExclusions.length > 0) {
  // 현재 플랜 그룹이 아닌 다른 플랜 그룹에 등록된 날짜만 중복으로 체크
  const otherGroupExclusions = allExclusions.filter((e) => e.plan_group_id !== groupId);
  const existingDates = new Set(otherGroupExclusions.map((e) => e.exclusion_date));

  // 중복된 날짜 필터링
  const duplicates = exclusions.filter((e) => existingDates.has(e.exclusion_date));
  if (duplicates.length > 0) {
    const duplicateDates = duplicates.map((e) => e.exclusion_date).join(", ");
    return {
      success: false,
      error: `이미 다른 플랜 그룹에 등록된 제외일이 있습니다: ${duplicateDates}`,
    };
  }
}
```

**장점**:
- 최소한의 변경으로 문제 해결
- 기존 스키마 유지
- 즉시 배포 가능

**단점**:
- 근본적인 구조 문제는 남아있음
- 제외일이 여러 플랜 그룹에 중복 저장됨

**구현 난이도**: 낮음 (함수 하나만 수정)

---

### 옵션 3: 업데이트 로직 순서 보장

**개념**: `updatePlanGroupDraftAction`에서 삭제 → 재추가 순서를 명확히 보장

**변경 내용** (`plan-groups/update.ts:178-219`):

```typescript
// 제외일 업데이트 (플랜 그룹별 관리)
if (data.exclusions !== undefined) {
  const supabase = await createSupabaseServerClient();

  // 1. 플랜 그룹의 기존 제외일 삭제 (await로 완료 보장)
  const { error: deleteError } = await supabase
    .from("plan_exclusions")
    .delete()
    .eq("plan_group_id", groupId);

  if (deleteError) {
    throw new AppError(
      `기존 제외일 삭제 실패: ${deleteError.message}`,
      ErrorCode.DATABASE_ERROR,
      500,
      true
    );
  }

  // 2. 새로운 제외일 추가 (삭제 완료 후 실행)
  if (data.exclusions.length > 0) {
    const exclusionsResult = await createPlanExclusions(
      groupId,
      tenantContext.tenantId,
      data.exclusions.map((e) => ({
        exclusion_date: e.exclusion_date,
        exclusion_type: e.exclusion_type,
        reason: e.reason || null,
      }))
    );

    if (!exclusionsResult.success) {
      throw new AppError(
        exclusionsResult.error || "제외일 업데이트에 실패했습니다.",
        ErrorCode.DATABASE_ERROR,
        500,
        true
      );
    }
  }
}
```

**장점**:
- 논리적으로 명확한 흐름
- 중복 체크 로직은 그대로 유지

**단점**:
- 여전히 중복 저장 문제 존재
- 삭제 실패 시 데이터 유실 가능

**구현 난이도**: 낮음

---

## 🎯 최종 선택: **옵션 2 (중복 체크 로직 개선)**

### 이유

1. **즉각적인 문제 해결**: 최소한의 변경으로 에러 해결
2. **안정성**: 기존 스키마와 데이터 유지
3. **호환성**: 다른 기능에 영향 없음
4. **점진적 개선**: 향후 옵션 1로 마이그레이션 가능

### 구현 계획

1. `lib/data/planGroups.ts`의 `createPlanExclusions` 함수 수정
2. 로직 변경:
   - 모든 제외일 조회 (현재 플랜 그룹 포함)
   - 필터링: 현재 플랜 그룹이 아닌 제외일만 중복 체크
3. 에러 메시지 명확화: "이미 다른 플랜 그룹에 등록된 제외일"

---

## 🧪 테스트 시나리오

### 1. 시간 관리 제외일 불러오기

**Steps**:
1. 시간 관리에서 제외일 등록: 2025-12-04
2. 플랜 그룹 생성 페이지에서 "시간 관리에서 불러오기" 클릭
3. 2025-12-04 선택 후 등록
4. **임시저장**
5. 다시 "시간 관리에서 불러오기" 클릭 (같은 제외일 다시 불러오기)
6. 2025-12-04 선택 후 등록

**Expected**:
- ✅ 에러 없이 정상 처리
- ✅ 중복된 날짜는 "등록됨" 표시
- ✅ 임시저장 성공

### 2. 여러 플랜 그룹에서 같은 제외일 사용

**Steps**:
1. 플랜 그룹 A 생성, 2025-12-04 제외일 등록
2. 플랜 그룹 B 생성, 2025-12-04 제외일 등록 시도

**Expected** (옵션 2 적용 시):
- ❌ "이미 다른 플랜 그룹에 등록된 제외일이 있습니다" 에러 발생

**Expected** (옵션 1 적용 시):
- ✅ 정상 처리 (전역 제외일 참조)

### 3. 학원 일정 불러오기 (동일 패턴)

**Steps**:
1. 시간 관리에서 학원 일정 등록: 월요일 09:00-10:00
2. 플랜 그룹 생성 페이지에서 "학원 일정 불러오기" 클릭
3. 월요일 09:00-10:00 선택 후 등록
4. **임시저장**
5. 다시 "학원 일정 불러오기" 클릭
6. 월요일 09:00-10:00 선택 후 등록

**Expected**:
- ✅ 에러 없이 정상 처리
- ✅ 중복된 일정은 "등록됨" 표시

---

## 📝 관련 파일

### 수정 대상

- `lib/data/planGroups.ts` - `createPlanExclusions` 함수 (920-974줄)

### 확인 필요

- `app/(student)/actions/plan-groups/update.ts` - `_updatePlanGroupDraft` (178-219줄)
- `app/(student)/plan/new-group/_components/_panels/ExclusionsPanel.tsx` - UI 로직
- `app/(student)/plan/new-group/_components/_panels/_modals/ExclusionImportModal.tsx` - 모달 로직
- `app/(student)/plan/new-group/_components/_panels/AcademySchedulePanel.tsx` - 학원 일정 UI
- `app/(student)/plan/new-group/_components/_panels/_modals/AcademyScheduleImportModal.tsx` - 학원 일정 모달

### 참고

- `app/(student)/actions/plan-groups/exclusions.ts` - 제외일 Action
- `app/(student)/actions/plan-groups/academy.ts` - 학원 일정 Action
- `lib/data/planGroups.ts` - `getStudentExclusions`, `getStudentAcademySchedules` 함수

---

## 🚀 다음 단계

1. ✅ **옵션 2 구현** - `createPlanExclusions` 함수 수정
2. ⏳ **테스트 실행** - 위의 테스트 시나리오 검증
3. ⏳ **학원 일정 확인** - 동일한 패턴으로 작동하는지 검증
4. ⏳ **문서화** - 작업 내용 정리
5. ⏳ **커밋** - 변경사항 저장

---

## 💡 장기 개선 제안 (옵션 1)

### 새로운 스키마 설계

```sql
-- 학생 전역 제외일 테이블
CREATE TABLE student_exclusions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  exclusion_date DATE NOT NULL,
  exclusion_type TEXT NOT NULL CHECK (exclusion_type IN ('휴가', '개인사정', '휴일지정', '기타')),
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(student_id, exclusion_date) -- 학생당 날짜별 유일성 보장
);

-- 플랜 그룹 제외일 참조 테이블 (옵션, 필터링용)
CREATE TABLE plan_group_exclusion_refs (
  plan_group_id UUID REFERENCES plan_groups(id) ON DELETE CASCADE,
  exclusion_id UUID REFERENCES student_exclusions(id) ON DELETE CASCADE,
  PRIMARY KEY (plan_group_id, exclusion_id)
);
```

### 마이그레이션 전략

1. 새 테이블 생성
2. 기존 `plan_exclusions` 데이터를 `student_exclusions`로 마이그레이션 (중복 제거)
3. 코드 업데이트
4. 기존 테이블 제거

### 예상 작업량

- **개발**: 3-5일
- **테스트**: 2-3일
- **마이그레이션**: 1일
- **총**: 6-9일

---

## ✅ 체크리스트

- [x] 문제 원인 파악
- [x] 해결 방안 분석
- [ ] 코드 수정 구현
- [ ] 제외일 불러오기 테스트
- [ ] 학원 일정 불러오기 테스트
- [ ] 문서화
- [ ] 커밋

---

**작성 완료**: 2025-01-30


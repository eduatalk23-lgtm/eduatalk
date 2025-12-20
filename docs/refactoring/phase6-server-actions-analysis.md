# Phase 6: Server Actions 및 API 계층 표준화 - 분석 리포트

**작업 일시**: 2025-01-XX  
**작업자**: AI Assistant  
**상태**: 🔍 분석 완료

---

## 📋 개요

Phase 5에서 `lib/data/` 계층이 표준화되었으므로, 이제 상위 계층인 Server Actions와 API Routes를 리팩토링하여 프로젝트 전체의 일관성을 확보해야 합니다.

---

## 🔍 스캔 결과

### Server Actions 파일 현황

**총 102개 파일** 발견:
- `app/actions/`: 루트 레벨 액션
- `app/(admin)/actions/`: 관리자 전용 액션
- `app/(student)/actions/`: 학생 전용 액션
- `app/(parent)/actions/`: 부모 전용 액션
- `app/(superadmin)/actions/`: 슈퍼 관리자 전용 액션

### API Routes 파일 현황

**총 44개 파일** 발견:
- `app/api/`: 공통 API 엔드포인트
- `app/api/admin/`: 관리자 전용 API
- `app/api/today/`: 오늘의 플랜 관련 API

---

## ✅ 이미 표준화된 파일

다음 파일들은 이미 `lib/data/` 함수를 사용하고 있습니다:

### Server Actions
1. ✅ **`app/(student)/actions/planActions.ts`**
   - `createPlan`, `updatePlan`, `deletePlan`, `getPlanById` from `@/lib/data/studentPlans`
   - **상태**: 완벽하게 표준화됨

2. ✅ **`app/actions/auth.ts`**
   - `getDefaultTenant` from `@/lib/data/tenants`
   - `saveUserConsents` from `@/lib/data/userConsents`

3. ✅ **`app/actions/studentDivisionsActions.ts`**
   - `getStudentDivisions`, `createStudentDivision`, etc. from `@/lib/data/studentDivisions`

4. ✅ **`app/actions/students.ts`**
   - `updateStudentDivision`, `getStudentsByDivision`, etc. from `@/lib/data/students`

5. ✅ **`app/actions/blockSets.ts`**
   - `fetchBlockSetsWithBlocks` from `@/lib/data/blockSets`

### API Routes
1. ✅ **`app/api/today/plans/route.ts`**
   - `getTodayPlans` from `@/lib/data/todayPlans`
   - **상태**: 완벽하게 표준화됨

2. ✅ **`app/api/scores/mock/route.ts`**
   - `getStudentTerm`, `calculateSchoolYear` from `@/lib/data/studentTerms`

3. ✅ **`app/api/scores/internal/route.ts`**
   - `getOrCreateStudentTerm` from `@/lib/data/studentTerms`

4. ✅ **기타 20개 이상의 API Routes**
   - 대부분 이미 `lib/data/` 함수를 사용 중

---

## ⚠️ 리팩토링 필요 파일

### 🔴 우선순위 1: 직접 Supabase 쿼리 사용

#### 1. **`app/actions/scores-internal.ts`** (최우선)

**현재 상태**:
- 직접 `createSupabaseServerClient()` 사용
- 직접 `supabase.from("student_internal_scores")` 쿼리 실행
- 직접 `supabase.from("student_mock_scores")` 쿼리 실행

**사용 가능한 함수** (`lib/data/studentScores.ts`):
- ✅ `createInternalScore(score)`
- ✅ `updateInternalScore(scoreId, studentId, tenantId, updates)`
- ✅ `deleteInternalScore(scoreId, studentId, tenantId)`
- ✅ `createMockScore(score)`
- ✅ `updateMockScore(scoreId, studentId, tenantId, updates)`
- ✅ `deleteMockScore(scoreId, studentId, tenantId)`

**리팩토링 필요 함수**:
- ❌ `_createInternalScore` → `createInternalScore` 사용
- ❌ `_updateInternalScore` → `updateInternalScore` 사용
- ❌ `_deleteInternalScore` → `deleteInternalScore` 사용
- ❌ `_createMockScore` → `createMockScore` 사용
- ❌ `_updateMockScore` → `updateMockScore` 사용
- ❌ `_deleteMockScore` → `deleteMockScore` 사용
- ⚠️ `_createInternalScoresBatch` → **일괄 생성 함수 필요** (추가 개발)
- ⚠️ `_createMockScoresBatch` → **일괄 생성 함수 필요** (추가 개발)

**예상 작업량**: 중간 (일괄 생성 함수 추가 필요)

---

### 🟡 우선순위 2: 부분적으로 리팩토링 필요

#### 2. **`app/(admin)/actions/studentManagementActions.ts`**

**현재 상태**:
- 일부는 `lib/data` 사용, 일부는 직접 쿼리
- `createSupabaseAdminClient()` 직접 사용 (관리자 권한 필요)

**리팩토링 방향**:
- 관리자 전용 함수는 `lib/data/admin/` 또는 Admin Client 사용 유지
- 일반 조회는 `lib/data/students.ts` 함수 사용

**예상 작업량**: 낮음 (부분 리팩토링)

#### 3. **`app/(student)/actions/plan-groups/queries.ts`**

**현재 상태**:
- 복잡한 쿼리 로직 포함
- 일부는 `lib/data` 사용, 일부는 직접 쿼리

**리팩토링 방향**:
- `lib/data/planGroups.ts`의 함수 활용
- 복잡한 쿼리는 유지하되, 표준 패턴 적용

**예상 작업량**: 중간

#### 4. **`app/(admin)/actions/camp-templates/progress.ts`**

**현재 상태**:
- 매우 긴 파일 (3000+ 라인)
- 복잡한 비즈니스 로직 포함
- 직접 Supabase 쿼리 다수 사용

**리팩토링 방향**:
- `lib/data/campTemplates.ts` 함수 활용
- 단계적 리팩토링 필요

**예상 작업량**: 높음 (대규모 리팩토링)

---

### 🟢 우선순위 3: 선택적 리팩토링

다음 파일들은 복잡한 비즈니스 로직이나 관리자 전용 기능을 포함하여, 직접 쿼리 사용이 적절할 수 있습니다:

- `app/(admin)/actions/subjectActions.ts`
- `app/(admin)/actions/masterLectures/import.ts`
- `app/(admin)/actions/masterBooks/import.ts`
- `app/(admin)/actions/parentStudentLinkActions.ts`
- `app/(admin)/actions/adminUserActions.ts`
- `app/(superadmin)/actions/tenantlessUserActions.ts`

**판단 기준**:
- 관리자 전용 기능은 Admin Client 사용 유지 가능
- 복잡한 비즈니스 로직은 직접 쿼리 유지 가능
- 단순 CRUD는 `lib/data` 함수 사용 권장

---

## 📊 통계 요약

### 직접 Supabase 쿼리 사용 현황

- **총 642개 매칭 라인** 발견
- **주요 사용 위치**:
  - Server Actions: ~400개
  - API Routes: ~100개
  - Page Components: ~142개

### lib/data 함수 사용 현황

- **Server Actions**: 6개 파일
- **API Routes**: 23개 파일

---

## 🎯 리팩토링 전략

### Phase 6.1: 핵심 파일 리팩토링 (우선순위 1)

1. **`app/actions/scores-internal.ts`** 리팩토링
   - 기존 함수들을 `lib/data/studentScores.ts` 함수로 교체
   - 일괄 생성 함수 추가 (`createInternalScoresBatch`, `createMockScoresBatch`)

### Phase 6.2: 부분 리팩토링 (우선순위 2)

2. **관리자 액션 파일들** 부분 리팩토링
   - 단순 CRUD는 `lib/data` 함수 사용
   - 복잡한 로직은 유지

3. **플랜 그룹 관련 액션** 리팩토링
   - `lib/data/planGroups.ts` 함수 활용

### Phase 6.3: 선택적 리팩토링 (우선순위 3)

4. **복잡한 비즈니스 로직 파일** 검토
   - 필요시에만 리팩토링
   - 직접 쿼리 유지가 적절한 경우도 있음

---

## 📝 다음 단계

### 즉시 작업 (Phase 6.1)

1. ✅ **`app/actions/scores-internal.ts` 리팩토링**
   - `createInternalScore`, `updateInternalScore`, `deleteInternalScore` 교체
   - `createMockScore`, `updateMockScore`, `deleteMockScore` 교체
   - 일괄 생성 함수 추가 (`lib/data/studentScores.ts`)

2. ✅ **에러 핸들링 통일**
   - `lib/data` 함수의 `{ success: boolean, error?: string }` 반환 형식 활용
   - `AppError`와의 통합 확인

### 중기 작업 (Phase 6.2)

3. **관리자 액션 파일들** 부분 리팩토링
4. **플랜 그룹 관련 액션** 리팩토링

### 장기 작업 (Phase 6.3)

5. **복잡한 비즈니스 로직 파일** 검토 및 선택적 리팩토링

---

## ✅ 검증 체크리스트

리팩토링 후 확인 사항:

- [ ] Server Action이 `lib/data` 함수를 사용하는가?
- [ ] 에러 핸들링이 표준화되었는가?
- [ ] 타입 안전성이 유지되는가?
- [ ] 권한 검사가 올바르게 수행되는가?
- [ ] 기존 기능이 정상 작동하는가?

---

## 📚 참고 문서

- [Phase 5 완료 리포트](./phase5-final-verification.md)
- [lib/data/studentScores.ts](../lib/data/studentScores.ts)
- [lib/data/studentPlans.ts](../lib/data/studentPlans.ts)
- [lib/data/planGroups.ts](../lib/data/planGroups.ts)


# 관리자 영역 학생 플랜 생성 플로우 집중화/중앙화 점검 및 문서화

**작성일**: 2026-01-15  
**작성자**: AI Assistant  
**상태**: 분석 완료, 개선 방향 제시

---

## 📋 목차

1. [개요](#개요)
2. [현재 플랜 생성 진입점 분석](#현재-플랜-생성-진입점-분석)
3. [플랜 생성 방법별 상세 분석](#플랜-생성-방법별-상세-분석)
4. [플래너-플랜 관계 분석](#플래너-플랜-관계-분석)
5. [집중화/중앙화 현황](#집중화중앙화-현황)
6. [핵심 문제점](#핵심-문제점)
7. [개선 방향](#개선-방향)
8. [구현 계획](#구현-계획)

---

## 개요

### 목적

관리자 영역에서 학생 플랜을 생성하는 **모든 진입점과 방법을 분석**하고, **집중화/중앙화 관점에서 점검**하여 일관된 플로우와 아키텍처를 제시합니다.

### 핵심 질문

1. **플랜 생성 진입점이 어디에 있는가?**
2. **각 진입점에서 어떤 방법으로 플랜을 생성하는가?**
3. **플래너(Planner)와의 관계는 일관적인가?**
4. **중앙화된 플랜 생성 로직이 있는가?**
5. **개선이 필요한 부분은 무엇인가?**

---

## 현재 플랜 생성 진입점 분석

### 1. 학생별 플랜 관리 페이지

**경로**: `/admin/students/[id]/plans`

**컴포넌트 구조**:
```
app/(admin)/admin/students/[id]/plans/
├── page.tsx (서버 컴포넌트)
└── _components/
    ├── StudentPlansPageClient.tsx (클라이언트 래퍼)
    ├── PlannerManagement.tsx (플래너 관리)
    └── AdminPlanManagement.tsx (플랜 관리 메인)
```

**특징**:
- ✅ 플래너 관리와 플랜 관리를 분리
- ✅ 플래너 선택 후 플랜 생성 가능
- ✅ 다양한 플랜 생성 방법 제공
- ⚠️ 플래너 선택이 필수인지 선택적인지 혼재

**플랜 생성 방법**:
1. 플랜 그룹 생성 (7단계 위저드) - `AdminPlanCreationWizard7Step`
2. 콘텐츠 추가 - `AddContentWizard`
3. 단발성 플랜 추가 - `AddAdHocModal`
4. AI 플랜 생성 - `AdminAIPlanModal`
5. 빠른 플랜 추가 - `AdminQuickPlanModal`

### 2. 일괄 플랜 생성 페이지

**경로**: `/admin/plan-creation`

**컴포넌트 구조**:
```
app/(admin)/admin/plan-creation/
├── page.tsx (서버 컴포넌트)
└── _components/
    ├── PlanCreationClient.tsx (메인 클라이언트)
    ├── student-selection/ (학생 선택)
    ├── method-selection/ (방법 선택)
    ├── creation-flow/ (생성 플로우)
    └── results/ (결과 표시)
```

**특징**:
- ✅ 다중 학생 선택 가능
- ✅ 여러 방법 중 선택 가능
- ✅ 단계별 플로우 (학생 선택 → 방법 선택 → 생성 → 결과)
- ⚠️ 플래너 선택이 없음 (플래너 없이도 생성 가능)

**플랜 생성 방법**:
1. 플랜 그룹 생성 (7단계 위저드) - `PlanGroupWizardWrapper`
2. AI 일괄 생성 - `BatchAIPlanWrapper`
3. 빠른 플랜 생성 - `QuickPlanWrapper`
4. 콘텐츠 위저드 - `ContentWizardWrapper`

### 3. 학생 상세 페이지 플랜 섹션

**경로**: `/admin/students/[id]`

**컴포넌트**: `PlanListSectionClient.tsx`

**특징**:
- ✅ 학생 상세 페이지에서 빠른 플랜 생성
- ✅ 플랜 그룹 생성 위저드 직접 호출
- ⚠️ 플래너 선택 없이 바로 위저드 열림

**플랜 생성 방법**:
1. 플랜 그룹 생성 (7단계 위저드) - `AdminPlanCreationWizard7Step`

---

## 플랜 생성 방법별 상세 분석

### 1. 플랜 그룹 생성 (7단계 위저드)

**컴포넌트**: `AdminPlanCreationWizard7Step.tsx`

**위치**: `app/(admin)/admin/students/[id]/plans/_components/admin-wizard/`

**특징**:
- ✅ 7단계 위저드로 체계적 입력
- ✅ 플래너 선택 필수 (Step 1)
- ✅ 시간 관리에서 Import 기능 (Step 2)
- ✅ Draft 저장/불러오기
- ✅ 자동 저장 기능

**액션**: `createPlanGroupAction` → `createPlanGroupAtomic`

**데이터 흐름**:
```
AdminWizardData (Context)
  └── createPlanGroupAction
      └── _createPlanGroup
          └── createPlanGroupAtomic
              └── plan_groups + plan_contents + plan_exclusions + academy_schedules
```

**플래너 의존성**: ✅ 필수 (`plannerId` prop)

**사용 위치**:
- `/admin/students/[id]/plans` - `AdminPlanManagement.tsx`
- `/admin/students/[id]` - `PlanListSectionClient.tsx`
- `/admin/plan-creation` - `PlanGroupWizardWrapper.tsx`

### 2. 콘텐츠 추가

**컴포넌트**: `AddContentWizard.tsx`

**위치**: `app/(admin)/admin/students/[id]/plans/_components/add-content-wizard/`

**특징**:
- ✅ flexible_contents 생성
- ✅ 배치 방식 선택 (today/period/weekly)
- ⚠️ 플래너 선택 선택적 (`selectedPlannerId` prop, 없어도 동작)
- ⚠️ plan_group_id 선택적 (자동 생성 가능)

**액션**: `createFlexibleContent` + `createPlanFromContent`

**데이터 흐름**:
```
AddContentWizard
  ├── createFlexibleContent
  │   └── flexible_contents 테이블
  └── createPlanFromContent
      └── student_plan 테이블
          └── plan_group_id (선택적, 자동 생성 가능)
```

**플래너 의존성**: ⚠️ 선택적 (plannerId가 있으면 자동 플랜 그룹 생성)

**사용 위치**:
- `/admin/students/[id]/plans` - `AdminPlanManagement.tsx`

### 3. 단발성 플랜 추가

**컴포넌트**: `AddAdHocModal.tsx`

**위치**: `app/(admin)/admin/students/[id]/plans/_components/`

**특징**:
- ✅ 간단한 폼 (제목, 날짜, 예상 소요시간)
- ✅ plan_group_id 필수 (캘린더 아키텍처)
- ⚠️ 플래너 선택 없음 (plan_group_id 직접 전달)
- ⚠️ 플래너와의 연결이 간접적 (plan_group → planner)

**액션**: `createAdHocPlan` / `createEnhancedAdHocPlan`

**데이터 흐름**:
```
AddAdHocModal
  └── createAdHocPlan
      └── ad_hoc_plans 테이블
          └── plan_group_id (필수)
```

**플래너 의존성**: ⚠️ 간접적 (plan_group_id를 통해 연결)

**사용 위치**:
- `/admin/students/[id]/plans` - `AdminPlanManagement.tsx`

### 4. AI 플랜 생성

**컴포넌트**: `AdminAIPlanModal.tsx`

**위치**: `app/(admin)/admin/students/[id]/plans/_components/`

**특징**:
- ✅ LLM 기반 플랜 생성
- ✅ plan_group_id 필수
- ⚠️ 플래너 선택 없음

**액션**: `generatePlanWithAI`

**데이터 흐름**:
```
AdminAIPlanModal
  └── generatePlanWithAI
      └── student_plan 테이블 (여러 개)
          └── plan_group_id (필수)
```

**플래너 의존성**: ⚠️ 간접적 (plan_group_id를 통해 연결)

**사용 위치**:
- `/admin/students/[id]/plans` - `AdminPlanManagement.tsx`
- `/admin/plan-creation` - `BatchAIPlanWrapper.tsx`

### 5. 빠른 플랜 추가

**컴포넌트**: `AdminQuickPlanModal.tsx`

**위치**: `app/(admin)/admin/students/[id]/plans/_components/`

**특징**:
- ✅ 간단한 폼으로 빠른 플랜 생성
- ⚠️ 플래너 선택 없음
- ⚠️ plan_group_id 선택적 (자동 생성 가능)

**액션**: `quickCreateFromContent` / `createQuickPlan`

**데이터 흐름**:
```
AdminQuickPlanModal
  └── quickCreateFromContent
      └── plan_groups + student_plan 테이블
```

**플래너 의존성**: ❌ 없음

**사용 위치**:
- `/admin/students/[id]/plans` - `AdminPlanManagement.tsx`
- `/admin/plan-creation` - `QuickPlanWrapper.tsx`

---

## 플래너-플랜 관계 분석

### 데이터 모델 관계

```
planners (플래너)
  ├── 기본 정보 (이름, 기간, 목적)
  ├── 시간 설정 (학습시간, 자율학습, 점심시간)
  ├── 비학습 시간 블록
  ├── 학원 일정
  ├── 제외일
  └── 스케줄러 설정

plan_groups (플랜 그룹)
  ├── planner_id (플래너 참조) ✅
  ├── 기본 정보 (플래너에서 상속 또는 오버라이드)
  ├── 시간 설정 (플래너에서 상속)
  └── 콘텐츠 및 플랜들
      ├── student_plan (일반 플랜)
      ├── flexible_contents (유연한 콘텐츠) ← plan_group_id 선택적
      └── ad_hoc_plans (단발성 플랜) ← plan_group_id 필수
```

### 플랜 생성 방법별 플래너 의존성

| 플랜 생성 방법 | 컴포넌트 | 플래너 선택 | plan_group_id | 연결 방식 |
|-------------|---------|------------|--------------|----------|
| 플랜 그룹 생성 | `AdminPlanCreationWizard7Step` | ✅ 필수 | 자동 생성 | `planner_id` → `plan_groups.planner_id` |
| 콘텐츠 추가 | `AddContentWizard` | ⚠️ 선택적 | 선택적 (자동 생성) | `plannerId` → 자동 `plan_group` 생성 |
| 단발성 플랜 | `AddAdHocModal` | ❌ 없음 | ✅ 필수 | `plan_group_id` → 간접 연결 |
| AI 플랜 생성 | `AdminAIPlanModal` | ❌ 없음 | ✅ 필수 | `plan_group_id` → 간접 연결 |
| 빠른 플랜 추가 | `AdminQuickPlanModal` | ❌ 없음 | 선택적 (자동 생성) | 직접 생성 |

### 문제점

1. **플래너 의존성 불일치**
   - 플랜 그룹 생성만 플래너 선택 필수
   - 다른 방법들은 플래너 없이도 생성 가능
   - 플래너 우선 생성 원칙이 강제되지 않음

2. **플래너-플랜 그룹 관계 혼란**
   - 플래너는 "템플릿/설정"
   - 플랜 그룹은 "인스턴스"
   - 하지만 플래너 없이도 플랜 그룹 생성 가능 (빠른 플랜 추가)

3. **plan_group_id 처리 불일치**
   - 필수인 경우: 단발성 플랜, AI 플랜 생성
   - 선택적인 경우: 콘텐츠 추가, 빠른 플랜 추가
   - 자동 생성 로직이 각각 다름

---

## 집중화/중앙화 현황

### 현재 상태

#### ✅ 중앙화된 부분

1. **플랜 그룹 생성 로직**
   - `createPlanGroupAtomic` - 원자적 플랜 그룹 생성
   - `lib/domains/plan/transactions.ts` - 트랜잭션 관리
   - `lib/domains/plan/actions/plan-groups/create.ts` - 생성 액션

2. **플래너 관리**
   - `PlannerManagement.tsx` - 플래너 목록 관리
   - `PlannerCreationModal.tsx` - 플래너 생성/수정
   - `lib/domains/admin-plan/actions/planners.ts` - 플래너 액션

3. **공통 컴포넌트**
   - `AdminPlanManagement.tsx` - 플랜 관리 메인 컴포넌트
   - 모달 상태 관리 (useReducer 패턴)

#### ❌ 분산된 부분

1. **플랜 생성 진입점**
   - 학생별 플랜 관리 페이지
   - 일괄 플랜 생성 페이지
   - 학생 상세 페이지 플랜 섹션
   - 각각 다른 컴포넌트와 로직 사용

2. **플랜 생성 액션**
   - `createPlanGroupAction` - 플랜 그룹 생성
   - `createFlexibleContent` - 콘텐츠 생성
   - `createPlanFromContent` - 콘텐츠에서 플랜 생성
   - `createAdHocPlan` - 단발성 플랜 생성
   - `generatePlanWithAI` - AI 플랜 생성
   - `quickCreateFromContent` - 빠른 플랜 생성
   - 각각 다른 위치에 분산

3. **플래너 선택 UI**
   - `AdminPlanCreationWizard7Step` - Step 1에 플래너 선택
   - `AddContentWizard` - 플래너 선택 선택적
   - 다른 모달들 - 플래너 선택 없음
   - 일관된 UI/UX 없음

### 중앙화 필요 영역

1. **플랜 생성 진입점 통합**
   - 모든 플랜 생성이 동일한 컴포넌트/페이지를 통해 이루어지도록
   - 플래너 선택을 공통으로 처리

2. **플랜 생성 액션 통합**
   - 공통 인터페이스 정의
   - 플래너 의존성 일관성 확보

3. **플래너 선택 UI 통합**
   - 공통 `PlannerSelector` 컴포넌트
   - 모든 플랜 생성 모달에서 사용

---

## 핵심 문제점

### 1. 플래너 의존성 불일치 ⚠️

**문제**:
- 플랜 그룹 생성만 플래너 선택 필수
- 다른 방법들은 플래너 없이도 생성 가능
- 플래너 우선 생성 원칙이 강제되지 않음

**영향**:
- 관리자가 플래너를 먼저 만들지 않고 플랜을 추가할 수 있음
- 플래너 없이 생성된 플랜들이 체계적으로 관리되지 않음
- 사용자 경험 혼란

### 2. 플랜 생성 진입점 분산 ⚠️

**문제**:
- 3개의 다른 진입점에서 각각 다른 방식으로 플랜 생성
- 일관된 플로우 없음
- 코드 중복 가능성

**영향**:
- 유지보수 어려움
- 사용자 경험 불일치
- 버그 발생 가능성 증가

### 3. 플랜 생성 액션 분산 ⚠️

**문제**:
- 각 플랜 생성 방법마다 별도의 액션 함수
- 공통 로직이 중복될 수 있음
- 일관된 에러 처리 없음

**영향**:
- 코드 중복
- 유지보수 어려움
- 일관성 부족

### 4. 플래너 선택 UI 분산 ⚠️

**문제**:
- 플래너 선택 UI가 각 컴포넌트에 분산
- 일관된 UI/UX 없음
- 플래너 없을 때의 처리 불명확

**영향**:
- 사용자 경험 불일치
- 코드 중복
- 유지보수 어려움

### 5. plan_group_id 처리 불일치 ⚠️

**문제**:
- 필수인 경우와 선택적인 경우 혼재
- 자동 생성 로직이 각각 다름
- 플래너와의 연결 방식 불일치

**영향**:
- 데이터 일관성 문제
- 버그 발생 가능성
- 유지보수 어려움

---

## 개선 방향

### 1. 플래너 우선 생성 원칙 강화

#### 목표

모든 플랜 생성이 플래너를 통해 이루어지도록 강제

#### 구현 방안

1. **플래너 선택 필수화**
   ```typescript
   // 모든 플랜 생성 모달에 plannerId 필수 추가
   interface PlanCreationModalProps {
     plannerId: string; // 필수
     // ...
   }
   ```

2. **플래너 없을 때 플랜 생성 버튼 비활성화**
   ```typescript
   // AdminPlanManagement.tsx
   const canCreatePlan = selectedPlannerId !== null;
   
   <button 
     disabled={!canCreatePlan}
     onClick={handleCreatePlan}
   >
     플랜 추가
   </button>
   ```

3. **플래너 선택 강제 UI**
   ```typescript
   // 플래너가 없을 때
   {!selectedPlanner && (
     <EmptyState
       title="플래너를 먼저 생성해주세요"
       description="플랜을 추가하려면 먼저 플래너를 생성해야 합니다"
       action={<button onClick={handleCreatePlanner}>플래너 만들기</button>}
     />
   )}
   ```

### 2. 플랜 생성 진입점 통합

#### 목표

모든 플랜 생성이 동일한 컴포넌트/페이지를 통해 이루어지도록

#### 구현 방안

1. **통합 플랜 생성 페이지**
   ```
   /admin/plan-creation (기존 유지)
     ├── 학생 선택
     ├── 플래너 선택 (필수)
     └── 플랜 생성 방법 선택
         ├── 플랜 그룹 생성 (7단계 위저드)
         ├── 콘텐츠 추가
         ├── 단발성 플랜 추가
         ├── AI 플랜 생성
         └── 빠른 플랜 추가
   ```

2. **학생별 플랜 관리 페이지 개선**
   ```
   /admin/students/[id]/plans
     ├── 플래너 관리 (상단)
     ├── 플래너 선택 (필수)
     └── 플랜 관리 (하단)
         └── 통합 플랜 생성 버튼
             └── 플랜 생성 방법 선택 모달
   ```

### 3. 플랜 생성 액션 통합

#### 목표

공통 인터페이스와 로직을 통한 일관된 플랜 생성

#### 구현 방안

1. **공통 플랜 생성 인터페이스**
   ```typescript
   interface BasePlanCreationInput {
     studentId: string;
     tenantId: string;
     plannerId: string; // 필수
     planGroupId?: string; // 선택적 (플래너에서 자동 선택)
   }
   
   interface PlanCreationResult {
     success: boolean;
     planGroupId?: string;
     planIds?: string[];
     error?: string;
   }
   ```

2. **플랜 생성 액션 통합**
   ```typescript
   // lib/domains/admin-plan/actions/planCreation.ts
   export async function createPlanGroup(input: BasePlanCreationInput & PlanGroupInput): Promise<PlanCreationResult>
   export async function createContentPlan(input: BasePlanCreationInput & ContentInput): Promise<PlanCreationResult>
   export async function createAdHocPlan(input: BasePlanCreationInput & AdHocInput): Promise<PlanCreationResult>
   export async function createAIPlan(input: BasePlanCreationInput & AIInput): Promise<PlanCreationResult>
   export async function createQuickPlan(input: BasePlanCreationInput & QuickInput): Promise<PlanCreationResult>
   ```

3. **공통 에러 처리 및 로깅**
   ```typescript
   // 모든 플랜 생성 액션에서 공통 사용
   try {
     // 플래너 검증
     await validatePlanner(input.plannerId);
     
     // 플랜 생성
     const result = await createPlan(...);
     
     // 이벤트 로깅
     await logPlanCreationEvent(...);
     
     return result;
   } catch (error) {
     // 공통 에러 처리
     return handlePlanCreationError(error);
   }
   ```

### 4. 플래너 선택 UI 통합

#### 목표

일관된 플래너 선택 UI/UX

#### 구현 방안

1. **공통 PlannerSelector 컴포넌트**
   ```typescript
   // components/plan/PlannerSelector.tsx
   export function PlannerSelector({
     planners,
     selectedPlannerId,
     onSelect,
     required = true,
   }: PlannerSelectorProps) {
     return (
       <div>
         <label>
           플래너 선택 {required && <span className="text-red-500">*</span>}
         </label>
         <select
           value={selectedPlannerId || ''}
           onChange={(e) => onSelect(e.target.value)}
           required={required}
         >
           <option value="">플래너를 선택하세요</option>
           {planners.map((planner) => (
             <option key={planner.id} value={planner.id}>
               {planner.name}
             </option>
           ))}
         </select>
       </div>
     );
   }
   ```

2. **모든 플랜 생성 모달에서 사용**
   ```typescript
   // 모든 플랜 생성 모달에 추가
   <PlannerSelector
     planners={planners}
     selectedPlannerId={plannerId}
     onSelect={setPlannerId}
     required={true}
   />
   ```

### 5. plan_group_id 처리 통일

#### 목표

일관된 plan_group_id 처리 로직

#### 구현 방안

1. **플래너 선택 시 활성 플랜 그룹 자동 선택**
   ```typescript
   const activePlanGroup = useMemo(() => {
     if (!selectedPlannerId) return null;
     return planGroups.find(
       pg => pg.planner_id === selectedPlannerId && pg.status === 'active'
     );
   }, [selectedPlannerId, planGroups]);
   ```

2. **플랜 그룹이 없을 때 처리**
   ```typescript
   // 플랜 그룹이 없으면 자동 생성 또는 플랜 그룹 생성 위저드로 안내
   if (!activePlanGroup) {
     // 옵션 1: 자동 생성
     const newGroup = await createAutoPlanGroup(selectedPlannerId);
     
     // 옵션 2: 위저드로 안내
     setShowPlanGroupWizard(true);
   }
   ```

---

## 구현 계획

### Phase 1: 플래너 선택 강제 (우선순위: 높음)

**작업 내용**:
1. `PlannerSelector` 컴포넌트 생성
2. `AdminPlanManagement`에 플래너 선택 섹션 추가
3. 플래너 없을 때 플랜 생성 버튼 비활성화
4. 모든 플랜 생성 모달에 `plannerId` prop 필수 추가

**예상 소요 시간**: 8시간

**파일**:
- `components/plan/PlannerSelector.tsx` (신규)
- `app/(admin)/admin/students/[id]/plans/_components/AdminPlanManagement.tsx` (수정)
- `app/(admin)/admin/students/[id]/plans/_components/add-content-wizard/AddContentWizard.tsx` (수정)
- `app/(admin)/admin/students/[id]/plans/_components/AddAdHocModal.tsx` (수정)
- `app/(admin)/admin/students/[id]/plans/_components/AdminAIPlanModal.tsx` (수정)
- `app/(admin)/admin/students/[id]/plans/_components/AdminQuickPlanModal.tsx` (수정)

### Phase 2: 플랜 생성 액션 통합 (우선순위: 중간)

**작업 내용**:
1. 공통 플랜 생성 인터페이스 정의
2. 플랜 생성 액션 통합
3. 공통 에러 처리 및 로깅
4. 플래너 검증 로직 추가

**예상 소요 시간**: 12시간

**파일**:
- `lib/domains/admin-plan/actions/planCreation.ts` (신규)
- `lib/domains/admin-plan/actions/planCreation/types.ts` (신규)
- `lib/domains/admin-plan/actions/planCreation/utils.ts` (신규)
- 기존 액션 파일들 (리팩토링)

### Phase 3: 플랜 생성 진입점 통합 (우선순위: 중간)

**작업 내용**:
1. 통합 플랜 생성 컴포넌트 생성
2. 학생별 플랜 관리 페이지 개선
3. 일괄 플랜 생성 페이지 개선
4. 학생 상세 페이지 플랜 섹션 개선

**예상 소요 시간**: 10시간

**파일**:
- `components/plan/PlanCreationModal.tsx` (신규)
- `app/(admin)/admin/students/[id]/plans/_components/AdminPlanManagement.tsx` (수정)
- `app/(admin)/admin/plan-creation/_components/PlanCreationClient.tsx` (수정)
- `app/(admin)/admin/students/[id]/_components/PlanListSectionClient.tsx` (수정)

### Phase 4: plan_group_id 처리 통일 (우선순위: 낮음)

**작업 내용**:
1. 플래너 선택 시 활성 플랜 그룹 자동 선택 로직
2. 플랜 그룹 없을 때 처리 UI
3. 플랜 그룹 자동 생성 옵션

**예상 소요 시간**: 6시간

**파일**:
- `lib/domains/admin-plan/utils/planGroupSelector.ts` (신규)
- `app/(admin)/admin/students/[id]/plans/_components/AdminPlanManagement.tsx` (수정)

### Phase 5: 통합 테스트 및 문서화 (우선순위: 낮음)

**작업 내용**:
1. 전체 플로우 테스트
2. 사용자 가이드 업데이트
3. 개발자 가이드 업데이트
4. API 문서 업데이트

**예상 소요 시간**: 4시간

---

## 체크리스트

### Phase 1: 플래너 선택 강제
- [ ] `PlannerSelector` 컴포넌트 생성
- [ ] `AdminPlanManagement`에 플래너 선택 섹션 추가
- [ ] 플래너 없을 때 플랜 생성 버튼 비활성화
- [ ] `AddContentWizard`에 `plannerId` prop 필수 추가
- [ ] `AddAdHocModal`에 `plannerId` prop 필수 추가
- [ ] `AdminAIPlanModal`에 `plannerId` prop 필수 추가
- [ ] `AdminQuickPlanModal`에 `plannerId` prop 필수 추가
- [ ] 테스트 작성

### Phase 2: 플랜 생성 액션 통합
- [ ] 공통 플랜 생성 인터페이스 정의
- [ ] 플랜 생성 액션 통합
- [ ] 공통 에러 처리 및 로깅
- [ ] 플래너 검증 로직 추가
- [ ] 기존 액션 리팩토링
- [ ] 테스트 작성

### Phase 3: 플랜 생성 진입점 통합
- [ ] 통합 플랜 생성 컴포넌트 생성
- [ ] 학생별 플랜 관리 페이지 개선
- [ ] 일괄 플랜 생성 페이지 개선
- [ ] 학생 상세 페이지 플랜 섹션 개선
- [ ] 테스트 작성

### Phase 4: plan_group_id 처리 통일
- [ ] 플래너 선택 시 활성 플랜 그룹 자동 선택 로직
- [ ] 플랜 그룹 없을 때 처리 UI
- [ ] 플랜 그룹 자동 생성 옵션
- [ ] 테스트 작성

### Phase 5: 통합 테스트 및 문서화
- [ ] 전체 플로우 테스트
- [ ] 사용자 가이드 업데이트
- [ ] 개발자 가이드 업데이트
- [ ] API 문서 업데이트

---

## 참고 문서

- [관리자 영역 플랜 생성 구조 분석 및 개선 방향](./2026-01-15-admin-plan-creation-structure-analysis-and-improvements.md)
- [관리자 영역 플래너 생성 위저드 분석 및 개선 방향 (v2)](./2026-01-15-admin-planner-wizard-analysis-and-improvements-v2.md)
- [플랜 생성 기능 통합 분석](./2025-02-02-plan-creation-features-comprehensive-analysis.md)

---

**마지막 업데이트**: 2026-01-15


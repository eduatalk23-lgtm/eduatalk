# 관리자 영역 플랜 생성 구조 분석 및 개선 방향

**작성일**: 2026-01-15  
**작성자**: AI Assistant  
**상태**: 분석 완료, 개선 방향 제시

---

## 📋 목차

1. [개요](#개요)
2. [현재 프로젝트 구조 분석](#현재-프로젝트-구조-분석)
3. [핵심 문제점](#핵심-문제점)
4. [플랜 생성 타입별 현황](#플랜-생성-타입별-현황)
5. [개선 방향](#개선-방향)
6. [제안하는 아키텍처](#제안하는-아키텍처)
7. [구현 계획](#구현-계획)

---

## 개요

### 목적

관리자 영역에서 학생 대상 플랜 생성의 **체계화 및 통일성 강화**를 위해 현재 프로젝트 구조를 분석하고, 플래너 우선 생성 → 플랜 추가(플랜 그룹, 단발성, 일회성) 워크플로우를 개선합니다.

### 핵심 요구사항

1. **플래너 우선 생성**: 플랜 생성 전에 플래너를 먼저 생성해야 함
2. **플랜 생성 단계 체계화**: 
   - 플래너 생성 → 플랜 그룹 추가 (7단계 위저드)
   - 플래너 생성 → 콘텐츠 추가 (flexible_contents)
   - 플래너 생성 → 단발성 플랜 추가 (ad_hoc_plans)
   - 플래너 생성 → 일회성 플랜 추가
3. **통일된 인터페이스**: 모든 플랜 생성 타입이 플래너와 명확하게 연결
4. **워크플로우 명확화**: 관리자가 플랜을 추가할 때 플래너 선택이 필수

---

## 현재 프로젝트 구조 분석

### 디렉토리 구조

```
app/(admin)/admin/students/[id]/plans/
├── page.tsx                                    # 서버 컴포넌트 (진입점)
├── _components/
│   ├── StudentPlansPageClient.tsx              # 클라이언트 래퍼
│   ├── PlannerManagement.tsx                   # 플래너 목록 관리
│   ├── PlannerCreationModal.tsx                # 플래너 생성/수정 모달
│   ├── AdminPlanManagement.tsx                 # 플랜 관리 메인 컴포넌트
│   │
│   ├── admin-wizard/                           # 7단계 플랜 그룹 생성 위저드
│   │   ├── AdminPlanCreationWizard7Step.tsx   # 메인 위저드 컴포넌트
│   │   ├── _context/                          # Context API (데이터 관리)
│   │   ├── steps/                             # 7개 Step 컴포넌트
│   │   └── modals/                            # Import 모달들
│   │
│   ├── AddContentModal.tsx                    # 콘텐츠 추가 모달
│   ├── AddAdHocModal.tsx                       # 단발성 플랜 추가 모달
│   └── modals/                                 # 기타 모달 컴포넌트
```

### 데이터 흐름

#### 1. 플래너 생성 흐름

```typescript
// 현재 구조
PlannerManagement
  └── PlannerCreationModal
      ├── 기본 정보 입력 (이름, 기간, 목적)
      ├── 시간 설정 (학습시간, 자율학습, 점심시간)
      ├── 비학습 시간 블록 설정
      ├── 학원 일정 Import (시간 관리에서 불러오기) ✅
      ├── 제외일 Import (시간 관리에서 불러오기) ✅
      └── 저장 → planners 테이블
```

**현재 상태**: 
- ✅ 학원 일정/제외일 Import 기능 구현됨 (v2에서 추가)
- ✅ 플래너 생성 시 메타 정보 선택적 반영 가능

#### 2. 플랜 그룹 생성 흐름 (7단계 위저드)

```typescript
// 현재 구조
AdminPlanManagement
  └── AdminPlanCreationWizard7Step
      ├── Step1BasicInfo (플래너 선택 필수)
      ├── Step2TimeSettings (시간 설정 + Import)
      ├── Step3SchedulePreview
      ├── Step4ContentSelection
      ├── Step5AllocationSettings
      ├── Step6FinalReview
      └── Step7GenerateResult
          └── createPlanGroupAction
              └── plan_groups 테이블
```

**현재 상태**:
- ✅ 플래너 선택 필수 (Step 1)
- ✅ 플래너 선택 시 자동 채우기 기능
- ⚠️ 플래너가 없을 때의 처리 불명확

#### 3. 콘텐츠 추가 흐름

```typescript
// 현재 구조
AdminPlanManagement
  └── AddContentModal
      ├── 콘텐츠 정보 입력
      ├── 배치 방식 선택 (today/period/weekly)
      └── createFlexibleContent + createPlanFromContent
          └── flexible_contents + student_plan 테이블
```

**현재 상태**:
- ❌ 플래너 선택 없이 콘텐츠 추가 가능
- ❌ 플래너와의 연결이 불명확
- ⚠️ plan_group_id가 선택적 (캘린더 아키텍처)

#### 4. 단발성 플랜 추가 흐름

```typescript
// 현재 구조
AdminPlanManagement
  └── AddAdHocModal
      ├── 제목, 날짜, 예상 소요시간 입력
      └── createAdHocPlan
          └── ad_hoc_plans 테이블
              └── plan_group_id 필수 (캘린더 아키텍처)
```

**현재 상태**:
- ✅ plan_group_id 필수 (캘린더 아키텍처)
- ⚠️ 플래너와의 연결이 간접적 (plan_group → planner)

---

## 핵심 문제점

### 1. 플래너-플랜 관계의 불명확성

#### 문제점

```typescript
// 현재 구조의 문제
planners (플래너)
  └── plan_groups (플랜 그룹) ← planner_id 연결
      └── student_plan (일반 플랜)
      └── flexible_contents (유연한 콘텐츠) ← plan_group_id 선택적
      └── ad_hoc_plans (단발성 플랜) ← plan_group_id 필수
```

**문제**:
- 플래너와 플랜 그룹은 명확히 연결됨 (`planner_id`)
- 하지만 콘텐츠 추가나 단발성 플랜 추가 시 플래너 선택이 필수가 아님
- 플래너가 없어도 플랜을 추가할 수 있는 구조

#### 영향

1. **워크플로우 혼란**: 관리자가 플래너를 먼저 만들지 않고 플랜을 추가할 수 있음
2. **데이터 일관성**: 플래너 없이 생성된 플랜들이 체계적으로 관리되지 않음
3. **사용자 경험**: 플래너 우선 생성 원칙이 UI에서 강제되지 않음

### 2. 플랜 생성 타입별 인터페이스 불일치

#### 현재 상태 비교

| 플랜 타입 | 컴포넌트 | 플래너 선택 | plan_group_id | 연결 방식 |
|---------|---------|------------|--------------|----------|
| 플랜 그룹 | `AdminPlanCreationWizard7Step` | ✅ 필수 (Step 1) | 자동 생성 | `planner_id` → `plan_groups.planner_id` |
| 콘텐츠 추가 | `AddContentModal` | ❌ 없음 | 선택적 | `plan_group_id` 직접 선택 (없으면 생성?) |
| 단발성 플랜 | `AddAdHocModal` | ❌ 없음 | ✅ 필수 | `plan_group_id` 직접 전달 |

**문제**:
- 플랜 그룹만 플래너 선택이 필수
- 콘텐츠 추가와 단발성 플랜 추가는 플래너 선택 없이 진행 가능
- 인터페이스가 일관되지 않음

### 3. 플래너 선택 UI의 분산

#### 현재 구조

```typescript
// 플래너 선택이 필요한 곳
1. AdminPlanCreationWizard7Step (Step 1) ✅
   └── 플래너 선택 드롭다운

2. AddContentModal ❌
   └── 플래너 선택 없음

3. AddAdHocModal ❌
   └── 플래너 선택 없음 (plan_group_id만 받음)
```

**문제**:
- 플래너 선택 UI가 위저드에만 존재
- 다른 플랜 생성 모달에는 플래너 선택이 없음
- 관리자가 플래너를 먼저 선택해야 한다는 것을 인지하기 어려움

### 4. 플래너 없을 때의 처리 불명확

#### 현재 동작

```typescript
// AdminPlanCreationWizard7Step
if (!selectedPlannerId) {
  // 위저드가 열리지 않음? 또는 에러?
  // 실제 코드 확인 필요
}
```

**문제**:
- 플래너가 없을 때 플랜 그룹 생성 위저드를 열 수 없음
- 하지만 다른 플랜 생성 모달은 플래너 없이도 열림
- 일관성 없는 동작

### 5. 플랜 그룹과 플래너의 개념 혼동

#### 현재 구조

```
planners (플래너)
  ├── 기본 정보 (이름, 기간, 목적)
  ├── 시간 설정 (학습시간, 자율학습, 점심시간)
  ├── 비학습 시간 블록
  ├── 학원 일정
  ├── 제외일
  └── 스케줄러 설정

plan_groups (플랜 그룹)
  ├── planner_id (플래너 참조)
  ├── 기본 정보 (이름, 기간, 목적) ← 중복?
  ├── 시간 설정 ← 플래너에서 상속?
  └── 콘텐츠 및 플랜들
```

**문제**:
- 플래너와 플랜 그룹의 역할이 명확하지 않음
- 플래너는 "템플릿"인가? 플랜 그룹은 "인스턴스"인가?
- 데이터 중복 가능성

---

## 플랜 생성 타입별 현황

### 1. 플랜 그룹 생성 (7단계 위저드)

**위치**: `app/(admin)/admin/students/[id]/plans/_components/admin-wizard/`

**특징**:
- ✅ 플래너 선택 필수 (Step 1)
- ✅ 플래너 선택 시 자동 채우기
- ✅ 7단계 위저드로 체계적 입력
- ✅ 시간 관리에서 Import 기능 (Step 2)
- ✅ 자동 저장 기능
- ✅ Draft 저장/불러오기

**데이터 흐름**:
```
AdminWizardData (Context)
  └── createPlanGroupAction
      └── _createPlanGroup
          └── createPlanGroupAtomic
              └── plan_groups + plan_contents + plan_exclusions + academy_schedules
```

### 2. 콘텐츠 추가 (AddContentModal)

**위치**: `app/(admin)/admin/students/[id]/plans/_components/AddContentModal.tsx`

**특징**:
- ❌ 플래너 선택 없음
- ✅ flexible_contents 생성
- ✅ 배치 방식 선택 (today/period/weekly)
- ⚠️ plan_group_id 선택적

**데이터 흐름**:
```
AddContentModal
  ├── createFlexibleContent
  │   └── flexible_contents 테이블
  └── createPlanFromContent
      └── student_plan 테이블
          └── plan_group_id (선택적)
```

**문제점**:
- 플래너와의 연결이 없음
- plan_group_id가 선택적이라 플래너 없이도 생성 가능

### 3. 단발성 플랜 추가 (AddAdHocModal)

**위치**: `app/(admin)/admin/students/[id]/plans/_components/AddAdHocModal.tsx`

**특징**:
- ❌ 플래너 선택 없음
- ✅ plan_group_id 필수 (캘린더 아키텍처)
- ✅ 간단한 폼 (제목, 날짜, 예상 소요시간)

**데이터 흐름**:
```
AddAdHocModal
  └── createAdHocPlan
      └── ad_hoc_plans 테이블
          └── plan_group_id (필수)
```

**문제점**:
- plan_group_id는 필수지만 플래너 선택은 없음
- 플래너 → plan_group → ad_hoc_plan 연결이 간접적

### 4. 일회성 플랜 추가

**현재 상태**: 별도 컴포넌트 없음 (단발성과 동일하게 처리?)

**필요 사항**:
- 일회성 플랜의 정의 명확화
- 단발성과의 차이점 정의
- 별도 컴포넌트 필요 여부 결정

---

## 개선 방향

### 1. 플래너 우선 생성 원칙 강화

#### 목표

모든 플랜 생성이 플래너를 통해 이루어지도록 강제

#### 구현 방안

1. **플래너 없을 때 플랜 생성 버튼 비활성화**
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

2. **플래너 선택 강제 UI**
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

3. **플래너 선택 드롭다운 추가**
   - 모든 플랜 생성 모달에 플래너 선택 추가
   - 플래너 선택 시 해당 플래너의 plan_group 자동 선택

### 2. 플랜 생성 타입별 통일된 인터페이스

#### 제안하는 구조

```typescript
// 공통 플랜 생성 인터페이스
interface PlanCreationModalProps {
  studentId: string;
  tenantId: string;
  plannerId: string; // 필수
  planGroupId?: string; // 선택적 (플래너에서 자동 선택)
  onClose: () => void;
  onSuccess: () => void;
}
```

#### 각 타입별 구현

1. **플랜 그룹 생성**
   ```typescript
   <AdminPlanCreationWizard7Step
     plannerId={selectedPlannerId} // 필수
     // ... 기존 props
   />
   ```

2. **콘텐츠 추가**
   ```typescript
   <AddContentModal
     plannerId={selectedPlannerId} // 필수 추가
     planGroupId={activePlanGroupId} // 플래너에서 자동 선택
     // ... 기존 props
   />
   ```

3. **단발성 플랜 추가**
   ```typescript
   <AddAdHocModal
     plannerId={selectedPlannerId} // 필수 추가
     planGroupId={activePlanGroupId} // 플래너에서 자동 선택
     // ... 기존 props
   />
   ```

### 3. 플래너-플랜 그룹 관계 명확화

#### 제안하는 구조

```
planners (플래너) - 템플릿/설정
  ├── 기본 정보
  ├── 시간 설정
  ├── 비학습 시간 블록
  ├── 학원 일정
  ├── 제외일
  └── 스케줄러 설정

plan_groups (플랜 그룹) - 인스턴스
  ├── planner_id (플래너 참조) ✅
  ├── 기본 정보 (플래너에서 상속 또는 오버라이드)
  ├── 시간 설정 (플래너에서 상속)
  └── 콘텐츠 및 플랜들
      ├── student_plan
      ├── flexible_contents
      └── ad_hoc_plans
```

**원칙**:
- 플래너는 "설정 템플릿"
- 플랜 그룹은 "실제 플랜 인스턴스"
- 플랜 그룹은 플래너의 설정을 상속하되, 필요시 오버라이드 가능

### 4. 통합 플랜 생성 UI

#### 제안하는 구조

```typescript
// AdminPlanManagement.tsx
<div className="plan-creation-section">
  {/* 플래너 선택 (필수) */}
  <PlannerSelector
    planners={planners}
    selectedPlannerId={selectedPlannerId}
    onSelect={handlePlannerSelect}
  />
  
  {/* 플랜 생성 버튼들 */}
  {selectedPlannerId && (
    <div className="plan-creation-buttons">
      <button onClick={handleCreatePlanGroup}>
        플랜 그룹 생성 (7단계 위저드)
      </button>
      <button onClick={handleAddContent}>
        콘텐츠 추가
      </button>
      <button onClick={handleAddAdHoc}>
        단발성 플랜 추가
      </button>
      <button onClick={handleAddOneTime}>
        일회성 플랜 추가
      </button>
    </div>
  )}
</div>
```

### 5. 플래너 선택 공통 컴포넌트

#### 제안하는 컴포넌트

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

**사용 예시**:
```typescript
// 모든 플랜 생성 모달에서 공통 사용
<PlannerSelector
  planners={planners}
  selectedPlannerId={plannerId}
  onSelect={setPlannerId}
  required={true}
/>
```

---

## 제안하는 아키텍처

### 전체 구조

```
관리자 플랜 관리 페이지
│
├── PlannerManagement (플래너 목록)
│   ├── 플래너 생성 버튼
│   ├── 플래너 목록 (카드)
│   └── PlannerCreationModal
│       ├── 기본 정보
│       ├── 시간 설정
│       ├── 학원 일정 Import ✅
│       └── 제외일 Import ✅
│
└── AdminPlanManagement (플랜 관리)
    ├── 플래너 선택 섹션 (필수) ← NEW
    │   └── PlannerSelector
    │
    └── 플랜 생성 섹션
        ├── 플랜 그룹 생성 (7단계 위저드)
        │   └── AdminPlanCreationWizard7Step
        │       └── plannerId 필수
        │
        ├── 콘텐츠 추가
        │   └── AddContentModal
        │       ├── plannerId 필수 ← NEW
        │       └── planGroupId 자동 선택 ← NEW
        │
        ├── 단발성 플랜 추가
        │   └── AddAdHocModal
        │       ├── plannerId 필수 ← NEW
        │       └── planGroupId 자동 선택 ← NEW
        │
        └── 일회성 플랜 추가 ← NEW
            └── AddOneTimeModal
                ├── plannerId 필수
                └── planGroupId 자동 선택
```

### 데이터 흐름

```typescript
// 1. 플래너 선택
const selectedPlanner = planners.find(p => p.id === selectedPlannerId);

// 2. 플래너의 활성 플랜 그룹 자동 선택
const activePlanGroup = planGroups.find(
  pg => pg.planner_id === selectedPlannerId && pg.status === 'active'
);

// 3. 플랜 생성 시 플래너 정보 전달
<AddContentModal
  plannerId={selectedPlannerId}
  planGroupId={activePlanGroup?.id}
  // 플래너 정보 자동 상속
  studyHours={selectedPlanner.studyHours}
  selfStudyHours={selectedPlanner.selfStudyHours}
  // ...
/>
```

### 컴포넌트 계층 구조

```
StudentPlansPageClient
│
├── PlannerManagement
│   └── PlannerCreationModal
│
└── AdminPlanManagement
    ├── PlannerSelector (NEW)
    │
    └── PlanCreationButtons
        ├── AdminPlanCreationWizard7Step
        ├── AddContentModal
        ├── AddAdHocModal
        └── AddOneTimeModal (NEW)
```

---

## 구현 계획

### Phase 1: 플래너 선택 강제 (우선순위: 높음)

#### 작업 내용

1. **PlannerSelector 컴포넌트 생성**
   - 위치: `components/plan/PlannerSelector.tsx`
   - 기능: 플래너 목록에서 선택
   - Props: `planners`, `selectedPlannerId`, `onSelect`, `required`

2. **AdminPlanManagement에 플래너 선택 섹션 추가**
   - 플래너 선택 필수 UI
   - 플래너 없을 때 플랜 생성 버튼 비활성화
   - 플래너 선택 시 활성 플랜 그룹 자동 선택

3. **플랜 생성 모달에 plannerId 필수 추가**
   - `AddContentModal`: `plannerId` prop 추가
   - `AddAdHocModal`: `plannerId` prop 추가
   - `AdminPlanCreationWizard7Step`: 이미 있음 (확인)

#### 예상 작업 시간

- PlannerSelector 컴포넌트: 2시간
- AdminPlanManagement 수정: 3시간
- 모달 수정: 4시간
- 테스트: 2시간
- **총 11시간**

### Phase 2: 플랜 그룹 자동 선택 (우선순위: 중간)

#### 작업 내용

1. **플래너 선택 시 활성 플랜 그룹 자동 선택 로직**
   ```typescript
   const activePlanGroup = useMemo(() => {
     if (!selectedPlannerId) return null;
     return planGroups.find(
       pg => pg.planner_id === selectedPlannerId && pg.status === 'active'
     );
   }, [selectedPlannerId, planGroups]);
   ```

2. **플랜 그룹이 없을 때 처리**
   - 플랜 그룹 생성 위저드로 안내
   - 또는 플랜 그룹 자동 생성 옵션

#### 예상 작업 시간

- 자동 선택 로직: 2시간
- 플랜 그룹 없을 때 처리: 3시간
- 테스트: 2시간
- **총 7시간**

### Phase 3: 일회성 플랜 추가 (우선순위: 중간)

#### 작업 내용

1. **일회성 플랜 정의 명확화**
   - 단발성과의 차이점 정의
   - 데이터 모델 확인

2. **AddOneTimeModal 컴포넌트 생성**
   - `AddAdHocModal` 참고
   - 일회성 플랜 특성 반영

3. **일회성 플랜 생성 액션**
   - `createOneTimePlan` 액션 생성
   - DB 스키마 확인 필요

#### 예상 작업 시간

- 정의 및 설계: 3시간
- 컴포넌트 생성: 4시간
- 액션 생성: 3시간
- 테스트: 2시간
- **총 12시간**

### Phase 4: 통합 테스트 및 문서화 (우선순위: 낮음)

#### 작업 내용

1. **통합 테스트**
   - 플래너 우선 생성 시나리오
   - 각 플랜 타입별 생성 시나리오
   - 에러 케이스 테스트

2. **문서화**
   - 사용자 가이드 업데이트
   - 개발자 가이드 업데이트
   - API 문서 업데이트

#### 예상 작업 시간

- 통합 테스트: 4시간
- 문서화: 3시간
- **총 7시간**

---

## 체크리스트

### Phase 1: 플래너 선택 강제

- [ ] `PlannerSelector` 컴포넌트 생성
- [ ] `AdminPlanManagement`에 플래너 선택 섹션 추가
- [ ] 플래너 없을 때 플랜 생성 버튼 비활성화
- [ ] `AddContentModal`에 `plannerId` prop 추가
- [ ] `AddAdHocModal`에 `plannerId` prop 추가
- [ ] 각 모달에서 플래너 정보 상속 로직 추가
- [ ] 테스트 작성

### Phase 2: 플랜 그룹 자동 선택

- [ ] 플래너 선택 시 활성 플랜 그룹 자동 선택 로직
- [ ] 플랜 그룹 없을 때 처리 UI
- [ ] 플랜 그룹 자동 생성 옵션 (선택적)
- [ ] 테스트 작성

### Phase 3: 일회성 플랜 추가

- [ ] 일회성 플랜 정의 문서화
- [ ] `AddOneTimeModal` 컴포넌트 생성
- [ ] `createOneTimePlan` 액션 생성
- [ ] DB 스키마 확인 및 필요시 마이그레이션
- [ ] 테스트 작성

### Phase 4: 통합 테스트 및 문서화

- [ ] 통합 테스트 시나리오 작성
- [ ] E2E 테스트 작성
- [ ] 사용자 가이드 업데이트
- [ ] 개발자 가이드 업데이트

---

## 참고 문서

- [관리자 영역 플래너 생성 위저드 분석 및 개선 방향 (v2)](./2026-01-15-admin-planner-wizard-analysis-and-improvements-v2.md)
- [플랜 생성 기능 통합 분석](./2025-02-02-plan-creation-features-comprehensive-analysis.md)
- [관리자 플랜 생성 통합 섹션 구축 계획](./2025-02-02-admin-plan-creation-unified-section-plan.md)

---

**마지막 업데이트**: 2026-01-15


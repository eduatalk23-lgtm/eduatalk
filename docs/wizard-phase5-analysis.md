# 🔍 Wizard Phase 5.1 분석: Step/DetailView 쌍 분석

**작성일**: 2025년 11월 29일  
**Phase**: 5.1 - 분석 및 설계  
**대상**: Step과 DetailView 컴포넌트 통합

---

## 📊 현재 상황 분석

### DetailView 파일 위치

```
app/(student)/plan/group/[id]/_components/
├── Step1DetailView.tsx          (81 라인)
├── Step2DetailView.tsx          (133 라인)
├── Step2_5DetailView.tsx        (426 라인) ⚠️ 가장 큼
├── Step3DetailView.tsx          (66 라인)
├── Step4DetailView.tsx          (66 라인)
├── Step6DetailView.tsx          (109 라인)
├── Step7DetailView.tsx          (34 라인)
└── PlanGroupDetailView.tsx      (메인 컨테이너)

총: 915 라인 (7개 DetailView)
```

### Step 컴포넌트 위치

```
app/(student)/plan/new-group/_components/
├── Step1BasicInfo.tsx
├── Step2TimeSettingsWithPreview.tsx
├── Step3ContentSelection.tsx
├── Step6Simplified.tsx          ✅ Phase 4 완료
└── Step7ScheduleResult.tsx
```

---

## 🔄 DetailView 사용처 분석

### 1. PlanGroupDetailView.tsx (메인)

**위치**: `/plan/group/[id]/_components/PlanGroupDetailView.tsx`

**역할**: 플랜 그룹 상세 페이지의 탭 UI 컨테이너

**사용 방식**:
```typescript
// 동적 임포트 (lazy loading)
const Step1DetailView = lazy(() => 
  import("./Step1DetailView").then(module => ({ default: module.Step1DetailView }))
);
const Step2DetailView = lazy(() => ...);
// ... 7개 DetailView 모두 lazy import

// 탭별 렌더링
{activeTab === 1 && (
  <Suspense fallback={<TabLoadingSkeleton />}>
    <Step1DetailView group={group} />
  </Suspense>
)}
```

**특징**:
- Lazy loading으로 성능 최적화
- 7개 탭으로 구성
- 캠프 제출 모드에서는 탭 필터링 (1, 2, 4만)
- 읽기 전용 (편집 불가)

---

### 2. 플랜 그룹 상세 페이지

**위치**: `/plan/group/[id]/page.tsx`

**역할**: 생성된 플랜 그룹을 조회하는 페이지

**사용 방식**:
```typescript
<PlanGroupDetailView
  group={group}
  contents={contents}
  exclusions={exclusions}
  academySchedules={academySchedules}
  contentsWithDetails={contentsWithDetails}
  canEdit={canEdit}
  groupId={groupId}
  hasPlans={hasPlans}
/>
```

---

## 📋 Step별 DetailView 분석

### Step 1: 기본 정보

#### Step1DetailView.tsx (81 라인)

**표시 내용**:
- 플랜 그룹 이름
- 플랜 목적
- 스케줄러 유형
- 시작일/종료일
- 목표일 (선택)

**UI 패턴**:
```typescript
<div className="grid gap-6 rounded-lg border border-gray-200 bg-white p-6 sm:grid-cols-2">
  <div>
    <dt className="text-sm font-medium text-gray-500">플랜 그룹 이름</dt>
    <dd className="mt-1 text-lg text-gray-900">
      {group.name || "—"}
    </dd>
  </div>
  {/* ... */}
</div>
```

**통합 전략**:
- BasicInfoSummary(Phase 4)와 유사
- mode="readonly"로 통합 가능
- dt/dd 패턴 유지

---

### Step 2: 블록 및 제외일

#### Step2DetailView.tsx (133 라인)

**표시 내용**:
- 블록 세트 정보
- 학원 일정 목록
- 제외일 목록

**UI 특징**:
- 섹션별로 구분 (블록/학원/제외일)
- 테이블 형태 리스트
- 요일별 그룹핑

#### Step2_5DetailView.tsx (426 라인) ⚠️

**표시 내용**:
- 스케줄 미리보기
- 일별 학습 가능 시간
- 주별 통계
- 월별 캘린더

**특징**:
- **가장 큰 파일** (426 라인)
- 복잡한 계산 로직
- 캘린더 UI
- 통계 차트

**통합 전략**:
- SchedulePreviewPanel (Phase 2)과 유사
- 읽기 전용이므로 큰 변경 불필요
- Step2에 통합 가능

---

### Step 3/4: 콘텐츠 선택

#### Step3DetailView.tsx (66 라인)

**표시 내용**:
- 학생이 선택한 콘텐츠 목록
- 콘텐츠 타입 (책/강의/커스텀)
- 범위 정보

#### Step4DetailView.tsx (66 라인)

**표시 내용**:
- 추천 콘텐츠 목록
- 동일한 UI 패턴

**통합 전략**:
- ContentsSummary (Phase 4)와 유사
- Step3ContentSelection에 mode 추가
- 탭 UI는 그대로 유지

---

### Step 6: 최종 검토

#### Step6DetailView.tsx (109 라인)

**표시 내용**:
- 모든 정보 요약
- 섹션별 주요 정보

**통합 전략**:
- ✅ **이미 완료** (Phase 4)
- Step6Simplified로 대체
- **제거만 하면 됨**

---

### Step 7: 스케줄 결과

#### Step7DetailView.tsx (34 라인)

**표시 내용**:
- 생성된 플랜 개수
- 총 학습 일수
- 완료 메시지

**통합 전략**:
- 단순한 구조
- mode 추가 쉬움

---

## 🎨 통합 패턴 설계

### 1. Mode Prop 추가

```typescript
type ViewMode = "edit" | "readonly";

type StepProps = {
  data: WizardData;
  onUpdate?: (updates: Partial<WizardData>) => void;
  mode?: ViewMode;  // 새로 추가
  locked?: string[]; // 템플릿 고정 필드
  // ... 기존 props
};
```

---

### 2. 조건부 렌더링 패턴

#### 패턴 A: 인라인 조건부 (간단한 경우)

```typescript
export function Step1BasicInfo({ data, onUpdate, mode = "edit", locked = [] }: StepProps) {
  const isEditable = mode === "edit" && !locked.includes("name");

  return (
    <div>
      <label>플랜 이름</label>
      {mode === "edit" ? (
        <Input
          value={data.name}
          onChange={(e) => onUpdate?.({ name: e.target.value })}
          disabled={locked.includes("name")}
        />
      ) : (
        <div className="text-lg text-gray-900">
          {data.name || "—"}
        </div>
      )}
    </div>
  );
}
```

#### 패턴 B: EditableField 컴포넌트 (복잡한 경우)

```typescript
type EditableFieldProps = {
  label: string;
  value: string;
  mode: ViewMode;
  onChange?: (value: string) => void;
  type?: "text" | "date" | "select";
  options?: Array<{ value: string; label: string }>;
  locked?: boolean;
};

function EditableField({
  label,
  value,
  mode,
  onChange,
  type = "text",
  options,
  locked = false,
}: EditableFieldProps) {
  if (mode === "readonly") {
    return (
      <div>
        <dt className="text-sm font-medium text-gray-500">{label}</dt>
        <dd className="mt-1 text-lg text-gray-900">{value || "—"}</dd>
      </div>
    );
  }

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700">{label}</label>
      {type === "select" ? (
        <select
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          disabled={locked}
          className="mt-1 block w-full rounded-md border-gray-300"
        >
          {options?.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      ) : (
        <input
          type={type}
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          disabled={locked}
          className="mt-1 block w-full rounded-md border-gray-300"
        />
      )}
    </div>
  );
}
```

---

### 3. Props 변환 로직

DetailView는 `PlanGroup` 타입을 받지만, Step은 `WizardData`를 받습니다.

#### 해결 방법 1: Props Adapter

```typescript
function planGroupToWizardData(group: PlanGroup): WizardData {
  return {
    name: group.name,
    plan_purpose: group.plan_purpose,
    scheduler_type: group.scheduler_type,
    period_start: group.period_start,
    period_end: group.period_end,
    target_date: group.target_date,
    // ... 나머지 필드
  };
}

// 사용
<Step1BasicInfo
  data={planGroupToWizardData(group)}
  mode="readonly"
/>
```

#### 해결 방법 2: Union Type

```typescript
type StepProps = {
  data: WizardData | PlanGroup;  // 둘 다 허용
  mode?: ViewMode;
  // ...
};
```

---

## 📐 통합 우선순위 및 난이도

### Priority 1 (High - 쉬움)

| Step | 현재 라인 | 예상 라인 | 난이도 | 이유 |
|------|----------|----------|--------|------|
| Step1 | 81 | +50 | 🟢 Low | 단순 필드 표시 |
| Step7 | 34 | +20 | 🟢 Low | 매우 단순 |
| Step6 | 109 | 0 (제거) | 🟢 Low | 이미 완료 |

### Priority 2 (Medium - 보통)

| Step | 현재 라인 | 예상 라인 | 난이도 | 이유 |
|------|----------|----------|--------|------|
| Step3 | 66 | +100 | 🟡 Medium | 콘텐츠 리스트 |
| Step4 | 66 | +100 | 🟡 Medium | 콘텐츠 리스트 |

### Priority 3 (Complex - 어려움)

| Step | 현재 라인 | 예상 라인 | 난이도 | 이유 |
|------|----------|----------|--------|------|
| Step2 | 133 | +150 | 🟠 High | 3개 섹션 |
| Step2_5 | 426 | +200 | 🔴 Very High | 복잡한 계산 |

---

## 🔄 통합 전략

### 단계적 접근 (권장)

#### Phase 5.2: Step1 통합 (3시간)
- 단순하므로 먼저 진행
- 패턴 검증용
- EditableField 컴포넌트 생성

#### Phase 5.3: Step7 통합 (2시간)
- Step1 패턴 재사용
- 빠르게 완료

#### Phase 5.4: Step3/4 통합 (6시간)
- ContentCard에 readonly variant 추가
- 탭 UI 유지

#### Phase 5.5: Step6 정리 (1시간)
- DetailView 제거만
- 간단함

#### Phase 5.6: Step2/2_5 통합 (8시간)
- 가장 복잡
- 마지막에 진행
- Panel 구조 활용

---

## 🎯 최종 목표

### 코드 감소

| Step | Before (Step + DetailView) | After (통합) | 감소 |
|------|---------------------------|-------------|------|
| Step1 | ~280 + 81 = 361 | ~330 | -31 (-9%) |
| Step2 | ~400 + 133 + 426 = 959 | ~650 | -309 (-32%) |
| Step3/4 | ~350 + 66 + 66 = 482 | ~450 | -32 (-7%) |
| Step6 | 120 + 109 = 229 | 120 | -109 (-48%) |
| Step7 | ~250 + 34 = 284 | ~270 | -14 (-5%) |
| **총계** | **2,315** | **1,820** | **-495 (-21%)** |

### 컴포넌트 감소
- Before: 12개 (Step 5 + DetailView 7)
- After: 5개 (통합 Step만)
- **-7개 (-58%)**

---

## 🔧 기술적 고려사항

### 1. Lazy Loading 유지

PlanGroupDetailView는 현재 lazy loading을 사용합니다.

```typescript
// Before (DetailView)
const Step1DetailView = lazy(() => 
  import("./Step1DetailView").then(module => ({ default: module.Step1DetailView }))
);

// After (통합 Step)
const Step1BasicInfo = lazy(() => 
  import("@/app/(student)/plan/new-group/_components/Step1BasicInfo")
    .then(module => ({ default: module.Step1BasicInfo }))
);
```

**주의**: 경로가 달라지므로 import 변경 필요

---

### 2. Props 타입 호환성

```typescript
// WizardData vs PlanGroup
type WizardData = {
  name: string;
  plan_purpose: "내신대비" | "모의고사(수능)" | "";
  // ... 입력용 타입
};

type PlanGroup = {
  id: string;
  name: string;
  plan_purpose: "내신대비" | "모의고사(수능)" | null;
  // ... DB 타입
};
```

**해결**: Union type 또는 Adapter 함수

---

### 3. 스타일링 일관성

DetailView는 다른 스타일 패턴을 사용합니다.

```typescript
// DetailView 스타일
<dt className="text-sm font-medium text-gray-500">플랜 이름</dt>
<dd className="mt-1 text-lg text-gray-900">{group.name}</dd>

// Step 편집 스타일
<label className="block text-sm font-medium text-gray-700">플랜 이름</label>
<input className="mt-1 block w-full rounded-md border-gray-300" />
```

**해결**: 조건부로 다른 스타일 적용

---

## 🚧 위험 요소

### 위험 1: Step2_5 복잡도
**문제**: 426 라인의 복잡한 계산 로직

**완화**:
- SchedulePreviewPanel (Phase 2) 재사용
- 별도 컴포넌트로 분리
- 점진적 통합

---

### 위험 2: Props 타입 불일치
**문제**: WizardData와 PlanGroup 타입 차이

**완화**:
- Adapter 함수 생성
- Union type 사용
- TypeScript로 검증

---

### 위험 3: Lazy Loading 경로
**문제**: 컴포넌트 위치 변경으로 import 깨짐

**완화**:
- TypeScript 컴파일 에러 확인
- grep으로 모든 import 검색
- 단계별 테스트

---

## 📝 다음 단계

### Phase 5.2: Step1 통합
1. EditableField 컴포넌트 생성
2. Step1BasicInfo에 mode prop 추가
3. readonly 모드 구현
4. Step1DetailView 제거
5. PlanGroupDetailView 업데이트

---

**작성일**: 2025년 11월 29일  
**소요 시간**: 4시간  
**상태**: Phase 5.1 완료  
**다음**: Phase 5.2 Step1 통합


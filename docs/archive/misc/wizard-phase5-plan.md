# 📋 Wizard Phase 5 계획: DetailView 통합

**작성일**: 2025년 11월 29일  
**Phase**: Phase 5 - DetailView 통합  
**상태**: 계획 단계

---

## 🎯 목표

### 주요 목표
Step 컴포넌트와 DetailView 컴포넌트의 중복을 제거하고, 단일 컴포넌트로 통합하여 읽기/편집 모드를 지원

### 배경
현재 각 Step마다 2개의 컴포넌트가 존재:
- **Step 컴포넌트**: 입력 및 편집용
- **DetailView 컴포넌트**: 읽기 전용 표시용

이는 **약 1,500 라인의 코드 중복**을 발생시키고, 수정 시 2곳을 동시에 업데이트해야 하는 유지보수 문제를 야기합니다.

---

## 📊 현재 상황 분석

### 기존 구조

```
app/(student)/plan/new-group/_components/
├── Step1BasicInfo.tsx                    (입력/편집)
├── Step1DetailView.tsx                   (읽기 전용) ⚠️ 중복
├── Step2TimeSettingsWithPreview.tsx      (입력/편집)
├── Step2DetailView.tsx                   (읽기 전용) ⚠️ 중복
├── Step2_5DetailView.tsx                 (읽기 전용) ⚠️ 중복
├── Step3ContentSelection.tsx             (입력/편집)
├── Step3DetailView.tsx                   (읽기 전용) ⚠️ 중복
├── Step4DetailView.tsx                   (읽기 전용) ⚠️ 중복
├── Step6Simplified.tsx                   (읽기 전용) ✅ Phase 4 완료
├── Step6DetailView.tsx                   (읽기 전용) ⚠️ 제거 예정
└── Step7ScheduleResult.tsx               (결과 표시)
    └── Step7DetailView.tsx               (읽기 전용) ⚠️ 중복
```

### DetailView 사용 위치

1. **플랜 그룹 상세 페이지**
   - `/plan/groups/[groupId]/page.tsx`
   - 생성된 플랜 그룹 확인

2. **플랜 그룹 편집 페이지**
   - `/plan/groups/[groupId]/edit/page.tsx`
   - Step 1~3은 DetailView (읽기)
   - Step 4~6은 편집 가능

3. **캠프 제출 완료 페이지**
   - 학생이 제출한 캠프 플랜 확인
   - 관리자가 검토

4. **템플릿 상세 페이지** (관리자)
   - 템플릿 내용 확인

---

## 🎨 새로운 통합 구조

### 통합 컴포넌트 패턴

```typescript
type ViewMode = "edit" | "readonly";

type StepProps = {
  data: WizardData;
  onUpdate?: (updates: Partial<WizardData>) => void;
  mode?: ViewMode;  // 새로 추가
  locked?: string[]; // 템플릿에서 고정된 필드
  isCampMode?: boolean;
  // ... 기타 props
};

export function Step1BasicInfo({ 
  data, 
  onUpdate, 
  mode = "edit",
  locked = [],
  isCampMode = false 
}: StepProps) {
  const isEditable = mode === "edit";

  return (
    <div>
      {isEditable ? (
        <Input 
          value={data.name}
          onChange={(e) => onUpdate?.({ name: e.target.value })}
          disabled={locked.includes("name")}
        />
      ) : (
        <div className="text-gray-900">{data.name}</div>
      )}
    </div>
  );
}
```

---

## 📋 Phase 5 세부 계획

### Phase 5.1: 분석 및 설계 (4시간)

**작업 내용**:
1. 모든 Step/DetailView 쌍 분석
   - Step1 + Step1DetailView
   - Step2 + Step2DetailView + Step2_5DetailView
   - Step3 + Step3DetailView + Step4DetailView
   - Step6Simplified (DetailView 불필요)
   - Step7 + Step7DetailView

2. 통합 패턴 설계
   - `mode` prop 추가
   - 조건부 렌더링 전략
   - 상태 관리 (편집 vs 읽기)

3. 영향 범위 파악
   - PlanGroupWizard
   - 상세/편집 페이지
   - 캠프 플로우

**산출물**:
- `wizard-phase5-analysis.md` (상세 분석)
- 통합 패턴 가이드
- 마이그레이션 계획

---

### Phase 5.2: Step1 통합 (3시간)

**작업 내용**:
1. Step1BasicInfo에 `mode` prop 추가
2. 조건부 렌더링 구현
   - edit: Input 컴포넌트
   - readonly: Text 표시
3. Step1DetailView 제거
4. 사용처 업데이트

**예상 코드**:
```typescript
// Before: 2개 파일
Step1BasicInfo.tsx (200 라인)
Step1DetailView.tsx (180 라인)
총: 380 라인

// After: 1개 파일
Step1BasicInfo.tsx (250 라인)
감소: -130 라인 (-34%)
```

---

### Phase 5.3: Step2 통합 (5시간)

**작업 내용**:
1. Step2TimeSettingsWithPreview에 `mode` prop 추가
2. 하위 Panel 컴포넌트에 `mode` 전파
3. Step2DetailView + Step2_5DetailView 제거
4. 읽기 모드 UI 구현

**예상 코드**:
```typescript
// Before: 3개 파일
Step2TimeSettingsWithPreview.tsx (300 라인)
Step2DetailView.tsx (250 라인)
Step2_5DetailView.tsx (200 라인)
총: 750 라인

// After: 1개 파일
Step2TimeSettingsWithPreview.tsx (450 라인)
감소: -300 라인 (-40%)
```

**주의사항**:
- SchedulePreviewPanel은 읽기 전용이므로 변경 불필요
- TimeSettingsPanel만 edit/readonly 처리

---

### Phase 5.4: Step3 통합 (6시간)

**작업 내용**:
1. Step3ContentSelection에 `mode` prop 추가
2. StudentContentsPanel, RecommendedContentsPanel에 `mode` 전파
3. Step3DetailView + Step4DetailView 제거
4. 읽기 모드 UI 구현

**예상 코드**:
```typescript
// Before: 3개 파일
Step3ContentSelection.tsx (200 라인)
Step3DetailView.tsx (280 라인)
Step4DetailView.tsx (250 라인)
총: 730 라인

// After: 1개 파일
Step3ContentSelection.tsx (350 라인)
감소: -380 라인 (-52%)
```

**주의사항**:
- ContentCard에 readonly variant 추가
- RangeSettingModal은 edit 모드에서만 표시

---

### Phase 5.5: Step6 정리 (2시간)

**작업 내용**:
1. Step6DetailView 완전 제거
2. Step6Simplified 사용으로 대체
3. 관련 import 정리

**예상 코드**:
```typescript
// Before: 2개 파일
Step6Simplified.tsx (120 라인)
Step6DetailView.tsx (300 라인)
총: 420 라인

// After: 1개 파일
Step6Simplified.tsx (120 라인)
감소: -300 라인 (-71%)
```

---

### Phase 5.6: Step7 통합 (3시간)

**작업 내용**:
1. Step7ScheduleResult에 `mode` prop 추가
2. Step7DetailView 제거
3. 읽기 모드 UI 구현

**예상 코드**:
```typescript
// Before: 2개 파일
Step7ScheduleResult.tsx (250 라인)
Step7DetailView.tsx (220 라인)
총: 470 라인

// After: 1개 파일
Step7ScheduleResult.tsx (320 라인)
감소: -150 라인 (-32%)
```

---

### Phase 5.7: 사용처 업데이트 (4시간)

**작업 내용**:
1. **플랜 그룹 상세 페이지**
   - DetailView → Step 컴포넌트 (mode="readonly")

2. **플랜 그룹 편집 페이지**
   - 조건부로 mode 전달

3. **캠프 플로우**
   - 학생 제출 후 → readonly
   - 관리자 계속 → edit

4. **템플릿 페이지**
   - readonly 모드

**영향 파일**:
```
app/(student)/plan/groups/[groupId]/
├── page.tsx (상세)
└── edit/page.tsx (편집)

app/(admin)/admin/camp-templates/
└── [templateId]/page.tsx

app/(student)/camp/
└── [invitationId]/submit/page.tsx
```

---

### Phase 5.8: 테스트 및 버그 수정 (5시간)

**작업 내용**:
1. 수동 테스트
   - 플랜 생성 플로우
   - 플랜 조회 플로우
   - 플랜 편집 플로우
   - 캠프 플로우

2. 버그 수정
   - edit/readonly 전환 문제
   - 스타일링 문제
   - 상태 관리 문제

3. 회귀 테스트
   - 기존 기능 정상 작동 확인

---

### Phase 5.9: 문서화 및 완료 보고서 (2시간)

**작업 내용**:
1. 마이그레이션 가이드
2. 통합 패턴 문서
3. 완료 보고서
4. 테스트 가이드

**산출물**:
- `wizard-phase5-migration-guide.md`
- `wizard-phase5-completion.md`
- `wizard-phase5-testing-guide.md`

---

## 📊 예상 성과

### 코드 감소

| Step | Before | After | 감소 |
|------|--------|-------|------|
| Step1 | 380 | 250 | -34% |
| Step2 | 750 | 450 | -40% |
| Step3 | 730 | 350 | -52% |
| Step6 | 420 | 120 | -71% |
| Step7 | 470 | 320 | -32% |
| **총계** | **2,750** | **1,490** | **-46%** |

### 컴포넌트 감소

| 항목 | Before | After | 변화 |
|------|--------|-------|------|
| Step 컴포넌트 | 7 | 7 | 0 |
| DetailView | 7 | 0 | -7 |
| **총계** | **14** | **7** | **-50%** |

---

## 🔧 기술적 고려사항

### 1. Mode Prop 패턴

```typescript
// 기본 패턴
type ViewMode = "edit" | "readonly";

type StepProps = {
  data: WizardData;
  onUpdate?: (updates: Partial<WizardData>) => void;
  mode?: ViewMode;
  locked?: string[];
};
```

### 2. 조건부 렌더링 전략

```typescript
// 방법 1: 인라인 조건부
{mode === "edit" ? (
  <Input />
) : (
  <Text />
)}

// 방법 2: 공통 컴포넌트
<EditableField 
  mode={mode}
  value={data.name}
  onChange={handleChange}
/>
```

### 3. 스타일링 통합

```typescript
// readonly 모드 스타일
const readonlyClasses = cn(
  "rounded-lg border border-gray-200 bg-gray-50 p-3",
  "text-gray-900"
);

// edit 모드 스타일 (기존 유지)
```

### 4. 이벤트 핸들러

```typescript
// edit 모드에서만 호출
const handleChange = (value: string) => {
  if (mode === "edit") {
    onUpdate?.({ name: value });
  }
};
```

---

## 🎯 우선순위

### Critical (P0)
- Step1, Step2, Step3 통합
- 사용처 업데이트

### High (P1)
- Step6, Step7 통합
- 테스트 및 버그 수정

### Medium (P2)
- 문서화
- 성능 최적화

---

## 🚧 위험 요소 및 완화 전략

### 위험 1: 복잡도 증가
**문제**: Step 컴포넌트가 너무 복잡해질 수 있음

**완화**:
- EditableField 같은 공통 컴포넌트 생성
- 조건부 로직 최소화
- 명확한 주석

---

### 위험 2: 기존 기능 손상
**문제**: 리팩토링 중 버그 발생

**완화**:
- 단계별 진행 (Step1 → Step2 → ...)
- 각 단계마다 테스트
- 롤백 계획

---

### 위험 3: 사용처 누락
**문제**: DetailView 사용처를 모두 찾지 못함

**완화**:
- 전역 검색 (grep)
- TypeScript 타입 체크
- 컴파일 에러 확인

---

## ✅ 완료 기준

### Phase 5 완료 조건

- [ ] 모든 DetailView 파일 제거 (7개)
- [ ] Step 컴포넌트에 mode prop 추가 (7개)
- [ ] 사용처 업데이트 (4개 페이지)
- [ ] 테스트 통과 (플랜 생성/조회/편집/캠프)
- [ ] 코드 리뷰 완료
- [ ] 문서화 완료

---

## ⏱️ 예상 일정

```
Week 1
├── Day 1-2: Phase 5.1 분석 및 설계 (4h)
├── Day 3: Phase 5.2 Step1 통합 (3h)
└── Day 4-5: Phase 5.3 Step2 통합 (5h)

Week 2
├── Day 1-2: Phase 5.4 Step3 통합 (6h)
├── Day 3: Phase 5.5 Step6 정리 (2h)
├── Day 4: Phase 5.6 Step7 통합 (3h)
└── Day 5: Phase 5.7 사용처 업데이트 시작 (2h)

Week 3
├── Day 1-2: Phase 5.7 사용처 업데이트 완료 (2h)
├── Day 3-4: Phase 5.8 테스트 및 버그 수정 (5h)
└── Day 5: Phase 5.9 문서화 (2h)

총: 34시간 (3주)
```

---

## 📦 제공 예정 파일

### 통합 컴포넌트 (7개)
```
app/(student)/plan/new-group/_components/
├── Step1BasicInfo.tsx (mode 지원)
├── Step2TimeSettingsWithPreview.tsx (mode 지원)
├── Step3ContentSelection.tsx (mode 지원)
├── Step6Simplified.tsx (이미 완료)
└── Step7ScheduleResult.tsx (mode 지원)
```

### 삭제 예정 파일 (7개)
```
app/(student)/plan/new-group/_components/
├── Step1DetailView.tsx ❌
├── Step2DetailView.tsx ❌
├── Step2_5DetailView.tsx ❌
├── Step3DetailView.tsx ❌
├── Step4DetailView.tsx ❌
├── Step6DetailView.tsx ❌
└── Step7DetailView.tsx ❌
```

### 문서 (3개)
```
docs/
├── wizard-phase5-analysis.md
├── wizard-phase5-migration-guide.md
└── wizard-phase5-completion.md
```

---

## 🎓 기대 효과

### 1. 코드 품질
- ✅ 중복 제거 (-1,260 라인, -46%)
- ✅ 단일 진실 공급원 (Single Source of Truth)
- ✅ 유지보수성 향상

### 2. 개발 생산성
- ✅ 수정 시 1곳만 변경
- ✅ 버그 발생 가능성 감소
- ✅ 새 기능 추가 용이

### 3. 번들 크기
- ✅ 약 100KB 감소 (예상)
- ✅ 더 빠른 로딩

### 4. 타입 안전성
- ✅ 동일한 타입 사용
- ✅ TypeScript 에러 감소

---

## 🚀 다음 단계

### Phase 5 시작 전
1. Phase 4 수동 테스트 완료
2. Phase 4 코드 리뷰 완료
3. 안정화 확인

### Phase 5 시작
1. Phase 5.1 분석 및 설계 착수
2. 상세 마이그레이션 계획 수립
3. Step1 통합부터 단계적 진행

---

## 📞 참고

**관련 문서**:
- `wizard-refactoring-phase1-summary.md` (Phase 1 요약)
- `wizard-phase2-final-completion.md` (Phase 2 완료)
- `wizard-phase3-completion.md` (Phase 3 완료)
- `wizard-phase4-completion.md` (Phase 4 완료)

**계획 문서**:
- `camp-plan.plan.md` (전체 계획)

---

**작성일**: 2025년 11월 29일  
**예상 기간**: 34시간 (3주)  
**상태**: 계획 완료, 시작 대기

---

**Phase 5 준비 완료! 사용자 승인 후 시작 가능합니다.** 🚀


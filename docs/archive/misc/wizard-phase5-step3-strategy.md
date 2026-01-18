# 📋 Phase 5.4: Step3/4 통합 전략

**작성일**: 2025년 11월 29일  
**Phase**: 5.4 - Step3/4 통합  
**상태**: 전략 확정

---

## 🎯 핵심 인사이트

### Phase 3의 가치 재발견!

**Phase 3에서 이미 통합 완료!**

- Step3ContentSelection: 학생 + 추천 콘텐츠 탭 UI
- StudentContentsPanel: 학생 콘텐츠 표시
- RecommendedContentsPanel: 추천 콘텐츠 표시

**결론**: Step2와 동일한 전략 - 기존 컴포넌트 재사용!

---

## 📊 DetailView 분석

### Step3DetailView.tsx (66 라인)

**표시 내용**:
- 학생 콘텐츠 목록
- 콘텐츠 타입 (책/강의/커스텀)
- 범위 정보
- 제목/부제목

### Step4DetailView.tsx (66 라인)

**표시 내용**:
- 추천 콘텐츠 목록
- 동일한 UI 패턴
- 보라색 배지

**공통점**:
- 거의 동일한 코드
- 색상과 레이블만 다름
- 단순 리스트 표시

---

## 🎨 통합 전략

### Step 1: Step3ContentSelection 재사용

```typescript
// PlanGroupDetailView.tsx

// Before
import Step3DetailView from "./Step3DetailView";
import Step4DetailView from "./Step4DetailView";

// After
import { Step3ContentSelection } from "@/app/(student)/plan/new-group/_components/Step3ContentSelection";
```

### Step 2: Props 변환

```typescript
// contents를 student_contents + recommended_contents로 분리
const studentContents = contents.filter(c => !c.isRecommended);
const recommendedContents = contents.filter(c => c.isRecommended);

// WizardData 형식으로 변환
const wizardData = {
  ...planGroupToWizardData(group, exclusions, academySchedules),
  student_contents: studentContents.map(c => ({
    content_id: c.content_id,
    content_type: c.content_type,
    start_range: c.start_range,
    end_range: c.end_range,
    subject_category: c.contentSubtitle,
    title: c.contentTitle,
  })),
  recommended_contents: recommendedContents.map(c => ({
    content_id: c.content_id,
    content_type: c.content_type,
    start_range: c.start_range,
    end_range: c.end_range,
    subject_category: c.contentSubtitle,
    title: c.contentTitle,
  })),
};
```

### Step 3: 사용

```typescript
<Step3ContentSelection
  data={wizardData}
  onUpdate={() => {}} // 읽기 전용
  isCampMode={false}
  isEditMode={false}
  studentId={group.student_id}
  editable={false} // 읽기 전용
/>
```

---

## ✅ 장점

### 1. Phase 3의 성과 활용
- ✅ 탭 UI (학생/추천 통합)
- ✅ ContentCard 재사용
- ✅ 일관된 UI/UX

### 2. 작업 간소화
- ✅ Step3 자체 수정 불필요
- ✅ editable prop 이미 지원
- ✅ 빠른 구현

### 3. 코드 제거
- ✅ Step3DetailView: 66 라인 제거
- ✅ Step4DetailView: 66 라인 제거
- ✅ 총 132 라인 제거

---

## 📋 구현 단계

### Step 1: Adapter 함수 확장 (30분)
```typescript
// planGroupAdapters.ts에 추가
export function contentsToWizardFormat(
  contents: Array<PlanContent & { contentTitle: string; contentSubtitle: string | null; isRecommended: boolean }>
) {
  const studentContents = contents
    .filter(c => !c.isRecommended)
    .map(c => ({
      content_id: c.content_id,
      content_type: c.content_type,
      start_range: c.start_range,
      end_range: c.end_range,
      subject_category: c.contentSubtitle || undefined,
      title: c.contentTitle,
    }));

  const recommendedContents = contents
    .filter(c => c.isRecommended)
    .map(c => ({
      content_id: c.content_id,
      content_type: c.content_type,
      start_range: c.start_range,
      end_range: c.end_range,
      subject_category: c.contentSubtitle || undefined,
      title: c.contentTitle,
    }));

  return { studentContents, recommendedContents };
}
```

### Step 2: PlanGroupDetailView 수정 (30분)
- Tab 4, 5를 하나로 통합
- Step3ContentSelection 사용

### Step 3: Step3/4DetailView 제거 (10분)

**총 예상 시간**: 1시간 (계획 대비 83% 단축!)

---

## 🎉 결론

### 핵심
**Phase 3에서 이미 모든 준비 완료!**

Step3ContentSelection:
- 탭 UI로 학생/추천 통합
- editable prop 지원
- ContentCard 재사용

### 작업 범위
- ❌ Step3 자체 수정 **불필요**
- ❌ 새로운 컴포넌트 **불필요**
- ✅ Adapter 함수 확장
- ✅ PlanGroupDetailView만 수정

### 예상 효과
- **코드 제거**: 132 라인 (Step3 + Step4 DetailView)
- **재사용**: 100%
- **작업 시간**: 6시간 → 1시간 (83% 단축)

---

**작성일**: 2025년 11월 29일  
**소요 시간**: 15분 (전략 수립)  
**상태**: 전략 확정  
**다음**: Adapter 함수 확장


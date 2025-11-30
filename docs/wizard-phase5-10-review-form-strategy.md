# CampPlanGroupReviewForm 통합 전략

**작성일**: 2025년 11월 29일  
**목표**: CampPlanGroupReviewForm의 TODO 플레이스홀더를 Step 컴포넌트로 교체  
**예상 시간**: 2-3시간

---

## 📋 현재 상황 분석

### 파일 정보
- **위치**: `app/(admin)/admin/camp-templates/[id]/participants/[groupId]/review/CampPlanGroupReviewForm.tsx`
- **총 라인**: 398
- **역할**: 캠프 참여자가 제출한 플랜 그룹을 관리자가 검토하는 페이지

### TODO 항목 (4개)
```typescript
Line 11-14: import 주석 처리
// TODO Phase 5: DetailView를 Step 컴포넌트로 교체 필요
// import { Step1DetailView } from "@/app/(student)/plan/group/[id]/_components/Step1DetailView";
// import { Step2DetailView } from "@/app/(student)/plan/group/[id]/_components/Step2DetailView";
// import { Step3DetailView } from "@/app/(student)/plan/group/[id]/_components/Step3DetailView";

Line 356-358: Step 1 플레이스홀더
{/* TODO Phase 5: Step1BasicInfo로 교체 */}
<div className="text-gray-500">기본 정보 표시 (Phase 5 TODO)</div>

Line 362-365: Step 2 플레이스홀더
{/* TODO Phase 5: Step2TimeSettingsWithPreview로 교체 */}
<div className="text-gray-500">시간 설정 표시 (Phase 5 TODO)</div>

Line 388-390: Step 4 플레이스홀더
{/* TODO Phase 5: Step3ContentSelection으로 교체 */}
<div className="text-gray-500">콘텐츠 표시 (Phase 5 TODO)</div>
```

### 현재 데이터 구조
```typescript
props: {
  templateId: string;
  groupId: string;
  group: PlanGroup;
  contents: PlanContent[];
  exclusions: PlanExclusion[];
  academySchedules: AcademySchedule[];
  templateBlocks?: Array<...>;
  templateBlockSetName?: string | null;
  studentInfo?: {...} | null;
}
```

### 탭 구조 (5개)
```typescript
currentTab: "overview" | "step1" | "step2" | "step3" | "step4"

1. overview: 플랜 그룹 개요 (완료)
2. step1: 기본 정보 (TODO)
3. step2: 블록 및 제외일 (TODO)
4. step3: 스케줄 확인 (부분 완료)
5. step4: 콘텐츠 선택 (TODO)
```

---

## 🎯 교체할 Step 컴포넌트

### 1. Step1BasicInfo
**경로**: `app/(student)/plan/new-group/_components/Step1BasicInfo.tsx`

**필요한 wizardData 필드**:
```typescript
{
  name: string;
  planPurpose: string;
  periodStart: string;
  periodEnd: string;
  blockSetId?: string;
  blockSetName?: string;
  schedulerType: string;
}
```

**props**:
```typescript
<Step1BasicInfo
  data={wizardData}
  mode="readonly"
  campMode={true}
  isTemplateMode={false}
  lockedFields={["blockSetId", "schedulerType"]}
/>
```

---

### 2. Step2TimeSettingsWithPreview
**경로**: `app/(student)/plan/new-group/_components/Step2TimeSettingsWithPreview.tsx`

**필요한 wizardData 필드**:
```typescript
{
  exclusions: PlanExclusion[];
  academySchedules: AcademySchedule[];
  blocks?: Array<...>;
  // timeConfig 관련 필드
}
```

**props**:
```typescript
<Step2TimeSettingsWithPreview
  data={wizardData}
  onUpdate={() => {}}
  mode="readonly"
  campMode={true}
  studentId={group.student_id}
/>
```

---

### 3. Step3ContentSelection (현재는 Step 4)
**경로**: `app/(student)/plan/new-group/_components/Step3ContentSelection.tsx`

**필요한 wizardData 필드**:
```typescript
{
  studentContents: Array<...>;
  recommendedContents: Array<...>;
}
```

**props**:
```typescript
<Step3ContentSelection
  data={wizardData}
  onUpdate={() => {}}
  mode="readonly"
  campMode={true}
  studentId={group.student_id}
/>
```

---

## 🔧 구현 전략

### Phase 1: Adapter 함수 확장 (30분)

**목표**: `planGroupToWizardData`에 CampPlanGroupReviewForm 전용 로직 추가

**작업**:
1. `lib/utils/planGroupAdapters.ts` 읽기
2. 현재 함수 분석
3. 필요한 필드 추가
4. 타입 안전성 확보

**예상 코드**:
```typescript
// lib/utils/planGroupAdapters.ts

export function planGroupToWizardDataForReview(
  group: PlanGroup,
  contents: PlanContent[],
  exclusions: PlanExclusion[],
  academySchedules: AcademySchedule[],
  templateBlocks?: Array<{...}>,
  templateBlockSetName?: string | null,
): WizardData {
  const studentContents = contents
    .filter((c) => !(c as any).is_recommended)
    .map((c) => ({
      ...c,
      contentTitle: (c as any).contentTitle || "알 수 없음",
      contentSubtitle: (c as any).contentSubtitle || null,
      isRecommended: false,
    }));

  const recommendedContents = contents
    .filter((c) => (c as any).is_recommended)
    .map((c) => ({
      ...c,
      contentTitle: (c as any).contentTitle || "알 수 없음",
      contentSubtitle: (c as any).contentSubtitle || null,
      isRecommended: true,
    }));

  return {
    // Step 1
    name: group.name || "",
    planPurpose: group.plan_purpose || "",
    periodStart: group.period_start || "",
    periodEnd: group.period_end || "",
    blockSetId: group.block_set_id || undefined,
    blockSetName: templateBlockSetName || undefined,
    schedulerType: group.scheduler_type || "",
    
    // Step 2
    exclusions: exclusions || [],
    academySchedules: academySchedules || [],
    blocks: templateBlocks || [],
    
    // Step 3 (Content Selection)
    studentContents,
    recommendedContents,
    
    // 기타
    studentId: group.student_id || undefined,
  };
}
```

---

### Phase 2: Step 컴포넌트 import (10분)

**작업**:
```typescript
// CampPlanGroupReviewForm.tsx

import { Step1BasicInfo } from "@/app/(student)/plan/new-group/_components/Step1BasicInfo";
import { Step2TimeSettingsWithPreview } from "@/app/(student)/plan/new-group/_components/Step2TimeSettingsWithPreview";
import { Step3ContentSelection } from "@/app/(student)/plan/new-group/_components/Step3ContentSelection";
import { planGroupToWizardDataForReview } from "@/lib/utils/planGroupAdapters";
```

---

### Phase 3: wizardData 생성 (15분)

**작업**:
```typescript
// CampPlanGroupReviewForm.tsx 내부

const wizardData = useMemo(() => {
  return planGroupToWizardDataForReview(
    group,
    studentContentsWithDetails,
    exclusions,
    academySchedules,
    templateBlocks,
    templateBlockSetName
  );
}, [
  group,
  studentContentsWithDetails,
  exclusions,
  academySchedules,
  templateBlocks,
  templateBlockSetName,
]);
```

---

### Phase 4: 탭 컨텐츠 교체 (45분)

#### Step 1 교체
```typescript
{currentTab === "step1" && (
  <div className="rounded-lg border border-gray-200 bg-white p-6">
    <Step1BasicInfo
      data={wizardData}
      onUpdate={() => {}} // readonly이므로 빈 함수
      mode="readonly"
      campMode={true}
      isTemplateMode={false}
      lockedFields={["blockSetId", "schedulerType"]}
    />
  </div>
)}
```

#### Step 2 교체
```typescript
{currentTab === "step2" && (
  <div className="rounded-lg border border-gray-200 bg-white p-6">
    <Step2TimeSettingsWithPreview
      data={wizardData}
      onUpdate={() => {}}
      mode="readonly"
      campMode={true}
      studentId={group.student_id}
    />
  </div>
)}
```

#### Step 4 교체 (Content Selection)
```typescript
{currentTab === "step4" && (
  <div className="rounded-lg border border-gray-200 bg-white p-6">
    <Step3ContentSelection
      data={wizardData}
      onUpdate={() => {}}
      mode="readonly"
      campMode={true}
      studentId={group.student_id}
    />
  </div>
)}
```

---

### Phase 5: Step 3 개선 (30분)

**현재 상태**: 간단한 텍스트만 표시  
**개선 방안**: SchedulePreviewPanel 재사용 가능하지만, 이 페이지는 검토용이므로 현재 상태 유지

**선택 사항**: 필요하면 나중에 추가

---

## 🚨 예상 이슈 및 해결책

### 이슈 1: WizardData 타입 불일치
**증상**: wizardData의 일부 필드가 undefined  
**해결**: optional 처리 및 기본값 제공

### 이슈 2: contentTitle/contentSubtitle 누락
**증상**: 콘텐츠 정보가 표시되지 않음  
**해결**: 이미 `studentContentsWithDetails`에서 처리 완료

### 이슈 3: onUpdate 함수 호출
**증상**: readonly 모드인데 onUpdate 호출 시도  
**해결**: 빈 함수 제공, Step 컴포넌트에서 mode="readonly"로 input 비활성화

### 이슈 4: lockedFields 전달
**증상**: 캠프 모드에서 특정 필드 잠금 필요  
**해결**: `lockedFields` prop으로 blockSetId, schedulerType 잠금

---

## 📊 작업 예상 시간

```
Phase 1: Adapter 함수 확장 - 30분
Phase 2: Step 컴포넌트 import - 10분
Phase 3: wizardData 생성 - 15분
Phase 4: 탭 컨텐츠 교체 - 45분
Phase 5: Step 3 개선 - 30분 (선택)
테스트 및 검증 - 30분
문서화 및 커밋 - 20분

총: 2시간 30분 ~ 3시간
```

---

## ✅ 완료 기준

### 기능적 완료
- [ ] Step1BasicInfo 정상 표시
- [ ] Step2TimeSettingsWithPreview 정상 표시
- [ ] Step3ContentSelection 정상 표시
- [ ] 모든 데이터가 정확하게 표시됨
- [ ] readonly 모드 동작 확인

### 코드 품질
- [ ] TODO 주석 모두 제거
- [ ] 타입 에러 0개
- [ ] Linter 에러 0개
- [ ] 중복 로직 제거

### 문서화
- [ ] 전략 문서 작성
- [ ] 구현 문서 작성
- [ ] 커밋 메시지 작성

---

## 🎯 다음 단계

1. **Phase 1**: Adapter 함수 확장
2. **Phase 2**: Step 컴포넌트 import
3. **Phase 3**: wizardData 생성
4. **Phase 4**: 탭 컨텐츠 교체
5. **Phase 5**: 테스트 및 검증
6. **Phase 6**: 문서화 및 커밋

---

**준비 완료!** 🚀

다음: Phase 1 (Adapter 함수 확장) 시작


# 📋 Phase 5.3: Step2 통합 전략

**작성일**: 2025년 11월 29일  
**Phase**: 5.3 - Step2 통합  
**상태**: 전략 수립 완료

---

## 🎯 핵심 인사이트

### 발견: Step2_5DetailView = SchedulePreviewPanel

**Step2_5DetailView (426 라인)**과 **SchedulePreviewPanel (Phase 2)** 은 **동일한 기능**을 수행합니다!

```typescript
// Step2_5DetailView.tsx (426 라인)
- calculateScheduleAvailability API 호출
- 로딩/에러 상태 관리
- 주간/일별 스케줄 표시
- 통계 카드

// SchedulePreviewPanel.tsx (Phase 2)
- calculateScheduleAvailability API 호출
- 로딩/에러 상태 관리
- 주간/일별 스케줄 표시
- 통계 카드
```

**결론**: 별도 통합 불필요! 기존 컴포넌트 재사용하면 됨.

---

## 📊 Step2 DetailView 구조 분석

### 1. Step2DetailView.tsx (133 라인)

**표시 내용**:
- 블록 세트 정보
- 학원 일정 목록
- 제외일 목록

**특징**:
- 간단한 정보 표시
- 섹션별 구분
- 리스트 형태

### 2. Step2_5DetailView.tsx (426 라인)

**표시 내용**:
- 스케줄 미리보기
- 일별 가능 시간
- 주별 통계
- 월별 캘린더

**특징**:
- 복잡한 계산 로직
- 실시간 데이터 조회
- 캘린더 UI

---

## 🎨 통합 전략 (간소화)

### 기존 계획 (복잡함)
```
Step2TimeSettingsWithPreview.tsx에 mode prop 추가
→ Step2DetailView 통합
→ Step2_5DetailView 통합
→ 복잡한 리팩토링
```

### 새로운 전략 (간단함)

#### Step 1: PlanGroupDetailView 업데이트
```typescript
// Before
import Step2DetailView from "./Step2DetailView";
import Step2_5DetailView from "./Step2_5DetailView";

// After
import { Step2TimeSettingsWithPreview } from "@/app/(student)/plan/new-group/_components/Step2TimeSettingsWithPreview";
```

#### Step 2: Props 변환
```typescript
// PlanGroup → WizardData 변환 함수
function planGroupToWizardData(group: PlanGroup): Partial<WizardData> {
  return {
    exclusions: exclusions.map(e => ({
      exclusion_date: e.exclusion_date,
      exclusion_type: e.exclusion_type,
      reason: e.reason,
    })),
    academy_schedules: academySchedules.map(a => ({
      day_of_week: a.day_of_week,
      start_time: a.start_time,
      end_time: a.end_time,
      academy_name: a.academy_name,
    })),
    // ... 기타 필드
  };
}
```

#### Step 3: 사용
```typescript
<Step2TimeSettingsWithPreview
  data={planGroupToWizardData(group)}
  onUpdate={() => {}} // 읽기 전용이므로 빈 함수
  blockSets={[]}
  studentId={group.student_id}
  editable={false} // 읽기 전용
  campMode={false}
  isTemplateMode={false}
  lockedFields={[]}
/>
```

---

## ✅ 장점

### 1. 코드 재사용
- ✅ 기존 Step2TimeSettingsWithPreview 그대로 사용
- ✅ SchedulePreviewPanel 재사용
- ✅ 중복 제거

### 2. 작업 간소화
- ✅ Step2 자체 수정 불필요
- ✅ 새로운 mode prop 불필요 (`editable` 이미 있음)
- ✅ 빠른 구현

### 3. 유지보수
- ✅ 단일 진실 공급원
- ✅ 버그 수정 1곳만
- ✅ 기능 추가 1곳만

---

## 🚧 고려사항

### 1. Props 타입 불일치

**문제**: WizardData vs PlanGroup/PlanExclusion/AcademySchedule

**해결**: Adapter 함수 생성

```typescript
function planGroupToWizardData(
  group: PlanGroup,
  exclusions: PlanExclusion[],
  academySchedules: AcademySchedule[]
): Partial<WizardData> {
  return {
    name: group.name,
    plan_purpose: group.plan_purpose || "",
    scheduler_type: group.scheduler_type || "",
    scheduler_options: group.scheduler_options as any,
    period_start: group.period_start,
    period_end: group.period_end,
    target_date: group.target_date || undefined,
    block_set_id: group.block_set_id,
    exclusions: exclusions.map(e => ({
      exclusion_date: e.exclusion_date,
      exclusion_type: e.exclusion_type as any,
      reason: e.reason || undefined,
      source: "student",
    })),
    academy_schedules: academySchedules.map(a => ({
      day_of_week: a.day_of_week,
      start_time: a.start_time,
      end_time: a.end_time,
      academy_name: a.academy_name || undefined,
      subject: a.subject || undefined,
      travel_time: a.travel_time || undefined,
    })),
    time_settings: (group.scheduler_options as any)?.time_settings,
    non_study_time_blocks: [],
    student_contents: [],
    recommended_contents: [],
  };
}
```

### 2. Lazy Loading 경로

**문제**: 현재는 동일 폴더, 변경 후 다른 폴더

```typescript
// Before
import("./Step2DetailView")

// After
import("@/app/(student)/plan/new-group/_components/Step2TimeSettingsWithPreview")
```

### 3. editable Prop

**현재**: Step2TimeSettingsWithPreview는 이미 `editable` prop 지원

```typescript
// 읽기 전용
<Step2TimeSettingsWithPreview
  editable={false}
/>
```

**결론**: 추가 작업 불필요!

---

## 📋 구현 단계

### Step 1: Adapter 함수 생성 (30분)
```
/lib/utils/planGroupAdapters.ts
- planGroupToWizardData()
```

### Step 2: PlanGroupDetailView 수정 (1시간)
```
1. Step2TimeSettingsWithPreview import
2. lazy loading 설정
3. adapter 함수 사용
4. 탭 2, 3에 적용
```

### Step 3: Step2/Step2_5DetailView 제거 (30분)
```
1. 파일 삭제
2. import 정리
3. 확인
```

### Step 4: 테스트 (1시간)
```
1. 플랜 상세 페이지
2. 탭 전환
3. 스케줄 미리보기
```

**총 예상 시간**: 3시간

---

## 🎉 결론

### 핵심 발견
**Phase 2에서 이미 필요한 모든 컴포넌트를 만들었습니다!**

- SchedulePreviewPanel = Step2_5DetailView
- Step2TimeSettingsWithPreview = Step2 + Step2_5
- editable prop = 읽기/편집 모드

### 작업 범위
- ❌ Step2 자체 수정 **불필요**
- ❌ 새로운 컴포넌트 생성 **불필요**
- ✅ Adapter 함수만 추가
- ✅ PlanGroupDetailView만 수정

### 예상 효과
- **코드 감소**: Step2DetailView (133) + Step2_5DetailView (426) = **559 라인 제거**
- **재사용**: 기존 컴포넌트 100% 재사용
- **유지보수**: 1곳에서만 관리

---

**작성일**: 2025년 11월 29일  
**소요 시간**: 30분 (전략 수립)  
**상태**: 전략 확정  
**다음**: Adapter 함수 구현


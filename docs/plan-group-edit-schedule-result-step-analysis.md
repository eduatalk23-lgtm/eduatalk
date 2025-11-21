# 플랜 그룹 수정 페이지 스케줄 결과 Step 추가 분석 및 제안

## 📋 현재 상황 분석

### 1. 현재 구조
- **PlanGroupWizard**: 6단계로 구성된 마법사 폼
  - Step 1: 기본 정보
  - Step 2: 블록 및 제외일
  - Step 3: 스케줄 확인 (Step2_5SchedulePreview) - **스케줄링 전 미리보기**
  - Step 4: 콘텐츠 선택
  - Step 5: 추천 콘텐츠
  - Step 6: 최종 확인

- **플랜 생성 흐름**:
  1. 플랜 그룹 생성/수정 (Wizard 완료)
  2. 플랜 그룹 상세 페이지에서 `GeneratePlansButton` 클릭
  3. `generatePlansFromGroupAction` 실행 → `student_plan` 테이블에 플랜 생성

### 2. 데이터 구조
- **student_plan 테이블**:
  - `plan_date`: 날짜 (YYYY-MM-DD)
  - `block_index`: 시간 블록 인덱스
  - `content_type`: 콘텐츠 유형 (book/lecture/custom)
  - `content_id`: 콘텐츠 ID
  - `planned_start_page_or_time`: 시작 페이지/회차
  - `planned_end_page_or_time`: 종료 페이지/회차
  - `chapter`: 단원명 (nullable)
  - `is_reschedulable`: 재스케줄 가능 여부

- **학습 완료 관련**:
  - `completed_amount`: 완료된 양 (nullable)
  - 진행률 계산: `completed_amount / (planned_end - planned_start) * 100`

## 🎯 요구사항 분석

### 시스템 프롬프트 기반 필드 요구사항
시스템 프롬프트에서 요구하는 표 형식 필드:

| 필드명 | 타입 | 설명 | 매핑 |
|--------|------|------|------|
| 주차 및 일차 | string | "1주차-1일" 형식 | 계산 필요 |
| 날짜 | date (YYYY-MM-DD) | 학습 날짜 | `plan_date` |
| 시간 | time (HH:MM) | 학습 시간 | `block_index` → 시간 블록 조회 |
| 교과 | string | 교과명 | 콘텐츠의 `subject_category` |
| 과목 | string | 과목명 | 콘텐츠의 `subject` |
| 교재/강의 유형 | string | "강의" / "교재" | `content_type` |
| 교재/강의 이름 | string | 콘텐츠 제목 | 콘텐츠 조회 필요 |
| 학습내역 | string | 단원명 등 | `chapter` 또는 계산 |
| 회차 | number | 동일 교재/강의 진행 횟수 | 계산 필요 |
| 예상 소요시간 | number (분) | 학습 예상 시간 | 블록 시간 계산 |
| 학습 분량 | string | "10-14p" 또는 "12강" | `planned_start_page_or_time` ~ `planned_end_page_or_time` |

### 추가 요구사항
1. **다양한 뷰 형식**: 목록, 캘린더, 표
2. **학습 완료 체킹**: 각 플랜의 완료 상태 표시 및 업데이트
3. **실시간 반영**: 플랜 그룹 수정 후 즉시 스케줄 결과 확인

## 💡 개선 방향 제안

### 방안 1: Step 7 추가 (스케줄 결과 확인) ⭐ 추천

**장점**:
- 기존 플로우와 자연스럽게 통합
- 스케줄링 완료 후 결과를 바로 확인 가능
- 학습 완료 체킹 기능 추가 용이

**구현 방식**:
1. Step 6 (최종 확인) 완료 후 플랜 생성
2. Step 7에서 생성된 플랜 결과 표시
3. 다양한 뷰 형식 제공 (목록/캘린더/표)

**단점**:
- 플랜 생성이 실패할 경우 처리 필요
- 플랜 생성 시간이 길 경우 로딩 처리 필요

### 방안 2: 별도 페이지로 분리

**장점**:
- 플랜 그룹 수정과 독립적
- 더 많은 공간 활용 가능

**단점**:
- 플로우가 분리되어 사용자 경험 저하
- 페이지 이동 필요

### 방안 3: Step 3 확장 (스케줄 확인 + 결과)

**장점**:
- 기존 Step 활용

**단점**:
- Step 3은 스케줄링 전 미리보기이므로 혼란 가능
- 역할이 모호해짐

## 🏗 구현 제안 (방안 1 기준)

### 1. Step 7 컴포넌트 구조

```
Step7ScheduleResult/
├── ScheduleResultView.tsx          # 메인 컴포넌트
├── ScheduleTableView.tsx           # 표 형식 뷰
├── ScheduleListView.tsx            # 목록 형식 뷰
├── ScheduleCalendarView.tsx         # 캘린더 형식 뷰
├── ScheduleCompletionCheck.tsx     # 완료 체킹 컴포넌트
└── utils/
    ├── scheduleTransform.ts         # 데이터 변환 유틸
    └── completionUtils.ts           # 완료 체킹 유틸
```

### 2. 데이터 변환 로직

```typescript
// scheduleTransform.ts
export function transformPlansToScheduleTable(
  plans: StudentPlan[],
  contents: ContentMap,
  blocks: BlockMap
): ScheduleTableRow[] {
  // 주차 계산
  // 회차 계산 (같은 콘텐츠의 연속된 플랜 카운트)
  // 시간 블록 조회
  // 콘텐츠 정보 조회
  // 학습 분량 포맷팅
}
```

### 3. 뷰 전환 기능

- 탭 또는 버튼으로 뷰 전환
- 사용자 선호도 저장 (localStorage)

### 4. 학습 완료 체킹

**기능**:
- 각 플랜 항목에 체크박스 또는 진행률 표시
- 완료 시 `completed_amount` 업데이트
- 일괄 완료 처리
- 완료율 통계 표시

**UI 패턴**:
```tsx
<ScheduleItem>
  <Checkbox checked={isCompleted} onChange={handleComplete} />
  <ProgressBar value={completionRate} />
  <CompletionBadge status={completionStatus} />
</ScheduleItem>
```

### 5. 필터링 및 검색

- 날짜 범위 필터
- 과목별 필터
- 완료/미완료 필터
- 검색 (콘텐츠명, 단원명)

### 6. 통계 대시보드

- 전체 완료율
- 주차별 완료율
- 과목별 완료율
- 일일 학습량 통계

## 📊 데이터 흐름

```
1. Step 6 완료
   ↓
2. 플랜 그룹 저장/업데이트
   ↓
3. 플랜 생성 (generatePlansFromGroupAction)
   ↓
4. student_plan 데이터 조회
   ↓
5. 관련 데이터 조회 (콘텐츠, 블록)
   ↓
6. 데이터 변환 (표 형식으로)
   ↓
7. Step 7 렌더링 (다양한 뷰)
   ↓
8. 학습 완료 체킹 (선택적)
```

## 🔧 기술 구현 상세

### 1. PlanGroupWizard 수정

```typescript
// PlanGroupWizard.tsx
type WizardStep = 1 | 2 | 3 | 4 | 5 | 6 | 7; // Step 7 추가

const stepLabels = [
  "기본 정보",
  "블록 및 제외일",
  "스케줄 확인",
  "콘텐츠 선택",
  "추천 콘텐츠",
  "최종 확인",
  "스케줄 결과", // 추가
];
```

### 2. Step 6 수정

Step 6 완료 시 플랜 생성 후 Step 7로 이동:

```typescript
const handleSubmit = async () => {
  // 플랜 그룹 저장
  await updatePlanGroupAction(...);
  
  // 플랜 생성
  const result = await generatePlansFromGroupAction(groupId);
  
  // Step 7로 이동
  setCurrentStep(7);
};
```

### 3. Step 7 컴포넌트

```tsx
// Step7ScheduleResult.tsx
export function Step7ScheduleResult({
  groupId,
  onComplete,
}: {
  groupId: string;
  onComplete: () => void;
}) {
  const [viewMode, setViewMode] = useState<"table" | "list" | "calendar">("table");
  const { data: plans, isLoading } = usePlansByGroup(groupId);
  
  if (isLoading) return <LoadingSpinner />;
  
  return (
    <div>
      <ViewModeSelector value={viewMode} onChange={setViewMode} />
      {viewMode === "table" && <ScheduleTableView plans={plans} />}
      {viewMode === "list" && <ScheduleListView plans={plans} />}
      {viewMode === "calendar" && <ScheduleCalendarView plans={plans} />}
      <CompletionStats plans={plans} />
    </div>
  );
}
```

### 4. 표 형식 뷰 (시스템 프롬프트 기준)

```tsx
// ScheduleTableView.tsx
export function ScheduleTableView({ plans }: { plans: ScheduleTableRow[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead>
          <tr>
            <th>주차 및 일차</th>
            <th>날짜</th>
            <th>시간</th>
            <th>교과</th>
            <th>과목</th>
            <th>교재/강의 유형</th>
            <th>교재/강의 이름</th>
            <th>학습내역</th>
            <th>회차</th>
            <th>예상 소요시간</th>
            <th>학습 분량</th>
            <th>완료</th>
          </tr>
        </thead>
        <tbody>
          {plans.map((plan) => (
            <ScheduleTableRow key={plan.id} plan={plan} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

### 5. 학습 완료 체킹

```tsx
// ScheduleCompletionCheck.tsx
export function ScheduleCompletionCheck({ plan }: { plan: StudentPlan }) {
  const [isCompleted, setIsCompleted] = useState(plan.completed_amount !== null);
  const [isUpdating, setIsUpdating] = useState(false);
  
  const handleToggle = async () => {
    setIsUpdating(true);
    try {
      await updatePlanCompletion(plan.id, isCompleted ? null : plan.planned_end);
      setIsCompleted(!isCompleted);
    } finally {
      setIsUpdating(false);
    }
  };
  
  return (
    <Checkbox
      checked={isCompleted}
      onChange={handleToggle}
      disabled={isUpdating}
    />
  );
}
```

## 🎨 UI/UX 개선 사항

### 1. 뷰 전환 애니메이션
- Framer Motion 사용하여 부드러운 전환

### 2. 반응형 디자인
- 모바일: 목록 뷰 기본
- 태블릿: 목록/표 뷰
- 데스크톱: 모든 뷰 지원

### 3. 접근성
- 키보드 네비게이션
- 스크린 리더 지원
- ARIA 레이블

### 4. 성능 최적화
- 가상 스크롤 (대량 데이터)
- 페이지네이션
- 무한 스크롤 옵션

## ✅ 체크리스트

### 필수 기능
- [ ] Step 7 컴포넌트 생성
- [ ] 플랜 데이터 조회 및 변환
- [ ] 표 형식 뷰 (시스템 프롬프트 기준)
- [ ] 목록 형식 뷰
- [ ] 캘린더 형식 뷰
- [ ] 학습 완료 체킹 기능
- [ ] 뷰 전환 기능

### 선택 기능
- [ ] 필터링 및 검색
- [ ] 통계 대시보드
- [ ] 일괄 완료 처리
- [ ] PDF/Excel 내보내기
- [ ] 인쇄 기능

## 🚀 구현 우선순위

1. **Phase 1 (필수)**: Step 7 기본 구조 + 표 형식 뷰
2. **Phase 2**: 목록/캘린더 뷰 + 학습 완료 체킹
3. **Phase 3**: 필터링/검색 + 통계
4. **Phase 4**: 고급 기능 (내보내기, 인쇄 등)

## 📝 참고사항

1. **성능 고려**: 플랜이 많을 경우 (수백 개) 성능 최적화 필요
2. **에러 처리**: 플랜 생성 실패 시 적절한 에러 메시지 및 대안 제공
3. **데이터 일관성**: 플랜 그룹 수정 후 플랜 재생성 시 기존 완료 데이터 처리 방안 필요
4. **사용자 경험**: 플랜 생성 중 로딩 상태 명확히 표시


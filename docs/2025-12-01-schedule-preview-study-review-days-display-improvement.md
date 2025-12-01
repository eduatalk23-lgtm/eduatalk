# 스케줄 미리보기 학습일/복습일 표시 개선

**작업 날짜**: 2025-12-01  
**작업 범위**: 스케줄 미리보기 UI 개선

## 작업 개요

스케줄 미리보기에서 학습일과 복습일 표시를 "25일 + 3일(복습)" 형식으로 통합하여 가독성을 향상시켰습니다.

## 변경 사항

### 1. SchedulePreviewPanel.tsx - 요약 통계 카드 개선

**파일**: `app/(student)/plan/new-group/_components/_panels/SchedulePreviewPanel.tsx`

**변경 내용**:
- 학습일 카드의 라벨을 "학습일"에서 "학습일 + 복습일"로 변경
- 숫자 표시를 "25일 + 3일(복습)" 형식으로 통합 표시
- 복습일이 0일 경우 "+ 0일(복습)" 표시하지 않고 학습일만 표시

**변경 전**:
```tsx
<span className="text-xs font-medium text-gray-500">학습일</span>
<p className="mt-2 text-2xl font-bold text-gray-900">
  {result.summary.total_study_days}
</p>
```

**변경 후**:
```tsx
<span className="text-xs font-medium text-gray-500">학습일 + 복습일</span>
<p className="mt-2 text-2xl font-bold text-gray-900">
  {result.summary.total_study_days}일
  {result.summary.total_review_days > 0 && (
    <> + {result.summary.total_review_days}일(복습)</>
  )}
</p>
```

### 2. ScheduleTableView.tsx - 주차별 스케줄 표시 개선

**파일**: `app/(student)/plan/new-group/_components/Step7ScheduleResult/ScheduleTableView.tsx`

**변경 내용**:
- 주차별 헤더에서 "학습일 X일"과 "복습일 Y일"을 통합 표시
- 복습일이 0일 경우 "학습일 X일"만 표시

**변경 전**:
```tsx
<span>학습일 {weekStudyDays}일</span>
<span>복습일 {weekReviewDays}일</span>
```

**변경 후**:
```tsx
<span>
  학습일 {weekStudyDays}일
  {weekReviewDays > 0 && <> + 복습일 {weekReviewDays}일</>}
</span>
```

## 표시 형식

### 복습일이 있는 경우
- **SchedulePreviewPanel**: "25일 + 3일(복습)"
- **ScheduleTableView**: "학습일 25일 + 복습일 3일"

### 복습일이 0인 경우
- **SchedulePreviewPanel**: "25일"
- **ScheduleTableView**: "학습일 25일"

## 기술적 고려사항

1. **조건부 렌더링**: `{total_review_days > 0 && ...}` 패턴 사용
2. **React Fragment**: `<> + ... </>` 문법으로 추가 DOM 없이 텍스트 추가
3. **일관성 유지**: 두 컴포넌트 모두 동일한 로직 적용
4. **스타일 보존**: 기존 Tailwind 클래스와 레이아웃 유지

## 테스트 시나리오

### ✅ 테스트 완료
1. **복습일이 있는 경우 (예: 학습일 25일, 복습일 3일)**
   - SchedulePreviewPanel: "25일 + 3일(복습)" 형식으로 표시됨 ✓
   - ScheduleTableView: "학습일 25일 + 복습일 3일" 형식으로 표시됨 ✓

2. **복습일이 0인 경우 (예: 학습일 28일, 복습일 0일)**
   - SchedulePreviewPanel: "28일"만 표시됨 ✓
   - ScheduleTableView: "학습일 28일"만 표시됨 ✓

3. **스타일 일관성**
   - 기존 폰트 크기, 색상, 간격 유지됨 ✓
   - 반응형 레이아웃 정상 작동 ✓

## 영향 범위

### 수정된 파일
1. `app/(student)/plan/new-group/_components/_panels/SchedulePreviewPanel.tsx` (312-324줄)
2. `app/(student)/plan/new-group/_components/Step7ScheduleResult/ScheduleTableView.tsx` (1307-1318줄)

### 영향받는 기능
- 학습 계획 그룹 생성 마법사의 스케줄 미리보기 패널
- 학습 계획 그룹 상세 페이지의 주차별 스케줄 표시

## 참고사항

- `result.summary.total_study_days`: 총 학습일 수 (학습일로 분류된 날짜 수)
- `result.summary.total_review_days`: 총 복습일 수 (복습일로 분류된 날짜 수)
- 데이터는 `lib/scheduler/calculateAvailableDates.ts`에서 계산됨

## 향후 개선 가능 사항

1. 주차별 요약에서도 동일한 형식 일관성 유지
2. 모바일 환경에서 긴 텍스트 줄바꿈 처리 최적화
3. 툴팁으로 학습일/복습일 개념 설명 추가 고려


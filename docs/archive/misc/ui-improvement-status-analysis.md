# UI 개선 작업 현황 분석

**작성 일자**: 2025-02-01  
**분석 기준**: Phase 2.1 완료 후 상태

---

## 📊 전체 현황

### ✅ 완료된 작업

#### Phase 1: 중복 코드 제거 및 통합
- ✅ **Phase 1.1**: ScoreCard 컴포넌트 통합
  - `BaseScoreCard` 생성 완료
  - `ScoreCard`, `MockScoreCard` 리팩토링 완료
  - 코드 중복 약 200줄 제거

- ✅ **Phase 1.2**: 상수 정의 통합
  - `lib/constants/planLabels.ts`로 통합 완료
  - 6개 파일에서 로컬 정의 제거

#### Phase 2.1: Margin 클래스 제거 (진행 중)
- ✅ **20개 파일 완료** (우선순위 높은 파일)
  - `app/(student)/plan/new-group/_components/Step7ScheduleResult/ScheduleTableView.tsx`
  - `app/(student)/plan/new-group/_components/Step6FinalReview/Step6FinalReview.tsx`
  - `app/(student)/blocks/_components/AcademyScheduleManagement.tsx`
  - `app/(student)/camp/today/page.tsx`
  - `app/(student)/contents/books/page.tsx`
  - `app/(student)/contents/lectures/page.tsx`
  - `app/(student)/report/monthly/page.tsx`
  - `app/(student)/report/weekly/page.tsx`
  - `app/(student)/scores/mock/[grade]/[month]/[exam-type]/page.tsx`
  - `app/(student)/scores/school/[grade]/[semester]/page.tsx`
  - `app/(student)/dashboard/page.tsx`
  - `app/(student)/plan/group/[id]/page.tsx`
  - `app/(student)/scores/input/page.tsx`
  - `app/(student)/analysis/page.tsx`
  - `app/(student)/plan/new-group/page.tsx`
  - `app/(student)/contents/master-books/page.tsx`
  - `app/(student)/contents/master-lectures/page.tsx`
  - `app/(student)/camp/page.tsx`
  - `app/(student)/plan/calendar/page.tsx`
  - `app/(student)/scores/_components/ScoreCardGrid.tsx`
  - `app/(student)/blocks/_components/BlockManagementContainer.tsx`
  - `app/(student)/plan/_components/PlanGroupListItem.tsx`

---

## 🔍 남은 작업 분석

### Phase 2.1: Margin 클래스 제거 (나머지)

**전체 파일 수**: 316개 (grep 결과)  
**완료 파일 수**: 20개  
**남은 파일 수**: 약 296개

**우선순위 재분류 필요**:
- 계획에는 30개 파일이라고 명시되어 있으나, 실제로는 더 많은 파일이 margin 클래스를 사용 중
- 우선순위가 높은 파일부터 단계적으로 처리 필요

**주요 패턴**:
- `mt-*`, `mb-*`, `ml-*`, `mr-*`, `mx-*`, `my-*` 클래스 사용
- 부모 요소에 `flex flex-col gap-*` 또는 `flex flex-row gap-*` 추가 필요
- 들여쓰기는 `pl-*`로 변환

### Phase 2.2: space-y/space-x 제거

**전체 파일 수**: 173개 (grep 결과)  
**계획 파일 수**: 30개 (우선순위 파일)

**변환 패턴**:
```tsx
// Before
<div className="space-y-4">
  <Item1 />
  <Item2 />
</div>

// After
<div className="flex flex-col gap-4">
  <Item1 />
  <Item2 />
</div>
```

**주의사항**:
- `space-y-1.5` 같은 소수점 값은 `gap-1.5`로 변환
- 반응형 spacing은 `gap-3 md:gap-4` 형태로 유지

### Phase 3: 인라인 스타일 제거

**확인된 파일**: 5개
1. `app/(student)/plan/new-group/_components/_shared/BlockSetTimeline.tsx`
   - `createPositionStyle`, `createHeightStyle` 함수 사용
   - 타임라인 시각화의 동적 위치 계산 (예외 허용 가능)

2. `app/(admin)/admin/camp-templates/_components/TemplateChecklist.tsx`
   - ProgressBar의 동적 `width` (43번째 줄)
   - `style={{ width: `${percentage}%` }}`
   - ProgressBar 컴포넌트 내부 처리 권장

3. `app/(admin)/admin/camp-templates/_components/TemplateFormChecklist.tsx`
   - 유사한 ProgressBar 패턴 예상

4. `app/(parent)/parent/goals/page.tsx`
   - 확인 필요

5. `app/(admin)/admin/camp-templates/_components/TemplateWizardChecklist.tsx`
   - 유사한 ProgressBar 패턴 예상

**작업 방향**:
- ProgressBar 컴포넌트에 `percentage` prop 추가 검토
- 동적 계산이 필요한 경우 주석으로 예외 사유 명시

### Phase 4: 컴포넌트 최적화

#### 4.1 getGradeColor 사용 패턴 통합

**확인된 파일**: 10개
1. `app/(student)/scores/_components/ScoreCard.tsx` (이미 BaseScoreCard로 통합됨)
2. `app/(student)/scores/mock/[grade]/[month]/[exam-type]/_components/MockScoreCard.tsx` (이미 BaseScoreCard로 통합됨)
3. `app/(student)/scores/dashboard/school/_components/SchoolHeatmapChart.tsx`
4. `app/(student)/scores/dashboard/mock/_components/MockDetailedMetrics.tsx`
5. `app/(student)/scores/dashboard/school/_components/SchoolDetailedMetrics.tsx`
6. `app/(student)/scores/_components/MockScoreListTable.tsx`
7. `app/(student)/scores/_components/ScoreListTable.tsx`
8. `app/(student)/scores/dashboard/mock/_components/MockSummarySection.tsx`
9. `app/(student)/scores/dashboard/school/_components/SchoolSummarySection.tsx`
10. `app/(student)/scores/dashboard/_components/SummarySection.tsx`

**작업 내용**:
- `getGradeColor` 사용 패턴 분석
- 공통 래퍼 컴포넌트 생성 검토 (필요시)
- 타입 안전성 개선

#### 4.2 Badge 컴포넌트 사용 통일

**현재 상태**: `components/atoms/Badge.tsx`로 통합 완료

**작업 내용**:
- 모든 파일에서 `@/components/atoms/Badge` import 확인
- 인라인 배지 스타일을 Badge 컴포넌트로 교체

### Phase 5: 데이터베이스 최적화

**작업 내용**:
- Supabase MCP로 인덱스 확인
- 쿼리 최적화 필요 시 개선
- RLS 정책 최적화

---

## 📈 진행률

### 전체 진행률
- **Phase 1**: 100% 완료 ✅
- **Phase 2.1**: 약 6% 완료 (20/316 파일)
- **Phase 2.2**: 0% (대기 중)
- **Phase 3**: 0% (대기 중)
- **Phase 4**: 0% (대기 중)
- **Phase 5**: 0% (대기 중)

### 예상 작업량
- **Phase 2.1**: 약 296개 파일 (우선순위 재분류 필요)
- **Phase 2.2**: 약 30개 파일 (우선순위 파일)
- **Phase 3**: 5개 파일
- **Phase 4.1**: 10개 파일
- **Phase 4.2**: 확인 필요
- **Phase 5**: 확인 필요

---

## 🎯 다음 단계 제안

### 옵션 1: Phase 2.1 우선순위 재분류 후 계속 진행
- 학생/관리자 주요 페이지 우선 처리
- 점진적으로 확장

### 옵션 2: Phase 2.2로 전환
- space-y/space-x 제거 작업 진행
- 우선순위 파일 30개 먼저 처리

### 옵션 3: Phase 3으로 전환
- 인라인 스타일 제거 (5개 파일만)
- 빠르게 완료 가능

### 옵션 4: Phase 4로 전환
- 컴포넌트 최적화 작업 진행
- getGradeColor 패턴 통합

---

## 💡 권장 사항

1. **Phase 2.1 우선순위 재분류**
   - 학생 페이지 우선 처리
   - 관리자 페이지 다음 처리
   - 부모 페이지 마지막 처리

2. **점진적 진행**
   - 한 번에 너무 많은 파일 처리하지 않기
   - 10-20개 파일씩 배치 처리
   - 각 배치마다 커밋 및 검증

3. **자동화 검토**
   - ESLint 규칙 추가 검토 (margin 클래스 사용 금지)
   - Prettier 설정으로 자동 변환 검토

---

## 📝 참고 사항

- 모든 변경사항은 Spacing-First 정책을 준수해야 함
- 부모 요소에 `gap-*` 추가 시 형제 요소의 margin 제거
- 들여쓰기는 `pl-*`로 변환
- 인라인 스타일은 예외 사유를 주석으로 명시


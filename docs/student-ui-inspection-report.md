# Student 페이지 모달 UI 점검 결과 보고서

**점검 일시**: 2024년 12월  
**점검 범위**: `app/(student)` 폴더 내 모든 페이지 및 모달 컴포넌트

---

## 📋 점검 개요

### 점검 대상

#### 주요 페이지 (53개)
- ✅ `/dashboard` - 대시보드
- ✅ `/plan` - 플랜 목록 (이미 점검 완료)
- ✅ `/today` - 오늘의 학습
- ✅ `/scores` - 성적 관리 (대시보드, 입력, 분석, 학교/모의고사)
- ✅ `/contents` - 콘텐츠 관리 (교재, 강의, 마스터 콘텐츠)
- ✅ `/blocks` - 시간 블록 관리
- ✅ `/attendance` - 출석 체크
- ✅ `/analysis` - 학습 분석 (패턴, 시간)
- ✅ `/camp` - 캠프 프로그램
- ✅ `/settings` - 설정
- ✅ `/report` - 리포트 (주간, 월간)

#### 모달/Dialog 컴포넌트 (14개)

**Plan 관련 (이미 점검 완료)**
- `PlanGroupDeleteDialog`
- `PlanGroupActiveToggleDialog`
- `PlanGroupBulkDeleteDialog`
- `PlanGroupActivationDialog`
- `PlanPreviewDialog`
- `RangeSettingModal`
- `DayTimelineModal`
- `ExclusionImportModal`
- `AcademyScheduleImportModal`

**추가 점검 완료**
- ✅ `ScoreFormModal` - 내신 성적 입력/수정
- ✅ `MockScoreFormModal` - 모의고사 성적 입력/수정
- ✅ `PlanMemoModal` - 플랜 메모
- ✅ `PlanRangeAdjustModal` - 플랜 범위 조정
- ✅ `CalculationInfoModal` - 계산 방법 안내

---

## 🔍 점검 결과

### 1. 스타일링 일관성

#### ✅ 잘된 점
- 대부분의 컴포넌트에서 Tailwind 유틸리티 클래스를 적절히 사용
- 디자인 시스템 컬러 사용 (gray, blue, green, red, indigo 등)
- 일관된 border-radius (`rounded-lg`, `rounded-xl`)

#### ❌ 개선 필요 사항

##### 1.1 인라인 스타일 사용 (23개 파일)

**위반 파일 목록:**

**Today 페이지 (6개)**
1. `app/(student)/today/_components/PlanItem.tsx:213, 277`
   ```tsx
   style={{ width: `${progress}%` }}
   ```

2. `app/(student)/today/_components/PlanGroupCard.tsx:394, 495`
   ```tsx
   style={{ width: `${aggregatedInfo.totalProgress}%` }}
   ```

3. `app/(student)/today/_components/CompletionAnimation.tsx:67`
   ```tsx
   style={{ ... }}
   ```

4. `app/(student)/today/_components/CircularProgress.tsx:36`
   ```tsx
   style={{ width: dimension, height: dimension }}
   ```

**Scores 페이지 (1개)**
5. `app/(student)/scores/dashboard/_components/SubjectGradeHistoryChart.tsx:97`
   ```tsx
   style={{ ... }}
   ```

**Blocks 페이지 (5개)**
6. `app/(student)/blocks/_components/BlockTimeline.tsx:105, 121, 127, 154`
   ```tsx
   style={{ height: `${hourHeight}px` }}
   ```

7. `app/(student)/blocks/_components/BlockStatistics.tsx:84`
   ```tsx
   style={{ ... }}
   ```

**Plan 페이지 (9개 - 이미 점검 완료)**
- `Step7ScheduleResult/TimelineBar.tsx`
- `Step3Contents.tsx`
- `_summary/LearningVolumeSummary.tsx`
- `_shared/ProgressIndicator.tsx`
- `_shared/BlockSetTimeline.tsx`
- `group/[id]/_components/PlanGroupProgressCard.tsx`
- `calendar/_components/PlanCard.tsx`
- `calendar/_components/DayView.tsx`

**기타 (2개)**
8. `app/(student)/report/monthly/_components/MonthlyCharts.tsx`
9. `app/(student)/report/weekly/_components/WeakSubjectsSection.tsx`
10. `app/(student)/report/weekly/_components/SubjectTimePieChart.tsx`
11. `app/(student)/analysis/time/_components/TimeAnalysisView.tsx`
12. `app/(student)/analysis/patterns/_components/PatternAnalysisView.tsx`
13. `app/(student)/analysis/_components/RiskIndexList.tsx`

**개선 방안:**
- 동적 width/height 계산은 CSS 변수와 Tailwind의 `w-[var(--width)]` 패턴 사용
- 진행률 바는 별도 컴포넌트로 추상화하여 일관성 확보
- 차트 라이브러리(recharts) 사용 시 인라인 스타일은 불가피하지만 최소화

**예시:**
```tsx
// Before
<div style={{ width: `${progress}%` }} />

// After
<div 
  className="h-full bg-blue-600 transition-all"
  style={{ '--width': `${progress}%` } as React.CSSProperties}
  className="w-[var(--width)]"
/>
```

##### 1.2 Spacing-First 정책 위반 (매우 많은 파일)

**문제점:**
- `mt-`, `mb-`, `ml-`, `mr-`, `mx-`, `my-` 클래스가 광범위하게 사용됨
- 형제 요소 간 간격을 margin으로 처리하는 패턴이 많음

**주요 위반 파일:**
- `app/(student)/today/_components/` - `mt-`, `mb-` 다수
- `app/(student)/scores/_components/` - `mt-`, `mb-` 다수
- `app/(student)/contents/_components/` - `mt-`, `mb-`, `ml-` 다수
- `app/(student)/today/plan/[planId]/_components/PlanExecutionForm.tsx` - `mt-`, `mb-` 매우 많음

**개선 방안:**
- 부모 컨테이너에 `gap-*` 클래스 추가
- 형제 요소 간 간격은 `gap`으로 통일
- 외곽 여백만 `padding` 사용

**예시:**
```tsx
// Before
<div>
  <h3 className="mb-3">제목</h3>
  <p className="mt-1">내용</p>
</div>

// After
<div className="flex flex-col gap-3">
  <h3>제목</h3>
  <p>내용</p>
</div>
```

##### 1.3 디자인 시스템 타이포그래피 미사용

**문제점:**
- 프로젝트 가이드라인에 정의된 타이포그래피 클래스(`text-h1`, `text-body-1` 등) 미사용
- 직접 `text-xl`, `text-sm` 등 사용

**개선 방안:**
- `globals.css`에 정의된 타이포그래피 클래스 사용
- 또는 디자인 시스템 문서 확인 후 일관성 확보

---

### 2. 모달 구조 및 UX

#### ✅ 잘된 점
- 대부분의 모달이 `Dialog` 컴포넌트 사용
- ESC 키 닫기 기능 구현됨
- 백드롭 클릭 처리 구현됨

#### ❌ 개선 필요 사항

##### 2.1 모달 컴포넌트 일관성 문제

**문제점:**
- 두 가지 다른 Dialog 컴포넌트 존재:
  - `components/ui/Dialog` - 주로 사용됨
  - `components/organisms/Dialog` - `CalculationInfoModal`에서만 사용
- `PlanMemoModal`, `PlanRangeAdjustModal`은 커스텀 구현

**위반 파일:**
- `app/(student)/settings/_components/CalculationInfoModal.tsx` - `components/organisms/Dialog` 사용
- `app/(student)/today/_components/PlanMemoModal.tsx` - 커스텀 구현
- `app/(student)/today/_components/PlanRangeAdjustModal.tsx` - 커스텀 구현

**개선 방안:**
- 모든 모달을 `components/ui/Dialog`로 통일
- 일관된 모달 구조 및 스타일 적용

**예시:**
```tsx
// Before (PlanMemoModal)
<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
  <div className="relative w-full max-w-2xl rounded-lg border border-gray-200 bg-white shadow-xl">
    {/* ... */}
  </div>
</div>

// After
<Dialog open={isOpen} onOpenChange={onClose} title="플랜 메모" maxWidth="2xl">
  <DialogContent>
    {/* ... */}
  </DialogContent>
  <DialogFooter>
    {/* ... */}
  </DialogFooter>
</Dialog>
```

##### 2.2 Dialog 컴포넌트 prop 불일치

**문제점:**
- `components/ui/Dialog`: `maxWidth` prop 사용
- `components/organisms/Dialog`: `size` prop 사용
- 두 컴포넌트의 API가 다름

**개선 방안:**
- 하나의 Dialog 컴포넌트로 통일
- 또는 두 컴포넌트의 API를 일치시키기

##### 2.3 모달 반응형 처리

**문제점:**
- 일부 모달의 최대 너비가 고정값 (`max-w-2xl`, `max-w-3xl`)
- 모바일에서 스크롤 처리 미흡

**개선 방안:**
- `Dialog` 컴포넌트의 `maxWidth` prop 활용
- 모바일에서 `p-4` 패딩으로 여백 확보

##### 2.4 포커스 트랩 미구현

**문제점:**
- 모달 내부에서 Tab 키로 포커스가 모달 밖으로 나가는 경우 있음
- 포커스 트랩(Focus Trap) 미구현

**개선 방안:**
- `Dialog` 컴포넌트에 포커스 트랩 기능 추가
- 또는 `focus-trap-react` 라이브러리 활용

##### 2.5 모달 내 스크롤 처리

**문제점:**
- 일부 모달에서 `max-h-[calc(100vh-300px)]` 사용하지만 일관성 부족
- 스크롤 영역이 명확하지 않은 경우 있음

**개선 방안:**
- `DialogContent` 내부 스크롤 영역 명확히 구분
- 일관된 최대 높이 설정

---

### 3. 컴포넌트 구조

#### ✅ 잘된 점
- 대부분의 컴포넌트가 단일 책임 원칙 준수
- Export 규칙 대체로 준수 (default export for pages, named export for components)

#### ❌ 개선 필요 사항

##### 3.1 불필요한 추상화

**문제점:**
- 일부 컴포넌트가 단순히 다른 컴포넌트를 래핑만 함

**개선 방안:**
- 직접 사용하거나 실제 로직이 필요한 경우에만 래퍼 유지

##### 3.2 Export 규칙 일관성

**문제점:**
- 대부분 준수하지만 일부 컴포넌트에서 혼용

**개선 방안:**
- 페이지 컴포넌트: `export default`
- UI 컴포넌트: `export function` (named export)
- 유틸리티: `export function` (named export)

##### 3.3 네이밍 규칙

**문제점:**
- 대부분 준수하지만 일부 파일명이 일관되지 않음

**개선 방안:**
- 컴포넌트 파일명: PascalCase (`PlanGroupList.tsx`)
- 유틸리티 파일명: camelCase (`planGroupTransform.ts`)
- 타입 파일명: camelCase 또는 kebab-case

---

### 4. 접근성

#### ✅ 잘된 점
- 일부 컴포넌트에서 키보드 네비게이션 구현
- `Dialog` 컴포넌트에서 ESC 키 닫기 기능 구현

#### ❌ 개선 필요 사항

##### 4.1 ARIA 속성 부족

**문제점:**
- 대부분의 버튼에 `aria-label` 없음
- 모달에 `aria-labelledby`, `aria-describedby` 없음
- 폼 요소에 `aria-required`, `aria-invalid` 없음

**개선 방안:**
- 모든 인터랙티브 요소에 적절한 ARIA 속성 추가
- 모달은 `Dialog` 컴포넌트에서 자동 처리되도록 개선

**예시:**
```tsx
// Before
<button onClick={handleDelete}>
  <Trash2 className="h-4 w-4" />
</button>

// After
<button 
  onClick={handleDelete}
  aria-label="플랜 그룹 삭제"
  title="삭제"
>
  <Trash2 className="h-4 w-4" />
</button>
```

##### 4.2 키보드 네비게이션

**문제점:**
- 일부 컴포넌트만 키보드 네비게이션 지원
- 모달 내부 포커스 관리 미흡

**개선 방안:**
- 모든 인터랙티브 요소에 키보드 이벤트 핸들러 추가
- Tab 순서 논리적으로 구성

##### 4.3 포커스 관리

**문제점:**
- 모달이 열릴 때 첫 번째 포커스 가능 요소로 자동 포커스 이동 없음
- 모달이 닫힐 때 이전 포커스 위치로 복귀 없음

**개선 방안:**
- 모달 열릴 때 첫 번째 입력 요소로 포커스 이동
- 모달 닫힐 때 트리거 버튼으로 포커스 복귀

##### 4.4 시맨틱 HTML

**문제점:**
- 일부 컴포넌트에서 `<div>` 남용
- `<button>` 대신 `<div>` + `onClick` 사용하는 경우 있음

**개선 방안:**
- 적절한 시맨틱 태그 사용 (`<button>`, `<nav>`, `<main>` 등)
- 클릭 가능한 요소는 반드시 `<button>` 또는 `<a>` 사용

---

### 5. 반응형 디자인

#### ✅ 잘된 점
- 대부분의 컴포넌트에서 반응형 클래스 사용 (`sm:`, `md:`, `lg:`)
- 그리드 레이아웃에서 `grid-cols-*` 반응형 처리

#### ❌ 개선 필요 사항

##### 5.1 모바일 레이아웃

**문제점:**
- 일부 모달이 모바일에서 너무 넓음
- 테이블이 모바일에서 가로 스크롤 없이 잘림

**개선 방안:**
- 모바일에서 테이블을 카드 형태로 변환
- 또는 가로 스크롤 영역 명확히 표시

##### 5.2 브레이크포인트 일관성

**문제점:**
- 일부 컴포넌트는 `sm:` 사용, 일부는 `md:` 사용
- 브레이크포인트 선택 기준이 일관되지 않음

**개선 방안:**
- 프로젝트 표준 브레이크포인트 정의
- 일관된 브레이크포인트 사용 (모바일 우선)

---

## 📊 우선순위별 개선 사항

### 🔴 높은 우선순위 (즉시 수정)

1. **모달 컴포넌트 통일**
   - 모든 모달을 `components/ui/Dialog`로 통일
   - `CalculationInfoModal`의 `components/organisms/Dialog` → `components/ui/Dialog` 변경
   - `PlanMemoModal`, `PlanRangeAdjustModal` 커스텀 구현 → `Dialog` 컴포넌트 사용
   - 예상 작업량: 중간 규모

2. **Spacing-First 정책 위반** (매우 많은 파일)
   - 형제 요소 간 간격을 `gap`으로 변경
   - 외곽 여백만 `padding` 사용
   - 예상 작업량: 대규모 리팩토링 필요

3. **접근성 개선 (ARIA 속성)**
   - 모든 인터랙티브 요소에 `aria-label` 추가
   - 모달에 적절한 ARIA 속성 추가
   - 예상 작업량: 중간 규모

### 🟡 중간 우선순위 (단계적 수정)

4. **인라인 스타일 제거**
   - 동적 width 계산을 CSS 변수로 변경
   - 진행률 바 컴포넌트 추상화
   - 예상 작업량: 소규모

5. **포커스 관리 개선**
   - 모달 포커스 트랩 구현
   - 모달 열림/닫힘 시 포커스 이동
   - 예상 작업량: 소규모

6. **반응형 디자인 개선**
   - 모바일 테이블 레이아웃 개선
   - 브레이크포인트 일관성 확보
   - 예상 작업량: 소규모

### 🟢 낮은 우선순위 (선택적 개선)

7. **타이포그래피 클래스 통일**
   - 디자인 시스템 타이포그래피 클래스 사용
   - 예상 작업량: 소규모

8. **컴포넌트 구조 개선**
   - 불필요한 래퍼 컴포넌트 제거
   - Export 규칙 일관성 확보
   - 예상 작업량: 소규모

---

## 📝 개선 작업 체크리스트

### Phase 1: 긴급 수정 (1주)

- [ ] 모달 컴포넌트 통일
  - [ ] `CalculationInfoModal` → `components/ui/Dialog` 사용
  - [ ] `PlanMemoModal` → `Dialog` 컴포넌트 사용
  - [ ] `PlanRangeAdjustModal` → `Dialog` 컴포넌트 사용
- [ ] Spacing-First 정책 적용 (주요 페이지부터)
  - [ ] `/today` 페이지
  - [ ] `/scores` 페이지
  - [ ] `/contents` 페이지
  - [ ] 주요 컴포넌트
- [ ] 접근성 기본 개선
  - [ ] 모든 버튼에 `aria-label` 추가
  - [ ] 모달에 ARIA 속성 추가

### Phase 2: 중요 개선 (2주)

- [ ] 인라인 스타일 제거
  - [ ] 진행률 바 컴포넌트 추상화
  - [ ] CSS 변수 패턴 적용
- [ ] 포커스 관리 개선
  - [ ] 포커스 트랩 구현
  - [ ] 포커스 이동 로직 추가
- [ ] 반응형 디자인 개선
  - [ ] 모바일 테이블 레이아웃
  - [ ] 브레이크포인트 통일

### Phase 3: 정리 작업 (1주)

- [ ] 타이포그래피 클래스 통일
- [ ] 컴포넌트 구조 정리
- [ ] 문서화 및 가이드 업데이트

---

## 🔍 상세 점검 결과

### 모달 컴포넌트 상세 분석

#### ✅ Dialog 컴포넌트 사용 (9개)
- `ScoreFormModal` - `components/ui/Dialog` 사용 ✅
- `MockScoreFormModal` - `components/ui/Dialog` 사용 ✅
- `DayTimelineModal` - `components/ui/Dialog` 사용 ✅
- `PlanGroupDeleteDialog` - `components/ui/Dialog` 사용 ✅
- `PlanGroupActiveToggleDialog` - `components/ui/Dialog` 사용 ✅
- `PlanGroupBulkDeleteDialog` - `components/ui/Dialog` 사용 ✅
- `PlanGroupActivationDialog` - `components/ui/Dialog` 사용 ✅
- `PlanPreviewDialog` - 커스텀 구현 (큰 테이블 포함)
- 삭제 확인 Dialog (scores 페이지) - `components/ui/Dialog` 사용 ✅

#### ❌ 다른 Dialog 컴포넌트 사용 (1개)
- `CalculationInfoModal` - `components/organisms/Dialog` 사용 ❌

#### ❌ 커스텀 구현 (4개)
- `PlanMemoModal` - 커스텀 구현 ❌
- `PlanRangeAdjustModal` - 커스텀 구현 ❌
- `RangeSettingModal` - 커스텀 구현 (이미 점검 완료)
- `ExclusionImportModal` - 커스텀 구현 (이미 점검 완료)
- `AcademyScheduleImportModal` - 커스텀 구현 (이미 점검 완료)

### 인라인 스타일 사용 패턴 분석

#### 진행률 바 (width 계산)
- **파일 수**: 8개
- **패턴**: `style={{ width: `${progress}%` }}`
- **용도**: 진행률 표시
- **개선**: 진행률 바 컴포넌트 추상화

#### 차트/그래프 (동적 크기)
- **파일 수**: 5개
- **패턴**: `style={{ height: `${height}px` }}`, `style={{ width: dimension, height: dimension }}`
- **용도**: 차트 크기 조정
- **개선**: CSS 변수 사용 또는 차트 라이브러리 설정 활용

#### 타임라인 (위치 계산)
- **파일 수**: 3개
- **패턴**: `style={{ top: `${position}%` }}`
- **용도**: 타임라인 아이템 위치
- **개선**: CSS 변수 또는 절대 위치 계산 로직 개선

---

## 🎯 결론

전반적으로 코드 품질은 양호하나, **모달 컴포넌트 일관성**과 **Spacing-First 정책 위반** 문제가 가장 크게 발견되었습니다.

특히:
1. **모달 컴포넌트 통일**이 가장 시급합니다 (3개 모달이 커스텀 구현)
2. **Spacing-First 정책** 적용이 대규모 리팩토링이 필요합니다
3. **인라인 스타일** 사용은 진행률 바 컴포넌트 추상화로 해결 가능합니다

우선순위에 따라 단계적으로 개선하면 사용자 경험과 코드 유지보수성이 크게 향상될 것입니다.

---

**작성자**: AI Assistant  
**검토 필요**: 개발팀 리뷰 권장


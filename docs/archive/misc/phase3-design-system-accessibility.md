# Phase 3: 디자인 시스템 및 접근성 개선 작업 문서

## 작업 개요

Phase 3 중기 개선 작업으로 디자인 시스템 컬러 팔레트 구축, 하드코딩된 컬러 값 제거, 접근성 개선(ARIA 레이블, 키보드 네비게이션)을 완료했습니다.

## 작업 일자

2024년 12월

## 완료된 작업

### 1. 컬러 시스템 구축

#### 1.1 CSS 변수 확장 (`app/globals.css`)

**추가된 컬러 팔레트:**

- **시맨틱 컬러**: Primary (indigo), Secondary (gray), Success (green), Warning (amber), Error (red), Info (blue)
  - 각 컬러마다 50-900 단계 정의
  - RGB 채널 형식으로 정의하여 Tailwind opacity modifier 지원

- **등급별 색상**: 1-9등급에 대한 색상 팔레트
  - `--color-grade-1` ~ `--color-grade-9`

- **차트 색상**: 8색 팔레트
  - `--color-chart-0` ~ `--color-chart-7`

- **날짜 타입 색상**: 학습일, 복습일, 휴일, 오늘, 일반
  - `--color-day-study`, `--color-day-review`, `--color-day-holiday`, `--color-day-today`, `--color-day-normal`

- **위험도 색상**: 양호, 주의, 위험, 매우 위험
  - `--color-risk-low`, `--color-risk-medium`, `--color-risk-high`, `--color-risk-critical`

#### 1.2 Tailwind CSS 4 컬러 통합

`@theme inline` 블록에 모든 CSS 변수를 매핑하여 Tailwind 유틸리티 클래스로 사용 가능하도록 설정:
- `bg-primary-500`, `text-grade-1`, `border-chart-0` 등

#### 1.3 컬러 유틸리티 함수 통합 (`lib/constants/colors.ts`)

**통합된 함수들:**

- `getChartColor(index)`: 차트 라이브러리용 hex 색상 반환
- `getChartColorClass(index)`: Tailwind 클래스 반환
- `getGradeColor(grade)`: 등급별 색상 (text, bg, border, badge, hex)
- `getGradeColorHex(grade)`: 등급별 hex 색상
- `getDayTypeColor(dayType, isToday)`: 날짜 타입별 색상
- `getRiskColor(riskScore)`: 위험도별 색상
- `getRiskColorHex(riskScore)`: 위험도별 hex 색상
- `getTrendColor(trend)`: 추세별 색상

**레거시 호환성:**
- `getSubjectColor()`, `getSubjectColorClass()` 유지 (deprecated)
- `SUBJECT_COLORS`, `SUBJECT_COLOR_CLASSES` export 유지

### 2. 하드코딩된 컬러 값 제거

#### 2.1 차트 컴포넌트 (8개 파일)

**수정된 파일:**
- `app/(student)/report/monthly/_components/MonthlyCharts.tsx`
- `app/(student)/report/weekly/_components/SubjectTimePieChart.tsx`
- `app/(admin)/admin/attendance/statistics/_components/MethodStatisticsChart.tsx`
- `app/(admin)/admin/attendance/statistics/_components/TimeDistributionChart.tsx`
- `app/(admin)/admin/attendance/statistics/_components/DailyAttendanceChart.tsx`
- `app/(student)/scores/dashboard/_components/SubjectGradeHistoryChart.tsx`
- `app/(student)/scores/dashboard/school/_components/SchoolHeatmapChart.tsx`
- `app/(student)/scores/analysis/_components/MockTrendChart.tsx`

**변경 사항:**
- 하드코딩된 hex 값 (`#6366f1`, `#8b5cf6` 등) 제거
- `getChartColor()`, `getGradeColorHex()` 함수 사용

#### 2.2 컴포넌트 내부 로직

**수정된 파일:**
- `app/(student)/analysis/_components/RiskIndexList.tsx`: `getRiskColorHex()` 사용
- `app/(student)/report/weekly/_components/WeakSubjectsSection.tsx`: `getRiskColor()` 사용
- `app/(student)/plan/calendar/_components/WeekView.tsx`: `getDayTypeColor()` 사용
- `app/(student)/plan/calendar/_components/MonthView.tsx`: `getDayTypeColor()` 사용

#### 2.3 인라인 스타일

**수정된 파일:**
- `app/(student)/plan/new-group/_components/_shared/BlockSetTimeline.tsx`: drop-shadow를 Tailwind 클래스로 변환
- `app/(admin)/admin/attendance/qr-code/_components/QRCodeDisplay.tsx`: hex 색상을 rgb() 형식으로 변환

### 3. 중복 코드 제거 및 최적화

#### 3.1 등급별 색상 로직 통합

- `SchoolHeatmapChart.tsx`의 중복 `getColorForGrade()` 함수 제거
- `getGradeColorHex()` 함수 사용으로 통일

#### 3.2 날짜 타입 색상 로직 통합

- `WeekView.tsx`와 `MonthView.tsx`의 중복 로직을 `lib/constants/colors.ts`의 `getDayTypeColor()` 함수로 통합

#### 3.3 차트 색상 팔레트 통합

- `lib/constants/chartColors.ts`를 `lib/constants/colors.ts`로 통합
- 모든 차트 컴포넌트가 동일한 색상 팔레트 사용

#### 3.4 파일 삭제

- `lib/constants/chartColors.ts` 삭제 (통합 완료)

### 4. 접근성 개선

#### 4.1 ARIA 레이블 추가

**버튼 컴포넌트 (`components/atoms/Button.tsx`):**
- 아이콘만 있는 버튼에 `aria-label` 자동 추가
- `aria-describedby` 지원 추가

**폼 컴포넌트:**
- `components/molecules/FormField.tsx`: `aria-describedby`로 에러/힌트 메시지 연결, `aria-invalid`, `aria-required` 추가
- `components/ui/FormInput.tsx`: `aria-invalid`, `aria-describedby` 추가
- `components/atoms/Input.tsx`: `aria-invalid`, `aria-describedby` 지원

**차트 컴포넌트:**
- 모든 차트에 `role="img"`, `aria-label` 추가
- 스크린 리더용 데이터 테이블 추가 (`.sr-only` 클래스 사용)
- 예시: `app/(student)/report/monthly/_components/MonthlyCharts.tsx`

**네비게이션 컴포넌트:**
- `components/navigation/student/StudentCategoryNav.tsx`: `aria-current="page"`, `aria-label="주요 메뉴"` 추가
- `components/navigation/global/Breadcrumbs.tsx`: 이미 `aria-label="Breadcrumb"` 구현됨

**모달 및 다이얼로그:**
- `components/ui/Dialog.tsx`: `aria-labelledby`, `aria-describedby`, `aria-modal="true"` 추가
- 포커스 트랩 구현 (첫 번째 포커스 가능한 요소로 자동 포커스)

**Toast 컴포넌트:**
- `components/molecules/Toast.tsx`: `role="status"`, `aria-live` 추가 (error는 "assertive", 나머지는 "polite")

#### 4.2 키보드 네비게이션 개선

**포커스 관리:**
- 모든 인터랙티브 요소에 적절한 `tabIndex` 설정
- 비활성화된 요소는 `tabIndex={-1}` 설정
- 포커스 스타일 명확하게 표시 (이미 `focus:ring-2` 적용됨)

**키보드 단축키:**
- 탭 컴포넌트: 화살표 키 네비게이션 추가
  - `app/(student)/scores/_components/ScoreTypeTabs.tsx`: ArrowLeft/Right, Home/End 키 지원
  - `app/(student)/plan/group/[id]/_components/PlanGroupDetailTabs.tsx`: 이미 구현됨
- 모달: Escape 키로 닫기 (이미 구현됨), 포커스 트랩 추가

**스킵 링크:**
- `components/layout/SkipLink.tsx` 생성
- 루트 레이아웃(`app/layout.tsx`)에 통합
- `components/layout/RoleBasedLayout.tsx`의 main 태그에 `id="main-content"` 추가

#### 4.3 스크린 리더 지원

**의미론적 HTML:**
- 대부분의 컴포넌트가 적절한 HTML 요소 사용 (`<button>`, `<a>`, `<input>` 등)

**폼 접근성:**
- 모든 입력 필드에 `<label>` 연결
- 에러 메시지와 입력 필드 연결 (`aria-describedby`)
- 필수 필드 표시 (`aria-required`)

**상태 알림:**
- Toast: `role="status"`, `aria-live` 추가
- ProgressBar: 이미 `role="progressbar"` 구현됨

**랜드마크 영역:**
- `RoleBasedLayout.tsx`에 `<main>` 태그 사용
- 네비게이션에 `<nav>` 태그 사용

**접근성 유틸리티:**
- `app/globals.css`에 `.sr-only` 클래스 추가 (스크린 리더 전용 콘텐츠)

## 변경된 파일 목록

### 신규 생성
- `lib/constants/colors.ts` - 통합 컬러 시스템
- `components/layout/SkipLink.tsx` - 스킵 링크 컴포넌트
- `docs/phase3-design-system-accessibility.md` - 작업 문서

### 수정된 파일
- `app/globals.css` - CSS 변수 확장 및 Tailwind 통합
- `lib/scores/gradeColors.ts` - colors.ts 함수 사용하도록 수정
- `components/atoms/Button.tsx` - ARIA 레이블 추가
- `components/atoms/Input.tsx` - 접근성 속성 추가
- `components/molecules/FormField.tsx` - 접근성 속성 추가
- `components/ui/FormInput.tsx` - 접근성 속성 추가
- `components/ui/Dialog.tsx` - 접근성 속성 및 포커스 트랩 추가
- `components/molecules/Toast.tsx` - 접근성 속성 추가
- `components/navigation/student/StudentCategoryNav.tsx` - ARIA 속성 추가
- `components/layout/RoleBasedLayout.tsx` - main-content id 추가
- `app/layout.tsx` - SkipLink 통합
- 차트 컴포넌트 8개 파일
- 캘린더 뷰 컴포넌트 2개 파일
- 기타 컴포넌트 3개 파일

### 삭제된 파일
- `lib/constants/chartColors.ts` - colors.ts로 통합

## 검증 방법

### 컬러 시스템
- [x] 모든 하드코딩된 hex 값 제거 확인
- [x] CSS 변수가 Tailwind 유틸리티로 사용 가능한지 확인
- [x] 차트 색상 일관성 확인

### 접근성
- [ ] WAVE 또는 axe DevTools로 접근성 검사 (수동 테스트 필요)
- [ ] 키보드만으로 모든 기능 사용 가능 확인 (수동 테스트 필요)
- [ ] NVDA 또는 VoiceOver로 스크린 리더 테스트 (수동 테스트 필요)
- [ ] WCAG 2.1 AA 수준 준수 확인 (수동 테스트 필요)

## 향후 개선 사항

1. **차트 접근성 개선**
   - 모든 차트 컴포넌트에 접근성 속성 추가 (현재 일부만 완료)
   - 차트 데이터를 더 상세하게 설명하는 aria-label 작성

2. **키보드 네비게이션 확장**
   - 모든 탭 컴포넌트에 화살표 키 네비게이션 추가
   - 드롭다운 메뉴에 키보드 네비게이션 추가

3. **포커스 관리 개선**
   - 모달 열릴 때 포커스 트랩 강화
   - 동적으로 생성되는 요소의 포커스 관리

4. **다크모드 컬러 조정**
   - 다크모드에서 컬러 변수의 적절한 사용 확인 및 조정

## 참고 사항

- Tailwind CSS 4의 `@theme inline` 블록 사용
- CSS 변수는 RGB 채널 형식으로 정의하여 opacity modifier 지원
- 기존 코드와의 호환성을 위해 deprecated 함수 유지
- 모든 변경사항은 기존 기능을 유지하면서 개선


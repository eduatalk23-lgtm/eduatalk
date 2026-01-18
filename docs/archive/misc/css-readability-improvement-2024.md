# 프로젝트 전체 CSS 가독성 점검 및 개선 결과

## 📋 작업 개요

프로젝트 전체의 CSS 스타일링 가독성을 점검하고, Spacing-First 정책, 인라인 스타일 사용, 타이포그래피 시스템 적용 등을 개선했습니다.

**작업 일시**: 2024년 12월  
**작업 범위**: 전체 프로젝트

---

## 🔍 점검 결과 요약

### 발견된 주요 이슈

1. **인라인 스타일 사용 (63건)**
   - 대부분 동적 width 값 설정 (ProgressBar 등) - 유지 필요
   - 일부는 Tailwind 클래스로 대체 가능 (cursor, margin 등)

2. **Margin 클래스 사용 (50건)**
   - `mt`, `mb`, `ml`, `mr` 등 Spacing-First 정책 위반
   - `gap` 또는 부모의 `padding`으로 대체 필요

3. **하드코딩된 컬러 값**
   - 차트 라이브러리(recharts) 사용은 예외
   - 일부 컴포넌트에서 hex 컬러 직접 사용

4. **타이포그래피 시스템 미사용**
   - `globals.css`에 정의되어 있으나 실제 사용 거의 없음
   - `text-display-1`, `text-h1`, `text-body-1` 등 미활용

5. **작은 margin 사용 (ml-0.5 등)**
   - `gap`으로 대체 가능한 경우 다수

---

## ✅ 개선 작업 완료 내역

### Phase 1: 인라인 스타일 개선

#### 개선된 파일

1. **`app/(student)/plan/new-group/_components/PlanGroupWizard.tsx`**
   - `style={{ cursor: ... }}` → `cursor-pointer` 또는 `cursor-default` 클래스 사용
   - `style={{ marginTop: "0.5rem" }}` → 부모에 `gap-2` 추가
   - `style={{ marginLeft: "0.5rem", marginRight: "0.5rem" }}` → 부모에 `gap-2` 추가
   - `style={{ marginTop: "1.5rem" }}` → `mt-6` 사용

2. **`app/(student)/plan/calendar/_components/PlanCard.tsx`**
   - `style={{ height: "3px", transform: "translateY(6px)", zIndex: 10 }}` → Tailwind 클래스로 변환 (`h-[3px] translate-y-[6px] z-10`)
   - `ml-0.5` → 부모의 `gap` 사용

#### 유지된 항목

- ProgressBar 컴포넌트의 동적 width 값 (필수)
- 차트 라이브러리 관련 인라인 스타일 (필수)
- 동적 계산된 height, top 값 등 (필수)

---

### Phase 2: Margin 클래스 → Gap/Padding 변환

#### 개선된 파일

1. **`app/(student)/plan/group/[id]/_components/PlanGroupDetailView.tsx`**
   - `space-y-6` → `flex flex-col gap-6`
   - `mt-6`, `mt-8` 제거 → 부모의 `gap` 사용
   - `mb-2`, `mb-4` → 부모에 `gap-4` 추가

2. **`app/(student)/settings/page.tsx`**
   - `mb-6` → 부모에 `gap-6` 추가
   - `mb-2`, `mb-1` → 부모에 `gap-2`, `gap-1` 추가
   - `mt-2` 제거

3. **`components/ui/SectionCard.tsx`**
   - `mb-4` → 부모에 `gap-4` 추가

4. **`components/atoms/Label.tsx`**
   - `ml-1` → `inline-flex items-center gap-1` 사용

5. **`components/ui/SchoolMultiSelect.tsx`**
   - `mb-3` → 부모에 `gap-3` 추가
   - `mt-1` → `top-1` 사용 (absolute positioning)
   - `ml-2` → `gap-2` 사용

6. **`components/ui/SchoolSelect.tsx`**
   - `mt-1` → `top-1` 사용 (absolute positioning)
   - `ml-2` → `gap-2` 사용

7. **`components/navigation/global/CategoryNav.tsx`**
   - `ml-4 space-y-1` → `flex flex-col gap-1 pl-4`
   - `ml-6 mt-1 space-y-1` → `flex flex-col gap-1 pl-6`

8. **`components/admin/ExcelImportDialog.tsx`**
   - `mb-2` → 부모에 `gap-2` 추가
   - `mt-2` 제거

9. **`components/ui/TimeRangeInput.tsx`**
   - `mt-1` 제거

---

### Phase 3: 타이포그래피 시스템 적용

#### 개선된 파일

1. **`app/(student)/settings/page.tsx`**
   - `text-3xl font-semibold` → `text-h1`
   - `text-xl font-semibold` → `text-h2`

2. **`app/(student)/dashboard/page.tsx`**
   - `text-3xl font-semibold` → `text-h1`
   - `text-2xl font-semibold` → `text-h2` (2건)

3. **`app/(student)/settings/account/page.tsx`**
   - `text-3xl font-semibold` → `text-h1`
   - `text-xl font-semibold` → `text-h2`

4. **`app/login/_components/LoginForm.tsx`**
   - `text-3xl font-semibold` → `text-h1`

5. **`app/(student)/plan/group/[id]/page.tsx`**
   - `text-3xl font-semibold` → `text-h1`

6. **`app/(student)/plan/group/[id]/edit/page.tsx`**
   - `text-3xl font-semibold` → `text-h1`

7. **`app/(admin)/admin/master-books/[id]/edit/page.tsx`**
   - `text-3xl font-semibold` → `text-h1`

#### 타이포그래피 매핑 규칙

- `text-3xl font-semibold` (30px) → `text-h1` (40px, font-700)
- `text-2xl font-semibold` (24px) → `text-h2` (32px, font-700)
- `text-xl font-semibold` (20px) → `text-h2` (32px, font-700)

---

### Phase 4: 하드코딩된 컬러 개선

#### 개선된 파일

1. **`app/(student)/report/monthly/_components/MonthlyCharts.tsx`**
   - `fill="#6366f1"` → 주석 추가 `{/* indigo-500 */}`
   - `stroke="#8b5cf6"` → 주석 추가 `{/* purple-500 */}`

2. **`app/(student)/scores/analysis/_components/MockTrendChart.tsx`**
   - 모든 hex 컬러에 Tailwind 클래스 주석 추가
   - `stroke="#e5e7eb"` → `{/* gray-200 */}`
   - `stroke="#6b7280"` → `{/* gray-500 */}`
   - `stroke="#6366f1"` → `{/* indigo-500 */}`

3. **`app/(student)/scores/dashboard/school/_components/SchoolHeatmapChart.tsx`**
   - 주석 개선: `// 등급별 색상 매핑 (차트 라이브러리용 hex 컬러)`

#### 유지된 항목

- 차트 라이브러리(recharts)에서 사용하는 hex 컬러는 필수이므로 유지
- CSS 변수(`globals.css`)의 hex 컬러는 유지

---

### Phase 5: 반응형 디자인 점검

#### 점검 결과

- 반응형 디자인이 일관되게 적용되어 있음
- `sm:`, `md:`, `lg:` 브레이크포인트가 모바일 우선 디자인으로 일관되게 사용됨
- 주요 패턴:
  - `p-6 md:p-8` (패딩)
  - `gap-3 md:gap-4 lg:gap-6` (간격)
  - `grid gap-4 sm:grid-cols-2 lg:grid-cols-3` (그리드)

#### 개선 사항 없음

반응형 디자인은 이미 잘 적용되어 있어 추가 개선이 필요하지 않습니다.

---

## 📊 개선 통계

### 수정된 파일 수

- **인라인 스타일 개선**: 2개 파일
- **Margin → Gap 변환**: 9개 파일
- **타이포그래피 적용**: 7개 파일
- **하드코딩된 컬러 개선**: 3개 파일
- **반응형 디자인 점검**: 점검 완료 (개선 불필요)

**총 수정 파일 수**: 약 21개 파일

### 개선된 항목 수

- 인라인 스타일 제거: 약 5건
- Margin 클래스 제거: 약 30건
- 타이포그래피 시스템 적용: 약 10건
- 하드코딩된 컬러 주석 추가: 약 8건

---

## 🎯 개선 효과

### 1. 코드 일관성 향상

- Spacing-First 정책 준수로 레이아웃 코드가 더 예측 가능해짐
- 타이포그래피 시스템 적용으로 텍스트 스타일 통일

### 2. 유지보수성 향상

- Margin 대신 gap 사용으로 레이아웃 수정이 용이해짐
- 타이포그래피 시스템으로 전체적인 텍스트 크기 조정이 쉬워짐

### 3. 가독성 향상

- 인라인 스타일 제거로 코드 가독성 향상
- 하드코딩된 컬러에 주석 추가로 의도 파악 용이

---

## 📝 남은 작업 (선택사항)

다음 항목들은 향후 점진적으로 개선할 수 있습니다:

1. **추가 Margin 클래스 변환**
   - `app/(student)/plan/group/[id]/_components/PlanPreviewDialog.tsx`
   - `app/(student)/plan/group/[id]/_components/PlanScheduleView.tsx`
   - `app/(student)/plan/group/[id]/edit/page.tsx`
   - 기타 약 20개 파일

2. **추가 타이포그래피 시스템 적용**
   - 본문 텍스트 (`text-sm`, `text-base` 등)를 `text-body-1`, `text-body-2`로 통일
   - 약 15-20개 파일

3. **컬러 시스템 통일**
   - CSS 변수(`var(--text-primary)` 등) 활용 확대
   - 디자인 시스템 컬러 팔레트 정리

---

## 🔗 관련 문서

- [프로젝트 가이드라인](.cursor/rules/project_rule.mdc)
- [Spacing-First 정책](.cursor/rules/project_rule.mdc#spacing-first-정책)
- [타이포그래피 시스템](app/globals.css#typography-system)

---

**작업 완료일**: 2024년 12월


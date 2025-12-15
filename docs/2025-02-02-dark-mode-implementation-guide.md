# 다크 모드 구현 가이드

**작업 일자**: 2025년 2월 2일  
**작업 범위**: 다크 모드 점검 및 최적화 완료

## 개요

프로젝트 전반에 걸쳐 다크 모드 지원을 일관되게 적용하고, 하드코딩된 색상을 유틸리티 함수로 통합하여 유지보수성을 향상시켰습니다.

## 구현 상태

### ✅ 완료된 작업

#### Phase 1: 유틸리티 함수 확장

**파일**: `lib/utils/darkMode.ts`

추가된 함수들:
- `tableRowStyles()`: 테이블 행 스타일 통합 함수 (default, hover, striped, selected)
- `statusBadgeColors`: 통합 상태 배지 색상 객체 (기본, 목표, 플랜, 위험도 상태 포함)
- `inputGroupStyles`: 입력 그룹 컨테이너 스타일
- `inputGroupLabelStyles`: 입력 그룹 레이블 스타일
- `inputGroupDescriptionStyles`: 입력 그룹 설명 스타일
- `inputGroupErrorStyles`: 입력 그룹 에러 스타일
- `sectionHeaderContainerStyles`: 섹션 헤더 컨테이너 스타일
- `sectionHeaderTitleStyles()`: 섹션 헤더 제목 스타일 (크기별)
- `sectionHeaderDescriptionStyles()`: 섹션 헤더 설명 스타일 (크기별)

#### Phase 2: Student 페이지 컴포넌트 수정

**수정된 파일들**:
- `app/(student)/dashboard/_components/TimeStatistics.tsx`
- `app/(student)/dashboard/_components/ActiveLearningWidget.tsx`
- `app/(student)/dashboard/_components/RecommendationCard.tsx`
- `app/(student)/dashboard/_components/MonthlyReportSection.tsx`
- `app/(student)/today/_components/PlanCard.tsx`
- `app/(student)/plan/_shared/PlanCard.tsx`
- `app/(student)/contents/_components/FilterBar.tsx`

**주요 변경사항**:
- 하드코딩된 색상 클래스 (`bg-white`, `text-gray-900`, `border-gray-200` 등)를 유틸리티 함수로 교체
- `bgSurface`, `borderDefault`, `textPrimary`, `textSecondary`, `textTertiary`, `textMuted` 등 활용

#### Phase 3: Admin 페이지 컴포넌트 수정

**수정된 파일들**:
- `app/(admin)/admin/dashboard/page.tsx`

**주요 변경사항**:
- KPI 카드, Top5 리스트, 위험 학생 리스트, 최근 상담노트 섹션의 하드코딩 색상 제거
- 유틸리티 함수로 통일

#### Phase 4: 중복 코드 최적화

- 테이블 스타일: `tableHeaderBase`, `tableCellBase`, `tableContainer` 활용 강화
- 카드 스타일: `cardStyle()` 함수 활용
- 상태 색상: `goalStatusColors`, `planStatusColors`, `riskLevelColors`, `statusBadgeColors` 통합

## 사용 가이드

### 기본 유틸리티 함수

```typescript
import { 
  bgSurface, 
  bgPage, 
  textPrimary, 
  textSecondary, 
  textTertiary, 
  textMuted,
  borderDefault,
  borderInput,
  divideDefault
} from "@/lib/utils/darkMode";
import { cn } from "@/lib/cn";

// 사용 예시
<div className={cn("rounded-xl border p-6", bgSurface, borderDefault)}>
  <h2 className={cn("text-xl font-semibold", textPrimary)}>제목</h2>
  <p className={cn("text-sm", textSecondary)}>설명</p>
</div>
```

### 카드 스타일

```typescript
import { cardStyle } from "@/lib/utils/darkMode";

// 기본 카드
<div className={cardStyle("default", "md")}>내용</div>

// 호버 효과가 있는 카드
<div className={cardStyle("hover", "lg")}>내용</div>

// 인터랙티브 카드
<div className={cardStyle("interactive", "md")}>내용</div>
```

### 테이블 스타일

```typescript
import { tableContainer, tableHeaderBase, tableCellBase, tableRowStyles } from "@/lib/utils/darkMode";

<div className={tableContainer}>
  <table>
    <thead>
      <tr>
        <th className={tableHeaderBase}>헤더</th>
      </tr>
    </thead>
    <tbody>
      <tr className={tableRowStyles("hover")}>
        <td className={tableCellBase}>셀</td>
      </tr>
    </tbody>
  </table>
</div>
```

### 상태 배지 색상

```typescript
import { statusBadgeColors } from "@/lib/utils/darkMode";

<span className={cn("rounded-full px-2 py-1 text-xs", statusBadgeColors.completed)}>
  완료
</span>
```

### 섹션 헤더

```typescript
import { 
  sectionHeaderContainerStyles, 
  sectionHeaderTitleStyles, 
  sectionHeaderDescriptionStyles 
} from "@/lib/utils/darkMode";

<div className={sectionHeaderContainerStyles}>
  <h2 className={sectionHeaderTitleStyles("lg")}>제목</h2>
  <p className={sectionHeaderDescriptionStyles("md")}>설명</p>
</div>
```

### 입력 그룹

```typescript
import { 
  inputGroupStyles, 
  inputGroupLabelStyles, 
  inputGroupDescriptionStyles,
  inputGroupErrorStyles 
} from "@/lib/utils/darkMode";

<div className={inputGroupStyles}>
  <label className={inputGroupLabelStyles}>레이블</label>
  <p className={inputGroupDescriptionStyles}>설명</p>
  <input type="text" />
  {error && <p className={inputGroupErrorStyles}>에러 메시지</p>}
</div>
```

## 모범 사례

### ✅ 좋은 예시

```typescript
import { cn, bgSurface, borderDefault, textPrimary } from "@/lib/utils/darkMode";

<div className={cn("rounded-xl border p-6", bgSurface, borderDefault)}>
  <h2 className={cn("text-xl font-semibold", textPrimary)}>제목</h2>
</div>
```

### ❌ 나쁜 예시

```typescript
// 하드코딩된 색상 사용 금지
<div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
  <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">제목</h2>
</div>
```

## 체크리스트

새로운 컴포넌트를 작성할 때 다음을 확인하세요:

- [ ] 하드코딩된 색상 클래스 (`bg-white`, `text-gray-900` 등)를 사용하지 않았는가?
- [ ] `lib/utils/darkMode.ts`의 유틸리티 함수를 활용했는가?
- [ ] `cn()` 함수를 사용하여 클래스를 병합했는가?
- [ ] 다크 모드에서도 색상이 올바르게 표시되는가?

## 참고 자료

- `lib/utils/darkMode.ts`: 모든 다크 모드 유틸리티 함수 정의
- `app/globals.css`: CSS 변수 시스템 정의
- `lib/providers/ThemeProvider.tsx`: next-themes 설정

## 향후 개선 사항

1. **ESLint 규칙 추가**: 하드코딩된 색상 클래스 사용 시 경고
2. **Storybook 통합**: 다크 모드 스토리 추가
3. **자동화 스크립트**: 하드코딩 색상 자동 감지 및 교체


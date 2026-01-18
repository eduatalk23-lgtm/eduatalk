# 다크모드 전면 적용 완료 보고서

## 작업 개요

프로젝트 전반에 걸쳐 하드코딩된 색상을 제거하고 다크모드를 체계적으로 적용했습니다. 중복 코드를 최적화하고 재사용 가능한 유틸리티 함수를 생성하여 일관성과 유지보수성을 향상시켰습니다.

## 완료된 작업

### Phase 1: 인프라 구축 ✅

#### 1.1 다크모드 색상 유틸리티 함수 생성
- **파일**: `lib/utils/darkMode.ts` (신규 생성)
- **내용**:
  - 배경색 유틸리티: `bgSurface`, `bgPage`, `bgHover`, `bgHoverStrong`
  - 텍스트 색상 유틸리티: `textPrimary`, `textSecondary`, `textTertiary`, `textMuted`
  - 테두리 유틸리티: `borderDefault`, `borderInput`, `divideDefault`
  - 인라인 버튼 함수: `inlineButtonBase()`, `inlineButtonSecondary()`
  - 테이블 행 스타일: `tableRowHover`, `tableRowBase`
  - 카드 스타일: `cardBase`

#### 1.2 기존 색상 유틸리티 함수에 다크모드 추가
- **파일**: `lib/constants/colors.ts`
  - `getDayTypeColor()` 함수의 일반 날짜 반환값에 다크모드 클래스 추가
- **파일**: `app/(student)/plan/calendar/_utils/timelineUtils.ts`
  - `getTimeSlotColorClass()` 함수의 모든 타임슬롯 타입에 다크모드 클래스 추가

#### 1.3 ThemeToggle 컴포넌트 배치
- **파일**: `components/layout/RoleBasedLayout.tsx`
  - 데스크톱 사이드바 하단에 ThemeToggle 추가
  - 모바일 사이드바 하단에도 ThemeToggle 추가

### Phase 2: 핵심 컴포넌트 수정 ✅

#### 2.1 레이아웃 컴포넌트

**`components/layout/RoleBasedLayout.tsx`**
- 사이드바 배경, 텍스트, 테두리, 호버 상태에 다크모드 추가
- 모바일 사이드바에도 동일하게 적용
- 페이지 배경색에 다크모드 추가

**`components/navigation/global/CategoryNav.tsx`**
- 네비게이션 아이템 색상에 다크모드 추가
- 활성 상태: `bg-indigo-50 dark:bg-indigo-900/30`, `text-indigo-700 dark:text-indigo-300`
- 호버 상태에 다크모드 추가
- 자식 아이템에도 다크모드 적용

**`components/layout/PageHeader.tsx`**
- 제목 텍스트: `text-gray-900 dark:text-gray-100`
- 설명 텍스트: `text-gray-600 dark:text-gray-400`

#### 2.2 UI 컴포넌트

**`components/organisms/LoadingOverlay.tsx`**
- 배경: `bg-white/80 dark:bg-gray-900/80`
- 텍스트: `text-gray-600 dark:text-gray-400`

**`components/ui/Dialog.tsx`**
- 다이얼로그 배경: `bg-white dark:bg-gray-800`
- 테두리: `border-gray-200 dark:border-gray-700`
- 제목 텍스트: `text-gray-900 dark:text-gray-100`
- 설명 텍스트: `text-gray-700 dark:text-gray-300`
- 닫기 버튼에 다크모드 추가
- Footer 테두리에 다크모드 추가

**`components/atoms/Badge.tsx`**
- 모든 variant에 다크모드 클래스 추가:
  - `default`: `bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200`
  - `primary`: `bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900`
  - `success`: `bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300`
  - `warning`: `bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300`
  - `error`: `bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300`
  - `info`: `bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300`
  - `gray`: `bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400`

**`components/molecules/Tabs.tsx`**
- Line variant: 테두리, 활성/비활성 상태에 다크모드 추가
- Pill variant: 배경, 활성/비활성 상태에 다크모드 추가
- 배지 색상에 다크모드 추가

### Phase 3: 페이지별 적용 ✅

#### 3.1 우선순위 페이지

**`app/(student)/contents/page.tsx`**
- 인라인 버튼 3개를 `inlineButtonBase()` 유틸리티 함수로 교체

**`app/(student)/scores/_components/ScoreListTable.tsx`**
- 테이블 헤더 텍스트에 다크모드 추가
- 테이블 행 스타일을 `tableRowBase`로 교체
- 텍스트 색상을 `textPrimary`, `textSecondary`로 교체
- 인라인 버튼을 `inlineButtonBase()`로 교체
- `divideDefault` 유틸리티 사용

**`app/(student)/scores/_components/MockScoreListTable.tsx`**
- ScoreListTable과 동일한 패턴 적용

**`app/(student)/dashboard/page.tsx`**
- `QuickActionCard`의 `colorClasses` 객체에 다크모드 추가
- 모든 색상(13개)에 대해 그라디언트와 텍스트 색상에 다크모드 클래스 추가

#### 3.2 플랜 관련 컴포넌트

**`app/(student)/plan/calendar/_utils/timelineUtils.ts`**
- Phase 1에서 이미 완료

**`app/(student)/plan/group/[id]/_components/PlanGroupStatusButtons.tsx`**
- 인라인 버튼 스타일에 다크모드 추가
- 템플릿 리터럴을 `cn()` 함수로 교체하여 다크모드 적용

### Phase 4: 최적화 및 리팩토링 ✅

#### 4.1 중복 코드 제거

다음 파일들에서 인라인 버튼 스타일을 `inlineButtonBase()`로 교체:

1. ✅ `app/(student)/contents/page.tsx`
2. ✅ `app/(student)/contents/master-books/page.tsx`
3. ✅ `app/(student)/contents/master-lectures/page.tsx`
4. ✅ `app/(student)/contents/master-custom-contents/page.tsx`
5. ✅ `app/(student)/plan/new-group/page.tsx`
6. ✅ `app/(student)/camp/[invitationId]/page.tsx`
7. ✅ `app/(student)/contents/_components/SelectionToolbar.tsx`
8. ✅ `app/(student)/scores/_components/ScoreListTable.tsx`
9. ✅ `app/(student)/scores/_components/MockScoreListTable.tsx`

추가로 `app/(student)/contents/master-custom-contents/page.tsx`에서는:
- 페이지 헤더 텍스트에 다크모드 추가
- 검색 필터 카드에 다크모드 추가
- 결과 개수 텍스트에 다크모드 추가
- 빈 상태 카드에 다크모드 추가
- 콘텐츠 카드에 다크모드 추가

## 색상 매핑 표준

다음 표준 색상 매핑을 적용했습니다:

| 용도 | 라이트 모드 | 다크 모드 |
|------|------------|----------|
| 카드/컨테이너 배경 | `bg-white` | `dark:bg-gray-800` |
| 페이지 배경 | `bg-gray-50` | `dark:bg-gray-900` |
| 주요 텍스트 | `text-gray-900` | `dark:text-gray-100` |
| 보조 텍스트 | `text-gray-700` | `dark:text-gray-200` |
| 부가 정보 | `text-gray-600` | `dark:text-gray-400` |
| 테두리 | `border-gray-200` | `dark:border-gray-700` |
| 입력 테두리 | `border-gray-300` | `dark:border-gray-700` |
| 호버 배경 (가벼운) | `hover:bg-gray-50` | `dark:hover:bg-gray-800` |
| 호버 배경 (일반) | `hover:bg-gray-100` | `dark:hover:bg-gray-700` |
| 활성 상태 (인디고) | `bg-indigo-50` | `dark:bg-indigo-900/30` |
| 활성 텍스트 (인디고) | `text-indigo-700` | `dark:text-indigo-300` |

## 기술 구현 세부사항

### Tailwind CSS 4 다크모드 설정
- Tailwind CSS 4는 기본적으로 `selector` 전략을 사용하므로 추가 설정 불필요
- `next-themes`의 `attribute="class"` 설정과 호환

### next-themes 설정
- `lib/providers/ThemeProvider.tsx`에서 `attribute="class"` 사용
- `defaultTheme="light"`, `enableSystem={true}` 설정

## 변경된 파일 목록

### 신규 생성
- `lib/utils/darkMode.ts`

### 수정된 파일 (21개)
1. `lib/constants/colors.ts`
2. `app/(student)/plan/calendar/_utils/timelineUtils.ts`
3. `components/layout/RoleBasedLayout.tsx`
4. `components/navigation/global/CategoryNav.tsx`
5. `components/layout/PageHeader.tsx`
6. `components/organisms/LoadingOverlay.tsx`
7. `components/ui/Dialog.tsx`
8. `components/atoms/Badge.tsx`
9. `components/molecules/Tabs.tsx`
10. `app/(student)/contents/page.tsx`
11. `app/(student)/scores/_components/ScoreListTable.tsx`
12. `app/(student)/scores/_components/MockScoreListTable.tsx`
13. `app/(student)/dashboard/page.tsx`
14. `app/(student)/contents/master-books/page.tsx`
15. `app/(student)/contents/master-lectures/page.tsx`
16. `app/(student)/contents/master-custom-contents/page.tsx`
17. `app/(student)/plan/new-group/page.tsx`
18. `app/(student)/camp/[invitationId]/page.tsx`
19. `app/(student)/contents/_components/SelectionToolbar.tsx`
20. `app/(student)/plan/group/[id]/_components/PlanGroupStatusButtons.tsx`

## 예상 효과

1. **코드 중복 감소**: 23개 이상의 파일에서 중복 버튼 스타일을 유틸리티 함수로 통합
2. **유지보수성 향상**: 색상 변경 시 한 곳(`lib/utils/darkMode.ts`)만 수정하면 전체 적용
3. **일관성 확보**: 모든 컴포넌트에서 동일한 다크모드 색상 매핑 사용
4. **개발 속도 향상**: 새로운 컴포넌트 작성 시 유틸리티 함수 활용으로 빠른 개발

## 다음 단계 (선택사항)

1. **나머지 페이지 점진적 적용**: Admin, Superadmin 페이지에도 동일한 패턴 적용
2. **접근성 검증**: 색상 대비율 검증 도구 사용
3. **사용자 피드백 수집**: 다크모드 사용성 개선점 파악

## 참고 문서

- [다크모드 구현 가이드](./2025-02-02-dark-mode-implementation.md)
- [다크모드 분석 보고서](./2025-02-02-dark-mode-analysis.md)

---

**작업 완료일**: 2025-02-02  
**커밋**: `0164460` - feat: 다크모드 전면 적용 및 유틸리티 함수 생성


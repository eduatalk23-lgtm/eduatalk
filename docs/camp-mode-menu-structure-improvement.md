# 캠프 모드 메뉴 구조 개선

## 작업 개요

캠프 모드 전용 메뉴 구조를 생성하고, 캠프 플랜 캘린더와 캠프 학습관리 페이지를 추가하여 일반 플랜과 캠프 플랜을 명확히 구분했습니다.

## 메뉴 구조 변경

### 새로운 구조
- **최상위: 캠프 관리** (`/camp`)
  - **상위: 캠프 목록** (`/camp`)
  - **상위: 캠프 플랜 캘린더** (`/camp/calendar`)
  - **상위: 캠프 학습관리** (`/camp/today`)

### 기존 구조 유지
- **플랜 관리** (`/plan`)
  - 플랜 목록 (`/plan`) - 일반 플랜 그룹만
  - 플랜 캘린더 (`/plan/calendar`) - 일반 플랜 그룹만
- **학습 관리** (`/today`) - 일반 플랜 그룹만

## 구현 내용

### 1. 메뉴 구조 변경

**파일**: `components/navigation/global/categoryConfig.ts`

- "캠프 참여" → "캠프 관리"로 변경
- 하위 메뉴 추가:
  - "캠프 목록" (`/camp`)
  - "캠프 플랜 캘린더" (`/camp/calendar`)
  - "캠프 학습관리" (`/camp/today`)

### 2. 캠프 플랜 캘린더 페이지 생성

**파일**: `app/(student)/camp/calendar/page.tsx` (신규)

- 기존 `app/(student)/plan/calendar/page.tsx`를 기반으로 생성
- 캠프 모드 플랜 그룹만 필터링하여 표시
- 필터링 조건:
  - `plan_type === "camp"`
  - `camp_template_id !== null`
  - `camp_invitation_id !== null`
- 기존 `PlanCalendarView` 컴포넌트 재사용

### 3. 캠프 학습관리 페이지 생성

**파일**: `app/(student)/camp/today/page.tsx` (신규)

- 기존 `app/(student)/today/page.tsx`를 기반으로 생성
- 캠프 모드 플랜만 필터링하여 표시
- `TodayPageContent` 컴포넌트에 `campMode={true}` prop 전달

### 4. API 엔드포인트 수정

**파일**: `app/api/today/plans/route.ts`

- `camp` 쿼리 파라미터 추가
- `camp=true`인 경우: 캠프 모드 플랜 그룹만 필터링
- `camp=false` 또는 없음: 일반 모드 플랜 그룹만 필터링
- 플랜 그룹을 먼저 조회하여 필터링 후 플랜 조회

### 5. 컴포넌트 수정

**파일**: 
- `app/(student)/today/_components/TodayPageContent.tsx`
- `app/(student)/today/_components/PlanViewContainer.tsx`

- `campMode` prop 추가
- API 호출 시 `camp=true` 쿼리 파라미터 전달

### 6. 진행률 계산 함수 수정

**파일**: `lib/metrics/todayProgress.ts`

- `excludeCampMode` 파라미터 추가 (기본값: `false`)
- 캠프 모드 제외 시 일반 플랜 그룹만 필터링

### 7. 일반 학습관리 페이지 수정

**파일**: `app/(student)/today/page.tsx`

- `calculateTodayProgress` 호출 시 `excludeCampMode: true` 전달
- 일반 플랜 그룹만 반영

### 8. 네비게이션 활성화 로직 업데이트

**파일**:
- `components/navigation/global/CategoryNav.tsx`
- `components/navigation/student/StudentCategoryNav.tsx`

- `/camp/calendar`, `/camp/today` 경로도 캠프 모드로 인식
- 캠프 모드일 때 "캠프 관리" 카테고리 활성화

## 필터링 조건

### 캠프 모드 플랜 그룹
- `plan_type === "camp"`
- `camp_template_id !== null`
- `camp_invitation_id !== null`

### 일반 모드 플랜 그룹
- `plan_type !== "camp"`
- `camp_template_id === null`
- `camp_invitation_id === null`

## 사용자 경험 개선

1. **명확한 구분**: 캠프 플랜과 일반 플랜을 별도 메뉴로 분리하여 혼동 방지
2. **일관된 네비게이션**: 캠프 관련 페이지에서 항상 "캠프 관리" 메뉴 활성화
3. **독립적인 관리**: 캠프 플랜과 일반 플랜을 각각 독립적으로 관리 가능

## 작업 일시

2024년 11월


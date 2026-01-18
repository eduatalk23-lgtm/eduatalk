# 캘린더 무한 루프 수정 및 코드 최적화

## 작업 일자
2025-01-16

## 문제 분석

### 1. 무한 루프 문제
- `PlanCalendarView.tsx`의 `updateURL` 함수가 `searchParams`에 의존
- `useEffect`가 `updateURL`에 의존하여 무한 루프 발생
- `router.replace`가 URL을 변경하면 `searchParams`가 변경되고, 이로 인해 `updateURL`이 재생성되고, 다시 `useEffect`가 실행됨
- 터미널 로그에서 약 2초마다 반복 요청 발생 확인

### 2. 중복 코드
- `app/(student)/plan/calendar/page.tsx`와 `app/(student)/camp/calendar/page.tsx`에서 유사한 로직 반복
- 콘텐츠 정보 조회 및 플랜 강화 로직이 중복됨 (약 75줄)

### 3. 최적화 가능한 부분
- `updateURL` 함수 내부에서 URL 변경 여부를 확인하지 않음
- 초기 마운트 시 불필요한 URL 업데이트
- 불필요한 래퍼 함수들 (`goToPrevious`, `goToNext`, `goToToday`)

## 수정 내용

### Phase 1: PlanCalendarView 무한 루프 수정

#### 1.1 URL 동기화 로직 개선
**파일**: `app/(student)/plan/calendar/_components/PlanCalendarView.tsx`

- `updateURL` 함수에서 현재 URL과 비교하여 실제 변경이 있을 때만 `router.replace` 호출
- `searchParams` 대신 필요한 값만 추출하여 의존성으로 사용 (`currentDateParam`, `currentViewParam`)
- URL이 이미 올바른 값이면 업데이트하지 않음

```typescript
// 수정 전
const updateURL = useCallback((date: Date, viewType: "month" | "week" | "day") => {
  const dateStr = formatDateString(date);
  const params = new URLSearchParams(searchParams.toString());
  params.set("date", dateStr);
  params.set("view", viewType);
  router.replace(`?${params.toString()}`, { scroll: false });
}, [router, searchParams]);

// 수정 후
const currentDateParam = searchParams.get("date");
const currentViewParam = searchParams.get("view");

const updateURL = useCallback((date: Date, viewType: "month" | "week" | "day") => {
  const dateStr = formatDateString(date);
  
  // URL이 이미 올바른 값이면 업데이트하지 않음
  if (currentDateParam === dateStr && currentViewParam === viewType) {
    return;
  }
  
  const params = new URLSearchParams();
  params.set("date", dateStr);
  params.set("view", viewType);
  router.replace(`?${params.toString()}`, { scroll: false });
}, [router, currentDateParam, currentViewParam]);
```

#### 1.2 useEffect 최적화
- 초기 마운트 시 URL 업데이트 방지 (`isInitialMount` ref 사용)
- URL과 상태가 다를 때만 업데이트

```typescript
// 수정 전
useEffect(() => {
  updateURL(currentDate, view);
}, [currentDate, view, updateURL]);

// 수정 후
const isInitialMount = useRef(true);
useEffect(() => {
  // 초기 마운트 시에는 URL이 이미 올바르게 설정되어 있으므로 스킵
  if (isInitialMount.current) {
    isInitialMount.current = false;
    return;
  }
  
  const dateStr = formatDateString(currentDate);
  // URL과 상태가 다를 때만 업데이트
  if (currentDateParam !== dateStr || currentViewParam !== view) {
    updateURL(currentDate, view);
  }
}, [currentDate, view, updateURL, currentDateParam, currentViewParam]);
```

#### 1.3 불필요한 래퍼 함수 제거
- `goToPrevious`, `goToNext`, `goToToday`를 직접 `moveDate` 호출로 대체
- 코드 간소화 및 성능 개선

```typescript
// 수정 전
const goToPrevious = useCallback(() => moveDate("prev"), [moveDate]);
const goToNext = useCallback(() => moveDate("next"), [moveDate]);
const goToToday = useCallback(() => moveDate("today"), [moveDate]);

// 수정 후 - 직접 moveDate 사용
onClick={() => moveDate("prev")}
onClick={() => moveDate("next")}
onClick={() => moveDate("today")}
```

#### 1.4 handleViewChange 최적화
- `handleViewChange`에서 중복된 `updateURL` 호출 제거 (이미 `useEffect`에서 처리)

```typescript
// 수정 전
const handleViewChange = useCallback((newView: "month" | "week" | "day") => {
  setView(newView);
  updateURL(currentDate, newView);
}, [currentDate, updateURL]);

// 수정 후
const handleViewChange = useCallback((newView: "month" | "week" | "day") => {
  setView(newView);
  // updateURL은 useEffect에서 자동으로 처리됨
}, []);
```

### Phase 2: 중복 코드 제거

#### 2.1 공통 로직 추출
**파일**: `lib/utils/calendarPageHelpers.ts` (신규 생성)

- `plan/calendar/page.tsx`와 `camp/calendar/page.tsx`의 공통 로직을 유틸리티 함수로 추출
- `enrichPlansWithContentInfo` 함수 생성
- 콘텐츠 정보 조회 및 플랜 강화 로직 통합

**주요 기능**:
1. 교과 정보가 없는 플랜의 콘텐츠 ID 수집
2. 콘텐츠 테이블에서 교과 정보 및 제목 조회
3. 플랜에 기본 콘텐츠 정보 추가
4. `enrichPlansWithContentDetails` 호출하여 상세 정보 추가
5. 최종 `PlanWithContent` 배열 반환

#### 2.2 페이지 컴포넌트 리팩토링
**파일**: 
- `app/(student)/plan/calendar/page.tsx`
- `app/(student)/camp/calendar/page.tsx`

- 공통 로직을 `enrichPlansWithContentInfo` 함수로 대체
- 중복 코드 제거 (약 75줄 → 5줄)

```typescript
// 수정 전 (약 75줄)
const missingContentIds = new Map<...>();
// ... 복잡한 로직 ...

// 수정 후 (5줄)
const plansWithContent = await enrichPlansWithContentInfo(
  filteredPlans,
  supabase,
  user.id,
  "[calendar]" // 또는 "[camp-calendar]"
);
```

## 수정된 파일 목록

1. `app/(student)/plan/calendar/_components/PlanCalendarView.tsx`
   - URL 동기화 로직 개선
   - useEffect 최적화
   - 불필요한 래퍼 함수 제거
   - handleViewChange 최적화

2. `lib/utils/calendarPageHelpers.ts` (신규)
   - `enrichPlansWithContentInfo` 함수 구현
   - `PlanWithContent` 타입 정의

3. `app/(student)/plan/calendar/page.tsx`
   - 공통 함수 사용으로 중복 코드 제거

4. `app/(student)/camp/calendar/page.tsx`
   - 공통 함수 사용으로 중복 코드 제거

## 예상 효과

### 성능 개선
- ✅ 무한 루프 제거로 불필요한 페이지 리렌더링 방지
- ✅ 초기 마운트 시 불필요한 URL 업데이트 방지
- ✅ 조건부 URL 업데이트로 불필요한 라우터 호출 감소

### 코드 품질 개선
- ✅ 중복 코드 제거 (약 150줄 → 약 80줄)
- ✅ 유지보수성 향상 (공통 로직 중앙화)
- ✅ 코드 가독성 및 일관성 향상

### 사용자 경험 개선
- ✅ 페이지 로딩 시간 단축
- ✅ 불필요한 네트워크 요청 감소
- ✅ 더 부드러운 UI 인터랙션

## 참고 자료

- Next.js 15 App Router: `useSearchParams`와 `router.replace` 사용법
- React Hooks: `useCallback`, `useEffect` 무한 루프 방지 패턴
- Context7 모범 사례: 함수 의존성 최적화 및 조건부 업데이트

## 테스트 권장 사항

1. 캘린더 페이지 로드 시 무한 루프 발생 여부 확인
2. 날짜/뷰 변경 시 URL 동기화 정상 작동 확인
3. 초기 마운트 시 불필요한 URL 업데이트 없음 확인
4. 두 캘린더 페이지(일반/캠프) 모두 정상 작동 확인


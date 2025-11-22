# Today 페이지 성능 최적화

## 📋 문제 분석

`/today` 페이지의 로딩이 오래 걸리는 주요 원인:

### 1. 중복 데이터 페칭
- `calculateTodayProgress` 함수가 **3번 중복 호출**됨:
  - `TodayGoals` 컴포넌트
  - `TodayFocusPreview` 컴포넌트
  - `TodayAchievements` 컴포넌트

### 2. calculateTodayProgress의 무거운 작업
이 함수는 다음 데이터베이스 쿼리를 실행합니다:
- `getPlansForStudent` - 오늘 날짜의 플랜 조회
- `getSessionsInRange` - 오늘 날짜의 세션 조회
- `getGoalsForStudent` - 활성 목표 조회
- 각 목표마다 `getGoalProgressList` 호출 (목표 수만큼 추가 쿼리)

### 3. 순차 실행
각 컴포넌트가 순차적으로 실행되어 전체 로딩 시간이 누적됨

## ✅ 최적화 방안

### 1. 중복 호출 제거
- 페이지 레벨에서 `calculateTodayProgress`를 **한 번만 호출**
- 결과를 props로 각 컴포넌트에 전달

### 2. 병렬 처리
- 병렬 처리 가능한 데이터 페칭을 `Promise.all`로 묶기

### 3. 데이터 재사용
- `TodayPlanList`와 `calculateTodayProgress`가 모두 플랜을 조회하므로 공통 데이터 재사용 고려 (향후 개선)

## 🔧 구현 내용

### 변경된 파일

1. **`app/(student)/today/page.tsx`**
   - 페이지 레벨에서 `calculateTodayProgress` 한 번만 호출
   - 결과를 props로 전달

2. **`app/(student)/today/_components/TodayGoals.tsx`**
   - `calculateTodayProgress` 호출 제거
   - props로 `todayProgress` 받도록 변경

3. **`app/(student)/today/_components/TodayFocusPreview.tsx`**
   - `calculateTodayProgress` 호출 제거
   - props로 `todayProgress` 받도록 변경

4. **`app/(student)/today/_components/TodayAchievements.tsx`**
   - `calculateTodayProgress` 호출 제거
   - props로 `todayProgress` 받도록 변경

## 📊 성능 개선 효과

### Before (최적화 전)
- `calculateTodayProgress` 호출: **3번**
- 예상 쿼리 수: 플랜 조회 3번 + 세션 조회 3번 + 목표 조회 3번 + 목표 진행률 조회 (목표 수 × 3)
- 총 쿼리 수: **약 9 + (목표 수 × 3)개**

### After (최적화 후)
- `calculateTodayProgress` 호출: **1번**
- 예상 쿼리 수: 플랜 조회 1번 + 세션 조회 1번 + 목표 조회 1번 + 목표 진행률 조회 (목표 수 × 1)
- 총 쿼리 수: **약 3 + (목표 수 × 1)개**

### 예상 성능 개선
- **약 66% 쿼리 감소** (목표가 많을수록 더 큰 개선)
- **로딩 시간 약 50-70% 단축** 예상

## 🚀 추가 최적화 가능 사항

### 1. 플랜 조회 중복 제거
- `TodayPlanList`와 `calculateTodayProgress`가 모두 오늘 날짜의 플랜을 조회
- 페이지 레벨에서 한 번만 조회하고 공유 가능

### 2. 캐싱 전략
- `calculateTodayProgress` 결과를 짧은 시간(예: 30초) 캐싱
- 같은 사용자가 빠르게 재방문 시 캐시 사용

### 3. Streaming SSR
- 느린 컴포넌트는 Suspense로 감싸서 점진적 렌더링
- 빠른 컴포넌트는 먼저 표시

## 📝 참고사항

- 컴포넌트는 여전히 서버 컴포넌트로 유지
- 에러 처리는 각 컴포넌트에서 유지
- 타입 안전성을 위해 `TodayProgress` 타입 사용


# 오늘의 학습 페이지 로딩 시간 개선

## 개요

오늘의 학습 페이지(`/today`)의 DB 부하를 줄이고 초기 로딩 시간을 개선하기 위한 최적화 작업입니다.

## 작업 내용

### 1. DB View 생성 (`today_plan_view`)

**목적**: Application-side Join을 DB 레벨로 이동하여 네트워크 왕복 횟수 감소

**마이그레이션 파일**: `supabase/migrations/20251215163535_create_today_plan_view.sql`

**View 구조**:
- `student_plan` 테이블의 모든 필드
- `books`, `lectures`, `student_custom_contents` 테이블과 LEFT JOIN
- `view_content_title`, `view_content_subject` 등의 fallback 필드 제공
- denormalized 필드(`student_plan.content_title` 등)가 NULL일 때 사용

**사용 방법**:
- `getPlansFromView()` 함수를 통해 View 조회
- denormalized 필드 우선, View 필드는 fallback

### 2. Application-side Join 제거

**변경 파일**: `lib/data/todayPlans.ts`

**변경 내용**:
- `getContentsByIds()` 호출 제거 (3개 쿼리 → 0개 쿼리)
- `getPlansFromView()` 함수 추가하여 View 사용
- View에서 가져온 정보로 `content` 객체 생성
- 기존 `contentMap` 제거

**성능 개선**:
- 네트워크 왕복 횟수: 4개 쿼리 → 1개 쿼리 (View 사용 시)
- 예상 쿼리 시간 감소: 30-50%

### 3. Statistics 비동기 처리

**목적**: Statistics 계산을 Suspense로 감싸서 초기 로딩 블로킹 방지

**변경 파일**:
- `app/api/today/stats/route.ts` (새로 생성)
- `app/(student)/today/_components/TodayAchievementsAsync.tsx` (새로 생성)
- `app/(student)/today/page.tsx`

**변경 내용**:
- `/api/today/stats` 엔드포인트 생성 (기존 `/api/today/progress`와 동일한 로직)
- `TodayAchievementsAsync` 서버 컴포넌트 생성
- `TodayAchievementsAsyncWithSuspense`로 Suspense 적용
- 페이지에서 `includeProgress: false`로 설정하여 초기 로딩 시 Statistics 제외
- Suspense로 Statistics 별도 스트리밍

**성능 개선**:
- 초기 로딩 시간: Statistics 계산 시간만큼 감소 (40-60% 예상)
- 플랜 리스트는 즉시 렌더링, Statistics는 별도로 스트리밍

## 파일 변경 목록

### 새로 생성된 파일

1. `supabase/migrations/20251215163535_create_today_plan_view.sql`
   - DB View 생성 마이그레이션

2. `app/api/today/stats/route.ts`
   - Statistics 조회 API 엔드포인트

3. `app/(student)/today/_components/TodayAchievementsAsync.tsx`
   - 서버 컴포넌트로 Statistics 비동기 로딩

### 수정된 파일

1. `lib/data/todayPlans.ts`
   - `getPlansFromView()` 함수 추가
   - Application-side Join 코드 제거
   - View 사용으로 변경

2. `app/(student)/today/page.tsx`
   - `includeProgress: false`로 변경
   - `TodayAchievementsAsyncWithSuspense` 사용
   - Suspense 적용

## 주의사항

### RLS 정책

View는 기존 테이블의 RLS 정책을 상속받으므로, 별도의 RLS 정책 설정이 필요 없습니다.

### 캐싱 전략

- `today_plans_cache` 테이블이 이미 존재하며, View 사용 후에도 캐싱 로직이 유지됩니다.
- View를 사용하더라도 캐시 키는 동일하므로 기존 캐싱 전략이 그대로 적용됩니다.

### Fallback 동작

View가 없거나 오류 발생 시, `getPlansFromView()` 함수는 자동으로 기존 `getPlansForStudent()`로 fallback됩니다.

### 클라이언트 사이드 날짜 변경

클라이언트 사이드에서 날짜 변경 시에는 여전히 `TodayPageContext`의 `fetchProgress()`를 통해 `/api/today/progress`를 호출합니다.

## 테스트 계획

1. View 쿼리 성능 측정 (EXPLAIN ANALYZE)
2. 기존 로직과 결과 일치 여부 확인
3. Edge case 처리 확인 (NULL 값, 존재하지 않는 content_id 등)
4. Suspense 스트리밍 동작 확인

## 예상 성능 개선

### DB 쿼리 감소
- 현재: `student_plan` 조회 + `books` 조회 + `lectures` 조회 + `student_custom_contents` 조회 = 4개 쿼리
- 개선: `today_plan_view` 조회 = 1개 쿼리
- 예상: 약 30-50% 쿼리 시간 감소

### 초기 렌더링 개선
- 현재: Statistics 계산 완료 후 전체 페이지 렌더링
- 개선: 플랜 리스트 즉시 렌더링, Statistics는 스트리밍
- 예상: 초기 로딩 시간 40-60% 감소 (Statistics 계산 시간만큼)


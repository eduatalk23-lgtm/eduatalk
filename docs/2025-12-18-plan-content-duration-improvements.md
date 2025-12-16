# 플랜 그룹 생성 시 콘텐츠 유형별 처리 개선

## 개요

플랜 그룹 생성 시 교재와 강의 콘텐츠의 학습 내역, 학습 분량, 소요시간 처리 로직을 개선하여 정확성과 성능을 향상시켰습니다.

## 작업 내용

### Phase 1: N+1 쿼리 문제 해결 ✅

**문제**: 각 강의마다 episode를 순차 조회하여 성능 저하 발생

**해결**:
- `lib/plan/contentResolver.ts`의 `loadContentDurations` 함수에서 `getStudentLectureEpisodesBatch` 활용
- 마스터 강의 episode 배치 조회 함수 `getMasterLectureEpisodesBatch` 추가 (`lib/data/contentMasters.ts`)
- 모든 강의 ID를 수집하여 한 번에 배치 조회
- 결과를 Map으로 그룹화하여 O(1) 조회

**성능 개선**: 강의 10개 기준 10회 쿼리 → 2회 쿼리 (80% 감소)

### Phase 2: 중복 코드 제거 ✅

**문제**: `calculateContentDuration`과 `calculateEstimatedTime` 함수가 여러 파일에 중복

**해결**:
- `lib/scheduler/SchedulerEngine.ts`와 `lib/plan/scheduler.ts`에서 중복 `calculateContentDuration` 함수 제거
- `lib/plan/contentDuration.ts`의 통합 함수 사용
- `scheduleTransform.ts`와 `scheduleUtils.ts`에서 중복 `calculateEstimatedTime` 함수 제거
- `lib/plan/assignPlanTimes.ts`의 `calculatePlanEstimatedTime` 함수 사용

**코드 감소**: 약 200줄 감소

### Phase 3: 강의 소요시간 계산 정확성 향상 ✅

**문제**: 전체 회차 수를 모르므로 부정확한 계산

**해결**:
- `ContentDurationInfo` 타입에 `total_episodes` 필드 추가
- `loadContentDurations` 함수에서 `total_episodes` 조회 및 저장
- `calculateContentDuration` 함수에서 `total_episodes` 기반 정확한 계산

**계산 로직**:
```typescript
if (durationInfo.total_episodes && durationInfo.duration) {
  const avgDurationPerEpisode = durationInfo.duration / durationInfo.total_episodes;
  baseTime = Math.round(avgDurationPerEpisode * amount);
}
```

### Phase 4: 교재 난이도별 소요시간 설정 ✅

**문제**: 모든 교재가 동일한 난이도로 가정

**해결**:
- `ContentDurationInfo` 타입에 `difficulty_level` 필드 추가
- `loadContentDurations` 함수에서 `difficulty_level` 조회 및 저장
- 난이도별 매핑 테이블 생성 및 적용

**난이도별 매핑**:
```typescript
const PAGE_DURATION_BY_DIFFICULTY: Record<string, number> = {
  기초: 4,   // 페이지당 4분
  기본: 6,   // 페이지당 6분 (현재 기본값)
  심화: 8,   // 페이지당 8분
  최상: 10,  // 페이지당 10분
};
```

### Phase 5: 복습일 비율 설정화 ✅

**문제**: 복습일 비율이 하드코딩됨 (50% 고정)

**해결**:
- `tenant_scheduler_settings` 테이블에 `review_time_ratio` 컬럼 추가 (마이그레이션)
- 기본값 0.5 (50%) 설정
- `SchedulerSettings` 타입에 `review_time_ratio` 필드 추가
- `calculateContentDuration` 함수에서 설정값 사용

**마이그레이션**: `supabase/migrations/20251218000000_add_review_time_ratio_to_scheduler_settings.sql`

## 수정된 파일

### 핵심 로직
- `lib/plan/contentResolver.ts` - Episode 배치 조회 적용
- `lib/plan/contentDuration.ts` - 소요시간 계산 로직 개선
- `lib/types/plan-generation.ts` - `ContentDurationInfo` 타입 확장

### 중복 코드 제거
- `lib/scheduler/SchedulerEngine.ts` - 중복 함수 제거
- `lib/plan/scheduler.ts` - 중복 함수 제거
- `app/(student)/plan/new-group/_components/utils/scheduleTransform.ts` - 통합 함수 사용
- `app/(student)/plan/new-group/_components/_features/scheduling/components/scheduleUtils.ts` - 통합 함수 사용

### 설정 관리
- `lib/types/schedulerSettings.ts` - `review_time_ratio` 필드 추가
- `lib/utils/schedulerSettingsMerge.ts` - 설정 병합 로직 업데이트
- `lib/data/contentMasters.ts` - 마스터 강의 episode 배치 조회 함수 추가

### 마이그레이션
- `supabase/migrations/20251218000000_add_review_time_ratio_to_scheduler_settings.sql` - 복습일 비율 컬럼 추가

## 예상 효과

### 성능 개선
- N+1 쿼리 해결: 강의 10개 기준 쿼리 수 10회 → 2회 (80% 감소)
- 응답 시간: 900ms → 150ms (약 83% 개선 예상)

### 코드 품질
- 중복 코드 제거: 약 200줄 감소
- 유지보수성 향상: 단일 소스로 로직 관리

### 정확성 향상
- 강의 소요시간: 전체 회차 수 기반 정확한 계산
- 교재 소요시간: 난이도별 차등 적용
- 복습일 비율: 설정 가능 (기본값 50%)

## 참고 사항

- 기존 배치 조회 함수 (`getStudentLectureEpisodesBatch`) 활용
- 데이터베이스 스키마는 이미 필요한 필드 존재 (`total_episodes`, `difficulty_level`)
- 하위 호환성 유지 (기본값 fallback 로직 유지)


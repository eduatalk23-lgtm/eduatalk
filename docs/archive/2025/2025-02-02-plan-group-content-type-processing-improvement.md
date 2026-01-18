# 플랜 그룹 생성 콘텐츠 유형별 처리 및 스케줄 시간 구성 개선

## 개요

플랜 그룹 생성 시 강의 콘텐츠의 episode별 duration 정보가 일별 스케줄 시간 구성에 제대로 반영되도록 개선하고, 중복 코드를 제거하며 성능을 최적화했습니다.

## 작업 일자

2025-02-02

## 개선 사항

### 1. Episode 정보 전달 경로 검증

**파일**: `app/(student)/actions/plan-groups/generatePlansRefactored.ts`

- `loadContentDurations` 호출 후 `contentDurationMap`에 episode 정보가 포함되어 있는지 검증하는 로깅 추가
- `assignPlanTimes` 호출 전 episode 정보 전달 확인 로깅 추가
- 개발 환경에서만 로깅 출력 (`process.env.NODE_ENV === "development"`)

**변경 내용**:
- 강의 콘텐츠의 episode 정보 포함 여부 확인
- Episode 정보가 없는 경우 경고 로그 출력
- Episode 정보가 있는 경우 상세 정보 로깅

### 2. `calculateContentDuration` 함수 최적화

**파일**: `lib/plan/contentDuration.ts`

**개선 사항**:
- Episode Map 생성 최적화: `createEpisodeMap` 헬퍼 함수 추가
- 기본값 상수 추출: `DEFAULT_BASE_TIME_MINUTES`, `DEFAULT_EPISODE_DURATION_MINUTES` 등
- Null 체크 강화: 명시적 null/undefined 검증
- 타입 안전성 개선: 타입 가드 함수 사용

**주요 변경**:
```typescript
// Before: 매번 Map 생성
const episodeMap = new Map(
  durationInfo.episodes.map((ep) => [ep.episode_number, ep.duration])
);

// After: 최적화된 헬퍼 함수 사용
const episodeMap = createEpisodeMap(durationInfo.episodes);
```

### 3. `assignPlanTimes` 함수 개선

**파일**: `lib/plan/assignPlanTimes.ts`

**개선 사항**:
- Episode 정보 활용 검증 로깅 추가
- `calculatePlanEstimatedTime`에서 기본값 계산 로직 개선
- 타입 안전성 개선: `lib/types/plan-generation`의 타입 사용

**변경 내용**:
- 강의 콘텐츠의 episode 정보 확인 및 로깅
- 범위 내 episode 개수 및 duration 정보 상세 로깅
- Episode 정보가 없는 경우 경고 로그 출력

### 4. 중복 코드 제거

**파일들**:
- `lib/plan/contentDuration.ts`
- `lib/plan/assignPlanTimes.ts`
- `lib/scheduler/SchedulerEngine.ts`
- `lib/plan/scheduler.ts`

**개선 사항**:
- 모든 소요시간 계산을 `calculateContentDuration`으로 통합
- 기본값 상수를 공통 상수로 추출
- Fallback 로직 일관성 개선

**변경 내용**:
- `SchedulerEngine.ts`와 `scheduler.ts`의 중복된 fallback 로직 개선
- 기본값 계산 로직을 `calculateDefaultDuration` 헬퍼 함수로 추출

### 5. Map 데이터 구조 최적화

**파일**: `lib/plan/contentResolver.ts`

**개선 사항**:
- Episode 정보 변환 시 타입 안전성 강화
- Null 체크 강화: `??` 연산자 사용
- Episode 정보 필터링 로직 개선

**변경 내용**:
```typescript
// Before
const studentEpisodes = studentEpisodesMap.get(finalContentId) || [];

// After
const studentEpisodes = studentEpisodesMap.get(finalContentId) ?? [];
```

### 6. 타입 안전성 개선

**파일**: `lib/types/plan-generation.ts`

**개선 사항**:
- `EpisodeInfo` 타입 별도 정의
- `hasValidEpisodes` 타입 가드 함수 추가
- `isValidContentDurationInfo` 타입 가드 함수 추가

**추가된 타입**:
```typescript
export type EpisodeInfo = {
  episode_number: number;
  duration: number | null;
};

export function hasValidEpisodes(
  episodes: ContentDurationInfo["episodes"]
): episodes is EpisodeInfo[];

export function isValidContentDurationInfo(
  info: ContentDurationInfo | null | undefined
): info is ContentDurationInfo;
```

## 수정된 파일 목록

1. `app/(student)/actions/plan-groups/generatePlansRefactored.ts`
   - Episode 정보 전달 경로 검증 로깅 추가

2. `lib/plan/contentDuration.ts`
   - Episode Map 생성 최적화
   - 기본값 상수 추출
   - 타입 안전성 개선

3. `lib/plan/assignPlanTimes.ts`
   - Episode 정보 활용 검증 로깅 추가
   - 기본값 계산 로직 개선
   - 타입 안전성 개선

4. `lib/scheduler/SchedulerEngine.ts`
   - 중복 코드 제거 (fallback 로직 개선)

5. `lib/plan/scheduler.ts`
   - 중복 코드 제거 (fallback 로직 개선)

6. `lib/plan/contentResolver.ts`
   - Map 데이터 구조 최적화
   - 타입 안전성 개선

7. `lib/types/plan-generation.ts`
   - EpisodeInfo 타입 정의 추가
   - 타입 가드 함수 추가

## 검증 방법

### 개발 환경에서 로깅 확인

1. 플랜 그룹 생성 시 콘솔 로그 확인:
   - `[generatePlansRefactored] 강의 콘텐츠 episode 정보 확인`
   - `[assignPlanTimes] 강의 플랜 episode 정보 확인`
   - `[calculateContentDuration] 강의 episode별 duration 합산`

2. Episode 정보가 없는 경우 경고 로그 확인:
   - `[generatePlansRefactored] 강의 콘텐츠 episode 정보 누락`
   - `[assignPlanTimes] 강의 플랜 episode 정보 없음`

### 테스트 시나리오

1. **강의 콘텐츠에 episode 정보가 있는 경우**:
   - Episode별 duration이 정확히 합산되어 일별 스케줄 시간에 반영되는지 확인
   - 로그에서 episode 정보가 제대로 전달되는지 확인

2. **강의 콘텐츠에 episode 정보가 없는 경우**:
   - 전체 duration / 전체 회차 * 배정 회차로 계산되는지 확인
   - 경고 로그가 출력되는지 확인

3. **복습일인 경우**:
   - 소요시간이 50%로 단축되는지 확인

## 예상 효과

1. **강의 콘텐츠 episode별 duration 정보가 일별 스케줄 시간 구성에 정확히 반영됨**
2. **중복 코드 제거로 유지보수성 향상**
3. **성능 최적화로 플랜 생성 속도 개선**
4. **타입 안전성 향상으로 런타임 에러 감소**

## 참고 사항

- TypeScript 2025 모범 사례 적용
- Map 데이터 구조 최적화 패턴 적용
- 기존 코드 스타일 및 컨벤션 유지
- 하위 호환성 보장
- 개발 환경에서만 로깅 출력 (프로덕션 성능 영향 없음)


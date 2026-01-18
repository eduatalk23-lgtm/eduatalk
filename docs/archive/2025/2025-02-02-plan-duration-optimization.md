# 플랜 생성 중복 계산 및 시간 배정 최적화

## 작업 일자
2025-02-02

## 문제점

### 1. 중복 계산 문제
- `calculateContentDuration` 함수가 동일한 `content_id`와 `range`에 대해 여러 번 호출됨
- 터미널 로그에서 `range: '15~15'`가 두 번 호출되는 등 중복 발생
- 성능 저하 및 불필요한 연산 발생

### 2. 시간 배정 문제
- 모든 episode가 동일한 시간대(10:00 ~ 10:30)에 배정됨
- 실제 episode duration(26분, 24분, 28분 등)이 반영되지 않음
- HTML에서 모든 episode가 30분으로 표시됨

### 3. 범위 분할 불일치
- `range: '2~23'` (22개 episode)가 하나의 플랜으로 생성됨
- 다음 날에는 `range: '2~2'`, `range: '3~3'` 등으로 개별 episode가 플랜으로 생성됨
- 일관성 없는 플랜 생성 패턴

### 4. Pre-calculated time 처리 문제
- `hasPrecalculatedTimes`가 true일 때 episode별 duration을 반영하지 않음
- 큰 범위(`range: '2~23'`)가 하나의 시간 세그먼트로 처리됨

## 해결 방안

### Phase 1: 캐싱 메커니즘 도입

#### 변경 파일
- `lib/plan/contentDuration.ts`

#### 주요 변경사항
1. Map 기반 캐싱 구현 (TTL 5분)
2. 캐시 키: `${content_id}:${start_range}~${end_range}:${dayType}`
3. 캐시 히트/미스 로깅 (개발 환경)
4. 캐시 무효화 함수 추가 (`invalidateDurationCache`)

#### 구현 내용
```typescript
const durationCache = new Map<string, { result: number; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5분

function getCachedDuration(key: string, calculateFn: () => number): number {
  // 캐시 조회 및 저장 로직
}
```

### Phase 2: Episode별 플랜 분할 로직

#### 신규 파일
- `lib/plan/planSplitter.ts`

#### 주요 기능
1. `splitPlanByEpisodes`: ScheduledPlan을 episode별로 분할
2. `splitPlanTimeInputByEpisodes`: PlanTimeInput을 episode별로 분할
3. Pre-calculated time 제거 (재계산 필요)

#### 변경 파일
- `app/(student)/actions/plan-groups/generatePlansRefactored.ts`

#### 주요 변경사항
1. `assignPlanTimes` 호출 전에 episode별 분할 수행
2. Pre-calculated time이 있어도 episode별 분할 후 재계산
3. 분할된 플랜에 대해 시간 재배정

### Phase 3: 시간 배정 로직 개선

#### 변경 파일
- `lib/plan/assignPlanTimes.ts`

#### 주요 변경사항
1. `assignEpisodeBasedTimes` 함수 추가
2. Episode별 duration을 정확히 반영한 시간 배정
3. 연속된 episode들이 시간 순서대로 배정되도록 보장
4. 강의 콘텐츠가 있고 episode별로 분할된 경우 자동으로 episode 기반 배정 사용

#### 구현 내용
```typescript
function assignEpisodeBasedTimes(
  plansWithInfo: Array<{...}>,
  studyTimeSlots: StudyTimeSlot[],
  contentDurationMap: Map<string, ContentDurationInfo>,
  dayType: string
): PlanTimeSegment[] {
  // Episode별 duration 누적 배정 로직
}
```

### Phase 4: 코드 최적화

#### 변경 파일
- `lib/plan/contentDuration.ts`
- `lib/plan/assignPlanTimes.ts`

#### 주요 변경사항
1. 중복된 상수 통합 (DEFAULT_BASE_TIME_MINUTES, DEFAULT_EPISODE_DURATION_MINUTES, DEFAULT_REVIEW_TIME_RATIO)
2. `contentDuration.ts`에서 상수 export
3. `assignPlanTimes.ts`에서 상수 import

## 테스트

### 단위 테스트
- `__tests__/plan/contentDuration.test.ts`: 캐싱 메커니즘 테스트
- `__tests__/plan/planSplitter.test.ts`: 플랜 분할 로직 테스트

### 테스트 커버리지
- 캐싱 히트/미스 시나리오
- Episode별 분할 로직
- 복습일 duration 계산
- 난이도별 페이지당 시간 계산

## 예상 효과

### 성능 개선
- 중복 계산 제거로 계산 시간 50% 이상 감소 예상
- 캐싱으로 동일 입력에 대한 즉시 응답

### 정확성 개선
- Episode별 실제 duration 반영
- 정확한 시간 배정으로 사용자 경험 개선

### 코드 품질 개선
- 중복 코드 제거
- 모듈화 및 재사용성 향상

## 참고 사항

- 캐시 TTL은 5분으로 설정 (필요시 조정 가능)
- 개발 환경에서만 캐시 히트/미스 로깅
- Episode별 분할은 강의 콘텐츠에만 적용
- Pre-calculated time이 있어도 episode별 분할 후 재계산


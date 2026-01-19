# Plan Generation Architecture Analysis

> 작성일: 2025-12-22
> 최종 수정: 2025-12-22 (Phase 5 완료)
> 목적: 플랜 생성 시스템 리팩토링을 위한 현재 아키텍처 분석 및 개선 로드맵

## 1. 현재 아키텍처 개요

### 1.1 핵심 파일 및 책임

| 파일 | 줄 수 | 책임 | 문제점 |
|------|------|------|--------|
| `generatePlansRefactored.ts` | 1,547 | 전체 플랜 생성 오케스트레이션 | **God Function** - 16+ 책임 |
| `previewPlansRefactored.ts` | ~1,500 | 플랜 미리보기 | generate와 90% 중복 |
| `contentResolver.ts` | 1,080 | 콘텐츠 ID 해석/매핑 | 복잡한 fallback 체인 |
| `contentMasters.ts` | 400+ | 마스터 콘텐츠 조회/복사 | RLS 권한 문제 |
| `scheduler.ts` | 500+ | 스케줄 생성 | 1730 로직 혼재 |
| `assignPlanTimes.ts` | 500+ | 시간 슬롯 할당 | 에피소드 분할 로직 혼재 |

### 1.2 의존성 그래프

```
┌─────────────────────────────────────────────────────────────────┐
│                  generatePlansRefactored.ts                      │
│                      (1,547줄 - God Function)                    │
└─────────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
        ▼                     ▼                     ▼
┌───────────────┐   ┌─────────────────┐   ┌─────────────────┐
│contentResolver│   │   scheduler.ts   │   │assignPlanTimes │
│    .ts        │   │                 │   │     .ts        │
│  (1,080줄)    │   │   (500+줄)      │   │   (500+줄)     │
└───────────────┘   └─────────────────┘   └─────────────────┘
        │                     │                     │
        ▼                     ▼                     ▼
┌───────────────┐   ┌─────────────────┐   ┌─────────────────┐
│contentMasters │   │1730Timetable    │   │ planSplitter   │
│    .ts        │   │   Logic.ts      │   │     .ts        │
└───────────────┘   └─────────────────┘   └─────────────────┘
```

## 2. 새 서비스 레이어 아키텍처 (Phase 2-5)

### 2.1 서비스 레이어 구조도

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              API / Server Actions                                │
│                                                                                  │
│  plans.ts ──► canUseServiceBasedGeneration() ──► Feature Flag 분기              │
│                     │                                                            │
│         ┌──────────┴──────────┐                                                 │
│         ▼                     ▼                                                  │
│  [레거시 경로]         [새 서비스 경로]                                           │
│  generatePlans         generatePlansWithServices                                 │
│  Refactored.ts         previewPlansWithServices                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                        preparePlanGenerationData (Phase 5)                       │
│                              공통 데이터 준비 함수                                 │
│                                                                                  │
│  1. 플랜 그룹 조회    ─► getPlanGroupWithDetailsByRole()                         │
│  2. 블록 세트 조회    ─► getBlockSetForPlanGroup()                               │
│  3. 스케줄러 설정 병합 ─► getMergedSchedulerSettings()                            │
│  4. 스케줄 계산       ─► calculateAvailableDates()                               │
│  5. 스케줄 맵 추출    ─► extractScheduleMaps()                                   │
│  6. 콘텐츠 해석       ─► adaptContentResolution()                                │
│  7. 스케줄 생성       ─► adaptScheduleGeneration()                               │
│  8. 시간 할당         ─► assignPlanTimes()                                       │
│                                                                                  │
│  Returns: PlanGenerationPreparedData                                             │
│           ├── group, contents                                                    │
│           ├── dateAllocations: DateAllocationResult[]                            │
│           ├── contentMetadataMap, contentDurationMap                             │
│           └── weekDatesMap, dateTimeSlots                                        │
└─────────────────────────────────────────────────────────────────────────────────┘
                                    │
              ┌─────────────────────┴─────────────────────┐
              ▼                                           ▼
┌──────────────────────────────┐         ┌──────────────────────────────┐
│   generatePlansWithServices   │         │   previewPlansWithServices    │
│                              │         │                              │
│  + planPayloads 생성         │         │  + PreviewPlan[] 생성        │
│  + PlanPersistenceService    │         │  + weekDay, planNumber 계산   │
│    .savePlans()              │         │                              │
│                              │         │  Returns: PreviewPlan[]       │
│  Returns: { count }          │         │                              │
└──────────────────────────────┘         └──────────────────────────────┘
```

### 2.2 서비스 레이어 상세 구조

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                          lib/plan/services/                                      │
└─────────────────────────────────────────────────────────────────────────────────┘
                                    │
    ┌───────────────────────────────┼───────────────────────────────┐
    │                               │                               │
    ▼                               ▼                               ▼
┌────────────────┐         ┌────────────────┐         ┌────────────────────────┐
│   Core Types    │         │ Error/Logging  │         │    Service Adapters    │
│   (types.ts)    │         │   (Phase 4)    │         │   (ServiceAdapter.ts)  │
│                │         │                │         │                        │
│ ServiceContext │         │ errors.ts      │         │ adaptContentResolution │
│ ServiceResult  │         │ ├─ServiceError │         │ adaptScheduleGeneration│
│ I*Service      │         │ ├─ErrorCodes   │         │ adaptTimeAllocation    │
└────────────────┘         │ └─toServiceErr │         └────────────────────────┘
                          │                │
                          │ logging.ts     │
                          │ ├─ServiceLogger│
                          │ ├─PerfTracker  │
                          │ └─globalPerf   │
                          └────────────────┘
                                    │
    ┌───────────────────────────────┼───────────────────────────────┐
    │                               │                               │
    ▼                               ▼                               ▼
┌────────────────────┐   ┌────────────────────┐   ┌────────────────────────┐
│ ContentResolution  │   │ ScheduleGeneration │   │   TimeAllocation       │
│    Service         │   │      Service       │   │      Service           │
│                    │   │                    │   │                        │
│ resolveContentIds  │   │ generateSchedule   │   │ allocateTimeSlots      │
│ loadMetadata       │   │ (어댑터 패턴)       │   │ (어댑터 패턴)           │
│ loadDurations      │   │                    │   │                        │
└────────────────────┘   └────────────────────┘   └────────────────────────┘
                                    │
                                    ▼
                        ┌────────────────────────┐
                        │  PlanPersistence       │
                        │      Service           │
                        │                        │
                        │ savePlans()            │
                        │ deletePlans()          │
                        └────────────────────────┘
```

### 2.3 Feature Flag 전환 흐름

```typescript
// 환경 변수: ENABLE_NEW_PLAN_SERVICES=true

// app/(student)/actions/plan-groups/plans.ts
export async function generatePlans(groupId: string) {
  if (canUseServiceBasedGeneration()) {
    // 새 서비스 레이어 사용
    return generatePlansWithServices({
      groupId,
      context: { studentId, tenantId },
      accessInfo: { userId, role }
    });
  } else {
    // 기존 레거시 코드 사용
    return generatePlansRefactored({ groupId });
  }
}
```

## 3. 데이터 흐름 (Data Flow)

### 3.1 플랜 생성 전체 흐름

```
[사용자 요청]
     │
     ▼
┌────────────────────────────────────────────────────────────┐
│ 1. 인증 & 권한 검증                                         │
│    - getCurrentUser(), requireStudentAuth()                │
│    - admin/consultant 모드 체크                            │
└────────────────────────────────────────────────────────────┘
     │
     ▼
┌────────────────────────────────────────────────────────────┐
│ 2. 플랜 그룹 데이터 로딩                                    │
│    - plan_groups 테이블 조회                                │
│    - plan_contents, plan_exclusions 조회                   │
│    - academy_schedules 조회                                │
└────────────────────────────────────────────────────────────┘
     │
     ▼
┌────────────────────────────────────────────────────────────┐
│ 3. 콘텐츠 ID 해석 (Content Resolution)                      │
│    - resolveContentIds(): master → student ID 매핑         │
│    - 캠프 모드: 마스터 콘텐츠 → 학생 콘텐츠 복사            │
│    - contentIdMap, detailIdMap 생성                        │
└────────────────────────────────────────────────────────────┘
     │
     ▼
┌────────────────────────────────────────────────────────────┐
│ 4. 콘텐츠 메타데이터 로딩                                   │
│    - loadContentMetadata(): 제목, 과목, 카테고리           │
│    - loadContentDurations(): 페이지 수, 소요 시간          │
│    - loadContentChapters(): 챕터/에피소드 정보             │
└────────────────────────────────────────────────────────────┘
     │
     ▼
┌────────────────────────────────────────────────────────────┐
│ 5. 스케줄 생성 (Schedule Generation)                        │
│    - calculateAvailableDates(): 학습 가능 날짜 계산        │
│    - generatePlansFromGroup(): 콘텐츠를 날짜별 분배        │
│    - 1730 타임테이블 로직 적용 (선택적)                     │
└────────────────────────────────────────────────────────────┘
     │
     ▼
┌────────────────────────────────────────────────────────────┐
│ 6. 시간 할당 (Time Allocation)                              │
│    - assignPlanTimes(): 시간 슬롯 배정                     │
│    - splitPlanTimeInputByEpisodes(): 에피소드 분할         │
│    - is_partial, is_continued 플래그 계산                  │
└────────────────────────────────────────────────────────────┘
     │
     ▼
┌────────────────────────────────────────────────────────────┐
│ 7. 검증 & DB 저장                                           │
│    - 중복 플랜 삭제 (기존 플랜 정리)                        │
│    - student_plans 테이블 삽입                             │
│    - 검증 및 에러 처리                                      │
└────────────────────────────────────────────────────────────┘
```

### 3.2 핵심 데이터 변환

```typescript
// 1단계: 콘텐츠 ID 매핑
plan_contents.content_id (master)
    → contentIdMap.get(masterId)
    → student content_id

// 2단계: 상세 ID 매핑 (에피소드/페이지)
plan_contents.start_detail_id (master episode/page)
    → detailIdMap.get(masterDetailId)
    → student detail_id

// 3단계: 챕터 정보 매핑
contentId → chapterMap.get(contentId) → {
  start_chapter: string,
  end_chapter: string,
  episode_title?: string
}

// 4단계: 시간 계산
content → durationMap.get(contentId) → {
  total_duration: number,
  episodes?: Episode[]
}
```

## 4. 핵심 인터페이스

### 4.1 입력 타입

```typescript
// 플랜 그룹 생성 요청
interface GeneratePlansRequest {
  groupId: string;
  studentId?: string;  // admin 모드에서 사용
  options?: {
    regenerate?: boolean;
    use1730Timetable?: boolean;
  };
}

// 플랜 콘텐츠 (DB에서 로드)
interface PlanContent {
  id: string;
  plan_group_id: string;
  content_id: string;          // master or student ID
  content_type: 'book' | 'lecture' | 'custom';
  start_detail_id?: string;    // episode or page ID
  end_detail_id?: string;
  start_range?: number;        // fallback: 페이지/에피소드 번호
  end_range?: number;
  display_order: number;
}
```

### 4.2 중간 타입 (매핑)

```typescript
// 콘텐츠 ID 매핑
type ContentIdMap = Map<string, string>;  // master → student

// 상세 ID 매핑 (에피소드/페이지)
type DetailIdMap = Map<string, string>;   // master detail → student detail

// 챕터 정보 매핑
type ChapterMap = Map<string, {
  start_chapter: string;
  end_chapter: string;
  episode_title?: string;
}>;

// 소요 시간 매핑
type DurationMap = Map<string, {
  total_duration: number;       // 분
  total_pages?: number;
  episodes?: EpisodeInfo[];
}>;
```

### 4.3 출력 타입

```typescript
// 스케줄된 플랜 (scheduler 출력)
interface ScheduledPlan {
  date: string;
  content_id: string;
  content_type: string;
  start_range: number;
  end_range: number;
  estimated_duration: number;
  is_review: boolean;
}

// 시간 할당된 플랜 (최종 DB 저장용)
interface PlanTimeSegment {
  plan_group_id: string;
  student_id: string;
  date: string;
  content_id: string;
  content_type: string;
  start_range: number;
  end_range: number;
  start_time: string;
  end_time: string;
  estimated_duration: number;
  is_partial: boolean;
  is_continued: boolean;
  chapter_info?: string;
}
```

## 4.4 generatePlansFromGroup API (Phase 4 완료)

### 함수 시그니처

```typescript
async function generatePlansFromGroup(
  group: PlanGroup,
  contents: PlanContent[],
  exclusions: PlanExclusion[],
  academySchedules: AcademySchedule[],
  blocks: BlockInfo[],
  contentSubjects?: Map<string, { subject?: string | null; subject_category?: string | null }>,
  riskIndexMap?: Map<string, { riskScore: number }>,
  dateAvailableTimeRanges?: DateAvailableTimeRanges,
  dateTimeSlots?: DateTimeSlots,
  contentDurationMap?: ContentDurationMap,
  contentChapterMap?: Map<string, string | null>,
  periodStart?: string,
  periodEnd?: string,
  existingPlans?: ExistingPlanInfo[],  // Phase 4: 기존 플랜 정보
  options?: GeneratePlansOptions        // Phase 4: 생성 옵션
): Promise<GeneratePlansResult>
```

### 옵션 타입

```typescript
// 플랜 생성 옵션
interface GeneratePlansOptions {
  /** 기존 플랜과 충돌 시 자동으로 시간 조정 */
  autoAdjustOverlaps?: boolean;
  /** 자동 조정 시 최대 종료 시간 (기본값: "23:59") */
  maxEndTime?: string;
}
```

### 반환 타입

```typescript
// 플랜 생성 결과
interface GeneratePlansResult {
  /** 생성된 플랜 목록 */
  plans: ScheduledPlan[];
  /** 기존 플랜과의 시간 겹침 검증 결과 */
  overlapValidation?: OverlapValidationResult;
  /** 자동 조정이 적용되었는지 여부 */
  wasAutoAdjusted?: boolean;
  /** 자동 조정된 플랜 개수 */
  autoAdjustedCount?: number;
  /** 조정 불가능한 플랜 목록 (시간대 부족 등) */
  unadjustablePlans?: Array<{
    plan: ScheduledPlan;
    reason: string;
  }>;
}

// 시간 겹침 검증 결과
interface OverlapValidationResult {
  hasOverlaps: boolean;
  overlaps: TimeOverlap[];
  totalOverlapMinutes: number;
}

// 개별 시간 겹침 정보
interface TimeOverlap {
  date: string;
  newPlan: { content_id: string; start_time: string; end_time: string };
  existingPlan: { start_time: string; end_time: string };
  overlapMinutes: number;
}
```

### 사용 예시

```typescript
import { generatePlansFromGroup } from "@/lib/plan/scheduler";

// 기본 사용 (충돌 검증만, 자동 조정 없음)
const result = await generatePlansFromGroup(
  group, contents, exclusions, academySchedules, blocks,
  contentSubjects, riskIndexMap, dateAvailableTimeRanges,
  dateTimeSlots, contentDurationMap, contentChapterMap,
  periodStart, periodEnd, existingPlans
);

if (result.overlapValidation?.hasOverlaps) {
  console.warn(`${result.overlapValidation.overlaps.length}개 시간 충돌 감지`);
}

// 자동 조정 활성화
const resultWithAutoAdjust = await generatePlansFromGroup(
  group, contents, exclusions, academySchedules, blocks,
  contentSubjects, riskIndexMap, dateAvailableTimeRanges,
  dateTimeSlots, contentDurationMap, contentChapterMap,
  periodStart, periodEnd, existingPlans,
  { autoAdjustOverlaps: true, maxEndTime: "22:00" }
);

if (resultWithAutoAdjust.wasAutoAdjusted) {
  console.log(`${resultWithAutoAdjust.autoAdjustedCount}개 플랜 시간 자동 조정됨`);
}

if (resultWithAutoAdjust.unadjustablePlans?.length) {
  console.warn("조정 불가능한 플랜:", resultWithAutoAdjust.unadjustablePlans);
}
```

### 관련 유틸리티 함수

```typescript
// lib/scheduler/utils/timeOverlapValidator.ts

// 새 플랜과 기존 플랜 간의 시간 충돌 검증
function validateNoTimeOverlaps(
  newPlans: ScheduledPlan[],
  existingPlans: ExistingPlanInfo[]
): OverlapValidationResult;

// 새 플랜들 간의 내부 충돌 검증
function validateNoInternalOverlaps(
  plans: ScheduledPlan[]
): OverlapValidationResult;

// 충돌하는 플랜 시간 자동 조정
function adjustOverlappingTimes(
  newPlans: ScheduledPlan[],
  existingPlans: ExistingPlanInfo[],
  maxEndTime?: string  // 기본값: "23:59"
): TimeAdjustmentResult;
```

---

## 5. 알려진 문제점

### 5.1 권한 및 RLS 문제

| 문제 | 위치 | 해결 상태 |
|------|------|----------|
| admin이 student 데이터 조회 시 RLS 차단 | `getStudentLectureEpisodesBatch` | ✅ 해결 (admin client 사용) |
| admin이 student 데이터 조회 시 RLS 차단 | `getStudentBookDetailsBatch` | ✅ 해결 (admin client 사용) |
| 잘못된 컬럼 필터 (`student_id`) | `loadContentChapters` | ✅ 해결 |
| chapterMap 키 불일치 | `loadContentChapters` | ✅ 해결 |

### 5.2 구조적 문제

| 문제 | 심각도 | 영향 |
|------|--------|------|
| God Function (1,547줄) | **CRITICAL** | 테스트/유지보수 어려움 |
| generate/preview 중복 (90%) | **HIGH** | 1,600줄 중복 코드 |
| 콘텐츠 해석 분산 (3곳) | **HIGH** | 다중 진실의 원천 |
| 복잡한 fallback 체인 | **MEDIUM** | 디버깅 어려움 |
| 에러 처리 불일치 | **MEDIUM** | 일관성 부족 |

## 6. 테스트 시나리오

### 6.1 핵심 기능 테스트

```typescript
// T1: 일반 모드 - 교재 플랜 생성
describe('일반 모드 교재 플랜', () => {
  it('학생 교재로 플랜 생성', async () => {
    // Given: 학생이 교재를 보유
    // When: 플랜 그룹 생성 후 플랜 생성
    // Then: student_plans에 올바른 데이터 저장
  });

  it('페이지 범위가 올바르게 설정됨', async () => {
    // Given: start_range=1, end_range=100
    // When: 10일 기간으로 플랜 생성
    // Then: 각 날짜에 ~10페이지씩 분배
  });
});

// T2: 일반 모드 - 강의 플랜 생성
describe('일반 모드 강의 플랜', () => {
  it('에피소드 제목이 표시됨', async () => {
    // Given: 강의에 에피소드 정보 존재
    // When: 플랜 생성
    // Then: chapter_info에 에피소드 제목 포함
  });

  it('에피소드가 올바르게 분할됨', async () => {
    // Given: 10개 에피소드, 각 30분
    // When: 60분 학습 시간으로 플랜 생성
    // Then: 하루에 2개 에피소드씩 배정
  });
});

// T3: 캠프 모드 - 마스터 → 학생 복사
describe('캠프 모드 콘텐츠 복사', () => {
  it('마스터 교재가 학생 교재로 복사됨', async () => {
    // Given: 마스터 교재 ID
    // When: 캠프 모드로 플랜 생성
    // Then: 학생 books 테이블에 복사본 생성
  });

  it('에피소드 정보가 학생 테이블로 복사됨', async () => {
    // Given: 마스터 강의 + 에피소드
    // When: 캠프 모드로 플랜 생성
    // Then: student_lecture_episodes에 복사본 생성
  });

  it('복사된 에피소드 제목이 표시됨', async () => {
    // Given: 마스터 에피소드에 제목 존재
    // When: 캠프 모드 플랜 생성 후 조회
    // Then: chapter_info에 에피소드 제목 포함
  });
});

// T4: 권한 테스트
describe('권한 및 RLS', () => {
  it('admin이 학생 플랜을 생성할 수 있음', async () => {
    // Given: admin 로그인
    // When: 특정 학생의 플랜 생성
    // Then: 성공
  });

  it('admin이 학생 에피소드 정보를 조회할 수 있음', async () => {
    // Given: 학생의 강의 에피소드 존재
    // When: admin이 플랜 조회
    // Then: 에피소드 제목 표시됨
  });
});

// T5: 1730 타임테이블
describe('1730 타임테이블', () => {
  it('학습일/복습일이 올바르게 교차됨', async () => {
    // Given: 1730 모드 활성화
    // When: 플랜 생성
    // Then: 학습 → 복습 → 학습 패턴
  });
});
```

### 6.2 경계 조건 테스트

```typescript
describe('경계 조건', () => {
  it('빈 콘텐츠로 플랜 생성 시도', async () => {});
  it('1페이지 교재로 플랜 생성', async () => {});
  it('1개 에피소드 강의로 플랜 생성', async () => {});
  it('시작일 = 종료일인 경우', async () => {});
  it('모든 날짜가 제외일인 경우', async () => {});
  it('학습 시간이 0분인 경우', async () => {});
});
```

## 7. 리팩토링 로드맵

### Phase 1: 기반 작업 ✅ 완료

```
목표: 테스트 기반 구축 및 문서화

[✅] 현재 동작 문서화
[✅] 핵심 테스트 케이스 작성 (33개 테스트)
[✅] 타입 정의 정리 및 중앙화 (lib/types/plan-generation.ts)
[✅] 공유 유틸리티 추출
```

### Phase 2: 서비스 분리 ✅ 완료

```
목표: God Function 분해 → 서비스 레이어 구현

┌─────────────────────────────────────────────────────────────┐
│              PlanGenerationOrchestrator (~100줄)            │
└─────────────────────────────────────────────────────────────┘
        │
        ├── ContentResolutionService ✅
        │   ├── resolveContentIds()
        │   ├── loadMetadata()
        │   └── loadDurations()
        │
        ├── ScheduleGenerationService ✅
        │   ├── generateSchedule()
        │   └── adaptScheduleGeneration() - 어댑터 패턴
        │
        ├── TimeAllocationService ✅
        │   ├── allocateTimeSlots()
        │   └── adaptTimeAllocation() - 어댑터 패턴
        │
        └── PlanPersistenceService ✅
            ├── savePlans()
            └── deletePlans()
```

### Phase 3: 중복 제거 ✅ 완료

```
목표: generate/preview 통합

[✅] previewPlansWithServices 구현 (previewPlansRefactored 대체)
[✅] generatePlansWithServices 구현 (generatePlansRefactored 대체)
[✅] Feature Flag 기반 점진적 전환 (ENABLE_NEW_PLAN_SERVICES)
```

### Phase 4: 안정화 ✅ 완료

```
목표: 에러 처리 통일, 모니터링, 기존 플랜 충돌 검증

[✅] ServiceError 클래스 구현 (errors.ts)
    - ServiceErrorCodes: 표준화된 에러 코드
    - toServiceError(): 에러 변환 유틸리티
    - getErrorChain(): 에러 체인 추적
    - isRecoverableServiceError(): 복구 가능 에러 판단

[✅] 통합 로깅 시스템 (logging.ts)
    - ServiceLogger: 구조화된 로깅
    - PerformanceTracker: 성능 측정
    - globalPerformanceTracker: 전역 성능 추적

[✅] 기존 플랜 충돌 검증 (timeOverlapValidator.ts) - 2026-01-18 추가
    - validateNoTimeOverlaps(): 새 플랜과 기존 플랜 간 시간 충돌 검증
    - validateNoInternalOverlaps(): 새 플랜들 간의 내부 충돌 검증
    - adjustOverlappingTimes(): 충돌하는 플랜 시간 자동 조정

[✅] generatePlansFromGroup 반환 타입 개선
    - GeneratePlansResult: 플랜 + 충돌 검증 결과 반환
    - GeneratePlansOptions: 자동 조정 옵션 지원
    - 기존 플랜 시간 충돌 시 자동 조정 기능
```

### Phase 5: 코드 최적화 ✅ 완료 (2025-12-22)

```
목표: generate/preview 간 공통 로직 추출

[✅] preparePlanGenerationData 함수 추출 (385줄)
    - 플랜 그룹 조회
    - 블록 세트 조회
    - 스케줄러 설정 병합
    - 스케줄 계산
    - 콘텐츠 해석
    - 스케줄 생성
    - 날짜별 시간 할당

[✅] 코드 중복 제거 결과:
    - generatePlansWithServices: 411줄 → 188줄 (-54%)
    - previewPlansWithServices: 429줄 → 213줄 (-50%)
    - 공통 로직: preparePlanGenerationData (385줄)
```

## 8. 마이그레이션 전략

### 8.1 점진적 마이그레이션

```
현재 코드                새 서비스
     │                      │
     │   ┌─────────────┐    │
     │   │  Feature    │    │
     │──▶│   Flag      │───▶│
     │   └─────────────┘    │
     │                      │
```

1. 새 서비스 구현
2. Feature Flag로 분기
3. A/B 테스트
4. 점진적 전환
5. 기존 코드 제거

### 8.2 롤백 계획

```typescript
// config/features.ts
export const PLAN_GENERATION_FLAGS = {
  USE_NEW_CONTENT_RESOLVER: false,
  USE_NEW_SCHEDULER: false,
  USE_NEW_TIME_ALLOCATOR: false,
  USE_NEW_PERSISTENCE: false,
};

// 롤백: 모든 플래그를 false로
```

## 9. 성공 지표

| 지표 | 이전 | 현재 | 목표 | 상태 |
|------|------|------|------|------|
| God Function 크기 | 1,547줄 | ~188줄 (서비스) | <200줄 | ✅ 달성 |
| 코드 중복 | ~1,600줄 | ~50줄 | <100줄 | ✅ 달성 |
| 테스트 커버리지 | 0% | 33개 테스트 | >80% | 🔄 진행중 |
| 콘텐츠 해석 위치 | 3곳 | 1곳 (ContentResolutionService) | 1곳 | ✅ 달성 |
| 평균 함수 크기 | 200+줄 | ~100줄 | <50줄 | 🔄 개선중 |
| 에러 처리 일관성 | 없음 | ServiceError 통합 | 통합 | ✅ 달성 |
| 성능 모니터링 | 없음 | PerformanceTracker | 적용 | ✅ 달성 |

---

## 부록: 관련 파일 위치

### A.1 기존 코드 (레거시)

```
app/(student)/actions/plan-groups/
├── create.ts                    # 플랜 그룹 생성
├── generatePlansRefactored.ts   # 플랜 생성 (레거시)
├── previewPlansRefactored.ts    # 플랜 미리보기 (레거시)
└── plans.ts                     # 플랜 조회 (Feature Flag로 새 서비스 호출)

lib/plan/
├── contentResolver.ts           # 콘텐츠 ID 해석 (레거시)
├── scheduler.ts                 # 스케줄 생성 (어댑터로 래핑)
├── assignPlanTimes.ts           # 시간 할당 (어댑터로 래핑)
├── planSplitter.ts              # 에피소드 분할
├── planDataLoader.ts            # 데이터 로더
├── contentDuration.ts           # 소요 시간 계산
├── 1730TimetableLogic.ts        # 1730 로직
└── blocks.ts                    # 블록 관리

lib/data/
└── contentMasters.ts            # 마스터 콘텐츠 조회/복사
```

### A.2 새 서비스 레이어 (Phase 2-5)

```
lib/plan/services/
├── index.ts                          # 모든 서비스 export
│
├── types.ts                          # 서비스 인터페이스 및 타입 정의
│   ├── ServiceContext
│   ├── ServiceResult<T>
│   ├── IContentResolutionService
│   ├── IScheduleGenerationService
│   ├── ITimeAllocationService
│   ├── IPlanPersistenceService
│   └── IPlanGenerationOrchestrator
│
├── errors.ts                         # Phase 4: 통합 에러 시스템
│   ├── ServiceError (class)
│   ├── ServiceErrorCodes (enum)
│   ├── toServiceError()
│   ├── createServiceErrorFromResult()
│   ├── getErrorChain()
│   └── isRecoverableServiceError()
│
├── logging.ts                        # Phase 4: 통합 로깅 시스템
│   ├── ServiceLogger (class)
│   ├── PerformanceTracker (class)
│   ├── globalPerformanceTracker
│   ├── createServiceLogger()
│   └── withPerformanceTracking()
│
├── ContentResolutionService.ts       # 콘텐츠 해석 서비스
├── ScheduleGenerationService.ts      # 스케줄 생성 서비스
├── TimeAllocationService.ts          # 시간 할당 서비스
├── PlanPersistenceService.ts         # 플랜 저장 서비스
├── PlanGenerationOrchestrator.ts     # 오케스트레이터
│
├── ServiceAdapter.ts                 # 레거시 함수 어댑터
│   ├── adaptContentResolution()
│   ├── adaptScheduleGeneration()
│   ├── adaptTimeAllocation()
│   └── getAdapterConfig()
│
├── preparePlanGenerationData.ts      # Phase 5: 공통 로직 추출
│   ├── preparePlanGenerationData()   # 플랜 생성 공통 데이터 준비
│   ├── timeToMinutes()               # 유틸리티 함수
│   └── 타입: PlanGenerationPreparedData, DateAllocationResult 등
│
├── generatePlansWithServices.ts      # 서비스 기반 플랜 생성
│   ├── generatePlansWithServices()
│   └── canUseServiceBasedGeneration()
│
└── previewPlansWithServices.ts       # 서비스 기반 플랜 미리보기
    └── previewPlansWithServices()

lib/types/
└── plan-generation.ts                # 플랜 생성 공통 타입 정의

lib/scheduler/
├── types.ts                          # 스케줄러 타입 정의 (Single Source of Truth)
│   ├── SchedulerType
│   ├── SchedulerInput / SchedulerOutput
│   ├── IScheduler
│   ├── GeneratePlansResult           # Phase 4: 플랜 생성 결과
│   ├── GeneratePlansOptions          # Phase 4: 생성 옵션
│   └── OverlapValidationResult       # Phase 4: 충돌 검증 결과
│
├── SchedulerEngine.ts                # 스케줄러 엔진 (1730 타임테이블)
├── calculateAvailableDates.ts        # 날짜/시간 계산
│
└── utils/
    ├── scheduleCalculator.ts         # 중앙화된 스케줄 계산 유틸리티
    │   ├── calculateAvailableDateStrings()
    │   └── Re-exports from calculateAvailableDates
    │
    └── timeOverlapValidator.ts       # Phase 4: 시간 충돌 검증
        ├── validateNoTimeOverlaps()
        ├── validateNoInternalOverlaps()
        └── adjustOverlappingTimes()
```

### A.3 테스트 파일

```
__tests__/lib/plan/
├── services.test.ts                  # 서비스 레이어 테스트 (33개)
├── scheduler.test.ts                 # 스케줄러 로직 테스트
└── generatePlansFromGroup.integration.test.ts  # Phase 4 통합 테스트 (13개)
    ├── describe("기존 플랜 충돌 검증")
    ├── describe("자동 조정 기능")
    ├── describe("maxEndTime 제한")
    ├── describe("복합 시나리오")
    └── describe("내부 플랜 간 충돌 검증")

__tests__/lib/scheduler/
├── schedulerEngine.integration.test.ts  # SchedulerEngine 통합 테스트 (9개)
└── utils/
    ├── scheduleCalculator.test.ts       # 스케줄 계산 테스트 (13개)
    └── timeOverlapValidator.test.ts     # 시간 충돌 검증 테스트 (21개)
```

# Plan Generation Architecture Analysis

> 작성일: 2025-12-22
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

## 2. 데이터 흐름 (Data Flow)

### 2.1 플랜 생성 전체 흐름

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

### 2.2 핵심 데이터 변환

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

## 3. 핵심 인터페이스

### 3.1 입력 타입

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

### 3.2 중간 타입 (매핑)

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

### 3.3 출력 타입

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

## 4. 알려진 문제점

### 4.1 권한 및 RLS 문제

| 문제 | 위치 | 해결 상태 |
|------|------|----------|
| admin이 student 데이터 조회 시 RLS 차단 | `getStudentLectureEpisodesBatch` | ✅ 해결 (admin client 사용) |
| admin이 student 데이터 조회 시 RLS 차단 | `getStudentBookDetailsBatch` | ✅ 해결 (admin client 사용) |
| 잘못된 컬럼 필터 (`student_id`) | `loadContentChapters` | ✅ 해결 |
| chapterMap 키 불일치 | `loadContentChapters` | ✅ 해결 |

### 4.2 구조적 문제

| 문제 | 심각도 | 영향 |
|------|--------|------|
| God Function (1,547줄) | **CRITICAL** | 테스트/유지보수 어려움 |
| generate/preview 중복 (90%) | **HIGH** | 1,600줄 중복 코드 |
| 콘텐츠 해석 분산 (3곳) | **HIGH** | 다중 진실의 원천 |
| 복잡한 fallback 체인 | **MEDIUM** | 디버깅 어려움 |
| 에러 처리 불일치 | **MEDIUM** | 일관성 부족 |

## 5. 테스트 시나리오

### 5.1 핵심 기능 테스트

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

### 5.2 경계 조건 테스트

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

## 6. 리팩토링 로드맵

### Phase 1: 기반 작업 (1-2주)

```
목표: 테스트 기반 구축 및 문서화

[ ] 현재 동작 문서화 (완료)
[ ] 핵심 테스트 케이스 작성
[ ] 타입 정의 정리 및 중앙화
[ ] 공유 유틸리티 추출
```

### Phase 2: 서비스 분리 (2-3주)

```
목표: God Function 분해

┌─────────────────────────────────────────────────────────────┐
│                    PlanGenerationOrchestrator               │
│                         (~150줄)                            │
└─────────────────────────────────────────────────────────────┘
        │
        ├── ContentResolutionService
        │   ├── resolveContentIds()
        │   ├── copyMissingContents()
        │   └── loadContentMetadata()
        │
        ├── ScheduleGenerationService
        │   ├── calculateAvailableDates()
        │   └── generateSchedule()
        │
        ├── TimeAllocationService
        │   ├── allocateTimeSlots()
        │   └── splitEpisodes()
        │
        └── PlanPersistenceService
            ├── validatePlans()
            └── savePlans()
```

### Phase 3: 중복 제거 (1주)

```
목표: generate/preview 통합

[ ] 공통 로직 추출
[ ] preview 플래그 기반 분기
[ ] 중복 코드 제거 (~1,600줄)
```

### Phase 4: 안정화 (1주)

```
목표: 에러 처리 통일 및 모니터링

[ ] PlanGenerationError 통일
[ ] 에러 컨텍스트 전파
[ ] 로깅 표준화
[ ] 성능 모니터링 추가
```

## 7. 마이그레이션 전략

### 7.1 점진적 마이그레이션

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

### 7.2 롤백 계획

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

## 8. 성공 지표

| 지표 | 현재 | 목표 |
|------|------|------|
| God Function 크기 | 1,547줄 | <200줄 |
| 코드 중복 | ~1,600줄 | <100줄 |
| 테스트 커버리지 | 0% | >80% |
| 콘텐츠 해석 위치 | 3곳 | 1곳 |
| 평균 함수 크기 | 200+줄 | <50줄 |

---

## 부록: 관련 파일 위치

```
app/(student)/actions/plan-groups/
├── create.ts                    # 플랜 그룹 생성
├── generatePlansRefactored.ts   # 플랜 생성 (메인)
├── previewPlansRefactored.ts    # 플랜 미리보기
└── plans.ts                     # 플랜 조회

lib/plan/
├── contentResolver.ts           # 콘텐츠 ID 해석
├── scheduler.ts                 # 스케줄 생성
├── assignPlanTimes.ts           # 시간 할당
├── planSplitter.ts              # 에피소드 분할
├── planDataLoader.ts            # 데이터 로더
├── contentDuration.ts           # 소요 시간 계산
├── 1730TimetableLogic.ts        # 1730 로직
└── blocks.ts                    # 블록 관리

lib/data/
└── contentMasters.ts            # 마스터 콘텐츠 조회/복사
```

# DB 구조 개편 제안: 캘린더 표준 패턴 기반

> 작성일: 2026-02-22
> 참조 분석: Google Calendar, Microsoft Outlook, Apple Calendar (CalDAV), Cal.com

---

## 목차

1. [현재 DB 구조 진단](#1-현재-db-구조-진단)
2. [주요 캘린더 서비스 DB 패턴 분석](#2-주요-캘린더-서비스-db-패턴-분석)
3. [제안: 하이브리드 캘린더 모델](#3-제안-하이브리드-캘린더-모델)
4. [마이그레이션 전략](#4-마이그레이션-전략)
5. [기대 효과](#5-기대-효과)
6. [Google Calendar과의 잔여 차이점](#6-google-calendar과의-잔여-차이점)

---

## 1. 현재 DB 구조 진단

### 1.1 핵심 문제점

#### A. 테이블 비대화 (Column Bloat)

| 테이블 | 컬럼 수 | 문제 |
|--------|---------|------|
| `student_plan` | ~60개 | 스케줄링, 콘텐츠, 추적, UI, 반복, 임시계획이 하나에 혼재 |
| `plan_groups` | ~55개 | 스케줄러 설정, 콘텐츠 설정, 관리자 워크플로우 혼재 |
| `ad_hoc_plans` | ~30개 | `student_plan`과 거의 동일한 구조를 별도 테이블로 유지 |

#### B. 개념 중복 & 분산

비학습시간/제외일 관련 테이블이 6개 이상:

```
├── student_non_study_time        (플래너별 비학습시간)
├── planner_exclusions            (플래너별 제외일)
├── planner_exclusion_overrides   (플랜그룹별 제외일 오버라이드)
├── planner_daily_overrides       (일별 오버라이드)
├── plan_exclusions               (플랜그룹별 제외일)
└── excluded_dates                (학생별 제외일)
```

#### C. 캘린더 추상화 부재

- "캘린더"라는 컨테이너 개념이 없음
- 외부 캘린더 연동(Google Calendar 등)의 구조적 한계
- 모든 시간 데이터가 `student_plan`, `ad_hoc_plans`, `student_non_study_time`에 분산

#### D. 반복 이벤트 비표준

- `recurrence_rule`이 jsonb로 저장 (RFC 5545 RRULE 비호환)
- 예외 처리(특정 날짜만 수정/취소) 메커니즘 없음

#### E. 시간 타입 불일치

- `time without time zone`, `date`, `timestamp with time zone`, `timestamp without time zone` 혼용

### 1.2 현재 테이블 관계도

```
planners (main entity)
├── student_id → students
├── tenant_id → tenants
├── block_set_id → tenant_block_sets
├── plan_groups (period-based collections, ~55 cols)
│   ├── student_id → students
│   ├── planner_id → planners
│   ├── student_plan (daily/weekly individual plans, ~60 cols)
│   │   ├── student_id → students
│   │   └── plan_group_id → plan_groups
│   └── plan_group_items (legacy multi-content)
├── student_non_study_time (Phase 5 통합 중)
│   ├── planner_id → planners
│   └── academy_schedule_id → planner_academy_schedules
├── planner_academy_schedules
├── planner_academy_overrides (deprecated 예정)
├── planner_exclusions (deprecated 예정)
├── planner_exclusion_overrides
├── planner_daily_overrides
├── plan_exclusions
├── excluded_dates
└── ad_hoc_plans (~30 cols, student_plan과 중복)
```

---

## 2. 주요 캘린더 서비스 DB 패턴 분석

### 2.1 Google Calendar 핵심 설계

```
Event
├── id, calendarId
├── summary, description, location
├── start: { dateTime | date, timeZone }      ← 시간/종일 분리
├── end: { dateTime | date, timeZone }
├── status: confirmed | tentative | cancelled
├── transparency: opaque | transparent         ← 시간 차단 여부
├── visibility: default | public | private | confidential
├── recurrence: ["RRULE:FREQ=WEEKLY;BYDAY=MO"]  ← RFC 5545 표준
├── recurringEventId                            ← 마스터 이벤트 참조
├── originalStartTime                           ← 예외 인스턴스용
├── sequence                                    ← 변경 추적 번호
├── attendees[]                                 ← 참석자 + 응답 상태
├── reminders: { useDefault, overrides[] }
├── extendedProperties: { private, shared }     ← key-value 확장
└── etag                                        ← optimistic concurrency
```

**반복 이벤트 처리**: 마스터 이벤트 + 가상 인스턴스 패턴

- 마스터에 RRULE 저장, 쿼리 시 인스턴스 확장
- 예외(수정된 인스턴스)만 별도 row 저장
- "이 일정 이후 전체 수정" → RRULE에 UNTIL 추가 + 새 마스터 생성

### 2.2 Microsoft Outlook 차별점

- **구조화된 반복 패턴**: RRULE 문자열 대신 `pattern` + `range` 객체
- **명시적 이벤트 타입**: `singleInstance | occurrence | exception | seriesMaster`
- **풍부한 상태**: `showAs: free | tentative | busy | oof | workingElsewhere`
- **종일 이벤트**: `isAllDay: boolean` 명시적 플래그
- **Timezone**: 항상 start/end 각각에 별도 timeZone 필드

### 2.3 Cal.com 스케줄링 패턴 (가장 참고할 만함)

```
Schedule (가용 시간 정의)
└── Availability[]
      ├── days: [1,2,3,4,5]     ← 요일 배열
      ├── startTime: 09:00       ← Time 타입
      ├── endTime: 17:00
      └── date: 2026-03-15?      ← 특정일 오버라이드 (null이면 주간 반복)
```

**핵심 인사이트**: 주간 반복 가용시간과 특정일 오버라이드를 **하나의 테이블**로 통합

### 2.4 RFC 5545 RRULE 문법

```
RRULE:FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,WE,FR;UNTIL=20260701T170000Z
```

| 컴포넌트 | 값 | 설명 |
|---------|-----|------|
| `FREQ` | DAILY, WEEKLY, MONTHLY, YEARLY | 반복 빈도 (필수) |
| `INTERVAL` | 정수 | 반복 간격 (기본: 1) |
| `BYDAY` | SU,MO,TU,WE,TH,FR,SA | 요일 |
| `BYMONTHDAY` | 1-31 | 월 중 일 |
| `UNTIL` | DATE 또는 DATE-TIME | 종료 경계 |
| `COUNT` | 정수 | 발생 횟수 |
| `EXDATE` | DATE 배열 | 제외 날짜 |

### 2.5 크로스 플랫폼 비교

| 기능 | Google Calendar | Outlook | Apple (CalDAV) | Cal.com |
|------|----------------|---------|----------------|---------|
| **반복 저장** | RRULE 문자열 배열 | 구조화된 JSON | RRULE (.ics) | JSON `{freq, count, interval}` |
| **인스턴스 확장** | 가상 (API 계산) | 가상 (API 계산) | 클라이언트 확장 | Row로 실체화 |
| **예외 처리** | `recurringEventId` | `seriesMasterId` | `RECURRENCE-ID` | N/A |
| **종일 이벤트** | `start.date` vs `start.dateTime` | `isAllDay: boolean` | `VALUE=DATE` | N/A |
| **Timezone** | 선택적 TZ 필드 | 항상 별도 TZ | `VTIMEZONE` + `TZID` | User/Schedule/Attendee별 |
| **가용성** | `transparency` | `showAs` (5종) | `TRANSP` | Schedule + Availability |
| **알림** | `{useDefault, overrides}` | `isReminderOn` + minutes | `VALARM` | Workflow 기반 |
| **공유** | Calendar ACL | `calendarPermission` | CalDAV ACL | Team + SchedulingType |

---

## 3. 제안: 하이브리드 캘린더 모델

학습 관리 도메인의 특수성(콘텐츠 진도, 완료 추적, 페이지 범위 등)을 유지하면서, 캘린더 표준 패턴을 적용합니다.

### 3.1 새로운 테이블 구조

#### Layer 1: Calendar (새 테이블)

```sql
-- 캘린더 컨테이너 (Google Calendar의 Calendar에 해당)
CREATE TABLE calendars (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id),
  student_id  UUID NOT NULL REFERENCES students(id),
  planner_id  UUID REFERENCES planners(id),   -- 플래너와 1:1 연결
  name        TEXT NOT NULL,                   -- "3월 학습 캘린더"
  color       TEXT,
  timezone    TEXT NOT NULL DEFAULT 'Asia/Seoul',  -- IANA timezone
  is_default  BOOLEAN DEFAULT false,
  is_visible  BOOLEAN DEFAULT true,
  source_type TEXT DEFAULT 'local',            -- 'local' | 'google' | 'outlook'
  external_id TEXT,                            -- 외부 캘린더 ID
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);
```

#### Layer 2: Unified Event (student_plan + ad_hoc_plans + student_non_study_time 통합)

```sql
-- 통합 이벤트 테이블 (Google Calendar의 Event에 해당)
CREATE TABLE calendar_events (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  calendar_id       UUID NOT NULL REFERENCES calendars(id) ON DELETE CASCADE,
  tenant_id         UUID NOT NULL REFERENCES tenants(id),

  -- === 기본 이벤트 정보 (Google Calendar 표준) ===
  title             TEXT NOT NULL,
  description       TEXT,
  event_type        TEXT NOT NULL,
  -- 'study'        : 학습 계획 (기존 student_plan)
  -- 'adhoc'        : 임시 계획 (기존 ad_hoc_plans)
  -- 'non_study'    : 비학습시간 (기존 student_non_study_time)
  -- 'academy'      : 학원 시간
  -- 'break'        : 점심/휴식
  -- 'exclusion'    : 제외일 (종일)
  -- 'custom'       : 사용자 정의

  -- === 시간 (Google/Outlook 하이브리드) ===
  start_at          TIMESTAMPTZ,     -- 시간 이벤트용 (NULL이면 종일)
  end_at            TIMESTAMPTZ,     -- 시간 이벤트용
  start_date        DATE,            -- 종일 이벤트용 (NULL이면 시간)
  end_date          DATE,            -- 종일 이벤트용
  timezone          TEXT DEFAULT 'Asia/Seoul',
  is_all_day        BOOLEAN DEFAULT false,

  -- === 상태 (Google+Outlook 통합) ===
  status            TEXT DEFAULT 'confirmed',
  -- 'confirmed' | 'tentative' | 'cancelled' | 'completed'
  transparency      TEXT DEFAULT 'opaque',
  -- 'opaque' (시간 차단) | 'transparent' (시간 비차단)

  -- === 반복 이벤트 (RFC 5545 / Google Calendar 패턴) ===
  rrule             TEXT,            -- "FREQ=WEEKLY;BYDAY=MO,WE,FR;UNTIL=20260401"
  exdates           DATE[],          -- 제외 날짜 배열
  recurring_event_id UUID REFERENCES calendar_events(id),
  original_start_at TIMESTAMPTZ,     -- 예외 인스턴스의 원래 시작 시간
  is_exception      BOOLEAN DEFAULT false,

  -- === 도메인 연결 (학습 관리 전용) ===
  plan_group_id     UUID REFERENCES plan_groups(id),
  container_type    TEXT DEFAULT 'daily', -- 'daily' | 'weekly' | 'unfinished'
  order_index       INTEGER DEFAULT 0,

  -- === UI/표시 ===
  color             TEXT,
  icon              TEXT,
  priority          INTEGER DEFAULT 0,
  tags              TEXT[] DEFAULT '{}',

  -- === 메타데이터 ===
  sequence          INTEGER DEFAULT 0,  -- iCal sequence (변경 추적)
  ical_uid          TEXT,               -- 외부 연동용 UID
  created_by        UUID,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW(),
  deleted_at        TIMESTAMPTZ
);

-- 핵심 인덱스
CREATE INDEX idx_events_calendar_time ON calendar_events(calendar_id, start_at, end_at);
CREATE INDEX idx_events_date ON calendar_events(start_date, end_date) WHERE is_all_day;
CREATE INDEX idx_events_recurring ON calendar_events(recurring_event_id);
CREATE INDEX idx_events_plan_group ON calendar_events(plan_group_id);
CREATE INDEX idx_events_type ON calendar_events(event_type);
CREATE INDEX idx_events_status ON calendar_events(status) WHERE status != 'cancelled';
```

#### Layer 3: Study Content (student_plan의 콘텐츠 컬럼 분리)

```sql
-- 학습 콘텐츠 연결 (study 타입 이벤트 전용)
CREATE TABLE event_study_content (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id              UUID NOT NULL REFERENCES calendar_events(id) ON DELETE CASCADE,
  content_type          TEXT NOT NULL,     -- 'book' | 'lecture' | 'custom'
  content_id            UUID,
  master_content_id     UUID,
  flexible_content_id   UUID REFERENCES flexible_contents(id),
  content_title         TEXT,
  subject_name          TEXT,
  subject_category      TEXT,

  -- 진도 범위
  planned_start_page    INTEGER,
  planned_end_page      INTEGER,
  chapter               TEXT,

  -- 원본 추적
  origin_plan_item_id   UUID REFERENCES plan_group_items(id),

  UNIQUE(event_id)  -- 이벤트당 1개
);
```

#### Layer 4: Study Tracking (student_plan의 추적 컬럼 분리)

```sql
-- 학습 실행 추적 (study/adhoc 타입 이벤트 전용)
CREATE TABLE event_study_tracking (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id                UUID NOT NULL REFERENCES calendar_events(id) ON DELETE CASCADE,

  -- 진행 상태
  completion_status       TEXT DEFAULT 'pending',
  -- 'pending' | 'in_progress' | 'completed' | 'skipped'
  started_at              TIMESTAMPTZ,
  completed_at            TIMESTAMPTZ,

  -- 시간 추적
  estimated_minutes       INTEGER DEFAULT 30,
  actual_minutes          INTEGER,
  paused_at               TIMESTAMPTZ,
  paused_duration_seconds INTEGER DEFAULT 0,
  pause_count             INTEGER DEFAULT 0,

  -- 진도 추적
  completed_amount        INTEGER,
  progress                NUMERIC,

  -- 간편 완료
  simple_completion       BOOLEAN DEFAULT false,
  simple_completed_at     TIMESTAMPTZ,

  -- 메모
  memo                    TEXT,

  UNIQUE(event_id)  -- 이벤트당 1개
);
```

#### Layer 5: Availability (Cal.com 패턴 - 6개 테이블 → 2개로 통합)

```sql
-- 가용 시간 스케줄 (기존 block_sets + non_study_time 템플릿 통합)
CREATE TABLE availability_schedules (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id),
  planner_id  UUID NOT NULL REFERENCES planners(id),
  name        TEXT NOT NULL,
  timezone    TEXT DEFAULT 'Asia/Seoul',
  is_default  BOOLEAN DEFAULT false,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 가용 시간 윈도우 (Cal.com Availability 모델)
CREATE TABLE availability_windows (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id   UUID NOT NULL REFERENCES availability_schedules(id) ON DELETE CASCADE,

  -- 주간 반복 (days가 있으면 매주 반복)
  days          INTEGER[],          -- [1,2,3,4,5] (월~금)
  start_time    TIME NOT NULL,
  end_time      TIME NOT NULL,

  -- 특정일 오버라이드 (date가 있으면 해당 날짜만 적용)
  override_date DATE,              -- NULL이면 주간 반복, 있으면 특정일

  -- 윈도우 유형
  window_type   TEXT NOT NULL,     -- 'study' | 'self_study' | 'break' | 'academy' | 'blocked'
  label         TEXT,              -- "점심시간", "영어학원"

  -- 출처 추적
  academy_schedule_id UUID,
  source        TEXT DEFAULT 'manual',  -- 'manual' | 'academy' | 'template'
  is_disabled   BOOLEAN DEFAULT false,

  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스
CREATE INDEX idx_avail_schedule ON availability_windows(schedule_id);
CREATE INDEX idx_avail_date ON availability_windows(override_date) WHERE override_date IS NOT NULL;
CREATE INDEX idx_avail_days ON availability_windows USING GIN(days) WHERE days IS NOT NULL;
```

### 3.2 신규 테이블 관계도

```
calendars (container, Google Calendar의 Calendar)
├── student_id → students
├── planner_id → planners (1:1)
├── tenant_id → tenants
│
└── calendar_events (통합 이벤트, Google Calendar의 Event)
    ├── calendar_id → calendars
    ├── plan_group_id → plan_groups (optional)
    ├── recurring_event_id → calendar_events (self, 반복 마스터)
    │
    ├── event_study_content (1:1, study 이벤트 전용)
    │   └── content_id, planned_start_page, planned_end_page ...
    │
    └── event_study_tracking (1:1, study/adhoc 이벤트 전용)
        └── completion_status, started_at, actual_minutes ...

availability_schedules (Cal.com의 Schedule)
├── planner_id → planners
└── availability_windows (Cal.com의 Availability)
    ├── days[] + start_time/end_time (주간 반복)
    └── override_date + start_time/end_time (특정일 오버라이드)
```

### 3.3 테이블 매핑 (기존 → 신규)

| 기존 테이블 | 신규 위치 | 비고 |
|-------------|-----------|------|
| `student_plan` (60 cols) | `calendar_events` + `event_study_content` + `event_study_tracking` | 3개로 분리 |
| `ad_hoc_plans` (30 cols) | `calendar_events` (event_type='adhoc') + `event_study_tracking` | 통합 |
| `student_non_study_time` | `calendar_events` (event_type='non_study') 또는 `availability_windows` | 템플릿은 availability, 인스턴스는 event |
| `planner_exclusions` | `calendar_events` (event_type='exclusion', is_all_day=true) | 통합 |
| `planner_exclusion_overrides` | `calendar_events` (is_exception=true) | 통합 |
| `planner_daily_overrides` | `availability_windows` (override_date 사용) | 통합 |
| `plan_exclusions` | `calendar_events` (event_type='exclusion') | 통합 |
| `excluded_dates` | `calendar_events` (event_type='exclusion') | 통합 |
| `student_block_schedule` | `availability_windows` (window_type='study') | 통합 |
| `student_block_sets` | `availability_schedules` | 통합 |
| `tenant_blocks` / `tenant_block_sets` | 유지 (테넌트 템플릿) | 변경 없음 |
| `planner_academy_schedules` | `availability_windows` (window_type='academy') | 통합 |
| `planner_academy_overrides` | `availability_windows` (override_date 사용) | 통합 |
| `google_calendar_sync_queue` | 유지 + `calendars.source_type` 연동 | 보강 |
| `plan_groups` | 유지 (슬림화) | 스케줄러 설정 분리 |
| `planners` | 유지 + `calendars` 1:1 연결 | 보강 |

### 3.4 반복 이벤트 시나리오 예시

**기존**: 학원 일정(매주 월/수/금)을 `planner_academy_schedules`에 저장 + 특정 날짜 휴강은 `planner_academy_overrides`에 저장

**신규** (Google Calendar 방식):

```sql
-- 마스터 이벤트 (학원 영어 수업)
INSERT INTO calendar_events (id, title, event_type, start_at, end_at, rrule, transparency)
VALUES (
  'evt-master-1',
  '영어학원',
  'academy',
  '2026-03-02 15:00+09',
  '2026-03-02 17:00+09',
  'FREQ=WEEKLY;BYDAY=MO,WE,FR;UNTIL=20260630',
  'opaque'
);

-- 3/16 휴강 (EXDATE로 처리)
UPDATE calendar_events
SET exdates = array_append(exdates, '2026-03-16'::date)
WHERE id = 'evt-master-1';

-- 3/23은 시간 변경 (예외 인스턴스)
INSERT INTO calendar_events (title, event_type, start_at, end_at,
  recurring_event_id, original_start_at, is_exception)
VALUES (
  '영어학원 (시간변경)',
  'academy',
  '2026-03-23 16:00+09',    -- 1시간 늦게
  '2026-03-23 18:00+09',
  'evt-master-1',
  '2026-03-23 15:00+09',    -- 원래 예정 시간
  true
);
```

### 3.5 plan_groups 슬림화 제안

현재 ~55개 컬럼에서 ~25개로 축소:

**유지할 컬럼**:
- id, tenant_id, student_id, planner_id, name, plan_purpose
- period_start, period_end, status, scheduler_type, scheduler_options
- plan_type, content_status, creation_mode, plan_mode
- content_type, content_id, master_content_id, start_range, end_range
- admin_memo, last_admin_id, created_at, updated_at, deleted_at

**제거할 컬럼** (availability_schedules/windows로 이동):
- study_hours, self_study_hours, lunch_time
- non_study_time_blocks, daily_schedule
- subject_constraints, additional_period_reallocation
- content_slots, use_slot_mode, default_scheduler_options
- 각종 lock/unlock/timezone 플래그

---

## 4. 마이그레이션 전략

### Phase 1: 신규 테이블 생성 (위험도: 낮음)

- `calendars`, `calendar_events`, `event_study_content`, `event_study_tracking` 생성
- `availability_schedules`, `availability_windows` 생성
- 기존 테이블은 그대로 유지

### Phase 2: 데이터 마이그레이션 (병렬 운영)

- `student_plan` → `calendar_events` + `event_study_content` + `event_study_tracking`로 동기화
- `ad_hoc_plans` → `calendar_events` (event_type='adhoc')로 동기화
- 읽기를 점진적으로 신규 테이블로 전환

### Phase 3: 쓰기 전환

- 새로운 생성/수정은 신규 테이블에 직접 쓰기
- 기존 테이블에는 트리거로 역동기화 (하위 호환)

### Phase 4: 기존 테이블 폐기

- 모든 읽기/쓰기가 신규 테이블로 전환된 후
- 기존 테이블을 아카이브/삭제

### Phase 5 정합성

현재 프로젝트는 이미 **Phase 5**로 `student_non_study_time` 테이블을 통한 통합을 진행 중입니다. 제안하는 `calendar_events` 테이블은 이 방향의 자연스러운 확장입니다:

| 현재 Phase 5 | 제안 (캘린더 표준) | 관계 |
|---|---|---|
| `student_non_study_time` (비학습시간만) | `calendar_events` (모든 이벤트 통합) | 확장 |
| `type` 컬럼 (아침식사, 점심 등) | `event_type` (study, non_study, academy 등) | 일반화 |
| `planner_id` 직접 참조 | `calendar_id` → `calendars` → `planner_id` | 간접화 (외부 캘린더 지원) |
| `plan_date` + `start_time`/`end_time` (TIME) | `start_at`/`end_at` (TIMESTAMPTZ) | 표준화 |
| RRULE 미지원 (`group_id`로 그룹핑) | `rrule` + `recurring_event_id` 패턴 | RFC 5545 |

---

## 5. 기대 효과

| 항목 | 현재 | 개선 후 |
|------|------|---------|
| 시간 관련 테이블 수 | ~15개 | **6개** |
| student_plan 컬럼 | ~60개 | **~15개** (events) + 확장 테이블 |
| 반복 이벤트 | jsonb 비표준 | **RFC 5545 RRULE** |
| 예외 처리 | 6개 override 테이블 | **마스터+예외 단일 패턴** |
| 외부 캘린더 연동 | 별도 sync queue만 | **Calendar 컨테이너로 통합** |
| 종일 이벤트 | 별도 테이블 (excluded_dates 등) | **is_all_day + start_date 통합** |
| 쿼리 복잡도 | 5~6개 테이블 JOIN | **calendar_events 단일 쿼리** |

---

## 6. Google Calendar과의 잔여 차이점

개선 후에도 Google Calendar DB 구조와 차이가 남는 부분입니다.

### 6.1 의도적 차이 (도메인 특성상 불가피)

#### A. 인스턴스 실체화 vs 가상 확장 (가장 큰 차이)

| | Google Calendar | 제안안 |
|---|---|---|
| **방식** | 마스터 RRULE만 저장, 인스턴스는 쿼리 시 **가상 확장** | 인스턴스를 **실제 row로 저장** (materialize) |
| **예외만 저장** | O (수정된 인스턴스만 별도 row) | X (모든 인스턴스가 row) |
| **이유** | 캘린더 이벤트는 조회만 하면 됨 | 학습 계획은 개별 완료 추적, 진도, 메모 등이 필요 |

```
Google: 마스터 1개 → API가 100개 인스턴스를 가상으로 반환
제안안: 마스터 1개 + 실제 인스턴스 100개 row (각각 completion tracking 가능)
```

학습 계획의 각 인스턴스는 "3/5 수학 p.52~60 완료 80%" 같은 개별 상태가 있어서, 가상 확장으로는 추적 불가.

#### B. 콘텐츠/학습 추적 레이어

| | Google Calendar | 제안안 |
|---|---|---|
| **콘텐츠 연결** | 없음 (이벤트는 시간 정보만) | `event_study_content` (교재, 페이지 범위 등) |
| **완료 추적** | 없음 | `event_study_tracking` (시작/완료/일시정지/진도) |
| **plan_group 연결** | 없음 | `plan_group_id` (배치 생성/관리) |
| **container_type** | 없음 | `daily` / `weekly` / `unfinished` (UI 배치) |
| **order_index** | 시간순 정렬만 | 명시적 순서 (같은 시간대 내 정렬) |

Google Calendar은 순수 시간 관리 도구이므로 "이 이벤트에서 무엇을 해야 하는가"라는 개념 자체가 없음.

#### C. Attendee 모델

| | Google Calendar | 제안안 |
|---|---|---|
| **참석자** | 풍부한 모델: email, responseStatus, optional, resource, additionalGuests | **없음** |
| **RSVP** | accepted/declined/tentative/needsAction | 해당 없음 |
| **organizer vs creator** | 분리 (위임 가능) | `created_by` 하나만 |

학습 계획은 1:1(학생-관리자) 관계이지 회의 초대가 아님.

#### D. Event Types

| | Google Calendar | 제안안 |
|---|---|---|
| **타입** | default, birthday, focusTime, outOfOffice, workingLocation, fromGmail | study, adhoc, non_study, academy, break, exclusion, custom |

각 도메인에 맞는 이벤트 타입 정의.

#### E. Availability 레이어

| | Google Calendar | 제안안 |
|---|---|---|
| **가용성** | 이벤트의 `transparency`로만 파악 (opaque/transparent) | 별도 `availability_schedules` + `availability_windows` |
| **모델** | free/busy는 이벤트에서 파생 | Cal.com 패턴의 명시적 가용 시간 정의 |

학습 관리 시스템은 "학습 가능 시간"을 명시적으로 정의해야 하므로 별도 레이어 필요.

### 6.2 보완 가능한 차이

필요시 추가할 수 있는 Google Calendar 기능들입니다.

#### A. Reminder (알림)

```sql
-- 필요시 추가 (Google Calendar의 reminders.overrides 패턴)
CREATE TABLE event_reminders (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id         UUID NOT NULL REFERENCES calendar_events(id) ON DELETE CASCADE,
  method           TEXT NOT NULL,        -- 'push' | 'email' | 'sms'
  minutes_before   INTEGER NOT NULL,     -- 이벤트 시작 N분 전
  is_sent          BOOLEAN DEFAULT false,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);
```

| 추가 난이도 | 우선순위 |
|------------|---------|
| 낮음 | Google Calendar 연동 시 |

#### B. Visibility (공개 범위)

```sql
-- calendar_events에 컬럼 추가
ALTER TABLE calendar_events ADD COLUMN visibility TEXT DEFAULT 'default';
-- 'default' | 'public' | 'private' | 'confidential'
```

| 추가 난이도 | 우선순위 |
|------------|---------|
| 낮음 | 학부모 캘린더 공유 시 |

#### C. Calendar ACL (공유 권한)

```sql
-- 캘린더 공유 (Google Calendar ACL 패턴)
CREATE TABLE calendar_shares (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  calendar_id            UUID NOT NULL REFERENCES calendars(id) ON DELETE CASCADE,
  shared_with_user_id    UUID,            -- NULL이면 공개
  role                   TEXT NOT NULL,    -- 'freeBusyReader' | 'reader' | 'writer' | 'owner'
  can_see_private_events BOOLEAN DEFAULT false,
  created_at             TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(calendar_id, shared_with_user_id)
);
```

| 추가 난이도 | 우선순위 |
|------------|---------|
| 중간 | 멀티 관리자 협업 시 |

#### D. Optimistic Concurrency (동시성 제어)

| | Google Calendar | 제안안 | 보완 방법 |
|---|---|---|---|
| **방식** | `etag` 기반 (If-Match 헤더) | `sequence` 번호만 | `updated_at` 기반 optimistic locking |

#### E. Extended Properties (확장 속성)

| | Google Calendar | 제안안 | 보완 방법 |
|---|---|---|---|
| **방식** | `extendedProperties: { private: {}, shared: {} }` | 타입화된 컬럼 | `metadata JSONB` 컬럼 추가 |

#### F. Timezone 세분화

| | Google Calendar | 제안안 | 보완 방법 |
|---|---|---|---|
| **이벤트별 TZ** | start.timeZone + end.timeZone (각각) | `timezone` 하나 | 유학생 지원 시 start_timezone/end_timezone 분리 |

#### G. 기타 Google Calendar 전용 기능

| 기능 | Google Calendar | 제안안 | 보완 필요성 |
|---|---|---|---|
| Conference Data | Hangouts/Meet 연동 | 해당 없음 | 불필요 |
| Attachments | 파일 첨부 | `event_study_content`로 대체 | 불필요 |
| Location + GEO | 자유 텍스트 + 좌표 | 없음 (학원명만 label) | 낮음 |
| htmlLink | Calendar UI 링크 | 해당 없음 | 불필요 |
| Color Palette | `colorId` → 팔레트 참조 | `color` TEXT 직접 | 낮음 |
| Source | `{ url, title }` 생성 출처 | `created_by` + event_type | 낮음 |

### 6.3 차이점 요약 매트릭스

| 차이 항목 | 유형 | Google Calendar | 제안안 | 비고 |
|-----------|------|----------------|--------|------|
| 인스턴스 확장 | 의도적 | 가상 확장 | Row 실체화 | 학습 추적 필수 |
| 콘텐츠 연결 | 의도적 | 없음 | 별도 테이블 | 도메인 확장 |
| 완료 추적 | 의도적 | 없음 | 별도 테이블 | 도메인 확장 |
| Attendee | 의도적 | 풍부한 모델 | 없음 | 1:1 학습 관계 |
| Availability | 의도적 | 이벤트 파생 | 명시적 정의 | Cal.com 패턴 |
| Event Types | 의도적 | 범용 | 학습 도메인 | 커스텀 |
| Reminder | 보완 가능 | 이벤트별 | 미구현 | 낮은 난이도 |
| Visibility | 보완 가능 | 4단계 | 미구현 | 낮은 난이도 |
| Calendar ACL | 보완 가능 | 세분화 ACL | RLS 기반 | 중간 난이도 |
| etag | 보완 가능 | etag 기반 | sequence만 | 낮은 난이도 |
| Extended Props | 보완 가능 | key-value | 타입 컬럼 | 낮은 난이도 |
| TZ 세분화 | 보완 가능 | start/end 분리 | 단일 TZ | 낮은 난이도 |
| Conference | 불필요 | Meet 연동 | - | - |
| Attachments | 불필요 | 파일 첨부 | 콘텐츠 연결 | - |
| Location/GEO | 불필요 | 좌표 포함 | - | - |

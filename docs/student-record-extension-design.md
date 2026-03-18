# 생기부 모형 확장 설계 — 컨설팅 피드백 반영

> 작성일: 2026-03-17
> 상태: 설계 확장 (v6 — 컨설팅 현장 피드백 14건 + 안정성/현장 보완 9건)
> 기반: `student-record-implementation-plan.md` v5

## 변경 요약

| # | 피드백 | 대응 | 신규 테이블 | Phase 변경 |
|---|--------|------|-------------|-----------|
| 1 | 스토리라인 개념 부재 | 스토리라인 트래커 신설 | 2개 | Phase 3에 추가 |
| 2 | 설계(Roadmap)가 후행적 | 선제적 로드맵(계획 vs 실행) | 1개 | Phase 3에 추가 |
| 3 | 고교 프로파일 부재 | school_profiles 테이블 신설 | 1개 | Phase 2에 추가 |
| 4 | 수능최저가 "메모" 수준 | 최저 시뮬레이션 엔진 | 2개 | Phase 4로 앞당김 |
| 5 | 전형 구분 조잡 | applications round/type 세분화 | 0 (스키마 변경) | Phase 1 반영 |
| 6 | 학부모 연동 없음 | 학부모 생기부 뷰 | 0 (UI만) | Phase 4에 추가 |
| 7 | 세특 AI 윤리적 포지셔닝 + 탐구DB 통합 | 탐구 가이드 시스템 (3모드 AI) | 3개 | Phase 2.5+3+9 |
| 8 | 독서→세특 연계 없음 | reading_links junction | 1개 | Phase 3에 추가 |
| 9 | 면접 대비 Phase 10 → 앞당김 | Phase 6.5로 이동 | 1개 | Phase 6.5 |
| 10 | 9등급↔5등급 혼재 처리 | 기존 computation.ts 확장 + UI | 0 | Phase 3 |
| 11 | content_bytes NEIS 불일치 가능 | EUC-KR 바이트 카운팅 보정 | 0 | Phase 2 |
| 12 | 입시 데이터 갱신 사이클 | 4단계 갱신 워크플로우 | 0 (프로세스) | Phase 8.4 |
| 13 | 졸업생 매칭 오버엔지니어링 | SQL 조건 검색으로 간소화 | 0 (삭제) | Phase 8.6 |
| 14 | Phase 재배치 | 우선순위 재조정 | - | 전체 |

**총 영향**: 신규 테이블 +14개 (기존 17 → 31), 스키마 변경 1개, Phase 재배치
> 탐구DB 3분할 3개 + 가이드 배정/이력/피드백 3개 + 확장 8개 + school_offered_subjects 1개

### v6 보완 사항 (안정성 + 현장 시나리오)

| # | 보완 항목 | 대응 | 영향 |
|---|----------|------|------|
| 15 | Phase 1 마이그레이션 위험 | 1a/1b/1c 3단계 분할 + down 마이그레이션 사전 작성 | Phase 구조 변경 |
| 16 | CMS가 별도 프로젝트 규모 | CMS 트랙 독립 분리 (C1~C5) | Phase 구조 변경 |
| 17 | 다형 참조 FK 무결성 | 삭제 시 고아 정리 트리거 설치 | DB 트리거 추가 |
| 18 | exploration_guides 60+ 컬럼 | 3개 테이블 분할 (meta/content/review) | DB 스키마 변경 |
| 19 | AI 비용 미추정 | 월간 비용 추정표 + 모니터링 | 문서 추가 |
| 20 | 테스트 자동화 부재 | 결정론적 엔진 100% 자동 테스트 | 문서 추가 |
| 21 | StudentRecordFull 과다 JOIN | 탭별 lazy loading으로 분리 | React Query 재설계 |
| 22 | 면접일 겹침 체크 | applications에 interview_date 추가 + 겹침 경고 | DB + UI |
| 23 | 교과전형 내신 산출 | university_admissions grade_weight JSONB 구조화 | Phase 8.1 |
| 24 | 가채점/실채점 분리 | applications에 score_type 추가 | DB + Phase 8.5 |
| 25 | 재수생/N수생 관리 | students.student_status 구분 + 정시 전용 뷰 | 문서 명시 |
| 26 | 6장 최적 배분 엔진 | 입결 기반 배분 시뮬레이션 | Phase 8.5 |
| 27 | 전형 변경 알림 | 목표 대학 전형 변경 시 push 알림 | Phase 8.4 |
| 28 | school_profiles JSONB 남용 | offered_subjects → junction 테이블 분리 | DB 스키마 변경 |

> **교차 참조 (상세는 implementation-plan v5에 기술):**
> - #17 다형 참조 정리 트리거 SQL → implementation-plan 섹션 5.9
> - #19 AI 월간 비용 추정표 → implementation-plan 섹션 5.6
> - #21 탭별 lazy loading 타입/키 → implementation-plan 섹션 13
> - #20 테스트 자동화 전략 → implementation-plan 섹션 5.7
> - #15 마이그레이션 롤백 전략 → implementation-plan 섹션 5.8

---

## E1. 스토리라인 트래커 (피드백 #1)

### E1.1 문제

학종 평가의 핵심은 **3년간 활동의 일관된 성장 서사**다. 현재 설계는 학년별 독립 레코드로, "1학년 동아리 → 2학년 세특 → 3학년 자율활동"이 하나의 진로 방향으로 수렴하는지 추적할 방법이 없다.

### E1.2 설계

```
┌────────────────────────────────────────────────────────┐
│  스토리라인: "사회 불평등과 법제도 탐구"                   │
│  핵심 키워드: 사회문제, 법, 정책, 불평등                   │
│  진로 연결: 법·행정 계열                                  │
│                                                          │
│  1학년                 2학년                 3학년        │
│  ┌──────────┐         ┌──────────┐         ┌──────────┐ │
│  │동아리:시사 │ ──────→ │세특:정치와│ ──────→ │자율:학교  │ │
│  │토론반     │         │법 탐구   │         │인권선언  │ │
│  └──────────┘         └──────────┘         │프로젝트  │ │
│  ┌──────────┐         ┌──────────┐         └──────────┘ │
│  │세특:사회문│ ──────→ │진로:법학  │         ┌──────────┐ │
│  │화 보고서  │         │캠프 참여  │ ──────→ │행특:공동  │ │
│  └──────────┘         └──────────┘         │체 기여   │ │
│                                             └──────────┘ │
│  ── 성장 서사 ──                                         │
│  관심(1학년) → 탐구 심화(2학년) → 주도적 실천(3학년)       │
└────────────────────────────────────────────────────────┘
```

### E1.3 DB 스키마

#### `student_record_storylines` (스토리라인 정의)

```sql
CREATE TABLE IF NOT EXISTS student_record_storylines (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  student_id       uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  title            varchar(200) NOT NULL,       -- "사회 불평등과 법제도 탐구"
  keywords         text[] NOT NULL DEFAULT '{}', -- {"사회문제", "법", "정책"}
  career_field     varchar(50),                  -- "법·행정" (계열 연결)
  narrative        text,                         -- 성장 서사 요약 (컨설턴트 작성)
  -- 학년별 키워드 심화 추적
  grade_1_theme    varchar(200),                -- "관심·발견"
  grade_2_theme    varchar(200),                -- "탐구·심화"
  grade_3_theme    varchar(200),                -- "주도·실천"
  strength         varchar(20) DEFAULT 'moderate'
                     CHECK (strength IN ('strong', 'moderate', 'weak')),
  sort_order       integer NOT NULL DEFAULT 0,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_srsl_student ON student_record_storylines(student_id);
CREATE INDEX idx_srsl_tenant ON student_record_storylines(tenant_id);
```

#### `student_record_storyline_links` (활동 ↔ 스토리라인 연결)

```sql
CREATE TABLE IF NOT EXISTS student_record_storyline_links (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  storyline_id     uuid NOT NULL REFERENCES student_record_storylines(id) ON DELETE CASCADE,
  -- 다형 참조: activity_tags와 동일 패턴
  record_type      varchar(30) NOT NULL
                     CHECK (record_type IN (
                       'setek', 'personal_setek', 'changche', 'haengteuk', 'reading'
                     )),
  record_id        uuid NOT NULL,
  grade            integer NOT NULL CHECK (grade BETWEEN 1 AND 3),
  connection_note  varchar(500),                -- "이 활동이 스토리라인에 기여하는 방식"
  sort_order       integer NOT NULL DEFAULT 0,
  created_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE(storyline_id, record_type, record_id)
);

CREATE INDEX idx_srsll_storyline ON student_record_storyline_links(storyline_id);
CREATE INDEX idx_srsll_record ON student_record_storyline_links(record_type, record_id);
```

### E1.4 핵심 타입

```typescript
type Storyline = {
  id: string;
  title: string;
  keywords: string[];
  careerField: string | null;
  narrative: string | null;
  grade1Theme: string | null;
  grade2Theme: string | null;
  grade3Theme: string | null;
  strength: 'strong' | 'moderate' | 'weak';
  links: StorylineLink[];
};

type StorylineLink = {
  recordType: 'setek' | 'personal_setek' | 'changche' | 'haengteuk' | 'reading';
  recordId: string;
  grade: number;
  connectionNote: string | null;
  // 조인 결과
  recordTitle?: string;    // 과목명 or 활동유형 or 책제목
  recordSnippet?: string;  // 내용 앞 100자
};

type StorylineAnalysis = {
  storylines: Storyline[];
  coverageByGrade: Record<1 | 2 | 3, number>;  // 활동 중 스토리라인에 연결된 비율
  orphanedActivities: { recordType: string; recordId: string; title: string }[];
  coherenceScore: number;  // 0~100 (키워드 중복도 + 학년간 연결도)
};
```

### E1.5 AI 스토리라인 분석 (Phase 6 통합)

```typescript
// llm/prompts/storylineAnalysis.ts
// 입력: 전 학년 세특/창체/행특 텍스트 + 진로 목표
// 출력: { suggestedStorylines[], orphanedActivities[], coherenceFeedback }
// 프로바이더: Claude standard (서사 분석 품질)
// 용도: "이 학생의 활동들에서 추출할 수 있는 스토리라인을 제안해주세요"
```

### E1.6 UI 컴포넌트

```
app/(admin)/admin/students/[id]/_components/student-record/
├── StorylineManager.tsx           # 스토리라인 CRUD + 드래그앤드롭 연결
├── StorylineTimeline.tsx          # 학년별 연결 타임라인 시각화
├── StorylineStrengthBadge.tsx     # strong/moderate/weak 뱃지
├── StorylineSuggestionPanel.tsx   # AI 스토리라인 제안 (Phase 6)
└── OrphanedActivityAlert.tsx      # 스토리라인에 연결되지 않은 활동 경고
```

### E1.7 조기 경보 확장

```typescript
// 스토리라인 관련 경고 룰
{
  storyline_weak: "주요 스토리라인의 strength가 'weak' (활동 연결 부족)",
  storyline_gap: "2학년 활동 중 스토리라인에 연결된 것이 30% 미만",
  storyline_inconsistent: "3학년에 새로운 스토리라인 시작 (일관성 경고)",
  orphaned_activities: "전체 활동의 50% 이상이 어떤 스토리라인에도 연결되지 않음",
}
```

---

## E2. 선제적 로드맵 — 계획 vs 실행 추적 (피드백 #2)

### E2.1 문제

현재 `student_record_strategies`는 "진단 후 보완"에 초점. 실제 컨설팅은 **1학년 3월에 3년치 계획을 세우고, 매 학기 계획 vs 실행을 비교**한다.

### E2.2 설계

```
┌──────────── 선제적 로드맵 ─────────────┐
│                                          │
│  영역: 동아리활동                        │
│  ┌──────────────────────────────────┐   │
│  │ 1학년         2학년         3학년│   │
│  │ ┌────────┐   ┌────────┐  ┌─────┐│   │
│  │ │계획: 시사│   │계획: 사회│  │계획:││   │
│  │ │토론반   │   │봉사동아리│  │확장 ││   │
│  │ │────────│   │────────│  │ 미정 ││   │
│  │ │실행: 시사│   │실행: 인권│  │     ││   │
│  │ │토론반 ✅│   │동아리 ⚠️│  │     ││   │
│  │ │일치율 100%│  │일치율 60%│  │     ││   │
│  │ └────────┘   └────────┘  └─────┘│   │
│  └──────────────────────────────────┘   │
│                                          │
│  ⚠️ 2학년 동아리: 계획(사회봉사) →       │
│     실행(인권동아리) — 방향 유사하나       │
│     봉사 활동 시간 부족. 보완 필요.        │
└──────────────────────────────────────────┘
```

### E2.3 DB 스키마

#### `student_record_roadmap_items` (로드맵 계획 + 실행)

```sql
CREATE TABLE IF NOT EXISTS student_record_roadmap_items (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  student_id       uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  school_year      integer NOT NULL,           -- 대상 학년도
  grade            integer NOT NULL CHECK (grade BETWEEN 1 AND 3),
  semester         integer CHECK (semester IN (1, 2)), -- NULL이면 학년 전체
  -- 영역 구분
  area             varchar(30) NOT NULL
                     CHECK (area IN (
                       'autonomy', 'club', 'career',       -- 창체 3영역
                       'setek', 'personal_setek',            -- 세특
                       'reading', 'course_selection',        -- 독서, 교과 이수
                       'competition', 'external',            -- 대회, 외부활동
                       'volunteer', 'general'                -- 봉사, 기타
                     )),
  -- 계획 (1학년 초에 작성)
  plan_content     text NOT NULL DEFAULT '',    -- 계획 내용
  plan_keywords    text[] DEFAULT '{}',         -- 계획 키워드
  planned_at       timestamptz,                 -- 계획 작성일
  -- 실행 결과 (학기/학년 종료 후 기록)
  execution_content text,                       -- 실제 수행 내용
  execution_keywords text[] DEFAULT '{}',
  executed_at      timestamptz,                 -- 실행 기록일
  -- 비교 분석
  match_rate       integer CHECK (match_rate BETWEEN 0 AND 100), -- 계획-실행 일치율 (컨설턴트 판단)
  deviation_note   text,                        -- 차이 발생 사유 + 대응
  -- 연결
  storyline_id     uuid REFERENCES student_record_storylines(id) ON DELETE SET NULL,
  linked_record_type varchar(30),               -- 연결된 실제 기록의 테이블
  linked_record_id   uuid,                      -- 연결된 실제 기록의 ID
  -- 정렬
  sort_order       integer NOT NULL DEFAULT 0,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_srri_student_year ON student_record_roadmap_items(student_id, school_year);
CREATE INDEX idx_srri_tenant ON student_record_roadmap_items(tenant_id);
CREATE INDEX idx_srri_area ON student_record_roadmap_items(area);
CREATE INDEX idx_srri_storyline ON student_record_roadmap_items(storyline_id);
```

### E2.4 핵심 타입

```typescript
type RoadmapItem = {
  id: string;
  grade: number;
  semester: number | null;
  area: RoadmapArea;
  // 계획
  planContent: string;
  planKeywords: string[];
  plannedAt: string | null;
  // 실행
  executionContent: string | null;
  executionKeywords: string[];
  executedAt: string | null;
  // 비교
  matchRate: number | null;
  deviationNote: string | null;
  // 연결
  storylineId: string | null;
  linkedRecordType: string | null;
  linkedRecordId: string | null;
};

type RoadmapArea =
  | 'autonomy' | 'club' | 'career'
  | 'setek' | 'personal_setek'
  | 'reading' | 'course_selection'
  | 'competition' | 'external'
  | 'volunteer' | 'general';

// 집계 뷰
type RoadmapSummary = {
  totalPlanned: number;
  totalExecuted: number;
  avgMatchRate: number;
  byArea: Record<RoadmapArea, {
    planned: number;
    executed: number;
    avgMatch: number;
  }>;
  byGrade: Record<1 | 2 | 3, {
    planned: number;
    executed: number;
    avgMatch: number;
  }>;
  deviations: RoadmapItem[];  // matchRate < 50인 항목
};
```

### E2.5 교과 이수 경로 (course_selection 영역)

교과 이수 로드맵은 특별히 중요하므로 별도 UX:

```typescript
// 이수 계획 시점: 보통 1학년 2학기 (과목 선택 시기)
type CourseSelectionPlan = {
  grade: 2 | 3;
  semester: 1 | 2;
  plannedSubjects: {
    subjectId: string;
    subjectName: string;
    reason: string;           // "전공 관련 심화 과목"
    isRecommended: boolean;   // 계열별 추천교과 여부
  }[];
  actualSubjects?: {
    subjectId: string;
    subjectName: string;
    changeReason?: string;    // 계획과 다른 경우 사유
  }[];
};
```

### E2.6 UI 컴포넌트

```
app/(admin)/admin/students/[id]/_components/student-record/
├── RoadmapPlanEditor.tsx          # 3년치 계획 작성 (그리드 형태)
├── RoadmapExecutionEditor.tsx     # 실행 결과 기록 + 계획 연결
├── RoadmapComparisonView.tsx      # 계획 vs 실행 비교 (시각화)
├── RoadmapMatchRateChart.tsx      # 영역별/학년별 일치율 차트
├── CourseSelectionPlanner.tsx      # 교과 이수 경로 계획 UI
└── RoadmapDeviationAlert.tsx      # 계획-실행 괴리 경고
```

---

## E3. 고교 프로파일 (피드백 #3)

### E3.1 문제

기존 `school_info`는 주소/전화/설립유형만 저장. 학종 컨설팅에서 **학교별 교과목 편성, 교내 프로그램, 학교 유형별 전략 차이**는 1순위 정보.

### E3.2 DB 스키마

#### `school_profiles` (고교 프로파일 — 컨설팅용 확장)

```sql
CREATE TABLE IF NOT EXISTS school_profiles (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  school_info_id   integer REFERENCES school_info(id) ON DELETE SET NULL,
  school_name      varchar(200) NOT NULL,      -- school_info 없을 때 대비
  -- 학교 유형 상세
  school_category  varchar(30)
                     CHECK (school_category IN (
                       'general', 'autonomous_private', 'autonomous_public',
                       'science', 'foreign_lang', 'international',
                       'art', 'sports', 'meister', 'specialized', 'other'
                     )),
  -- 교과목 편성 (학교에서 실제 개설하는 과목)
  offered_subjects jsonb DEFAULT '[]',
  -- 예: [{ "subjectId": "...", "subjectName": "인공지능수학", "grades": [2,3], "semesters": [1] }]
  -- 교내 프로그램/대회/비교과
  programs         jsonb DEFAULT '[]',
  -- 예: [{ "name": "과학탐구대회", "type": "competition", "timing": "1학기", "description": "..." }]
  -- 학교 특성 메모 (컨설턴트용)
  profile_notes    text,                       -- 자유형 메모
  -- 입결 참고 정보
  avg_grade_trend  jsonb,                      -- 학교 평균 등급 추이 (연도별)
  notable_alumni   jsonb DEFAULT '[]',         -- 주요 합격 실적
  -- 예: [{ "year": 2025, "university": "서울대", "department": "법학", "admission": "학종" }]
  -- 메타
  data_year        integer,                    -- 이 정보의 기준년도
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, school_info_id)
);

CREATE INDEX idx_sp_tenant ON school_profiles(tenant_id);
CREATE INDEX idx_sp_school ON school_profiles(school_info_id);
CREATE INDEX idx_sp_category ON school_profiles(school_category);
```

### E3.3 핵심 타입

```typescript
type SchoolCategory =
  | 'general'              // 일반고
  | 'autonomous_private'   // 자사고
  | 'autonomous_public'    // 자공고
  | 'science'              // 과학고
  | 'foreign_lang'         // 외고
  | 'international'        // 국제고
  | 'art'                  // 예고
  | 'sports'               // 체고
  | 'meister'              // 마이스터고
  | 'specialized'          // 특성화고
  | 'other';

type SchoolProgram = {
  name: string;
  type: 'competition' | 'camp' | 'mentoring' | 'research' | 'volunteer' | 'other';
  timing: string;          // "1학기", "여름방학", "연중" 등
  description: string;
  targetGrades: number[];  // [1, 2, 3]
};

type SchoolProfile = {
  id: string;
  schoolName: string;
  schoolCategory: SchoolCategory | null;
  offeredSubjects: { subjectId: string; subjectName: string; grades: number[]; semesters: number[] }[];
  programs: SchoolProgram[];
  profileNotes: string | null;
  avgGradeTrend: Record<number, number> | null;  // { 2024: 4.2, 2025: 3.8 }
  notableAlumni: { year: number; university: string; department: string; admission: string }[];
};
```

### E3.4 활용

- **교과 이수 적합도** 계산 시: 학교에서 개설하지 않는 과목은 "이수 불가" 표시 (학생 탓이 아님)
- **로드맵 계획** 시: 학교 프로그램 목록에서 참여 가능한 활동 제안
- **스토리라인** 강화: 학교 특색 프로그램을 활용한 차별화 전략

### E3.5 UI

```
app/(admin)/admin/schools/[id]/_components/
├── SchoolProfileEditor.tsx        # 프로파일 편집 (교과, 프로그램, 메모)
└── SchoolProfileSummary.tsx       # 학생 상세에서 학교 요약 표시
```

---

## E4. 수능최저 시뮬레이션 (피드백 #4)

### E4.1 문제

수시 학종/교과에서 수능최저 충족 여부가 당락의 50%. "메모"로 처리하면 안 된다.

### E4.2 설계

```
┌──────────────────────────────────────────────────────────┐
│  이다은 — 수능최저 시뮬레이션 (6월 모평 기준)             │
│                                                            │
│  목표 대학/전형           최저 조건         현재 달성      │
│  ─────────────────────────────────────────────────────     │
│  고려대 심리학(학종)      국수영탐 3합6     ✅ 1+3+3=7→❌  │
│                           + 한국사 4이내     ✅ 1등급       │
│  성균관대 사회과학(학종)  국수영탐 2합5     3+3=6 → ❌     │
│  이화여대 뇌인지(학종)    없음              ✅ 해당없음     │
│  서울시립대 행정(교과)    국수영 2합5       1+3+3=7 → ❌   │
│                                                            │
│  ⚠️ 위험 과목: 수학(3등급) — 목표 대학 3곳의 최저 미달 원인│
│  📈 추천: 수학 2등급 달성 시 최저 충족 대학 2곳 → 4곳      │
│                                                            │
│  [3월] [6월] [9월] [수능] ← 모평별 시뮬레이션 전환         │
└──────────────────────────────────────────────────────────┘
```

### E4.3 DB 스키마

#### `student_record_min_score_targets` (수능최저 목표)

```sql
CREATE TABLE IF NOT EXISTS student_record_min_score_targets (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  student_id        uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  -- 목표 대학/전형
  university_name   varchar(100) NOT NULL,
  department        varchar(100) NOT NULL,
  admission_type    varchar(100),               -- 학종/교과/논술
  -- 수능최저 조건 (구조화)
  criteria          jsonb NOT NULL,
  -- 예: {
  --   "type": "grade_sum",          // grade_sum | single_grade | none
  --   "subjects": ["국어","수학","영어","탐구1"], // 반영 영역
  --   "count": 3,                   // 3개 합
  --   "max_sum": 6,                 // 등급합 6 이내
  --   "additional": [               // 추가 조건
  --     { "subject": "한국사", "max_grade": 4 },
  --     { "subject": "수학", "required": ["미적분","기하"] }  // 지정과목
  --   ]
  -- }
  priority          integer NOT NULL DEFAULT 0, -- 목표 순위 (0=최우선)
  notes             text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_srmst_student ON student_record_min_score_targets(student_id);
CREATE INDEX idx_srmst_tenant ON student_record_min_score_targets(tenant_id);
```

#### `student_record_min_score_simulations` (시뮬레이션 결과 캐시)

```sql
CREATE TABLE IF NOT EXISTS student_record_min_score_simulations (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  student_id        uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  target_id         uuid NOT NULL REFERENCES student_record_min_score_targets(id) ON DELETE CASCADE,
  -- 기준 모의고사
  mock_score_exam_title varchar(100) NOT NULL,  -- "6월 모평"
  mock_score_date   date NOT NULL,
  -- 시뮬레이션 결과
  is_met            boolean NOT NULL,           -- 최저 충족 여부
  actual_grades     jsonb NOT NULL,             -- { "국어": 1, "수학": 3, "영어": 3, "탐구1": 2 }
  grade_sum         integer,                    -- 실제 등급합
  gap               integer,                    -- 목표 대비 차이 (음수=미달)
  -- 분석
  bottleneck_subjects text[] DEFAULT '{}',      -- 미달 원인 과목
  what_if            jsonb,                     -- "수학이 2등급이면?" 시나리오
  -- 예: { "if_math_2": { "is_met": true, "new_sum": 6 } }
  created_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE(target_id, mock_score_date)
);

CREATE INDEX idx_srmss_student ON student_record_min_score_simulations(student_id);
CREATE INDEX idx_srmss_target ON student_record_min_score_simulations(target_id);
```

### E4.4 시뮬레이션 엔진

```typescript
// lib/domains/student-record/min-score-simulator.ts

type MinScoreCriteria = {
  type: 'grade_sum' | 'single_grade' | 'none';
  subjects: string[];         // 반영 영역명
  count: number;              // N개 선택
  maxSum: number;             // 등급합 상한
  additional: {
    subject: string;
    maxGrade?: number;
    required?: string[];      // 지정과목 (미적분/기하 등)
  }[];
};

type SimulationResult = {
  targetId: string;
  universityName: string;
  department: string;
  isMet: boolean;
  actualGrades: Record<string, number>;
  gradeSum: number | null;
  gap: number;                // 양수=여유, 음수=미달
  bottleneckSubjects: string[];
  whatIf: Record<string, { isMet: boolean; newSum: number }>;
};

/**
 * 모평 점수 기반 수능최저 시뮬레이션
 * @param studentId 학생 ID
 * @param examTitle 모평명 (e.g., "6월 모평")
 * @returns 목표별 시뮬레이션 결과
 */
async function simulateMinScores(
  studentId: string,
  examTitle: string
): Promise<SimulationResult[]> {
  // 1. 학생의 최저 목표 조회
  // 2. 해당 모평의 등급 조회 (student_mock_scores)
  // 3. 각 목표별 최저 충족 여부 계산
  // 4. 최적 조합 탐색 (N개 중 최소 등급합 조합)
  // 5. what-if 시나리오 (각 과목 1등급 개선 시)
  // 6. bottleneck 과목 식별
}

/**
 * 과목별 영향도 분석
 * "수학이 2등급이 되면 몇 개 대학 최저를 추가 충족하는가?"
 */
function analyzeSubjectImpact(
  targets: MinScoreTarget[],
  currentGrades: Record<string, number>,
  targetSubject: string,
  improvedGrade: number
): { additionalMet: string[]; totalMet: number } { ... }
```

### E4.5 조기 경보 확장

```typescript
{
  min_score_critical: "목표 대학 전체가 수능최저 미달 (모든 모평 기준)",
  min_score_bottleneck: "특정 과목(수학 등)이 3개 이상 대학의 최저 미달 원인",
  min_score_trend_down: "최저 충족 대학 수가 전 모평 대비 감소",
}
```

### E4.6 UI 컴포넌트

```
app/(admin)/admin/students/[id]/_components/student-record/
├── MinScoreTargetEditor.tsx       # 목표 대학별 최저 조건 입력
├── MinScoreSimulationView.tsx     # 모평별 충족/미달 시뮬레이션 표
├── MinScoreBottleneckChart.tsx    # 미달 원인 과목 시각화
├── MinScoreWhatIfPanel.tsx        # "이 과목이 N등급이면?" 시나리오
└── MinScoreExamSelector.tsx       # 3월/6월/9월/수능 전환
```

---

## E5. 전형 구분 세분화 (피드백 #5)

### E5.1 `student_record_applications` 스키마 변경

```sql
-- 기존: round CHECK ('early', 'regular')
-- 변경:
ALTER TABLE student_record_applications
  DROP CONSTRAINT student_record_applications_round_check;

ALTER TABLE student_record_applications
  ADD CONSTRAINT student_record_applications_round_check
    CHECK (round IN (
      -- 수시
      'early_comprehensive',    -- 학생부종합
      'early_subject',          -- 학생부교과
      'early_essay',            -- 논술
      'early_practical',        -- 실기/실적
      'early_special',          -- 특별전형 (농어촌, 기회균형 등)
      'early_other',            -- 기타 수시
      -- 정시
      'regular_ga',             -- 정시 가군
      'regular_na',             -- 정시 나군
      'regular_da',             -- 정시 다군
      -- 기타
      'additional',             -- 추가모집
      'special_quota'           -- 정원외전형
    ));

-- admission_type은 전형명 상세 (e.g., "학생부종합 – 일반전형", "학종 – 기회균형")
-- 기존 varchar(100)으로 충분
```

### E5.2 타입 변경

```typescript
type ApplicationRound =
  // 수시
  | 'early_comprehensive'    // 학종
  | 'early_subject'          // 교과
  | 'early_essay'            // 논술
  | 'early_practical'        // 실기/실적
  | 'early_special'          // 특별전형
  | 'early_other'
  // 정시
  | 'regular_ga'             // 가군
  | 'regular_na'             // 나군
  | 'regular_da'             // 다군
  // 기타
  | 'additional'             // 추가모집
  | 'special_quota';         // 정원외

// 지원 전략 통합 뷰
type ApplicationStrategy = {
  earlySlots: Application[];       // 수시 6장 (최대)
  regularSlots: {
    ga: Application | null;        // 가군 1장
    na: Application | null;        // 나군 1장
    da: Application | null;        // 다군 1장
  };
  additional: Application[];       // 추가모집
  totalEarly: number;              // 수시 지원 수 (max 6 체크)
  hasConflict: boolean;            // 군별 중복 체크
};
```

### E5.3 수시 6장 카드 제약 UI

```
┌────────── 수시 지원 카드 (6/6) ──────────┐
│  1️⃣ 고려대 심리학 [학종] ──── 가능성: 🟡  │
│  2️⃣ 성균관 사회과학 [학종] ── 가능성: 🟠  │
│  3️⃣ 이화여대 뇌인지 [학종] ── 가능성: 🟢  │
│  4️⃣ 서울시립대 행정 [교과] ── 가능성: 🟢  │
│  5️⃣ 건국대 사회학 [논술] ──── 가능성: 🟢  │
│  6️⃣ (비어있음) ────────────── [추가]       │
│                                            │
│  ⚠️ 학종 3장, 교과 1장, 논술 1장           │
│  💡 소신+적정+안정 배분: 1+2+2 (권장 1+2+3)│
└────────────────────────────────────────────┘
```

---

## E6. 학부모 생기부 뷰 (피드백 #6)

### E6.1 설계

기존 `app/(parent)/parent/` 인프라를 활용. 별도 테이블 불필요 (RLS로 자녀 데이터 접근).

### E6.2 학부모에게 공개할 범위

| 항목 | 공개 | 비공개 (컨설턴트 전용) | 근거 |
|------|------|----------------------|------|
| 교과 성적 추이 | ✅ | | 학부모가 가장 궁금해하는 정보 |
| 모의고사 추이 | ✅ | | 정시 대비 현황 |
| 수능최저 충족 현황 | ✅ | | "우리 아이 최저 되나요?" |
| 역량 평가 (요약) | ✅ | 세부 루브릭 점수 | 긍정적 방향으로 요약 |
| 스토리라인 (요약) | ✅ | 세부 연결 | 큰 방향만 공유 |
| 로드맵 계획 vs 실행 | ✅ | | 진행 상황 공유 |
| 보완전략 (요약) | ✅ | 세부 전략 | 방향만 공유 |
| 세특/창체 원문 | ❌ | ✅ | 교사 작성 문서, 학부모 공개 부적절 |
| AI 진단 원문 | ❌ | ✅ | 내부 분석 자료 |
| 컨설턴트 메모 | ❌ | ✅ | 내부 판단 |

### E6.3 UI 컴포넌트

```
app/(parent)/parent/student-record/
├── page.tsx                           # Server Component
└── _components/
    ├── ParentRecordDashboard.tsx       # 요약 대시보드
    ├── ParentScoreTrend.tsx            # 성적 추이 차트 (읽기전용)
    ├── ParentMockScoreTrend.tsx        # 모평 추이 (읽기전용)
    ├── ParentMinScoreStatus.tsx        # 수능최저 충족 현황
    ├── ParentCompetencySummary.tsx     # 역량 요약 (레이더 차트, 요약 텍스트만)
    ├── ParentStorylineSummary.tsx      # 스토리라인 요약 (타임라인)
    ├── ParentRoadmapProgress.tsx       # 로드맵 진행 상황
    └── ParentStrategyOverview.tsx      # 보완전략 방향 요약
```

### E6.4 RLS

```sql
-- 학부모: parent_student_links 기반 자녀 데이터 읽기
CREATE POLICY "{table}_parent_select" ON {student_record_table}
  FOR SELECT
  USING (
    student_id IN (
      SELECT psl.student_id
      FROM parent_student_links psl
      WHERE psl.parent_id = (SELECT auth.uid())
        AND psl.status = 'active'
    )
  );
```

---

## E7. 탐구 가이드 시스템 + AI 활동 지원 (피드백 #7 전면 재설계)

### E7.1 배경 — 에듀엣톡 탐구DB

에듀엣톡은 **탐구DB**(생기부레벨업 가이드)를 보유하고 있다. Access DB 기준:

| 항목 | 규모 |
|------|------|
| **가이드 총 건수** | 7,836건 (독서 6,078 + 주제탐구 1,455 + 교과수행 278) |
| **추천도서** (Excel 기준) | 5,000건+ (18개 계열별) |
| **나침반36.5 학과별 활동** | 15개 학과 × (탐구+동아리+자율+진로) |
| **교과목 커버리지** | 2015/2022 개정 × 8교과 × 66과목+ |

**각 가이드의 데이터 구조** (Access `가이드` 테이블 52컬럼):

```
가이드 1건 = {
  메타: 구분유형, 개정년도, 교과선택, 과목선택, 대단원, 소단원, 계열, 학과
  핵심: 주제, 탐구동기, 탐구이론(7단계), 탐구고찰, 느낀점, 탐구요약
  참고: 도서이름/저자/출판사/출판연도/도서소개, 관련논문(2), 관련도서(7)
  산출: 교과세특 예시(2개), 후속탐구
  관리: 등록자, 등록일, 이미지(7), 가이드URL
}
```

**핵심 비즈니스 룰** (Excel 개요 시트):
- 3년 내 동일 주제를 같은 학교 학생에게 배정하지 않음
- 3년 내 동일 주제를 같은 계열 학생에게 배정하지 않음
- 학교별 주제 사용률이 낮은 것을 우선 추천
- 이용 학생별 사용현황 추적 (학년, 계열 구분)

### E7.2 3가지 출력 모드 — 대상별 AI 활동 지원

플랫폼이 생기부를 총괄 관리하므로 **3가지 대상 모두를 지원**한다:

| 모드 | 대상 | 출력 형식 | 용도 | 데이터 소스 |
|------|------|-----------|------|-------------|
| **A. 활동 요약서** | 학생 → 교사 제출용 | 학생 관점 정리본 | 교사가 세특 작성 시 참고 | 탐구DB 가이드 + 학생 실행 기록 |
| **B. 세특 방향 가이드** | 컨설턴트 내부용 | 세특 포인트 요약 | 세특에 녹일 핵심 역량·키워드 제안 | 탐구DB 교과세특 예시 + 역량 태그 |
| **C. 활동 가이드** | 학생 직접 사용 | 탐구 수행 안내서 | 학교 활동 전 탐구 방향 제시 | 탐구DB 가이드 원본 (주제~요약) |

```
┌─────────────────────────────────────────────────────────────┐
│  탐구 가이드 시스템 흐름                                      │
│                                                               │
│  [탐구DB 7,836건]                                             │
│       │                                                       │
│       ├─ 학생 매칭 (계열+과목+학교 고유성 체크)               │
│       │       │                                               │
│       │       ▼                                               │
│       │  [가이드 배정] → 학생 APP 전달 (모드 C)               │
│       │       │                                               │
│       │       ▼                                               │
│       │  [학생 활동 수행] → 탐구 기록 입력                    │
│       │       │                                               │
│       │       ▼                                               │
│       ├─ AI 모드 A: 활동 요약서 생성 → 학생이 교사에게 제출   │
│       │                                                       │
│       ├─ AI 모드 B: 세특 방향 가이드 → 컨설턴트 내부 참고     │
│       │              (교과세특 예시 기반 핵심 포인트 제안)     │
│       │                                                       │
│       └─ 교사: 활동 요약서 + 본인 관찰 → NEIS 세특 작성      │
│                                                               │
│  ※ 시스템은 NEIS 세특을 직접 생성하지 않는다.                 │
│  ※ 교과세특 예시(DB)는 컨설턴트 참고용이며 교사 전달 X.     │
└─────────────────────────────────────────────────────────────┘
```

### E7.3 DB 스키마 — 탐구 가이드 시스템

#### 참조 테이블 (Access DB → Supabase 마이그레이션)

```sql
-- guide_types 참조 테이블은 불필요 (exploration_guides.guide_type CHECK 제약으로 충분)
-- 삭제됨: E16 3분할 스키마에서 CHECK 제약 유지

-- ⚠️ 이 단일 테이블 스키마는 E16에서 3분할로 대체됨. 아래는 참고용 원본.
CREATE TABLE IF NOT EXISTS exploration_guides (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Access 원본 ID (마이그레이션 추적)
  legacy_id        integer,
  -- 분류
  guide_type       varchar(30) NOT NULL
                     CHECK (guide_type IN (
                       'subject_performance', -- 교과수행
                       'experiment',          -- 실험 및 연구
                       'topic_exploration',   -- 주제 탐구
                       'reading',             -- 독서
                       'program'              -- 교육프로그램
                     )),
  curriculum_years  text[] DEFAULT '{}',     -- {"2015", "2022"}
  -- 교과 연결
  subject_areas     text[] DEFAULT '{}',     -- {"과학과", "수학과"}
  subject_names     text[] DEFAULT '{}',     -- {"물리학Ⅰ", "화학Ⅰ"}
  unit_major        varchar(200),            -- 대단원
  unit_minor        varchar(200),            -- 소단원
  -- 계열/학과 연결
  career_fields     text[] DEFAULT '{}',     -- {"공학계열", "자연계열"}
  departments       text[] DEFAULT '{}',     -- {"물리학과", "전자공학과", ...}
  -- 핵심 콘텐츠
  title             text NOT NULL,           -- 주제/제목
  motivation        text,                    -- 탐구동기
  theory            text,                    -- 탐구이론 (통합, 원본은 7단계)
  theory_sections   jsonb DEFAULT '[]',      -- [{ "order": 1, "content": "...", "imagePath": "..." }]
  reflection        text,                    -- 탐구고찰
  impression        text,                    -- 느낀점
  summary           text,                    -- 탐구요약
  follow_up         text,                    -- 후속탐구
  -- 독서 정보 (guide_type = 'reading' 시)
  book_title        varchar(300),
  book_author       varchar(200),
  book_publisher    varchar(200),
  book_year         integer,
  book_description  text,
  -- 참고 자료
  related_papers    jsonb DEFAULT '[]',      -- [{ "title": "...", "url": "..." }]
  related_books     text[] DEFAULT '{}',     -- 관련도서 (최대 7개)
  -- 교과세특 예시 (컨설턴트 전용, 학생/교사 비공개)
  setek_example_1   text,                    -- 교과세특 예시 1
  setek_example_2   text,                    -- 교과세특 예시 2
  -- 이미지
  image_paths       text[] DEFAULT '{}',
  guide_url         text,
  -- 관리
  registered_by     varchar(100),
  registered_at     timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_eg_type ON exploration_guides(guide_type);
CREATE INDEX idx_eg_subjects ON exploration_guides USING GIN(subject_names);
CREATE INDEX idx_eg_careers ON exploration_guides USING GIN(career_fields);
CREATE INDEX idx_eg_curriculum ON exploration_guides USING GIN(curriculum_years);
CREATE INDEX idx_eg_title ON exploration_guides USING gin(to_tsvector('simple', title));
```

#### 가이드 배정 + 이용 추적

```sql
-- 학생별 가이드 배정 (Access 가이드 이용 내역 → 확장)
CREATE TABLE IF NOT EXISTS guide_assignments (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  student_id       uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  guide_id         uuid NOT NULL REFERENCES exploration_guides(id) ON DELETE CASCADE,
  -- 배정 정보
  assigned_by      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  assigned_at      timestamptz NOT NULL DEFAULT now(),
  school_year      integer NOT NULL,
  grade            integer NOT NULL CHECK (grade BETWEEN 1 AND 3),
  -- 상태 추적
  status           varchar(20) NOT NULL DEFAULT 'assigned'
                     CHECK (status IN (
                       'assigned',        -- 배정됨 (학생에게 전달)
                       'in_progress',     -- 학생이 수행 중
                       'submitted',       -- 학생이 활동 요약서 제출
                       'completed',       -- 컨설턴트 확인 완료
                       'cancelled'        -- 취소
                     )),
  -- 학생 실행 기록
  student_notes    text,                    -- 학생이 작성한 탐구 기록
  submitted_at     timestamptz,
  completed_at     timestamptz,
  -- 연결 (이 가이드가 어떤 생기부 기록에 반영되었는지)
  linked_record_type varchar(30),           -- 'setek', 'changche', 'reading' 등
  linked_record_id   uuid,
  -- 스토리라인 연결
  storyline_id     uuid REFERENCES student_record_storylines(id) ON DELETE SET NULL,
  notes            text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, student_id, guide_id)  -- 동일 학생에게 같은 가이드 중복 배정 방지
);

CREATE INDEX idx_ga_student ON guide_assignments(student_id, school_year);
CREATE INDEX idx_ga_tenant ON guide_assignments(tenant_id);
CREATE INDEX idx_ga_guide ON guide_assignments(guide_id);
CREATE INDEX idx_ga_status ON guide_assignments(status) WHERE status != 'completed';
```

#### 주제 고유성 추적

```sql
-- 학교별 주제 사용 이력 (3년 중복 방지용)
CREATE TABLE IF NOT EXISTS guide_usage_history (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guide_id         uuid NOT NULL REFERENCES exploration_guides(id) ON DELETE CASCADE,
  school_info_id   integer REFERENCES school_info(id) ON DELETE SET NULL,
  school_name      varchar(200) NOT NULL,    -- school_info 없을 때 대비
  career_field     varchar(50),              -- 사용 학생의 계열
  used_year        integer NOT NULL,         -- 사용 연도
  student_count    integer NOT NULL DEFAULT 1,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_guh_guide ON guide_usage_history(guide_id);
CREATE INDEX idx_guh_school ON guide_usage_history(school_info_id, used_year);
CREATE INDEX idx_guh_school_name ON guide_usage_history(school_name, used_year);
```

### E7.4 주제 고유성 엔진

```typescript
// lib/domains/student-record/guide/uniqueness-checker.ts

type UniquenessCheckResult = {
  isUnique: boolean;
  conflicts: {
    type: 'same_school_same_topic' | 'same_school_same_career' | 'high_usage';
    detail: string;
    year: number;
  }[];
  usageRate: number;           // 해당 학교에서의 사용률 (0~1)
  recommendationScore: number; // 추천 점수 (높을수록 좋음, 0~100)
};

/**
 * 학생에게 이 가이드를 배정해도 되는지 고유성 체크
 *
 * 규칙:
 * 1. 3년 내 같은 학교에서 동일 주제 사용 → 불가
 * 2. 3년 내 같은 학교+같은 계열에서 동일 주제 → 불가
 * 3. 학교별 사용률이 높은 주제 → 경고 (차단은 아님)
 */
async function checkGuideUniqueness(
  guideId: string,
  studentId: string,
): Promise<UniquenessCheckResult> { ... }

/**
 * 학생 조건에 맞는 가이드 추천 (고유성 통과 + 관련성 높은 순)
 */
async function recommendGuides(params: {
  studentId: string;
  subjectName?: string;
  careerField?: string;
  guideType?: string;
  limit?: number;
}): Promise<(ExplorationGuide & { recommendationScore: number })[]> { ... }
```

### E7.5 AI 모드별 프롬프트 설계

#### 모드 A: 학생 → 교사 활동 요약서

```typescript
// llm/prompts/activitySummaryForTeacher.ts
const SYSTEM_PROMPT = `
당신은 학생의 교과 탐구활동을 정리하는 도우미입니다.

[중요 원칙]
- 이 문서는 "학생 활동 요약서"이며, NEIS 세특이 아닙니다.
- 학생이 교사에게 제출하여 세특 작성 시 참고할 수 있는 정리본입니다.
- 학생 관점("저는 ~ 탐구했습니다")으로 작성합니다.
- NEIS 세특 양식(~하였음, ~을 보임)으로 작성하지 마세요.

[입력 데이터]
- 탐구 가이드 원본 (주제, 동기, 이론, 고찰)
- 학생이 실제 수행한 기록 (student_notes)
- 과목명, 단원, 학년

[출력 형식]
1. 탐구 주제 및 동기 (2-3문장)
2. 구체적 수행 내용 (3-5개 항목, 불릿)
3. 탐구 과정에서의 발견/심화 (2-3문장)
4. 성장 포인트 (역량 연결, 1-2문장)
5. 글자수: {charLimit}자 이내
`;
// 프로바이더: Claude standard (정리 품질)
```

#### 모드 B: 컨설턴트 내부 세특 방향 가이드

```typescript
// llm/prompts/setekDirectionGuide.ts
const SYSTEM_PROMPT = `
당신은 생기부 컨설팅 전문가입니다.

[중요 원칙]
- 이 문서는 컨설턴트 내부 참고용이며, 교사나 학생에게 직접 전달하지 않습니다.
- 교과세특 예시를 기반으로 핵심 역량 키워드와 세특 방향을 제안합니다.

[입력 데이터]
- 탐구 가이드 원본 (주제~요약 전체)
- 교과세특 예시 2개 (DB 보유분)
- 학생의 역량 태그/평가 현황
- 학생의 스토리라인

[출력 형식]
1. 세특에 녹일 핵심 키워드 (5-7개)
2. 강조할 역량 (학업/진로/공동체 중 해당 항목)
3. 세특 방향 제안 (스토리라인 연결점)
4. 주의사항 (이 주제에서 피해야 할 표현/방향)
5. 교사에게 전달할 핵심 포인트 (2-3개)
`;
// 프로바이더: Claude standard
```

#### 모드 C: 학생 직접 활동 가이드 (AI 변환 아닌 DB 원본 전달)

```typescript
// 모드 C는 AI 생성이 아닌 탐구DB 원본 가이드를 구조화하여 전달
// 탐구동기 → 탐구이론 → 탐구고찰 순서로 학생에게 단계별 안내

type StudentActivityGuide = {
  title: string;                // 주제
  motivation: string;           // 탐구동기 (왜 이 주제를?)
  theorySteps: {                // 탐구이론 (단계별 탐구 안내)
    order: number;
    content: string;
    imagePath?: string;
  }[];
  reflection: string;           // 탐구고찰 (어떤 결론을?)
  followUp: string;             // 후속탐구 (더 발전시키려면?)
  relatedBooks: string[];       // 관련 도서
  relatedPapers: { title: string; url: string }[];
  // 교과세특 예시는 포함하지 않음 (학생 비공개)
};
```

### E7.6 UI 컴포넌트

```
── 관리자: 가이드 관리 ──
app/(admin)/admin/guides/
├── page.tsx                           # 가이드 목록 (검색/필터)
├── [id]/page.tsx                      # 가이드 상세/편집
└── _components/
    ├── GuideSearchFilter.tsx          # 교과/과목/계열/유형 필터
    ├── GuideDetailView.tsx            # 가이드 상세 보기 (52컬럼 전체)
    ├── GuideAssignButton.tsx          # 학생에게 배정 (고유성 체크 포함)
    ├── GuideUniquenessWarning.tsx     # 3년 중복 경고 표시
    └── GuideUsageStats.tsx            # 학교별/계열별 사용현황

── 관리자: 학생 상세 내 가이드 탭 ──
app/(admin)/admin/students/[id]/_components/student-record/
├── GuideAssignmentList.tsx            # 배정된 가이드 목록 + 상태
├── GuideAssignmentModal.tsx           # 가이드 검색 → 배정 모달
├── ActivitySummaryGenerator.tsx       # 모드 A: 활동 요약서 AI 생성
├── SetekDirectionPanel.tsx            # 모드 B: 세특 방향 가이드 (내부용)
└── GuideToRecordLinker.tsx            # 가이드 ↔ 생기부 기록 연결

── 학생 APP ──
app/(student)/guides/
├── page.tsx                           # 배정된 가이드 목록
├── [id]/page.tsx                      # 가이드 상세 (모드 C: 활동 안내)
└── _components/
    ├── StudentGuideView.tsx           # 단계별 탐구 안내 (교과세특 제외)
    ├── StudentNoteEditor.tsx          # 탐구 기록 입력
    └── StudentGuideSubmit.tsx         # 활동 요약서 제출
```

### E7.7 Access DB → Supabase 마이그레이션 스크립트

```
Phase 2.5 (탐구DB 이관)
2.5.1  mdb-export로 Access DB → CSV 추출
2.5.2  CSV → JSON 변환 + 데이터 정제 (중복 제거, 필드 정규화)
2.5.3  exploration_guides bulk insert (7,836건)
2.5.4  guide_usage_history 초기화 (기존 이용 내역 1건 + 학생 정보)
2.5.5  과목명 → subjects.id 매칭 (기존 subject-matcher.ts 활용)
2.5.6  데이터 정합성 검증 (건수, 유형별 분포, 교과 매핑률)
```

### E7.8 윤리적 경계 명확화

| 시스템이 하는 것 | 시스템이 하지 않는 것 |
|-----------------|---------------------|
| 탐구 주제 추천 + 활동 가이드 제공 | NEIS 세특 텍스트 직접 생성 |
| 학생 활동 요약서 초안 (학생 관점) | 교사 작성 양식 세특 생성 |
| 컨설턴트용 세특 방향 제안 (내부) | 교사에게 세특 내용 전달 |
| 교과세특 예시 보관 (컨설턴트 참고) | 교과세특 예시를 학생/교사에 노출 |
| 주제 고유성 체크 (학교/계열별) | 학생 간 동일 내용 복사 허용 |

---

## E7-CMS. 가이드 제작 시스템 (CMS + AI 생성 + 적대적 검증)

### CMS.1 전체 파이프라인

```
┌────────────────────────────────────────────────────────────────┐
│                    가이드 제작 파이프라인                        │
│                                                                  │
│  ── 입력 소스 (5가지) ──                                        │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐                 │
│  │키워드 │ │PDF   │ │논문/ │ │기존  │ │수동  │                 │
│  │입력   │ │추출  │ │기사  │ │가이드│ │작성  │                 │
│  │       │ │나침반│ │URL   │ │복제  │ │      │                 │
│  └──┬───┘ │과학동│ └──┬───┘ │변형  │ └──┬───┘                 │
│     │     └──┬───┘    │     └──┬───┘    │                      │
│     └────────┴────────┴───────┴────────┘                       │
│                        │                                         │
│                        ▼                                         │
│  ┌─────────────────────────────────────┐                        │
│  │      1단계: AI 초안 생성            │ Claude/Gemini           │
│  │  주제 → 탐구동기 → 단계별 이론     │                        │
│  │  → 탐구고찰 → 요약 → 후속탐구      │                        │
│  │  → 관련도서/논문 → 교과세특 예시    │                        │
│  └──────────────┬──────────────────────┘                        │
│                  ▼                                               │
│  ┌─────────────────────────────────────┐                        │
│  │      2단계: AI 적대적 검증          │ 별도 AI (검증자 역할)   │
│  │  ✓ 학문적 정확성 (사실 오류 검출)   │                        │
│  │  ✓ 도서/논문 실존 가능성 판정       │                        │
│  │  ✓ 계열-과목 매칭 적절성            │                        │
│  │  ✓ 기존 가이드 유사도 (중복 탐지)   │                        │
│  │  ✓ 난이도/수준 적절성               │                        │
│  │  ✓ 교과세특 예시 NEIS 준수          │                        │
│  │  → 항목별 점수 + 구체적 지적사항    │                        │
│  └──────────────┬──────────────────────┘                        │
│                  ▼                                               │
│  ┌─────────────────────────────────────┐                        │
│  │      3단계: 컨설턴트 최종 승인      │ 사람                   │
│  │  AI 검증 결과 확인                  │                        │
│  │  도서/논문 수동 확인 (필수)          │                        │
│  │  내용 수정/보완                     │                        │
│  │  [승인] → 배정 가능 상태            │                        │
│  │  [반려] → 1단계로 (수정 지시 포함)  │                        │
│  └──────────────┬──────────────────────┘                        │
│                  ▼                                               │
│  ┌─────────────────────────────────────┐                        │
│  │      4단계: 발행 + 품질 추적        │                        │
│  │  품질 등급 부여                     │                        │
│  │  학생 배정 가능                     │                        │
│  │  사용 후 학생 피드백 수집           │                        │
│  │  피드백 기반 품질 점수 갱신         │                        │
│  └─────────────────────────────────────┘                        │
└────────────────────────────────────────────────────────────────┘
```

### CMS.2 exploration_guides 스키마 확장 (⚠️ E16 3분할로 대체됨)

> **⚠️ 아래 ALTER 문은 E16 3분할에 의해 대체됨.** 각 컬럼의 새 위치: status/source_type → exploration_guides(메타), ai_review_score/quality_tier → exploration_guide_reviews. 원본은 참고용으로 유지.

```sql
ALTER TABLE exploration_guides ADD COLUMN IF NOT EXISTS

  -- ── 상태 관리 ──
  status           varchar(20) NOT NULL DEFAULT 'draft'
                     CHECK (status IN (
                       'draft',            -- AI 생성 직후 / 수동 작성 중
                       'ai_reviewing',     -- AI 적대적 검증 진행 중
                       'review_failed',    -- AI 검증 실패 (수정 필요)
                       'pending_approval', -- 컨설턴트 승인 대기
                       'approved',         -- 승인 완료 (배정 가능)
                       'archived'          -- 보관 (배정 중단)
                     )),

  -- ── 생성 메타 ──
  source_type      varchar(30) DEFAULT 'manual'
                     CHECK (source_type IN (
                       'manual',           -- 수동 작성
                       'ai_keyword',       -- AI: 키워드 기반 생성
                       'ai_pdf_extract',   -- AI: PDF(나침반/과학동아) 추출
                       'ai_url_extract',   -- AI: 논문/기사 URL 기반
                       'ai_clone_variant', -- AI: 기존 가이드 복제 변형
                       'ai_hybrid'         -- AI + 수동 혼합
                     )),
  source_reference text,                    -- 원본 소스 (URL, PDF 페이지, 원본 guide ID 등)
  parent_guide_id  uuid REFERENCES exploration_guides(id) ON DELETE SET NULL,
                                             -- 복제/변형 시 원본 가이드

  -- ── AI 검증 결과 ──
  ai_review_score  integer CHECK (ai_review_score BETWEEN 0 AND 100),
  ai_review_result jsonb,
  -- {
  --   "accuracy": { "score": 85, "issues": ["프랭클의 출생년도 1905→정확"] },
  --   "book_plausibility": { "score": 70, "flags": ["관련도서3 출판사 미확인"] },
  --   "career_match": { "score": 95, "notes": "계열 매칭 적절" },
  --   "similarity": { "score": 30, "similar_guides": [{ "id": "...", "title": "...", "sim": 0.82 }] },
  --   "difficulty": { "score": 90, "level": "고2 적합" },
  --   "setek_compliance": { "score": 88, "issues": ["세특예시2 글자수 520자, 500자 초과"] },
  --   "overall_verdict": "pass_with_warnings",  -- pass | pass_with_warnings | fail
  --   "review_timestamp": "2026-03-17T10:00:00Z"
  -- }
  ai_reviewed_at   timestamptz,

  -- ── 승인 ──
  approved_by      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at      timestamptz,
  rejection_reason text,                    -- 반려 사유

  -- ── 품질 관리 ──
  quality_tier     varchar(30) DEFAULT 'ai_draft'
                     CHECK (quality_tier IN (
                       'expert_authored',        -- 전문가 직접 작성
                       'expert_reviewed',        -- AI 생성 + 전문가 검증 완료
                       'ai_reviewed_approved',   -- AI 생성 + AI 검증 통과 + 승인
                       'ai_draft'                -- AI 초안 (미검증)
                     )),
  quality_score    numeric(4,1) DEFAULT 0,  -- 0~100 (학생 피드백 기반 갱신)
  usage_count      integer DEFAULT 0,       -- 배정 횟수
  feedback_count   integer DEFAULT 0,       -- 피드백 수

  -- ── 버전 관리 ──
  version          integer NOT NULL DEFAULT 1,
  version_note     text,                    -- "2022 개정 교육과정 반영" 등
  is_latest        boolean NOT NULL DEFAULT true;

-- 동일 원본의 버전 계보 추적
CREATE INDEX idx_eg_parent ON exploration_guides(parent_guide_id);
CREATE INDEX idx_eg_status ON exploration_guides(status);
CREATE INDEX idx_eg_quality ON exploration_guides(quality_tier, quality_score DESC);
```

### CMS.3 가이드 피드백 테이블

```sql
CREATE TABLE IF NOT EXISTS guide_feedback (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guide_id         uuid NOT NULL REFERENCES exploration_guides(id) ON DELETE CASCADE,
  assignment_id    uuid REFERENCES guide_assignments(id) ON DELETE SET NULL,
  student_id       uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  tenant_id        uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  -- 평가
  helpfulness      integer NOT NULL CHECK (helpfulness BETWEEN 1 AND 5),
  difficulty_rating varchar(20)
                     CHECK (difficulty_rating IN ('too_easy', 'appropriate', 'too_hard')),
  comment          text,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_gf_guide ON guide_feedback(guide_id);
```

### CMS.4 리치 텍스트 탐구이론 — 단계별 구조화

Access에서 `탐구이론1`~`탐구이론7`로 칸을 나눈 이유가 텍스트 도구 제한이었으므로, 웹에서는 **리치 텍스트 에디터 + 단계별 구조**로 설계합니다.

```sql
-- exploration_guides.theory_sections 컬럼 (jsonb)
-- 기존 theory (text) 컬럼과 병행. 단계 구분이 필요 없으면 theory 사용.

-- theory_sections 구조:
-- [
--   {
--     "order": 1,
--     "title": "이론적 배경",
--     "content": "<p>보간법이란 주어진 데이터 점들을...</p>",  -- HTML (리치텍스트)
--     "content_format": "html",
--     "images": [{ "path": "/storage/...", "caption": "그림 1. 다항식 보간법 개념도" }],
--     "formulas": [{ "latex": "P(x) = \\sum_{i=0}^{n} y_i L_i(x)", "label": "식 1" }]
--   },
--   {
--     "order": 2,
--     "title": "실험 설계",
--     "content": "<p>영상처리에서 보간법이 사용되는 과정을...</p>",
--     "content_format": "html",
--     "images": [...],
--     "formulas": [...]
--   },
--   ...
-- ]
```

**주제 유형별 단계 템플릿** (AI 생성 시 참조):

```typescript
const THEORY_STAGE_TEMPLATES: Record<string, string[]> = {
  // 교과수행 (실험/탐구형)
  subject_performance: [
    '이론적 배경',
    '탐구 설계 및 방법',
    '탐구 수행 과정',
    '결과 분석',
    '결론 및 한계',
  ],
  // 독서 (감상/비평형)
  reading: [
    '작품 개요 및 배경',
    '핵심 내용 분석',
    '비판적 고찰',
    '현대적 의의',
  ],
  // 주제 탐구 (논문형)
  topic_exploration: [
    '문제 제기 및 배경',
    '선행 연구 검토',
    '분석 및 논의',
    '결론 및 후속 과제',
  ],
  // 실험 및 연구
  experiment: [
    '연구 목적 및 가설',
    '실험 재료 및 방법',
    '실험 결과',
    '결과 해석 및 고찰',
    '결론 및 제언',
  ],
};
```

### CMS.5 AI 초안 생성 엔진

#### 5가지 입력 소스별 생성 프롬프트

```typescript
// lib/domains/student-record/guide/ai/generate-guide.ts

type GuideGenerationInput =
  | { type: 'keyword'; keyword: string; subject: string; careerField: string; grade?: number }
  | { type: 'pdf_extract'; pdfBase64Pages: string[]; sourceTitle: string }
  | { type: 'url_extract'; url: string; articleTitle?: string }
  | { type: 'clone_variant'; sourceGuideId: string; targetCareerField: string; targetSubject?: string }
  | { type: 'manual_enhance'; partialGuide: Partial<ExplorationGuide> };

type GuideGenerationResult = {
  guide: ExplorationGuide;      // 생성된 가이드 전체
  confidence: number;           // AI 자신감 (0~100)
  warnings: string[];           // "관련도서2는 실존 확인 필요" 등
  sourceExtracts?: string[];    // PDF/URL에서 추출한 원문 스니펫
};

/**
 * 딸깍 한 번으로 가이드 전체를 생성하는 원스텝 함수
 */
async function generateGuide(input: GuideGenerationInput): Promise<GuideGenerationResult> {
  // 1. 입력 소스별 컨텍스트 준비
  // 2. AI 호출 (Claude standard: 구조화 + 품질)
  // 3. 기존 가이드 유사도 체크 (임베딩 or 키워드)
  // 4. 결과 구조화 + 경고 생성
  // 5. status = 'draft'로 저장
}
```

#### 키워드 기반 생성 프롬프트

```typescript
// llm/prompts/guideGeneration.ts

const KEYWORD_GENERATION_PROMPT = `
당신은 고등학교 교과 탐구활동 가이드를 작성하는 교육 콘텐츠 전문가입니다.

[입력]
- 과목: {subject}
- 단원: {unit} (있는 경우)
- 키워드/주제: {keyword}
- 대상 계열: {careerField}
- 대상 학년: {grade}학년

[출력 — 반드시 아래 전체를 생성]

1. **주제** (한 줄, 구체적이고 탐구 가능한 형태)
2. **탐구동기** (200~300자, 학생이 이 주제에 관심을 갖게 된 계기)
3. **탐구이론** (단계별, 각 단계 300~500자)
   - 단계 수: 주제 유형에 따라 3~5단계
   - 각 단계: 제목 + 본문 + 수식(필요 시 LaTeX) + 이미지 설명(필요 시)
4. **탐구고찰** (300~500자, 탐구 결과에 대한 분석적 사고)
5. **느낀점** (200~300자, 학생 관점의 성찰)
6. **탐구요약** (200자 이내, 전체 요약)
7. **후속탐구** (100~200자, 확장 가능한 방향)
8. **관련도서** (3~5권, 반드시 실존하는 책. 저자/출판사/출판연도 포함)
   ⚠️ 존재하지 않는 책을 만들지 마세요. 확실하지 않으면 "확인 필요" 표시
9. **관련논문** (1~2편, KCI/학술지 논문. URL 포함)
   ⚠️ 실존 논문만. 확실하지 않으면 "확인 필요" 표시
10. **교과세특 예시 1** (500자 이내, NEIS 양식: ~하였음/~을 보임)
    - 해당 과목 교사가 작성할 법한 세특 문장
11. **교과세특 예시 2** (500자 이내, 다른 각도의 세특)
12. **관련학과** (해당 계열 내 구체적 학과명 나열)

[원칙]
- 학문적으로 정확한 내용만 작성
- 고등학생 수준에서 이해 가능하되, 대학 탐구 수준으로 심화
- 수식은 LaTeX 문법, 이미지는 [이미지: 설명] 형태로 위치 표시
- 독서형은 실존 작품/저자 기반으로만 작성
`;
```

#### PDF 추출 프롬프트 (나침반36.5 / 과학동아)

```typescript
const PDF_EXTRACTION_PROMPT = `
당신은 교육 월간지에서 고등학생 탐구활동 주제를 추출하는 전문가입니다.

[입력]
- 월간지 페이지 이미지 (Gemini 멀티모달)
- 출처: {sourceTitle} (예: "나침반36.5 2025년 9월호")

[작업]
이 페이지에서 고등학생 탐구활동 가이드로 변환 가능한 주제를 추출하세요.

[출력]
각 추출 주제에 대해 가이드 전체 구조를 생성 (키워드 생성과 동일 형식).
단, 아래를 추가:
- **원문 인용**: 월간지에서 직접 인용한 부분 (따옴표)
- **확장 방향**: 원문 내용을 탐구 주제로 확장한 방식 설명

⚠️ 월간지의 내용을 그대로 복사하지 말고, 탐구 가이드 형태로 재구성하세요.
`;
// 프로바이더: Gemini 멀티모달 (이미지 입력)
```

### CMS.6 AI 적대적 검증 엔진

```typescript
// lib/domains/student-record/guide/ai/adversarial-review.ts

type ReviewCategory = {
  name: string;
  score: number;           // 0~100
  verdict: 'pass' | 'warning' | 'fail';
  issues: string[];        // 구체적 지적사항
  suggestions: string[];   // 개선 제안
};

type AdversarialReviewResult = {
  overallScore: number;    // 가중 평균
  overallVerdict: 'pass' | 'pass_with_warnings' | 'fail';
  categories: {
    accuracy: ReviewCategory;        // 학문적 정확성
    bookPlausibility: ReviewCategory; // 도서/논문 실존 가능성
    careerMatch: ReviewCategory;     // 계열-과목 매칭
    similarity: ReviewCategory;      // 기존 가이드 중복도
    difficulty: ReviewCategory;      // 난이도 적절성
    setekCompliance: ReviewCategory; // 세특 예시 NEIS 준수
  };
  mustFixItems: string[];            // 반드시 수정해야 할 항목
  manualCheckItems: string[];        // 사람이 확인해야 할 항목 (도서/논문)
  reviewedAt: string;
};

/**
 * AI 적대적 검증 — 생성 AI와 다른 역할로 검증
 *
 * 핵심: "이 가이드에서 틀린 것, 의심스러운 것, 부족한 것을 찾아라"
 * 생성 AI(Claude)와 검증 AI(동일 모델, 다른 프롬프트)를 분리하여
 * 자기검증 바이어스를 최소화
 */
async function adversarialReview(
  guide: ExplorationGuide,
  existingGuides: { id: string; title: string; keywords: string[] }[]
): Promise<AdversarialReviewResult> { ... }
```

#### 적대적 검증 프롬프트

```typescript
const ADVERSARIAL_REVIEW_PROMPT = `
당신은 교육 콘텐츠 품질 검증 전문가입니다.
아래 탐구 가이드에서 **문제점, 오류, 의심스러운 부분**을 찾으세요.

[역할: 비판적 검토자]
- 칭찬하지 마세요. 문제를 찾는 것이 목적입니다.
- "아마 맞을 것이다"는 불충분합니다. 확실하지 않으면 "확인 필요"로 표시하세요.

[검증 항목별 기준]

1. **학문적 정확성** (40점)
   - 사실 오류 (날짜, 이름, 개념, 수식)
   - 인과관계 오류
   - 과도한 단순화 또는 부정확한 일반화
   - 최신 학술 동향과의 괴리

2. **도서/논문 실존 가능성** (20점)
   - 저자명 + 출판사 + 출판연도 조합이 현실적인지
   - 논문 제목 + URL 형식이 유효한지
   - ⚠️ AI가 만들어낸 가짜 도서 의심 시 "확인 필요" 표시
   - 존재 확인이 불가하면 반드시 manualCheckItems에 추가

3. **계열-과목 매칭** (10점)
   - 이 탐구 주제가 해당 과목/단원에 적합한지
   - 대상 계열 학생에게 의미 있는 내용인지
   - 관련학과 나열이 현실적인지

4. **기존 가이드 유사도** (10점)
   - 아래 기존 가이드 목록과 비교하여 유사한 것 식별
   - 유사도 80% 이상이면 fail
   - 50~80%면 warning + "기존 가이드 변형 권장"
   [기존 가이드 목록: {existingGuideTitles}]

5. **난이도 적절성** (10점)
   - 고등학생 수준에서 이해 가능한지
   - 너무 쉽거나 (중학생 수준) 너무 어려운 (대학원 수준) 내용은 없는지

6. **교과세특 예시 NEIS 준수** (10점)
   - 500자(1,500B) 초과 여부
   - NEIS 세특 양식(~하였음/~을 보임/~이 돋보임) 준수
   - 구체적 활동 내용 포함 여부

[출력: JSON]
{
  "overallScore": number,
  "overallVerdict": "pass" | "pass_with_warnings" | "fail",
  "categories": { ... },
  "mustFixItems": string[],
  "manualCheckItems": string[]
}
`;
```

### CMS.7 유사도 탐지 엔진

```typescript
// lib/domains/student-record/guide/similarity-detector.ts

/**
 * 신규 가이드 vs 기존 가이드 유사도 검사
 *
 * 2단계:
 * 1. 키워드 기반 사전 필터링 (빠름, 후보 축소)
 * 2. AI 기반 의미 유사도 판정 (후보에 대해서만)
 */

type SimilarityResult = {
  hasDuplicate: boolean;           // 80% 이상 유사 존재
  hasNearDuplicate: boolean;       // 50~80% 유사 존재
  matches: {
    guideId: string;
    title: string;
    similarityScore: number;       // 0~100
    sharedKeywords: string[];
    recommendation: 'block' | 'warn_use_existing' | 'ok';
  }[];
};

async function detectSimilarity(
  newGuide: { title: string; keywords: string[]; subjectNames: string[]; summary: string },
): Promise<SimilarityResult> {
  // 1단계: 키워드 겹침 + 과목 겹침으로 후보 추출 (SQL)
  //   - 동일 과목 + 키워드 2개 이상 겹침 → 후보
  //   - 제목 유사도 (trigram) → 후보
  //   - 최대 20개 후보 추출

  // 2단계: AI 의미 유사도 (후보에 대해서만)
  //   - 새 가이드 요약 vs 후보 가이드 요약 비교
  //   - "이 두 탐구 주제가 본질적으로 같은 내용인지 판단하세요"
  //   - 점수: 0~100
}
```

```sql
-- 유사도 검색용 trigram 인덱스
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX idx_eg_title_trgm ON exploration_guides
  USING gin(title gin_trgm_ops);

-- 키워드 겹침 후보 검색 쿼리 예시
-- SELECT id, title, subject_names,
--   array_length(
--     ARRAY(SELECT unnest(subject_names) INTERSECT SELECT unnest($1::text[])), 1
--   ) as subject_overlap,
--   similarity(title, $2) as title_sim
-- FROM exploration_guides
-- WHERE status = 'approved'
--   AND subject_names && $1::text[]  -- 과목 겹침
-- ORDER BY title_sim DESC
-- LIMIT 20;
```

### CMS.8 버전 관리

```typescript
// lib/domains/student-record/guide/version-manager.ts

type VersionAction =
  | 'curriculum_update'    // 교육과정 변경 반영 (2015→2022)
  | 'career_variant'       // 다른 계열용 변형
  | 'content_improvement'  // 내용 개선/오류 수정
  | 'student_customization'; // 학생 맞춤 변형

/**
 * 기존 가이드의 새 버전 생성
 *
 * 원본 guide → parent_guide_id로 연결
 * 원본의 is_latest = false, 새 버전 is_latest = true
 */
async function createNewVersion(
  sourceGuideId: string,
  action: VersionAction,
  changes?: Partial<ExplorationGuide>,
  options?: {
    useAI?: boolean;        // AI가 변형 수행
    targetCareerField?: string;
    targetCurriculum?: string;
    versionNote?: string;
  }
): Promise<ExplorationGuide> {
  // 1. 원본 가이드 복제
  // 2. action에 따라:
  //    - curriculum_update: AI에게 "2022 개정 교육과정 기준으로 갱신" 요청
  //    - career_variant: AI에게 "이 주제를 {targetCareerField} 관점으로 재구성" 요청
  //    - content_improvement: changes 적용 (수동) 또는 AI 보완
  //    - student_customization: 특정 학생 맞춤 (학교 프로그램 반영 등)
  // 3. parent_guide_id = sourceGuideId 설정
  // 4. version 증가, is_latest 갱신
  // 5. status = 'draft' (검증 필요)
}

/**
 * 가이드 버전 이력 조회
 */
async function getVersionHistory(guideId: string): Promise<{
  current: ExplorationGuide;
  versions: { version: number; versionNote: string; createdAt: string; status: string }[];
  parent: ExplorationGuide | null;
  children: ExplorationGuide[];  // 이 가이드에서 파생된 변형들
}> { ... }
```

### CMS.9 딸깍 한 번 UX — 원클릭 워크플로우

```
┌──────────────────────────────────────────────────────────────────┐
│  가이드 제작 (관리자 화면)                                        │
│                                                                    │
│  ┌─ 빠른 생성 ─────────────────────────────────────────────────┐ │
│  │                                                               │ │
│  │  생성 방식:  ● 키워드  ○ PDF 추출  ○ URL  ○ 기존 변형      │ │
│  │                                                               │ │
│  │  과목: [정치와 법 ▼]    계열: [사회계열 ▼]                   │ │
│  │                                                               │ │
│  │  키워드: [헌법재판소의 위헌법률심판 절차와 사회적 영향    ]   │ │
│  │                                                               │ │
│  │                              [ 가이드 생성 ]  ← 딸깍         │ │
│  └───────────────────────────────────────────────────────────────┘ │
│                                                                    │
│  ══ 생성 중... ═══════════════════════════ (SSE 스트리밍) ══════  │
│  ✅ 주제 생성 완료                                                │
│  ✅ 탐구동기 생성 완료                                            │
│  ✅ 탐구이론 4단계 생성 완료                                      │
│  ✅ 탐구고찰/느낀점/요약 생성 완료                                │
│  ✅ 관련도서 4권 + 관련논문 1편 생성 완료                         │
│  ✅ 교과세특 예시 2개 생성 완료                                   │
│  🔍 AI 검증 진행 중...                                            │
│  ✅ AI 검증 완료 — 82점 (경고 2건)                                │
│                                                                    │
│  ┌─ 검증 결과 ──────────────────────────────────────────────────┐ │
│  │  학문적 정확성:  90/100 ✅                                    │ │
│  │  도서/논문:      65/100 ⚠️  관련도서3 실존 확인 필요          │ │
│  │  계열 매칭:      95/100 ✅                                    │ │
│  │  기존 유사도:    25/100 ✅ (중복 없음)                        │ │
│  │  난이도:         88/100 ✅                                    │ │
│  │  세특 예시:      80/100 ⚠️  예시2 글자수 520자→500자 수정    │ │
│  │                                                               │ │
│  │  📋 수동 확인 필요:                                           │ │
│  │  □ 《헌법재판의 이해》, 정재황, 박영사 — 실존 확인           │ │
│  │  □ KCI 논문 "위헌법률심판의 효력..." — URL 유효 확인         │ │
│  └───────────────────────────────────────────────────────────────┘ │
│                                                                    │
│  ┌─ 생성된 가이드 미리보기 ─────────────────────────────────────┐ │
│  │  (리치 텍스트 에디터 — 수식/이미지/서식 지원)                 │ │
│  │  ┌─ 탐구이론 ────────────────────────────────────────────┐   │ │
│  │  │ 1단계: 위헌법률심판의 법적 근거                        │   │ │
│  │  │  헌법 제107조 제1항에 따르면...                         │   │ │
│  │  │  [수식] P(위헌) = \frac{찬성}{재판관수} \geq \frac{2}{3}│   │ │
│  │  │ 2단계: 심판 절차와 결정 유형                            │   │ │
│  │  │  ...                                                    │   │ │
│  │  └──────────────────────────────────────────────────────┘   │ │
│  │                                                               │ │
│  │  [수정]  [재생성]  [승인]  [반려]                             │ │
│  └───────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
```

### CMS.10 UI 컴포넌트 구조

```
app/(admin)/admin/guides/
├── page.tsx                            # 가이드 목록 + 검색/필터
├── create/
│   └── page.tsx                        # 가이드 생성 (원클릭 UI)
├── [id]/
│   ├── page.tsx                        # 가이드 상세/편집
│   └── versions/page.tsx               # 버전 이력
└── _components/
    ── 목록/검색 ──
    ├── GuideListView.tsx               # 목록 (상태별 필터 탭)
    ├── GuideSearchFilter.tsx           # 교과/과목/계열/유형/상태 필터
    ├── GuideStatusBadge.tsx            # draft/reviewing/approved 뱃지
    ├── GuideQualityBadge.tsx           # 품질 등급 + 점수 뱃지
    ── 생성 ──
    ├── GuideGeneratorPanel.tsx         # 원클릭 생성 (5가지 소스)
    ├── GuideGenerationProgress.tsx     # SSE 스트리밍 프로그레스
    ├── GuidePdfExtractor.tsx           # PDF 업로드 → 페이지 선택 → 추출
    ├── GuideUrlExtractor.tsx           # URL 입력 → 기사/논문 추출
    ├── GuideCloneVariant.tsx           # 기존 가이드 선택 → 변형 설정
    ── 편집 ──
    ├── GuideRichEditor.tsx             # 리치 텍스트 에디터 (메인)
    ├── TheoryStageEditor.tsx           # 단계별 탐구이론 편집
    ├── FormulaEditor.tsx               # LaTeX 수식 입력/미리보기
    ├── ImageUploader.tsx               # 단계별 이미지 업로드
    ├── RelatedBookEditor.tsx           # 관련 도서 편집 (수동 확인 체크박스)
    ├── RelatedPaperEditor.tsx          # 관련 논문 편집 (URL 유효성 체크)
    ├── SetekExampleEditor.tsx          # 교과세특 예시 편집 (NEIS 바이트 카운터)
    ── 검증 ──
    ├── AiReviewPanel.tsx               # AI 검증 결과 표시 (항목별 점수)
    ├── AiReviewScoreCard.tsx           # 항목별 점수 카드
    ├── ManualCheckList.tsx             # 수동 확인 체크리스트
    ├── SimilarGuideWarning.tsx         # 유사 가이드 경고 + 링크
    ├── ApprovalActions.tsx             # 승인/반려/재검증 버튼
    ── 버전 ──
    ├── VersionHistoryTimeline.tsx      # 버전 이력 타임라인
    ├── VersionDiffView.tsx             # 두 버전 비교 (diff)
    ├── VersionCreateModal.tsx          # 새 버전 생성 (용도 선택)
    ── 품질 ──
    ├── QualityDashboard.tsx            # 전체 가이드 품질 대시보드
    ├── FeedbackSummary.tsx             # 학생 피드백 요약
    └── UsageAnalytics.tsx              # 사용 통계 (학교별/계열별)
```

### CMS.11 Phase 반영

```
Phase 2.5  탐구DB 이관 (기존)
           + exploration_guides 스키마 확장 (CMS 컬럼)
           + guide_feedback 테이블

Phase 2.6  🆕 가이드 CMS 핵심
           + 가이드 리치 텍스트 에디터 (TheoryStageEditor, FormulaEditor)
           + 관리자 가이드 CRUD UI (목록/상세/편집)
           + 수동 작성 워크플로우 (Access 대체)

Phase 2.7  🆕 AI 생성 + 적대적 검증
           + AI 초안 생성 엔진 (5가지 소스)
           + AI 적대적 검증 엔진
           + 유사도 탐지 엔진 (pg_trgm + AI)
           + 원클릭 생성 UI (GuideGeneratorPanel)
           + SSE 스트리밍 프로그레스

Phase 2.8  🆕 버전 관리 + 품질 시스템
           + 버전 생성/이력/비교 UI
           + 품질 등급 + 학생 피드백 루프
           + 사용 통계 대시보드

Phase 4.5  PDF Import (기존) + 🆕 나침반36.5/과학동아 PDF → 가이드 추출
```

### CMS.12 Access 워크플로우 → 웹 대응표

| Access에서 하던 작업 | 웹 시스템 대응 | 개선점 |
|---------------------|---------------|--------|
| 폼에서 52칸 수동 입력 | **딸깍 1번** → AI 전체 생성 | 작성 시간 30분→2분 |
| 탐구이론1~7 텍스트 칸 | 리치 텍스트 + 단계별 에디터 | 수식/이미지/서식 지원 |
| 학생 배정 → 학생ID 입력 | 학생 검색 → 클릭 배정 | 고유성 자동 체크 |
| 이용현황 → 수동 확인 | 자동 추적 + 대시보드 | 학교별/계열별 실시간 |
| 중복 체크 → 기억/수동 | **AI 유사도 자동 탐지** | 7,836건 대비 자동 비교 |
| 버전 관리 → 파일명 변경 | 버전 이력 + diff | 원본-변형 관계 추적 |
| 품질 관리 → 없음 | **AI 검증 + 학생 피드백** | 데이터 기반 품질 개선 |
| 나침반36.5 → 수작업 추출 | **PDF 업로드 → AI 추출** | 월간지 1권 → 가이드 N건 자동 |

---

## E8. 독서→세특 연계 (피드백 #8)

### E8.1 DB 스키마

#### `student_record_reading_links` (독서 ↔ 세특/창체 연결)

```sql
CREATE TABLE IF NOT EXISTS student_record_reading_links (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reading_id       uuid NOT NULL REFERENCES student_record_reading(id) ON DELETE CASCADE,
  -- 다형 참조
  record_type      varchar(30) NOT NULL
                     CHECK (record_type IN ('setek', 'personal_setek', 'changche')),
  record_id        uuid NOT NULL,
  connection_note  varchar(500),               -- "이 책의 3장 논의를 세특 탐구에 활용"
  created_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE(reading_id, record_type, record_id)
);

CREATE INDEX idx_srrl_reading ON student_record_reading_links(reading_id);
CREATE INDEX idx_srrl_record ON student_record_reading_links(record_type, record_id);
```

### E8.2 활용

- 독서 목록에서 "이 책이 어떤 세특에 반영되었는지" 추적
- 세특 편집 시 "관련 독서" 자동 표시
- 독서가 세특에 연결되지 않은 경우 경고 ("읽었지만 활용하지 않은 책")
- 스토리라인에도 연결 가능 (독서가 스토리라인 강화에 기여)

---

## E9. 면접 예상 질문 — Phase 6.5로 앞당김 (피드백 #9)

### E9.1 근거

면접은 **생기부 기반으로 출제**된다. 세특/창체 내용을 분석하여 예상 질문을 뽑는 것은 역량 분석(Phase 6)과 동시에 해야 할 일이다. 3학년 2학기에야 시작하면 늦다.

### E9.2 DB 스키마

#### `student_record_interview_questions` (면접 예상 질문)

```sql
CREATE TABLE IF NOT EXISTS student_record_interview_questions (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  student_id       uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  -- 출처 (어떤 기록에서 파생된 질문인지)
  source_type      varchar(30)
                     CHECK (source_type IN (
                       'setek', 'personal_setek', 'changche', 'haengteuk',
                       'reading', 'general'
                     )),
  source_id        uuid,                       -- 원본 기록 ID (general이면 NULL)
  -- 질문 내용
  question         text NOT NULL,              -- 예상 질문
  question_type    varchar(30) NOT NULL
                     CHECK (question_type IN (
                       'factual',              -- 사실 확인 ("이 실험의 결과는?")
                       'reasoning',            -- 사고력 ("왜 그런 결론을?")
                       'application',          -- 적용/확장 ("다른 분야에 적용하면?")
                       'value',                -- 가치관 ("이 경험에서 배운 점은?")
                       'controversial'         -- 쟁점 ("반대 의견에 대해?")
                     )),
  suggested_answer text,                       -- 모범 답변 가이드 (키포인트)
  difficulty       varchar(10) DEFAULT 'medium'
                     CHECK (difficulty IN ('easy', 'medium', 'hard')),
  is_ai_generated  boolean NOT NULL DEFAULT false,
  is_reviewed      boolean NOT NULL DEFAULT false,  -- 컨설턴트 검토 여부
  notes            text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_sriq_student ON student_record_interview_questions(student_id);
CREATE INDEX idx_sriq_tenant ON student_record_interview_questions(tenant_id);
CREATE INDEX idx_sriq_source ON student_record_interview_questions(source_type, source_id);
```

### E9.3 AI 면접 질문 생성 (Phase 6.5 통합)

```typescript
// llm/prompts/interviewQuestionGeneration.ts

const SYSTEM_PROMPT = `
당신은 대학 입학 면접 전문가입니다.

학생의 생기부 기록(세특/창체/행특)을 분석하여 면접 예상 질문을 생성합니다.

[질문 유형별 생성 비율]
- 사실 확인(factual): 20% — "이 탐구에서 사용한 방법론은?"
- 사고력(reasoning): 30% — "왜 이 주제를 선택했는가?"
- 적용/확장(application): 20% — "이 결과를 실제 정책에 적용하면?"
- 가치관(value): 15% — "이 경험이 진로 선택에 미친 영향은?"
- 쟁점(controversial): 15% — "반대 의견에 대해 어떻게 생각하는가?"

[출력 형식]
각 질문에 대해:
- question: 예상 질문
- questionType: factual | reasoning | application | value | controversial
- suggestedAnswer: 핵심 답변 포인트 (3-5개)
- difficulty: easy | medium | hard
- sourceContext: 질문이 파생된 기록 내용 요약

[원칙]
- 실제 대학 면접에서 출제될 법한 수준
- 학생의 활동 내용에 근거한 구체적 질문 (범용 질문 X)
- 후속 질문(꼬리질문) 가능성 표시
`;

// 프로바이더: Claude standard (분석 + 질문 설계 품질)
// 입력: 세특/창체 텍스트 + 역량 태그 + 스토리라인
// 출력: InterviewQuestion[] (5~10개)
```

### E9.4 UI 컴포넌트

```
app/(admin)/admin/students/[id]/_components/student-record/
├── InterviewQuestionList.tsx       # 질문 목록 (출처별, 유형별 필터)
├── InterviewQuestionCard.tsx       # 개별 질문 카드 (답변 가이드 토글)
├── InterviewPracticeMode.tsx       # 모의 면접 모드 (질문→타이머→답변 기록)
├── InterviewQuestionGenerator.tsx  # AI 질문 생성 버튼 + 결과 검토
└── InterviewSourceLink.tsx         # 질문↔원본 기록 연결 표시
```

---

## E10. 9등급↔5등급 혼재 처리 (피드백 #10)

### E10.1 기존 인프라

`lib/domains/score/computation.ts`에 이미 구현되어 있음:
- `percentileToGrade9(percentile)` — 9등급 환산
- `percentileToGrade5(percentile)` — 5등급 환산
- `determineGradeSystem(curriculumYear)` — 교육과정 연도 기반 판별

### E10.2 확장 필요사항

```typescript
// lib/domains/student-record/grade-normalizer.ts

/**
 * 9등급↔5등급 상호 환산 (동일 학생 내 학년 간 비교용)
 *
 * 2015 교육과정 (현 고2·3): 9등급
 * 2022 교육과정 (2025 고1~): 5등급
 *
 * 환산 기준: 백분위 기반 정규분포 매핑
 */

// 9등급 → 5등급 환산
const GRADE_9_TO_5_MAP: Record<number, string> = {
  1: 'A',      // 상위 4% → A(상위 10%)
  2: 'A',      // 상위 11% → A
  3: 'B',      // 상위 23% → B(상위 34%)
  4: 'B',      // 상위 40% → B~C 경계
  5: 'C',      // 상위 60% → C(상위 66%)
  6: 'C',      // 상위 77% → C~D 경계
  7: 'D',      // 상위 89% → D(상위 90%)
  8: 'D',      // 상위 96% → D~E 경계
  9: 'E',      // 상위 100% → E
};

// 5등급 → 9등급 근사 환산 (범위)
const GRADE_5_TO_9_MAP: Record<string, { min: number; max: number; typical: number }> = {
  'A': { min: 1, max: 2, typical: 2 },    // A → 1~2등급, 대표값 2
  'B': { min: 3, max: 4, typical: 3 },    // B → 3~4등급, 대표값 3
  'C': { min: 4, max: 6, typical: 5 },    // C → 4~6등급, 대표값 5
  'D': { min: 7, max: 8, typical: 7 },    // D → 7~8등급, 대표값 7
  'E': { min: 8, max: 9, typical: 9 },    // E → 8~9등급, 대표값 9
};

type NormalizedGrade = {
  original: string;             // 원래 등급 (예: "2" or "B")
  gradeSystem: 5 | 9;          // 원래 등급 체계
  normalizedTo9: number | null; // 9등급 환산값
  normalizedTo5: string | null; // 5등급 환산값
  percentileRange: [number, number]; // 백분위 범위
  displayLabel: string;         // UI 표시용 (예: "2등급(≈A)")
};

/**
 * 학년 간 성적 비교 시 등급 정규화
 */
function normalizeGradeForComparison(
  grade: number | string,
  curriculumYear: number
): NormalizedGrade { ... }
```

### E10.3 ScoreSummaryView 확장

```
┌──────────────────────────────────────────────┐
│  학년별 성적 비교 (등급 정규화)               │
│                                                │
│          1학년 (5등급)  2학년 (9등급)  비교    │
│  국어     B(≈3등급)     2등급          ↗ 개선  │
│  수학     C(≈5등급)     4등급          ↗ 개선  │
│  영어     A(≈2등급)     3등급          ↘ 하락  │
│                                                │
│  ⓘ 1학년은 2022 교육과정(5등급제),             │
│    2학년은 2015 교육과정(9등급제)입니다.        │
│    비교를 위해 백분위 기준 환산했습니다.        │
└──────────────────────────────────────────────┘
```

---

## E11. NEIS 바이트 카운팅 보정 (피드백 #11)

### E11.1 문제

```sql
content_bytes integer GENERATED ALWAYS AS (octet_length(content)) STORED
```

`octet_length`는 PostgreSQL UTF-8 바이트. NEIS는 역사적으로 **EUC-KR 기반** 바이트 계산을 사용할 수 있다. 대부분의 경우 한글은 UTF-8(3B) = EUC-KR(2B)이므로 차이 발생.

### E11.2 해결

```typescript
// lib/domains/student-record/validation.ts

/**
 * NEIS 바이트 계산 (EUC-KR 기준)
 *
 * NEIS 2.0 이후 내부적으로 UTF-8을 사용하지만,
 * 글자수 제한은 여전히 "한글 1자 = 3바이트" 기준으로 운영.
 * (교육부 2019년 글자수 산정 기준 문서 참조)
 *
 * 따라서 UTF-8 octet_length와 동일.
 * 단, 일부 특수문자(이모지 등)는 UTF-8에서 4B이지만
 * NEIS에서는 입력 자체가 불가하므로 무시.
 */
function countNeisBytes(text: string): number {
  let bytes = 0;
  for (const char of text) {
    const code = char.codePointAt(0)!;
    if (code >= 0xAC00 && code <= 0xD7A3) bytes += 3;      // 한글 완성형 → 3B
    else if (code >= 0x3131 && code <= 0x318E) bytes += 3;  // 한글 자모 → 3B
    else if (code >= 0x4E00 && code <= 0x9FFF) bytes += 3;  // CJK 한자 → 3B
    else if (code >= 0xFF01 && code <= 0xFF5E) bytes += 3;  // 전각 특수문자 → 3B
    else if (code === 0x000D || code === 0x000A) bytes += 1; // CR/LF → 1B
    else if (code <= 0x007F) bytes += 1;                     // ASCII → 1B
    else if (code >= 0x10000) bytes += 4;                    // 4B 문자 (이모지) → 경고
    else bytes += 3;                                          // 기타 → 3B (안전 쪽)
  }
  return bytes;
}

/**
 * NEIS 입력 불가 문자 필터링
 * NEIS에서 입력 불가한 문자(이모지, 특수 유니코드)를 감지하여 경고
 */
function detectNeisInvalidChars(text: string): { char: string; position: number }[] {
  const invalid: { char: string; position: number }[] = [];
  let i = 0;
  for (const char of text) {
    const code = char.codePointAt(0)!;
    if (code >= 0x10000) {  // 4B 이상 문자 (이모지 등)
      invalid.push({ char, position: i });
    }
    i++;
  }
  return invalid;
}
```

### E11.3 DB Generated Column 유지 판단

`octet_length(content)`는 UTF-8 바이트를 반환하며, NEIS의 현행 기준(한글 3B)과 일치한다. **Generated column 유지**하되, 앱 레벨에서 `countNeisBytes()` 함수로 이중 검증하고, NEIS 입력 불가 문자는 별도 경고한다.

---

## E12. 입시 데이터 갱신 사이클 (피드백 #12)

### E12.1 연간 4단계 갱신 워크플로우

```
┌─────────────────────────────────────────────────────┐
│  입시 데이터 연간 갱신 사이클                        │
│                                                       │
│  4~5월   수시 요강 확정 → 1차 갱신 (전형/모집인원)   │
│  ├─ 소스: adiga.kr + 대학별 요강 PDF                 │
│  ├─ 작업: 전형 변경사항 반영, 신설/폐지 처리          │
│  └─ 트리거: 관리자 "수시 요강 갱신" 버튼             │
│                                                       │
│  8~9월   수시 접수 시 변경 → 2차 갱신                 │
│  ├─ 소스: 에듀엣톡 수작업 검증 Excel                  │
│  ├─ 작업: 최종 모집인원, 경쟁률 예측, 최저 변경       │
│  └─ 트리거: Excel 업로드 → diff → upsert             │
│                                                       │
│  11~12월 정시 요강 확정 → 3차 갱신                    │
│  ├─ 소스: 대학별 정시 요강 + 환산 공식                │
│  ├─ 작업: 환산 공식, 반영비율, 결격사유 갱신          │
│  └─ 트리거: university_score_formulas upsert          │
│                                                       │
│  1~2월   최종 결과 + 추가모집 → 4차 갱신              │
│  ├─ 소스: 합격자 발표 + 추가모집 공고                 │
│  ├─ 작업: 경쟁률 확정, 입결 갱신, 충원 데이터          │
│  └─ 트리거: 최종 입결 Excel 업로드                    │
└─────────────────────────────────────────────────────┘
```

### E12.2 갱신 이력 테이블

```sql
-- university_admissions, university_score_formulas의 갱신 이력
-- 별도 테이블 불필요: 기존 updated_at + 관리자 UI 로그로 충분
-- 대신 갱신 메타데이터를 JSONB로 추적

ALTER TABLE university_admissions
  ADD COLUMN IF NOT EXISTS update_source varchar(50),
  -- 'adiga_pdf' | 'manual_excel' | 'datagokr_api' | 'manual_input'
  ADD COLUMN IF NOT EXISTS update_cycle varchar(20);
  -- 'spring_1st' | 'fall_2nd' | 'winter_3rd' | 'final_4th'
```

### E12.3 관리자 UI

```
app/(admin)/admin/admission-data/
├── page.tsx                        # 데이터 현황 대시보드
├── _components/
│   ├── DataFreshnessIndicator.tsx  # 마지막 갱신일 + 다음 갱신 예정
│   ├── UpdateCycleTimeline.tsx     # 4단계 사이클 표시
│   ├── BulkUploadModal.tsx         # Excel/PDF 업로드 → diff → upsert
│   └── ChangelogView.tsx           # 갱신 이력 (무엇이, 몇 건 변경)
```

---

## E13. 졸업생 매칭 간소화 (피드백 #13)

### E13.1 변경

| 기존 (Phase 8.6) | 변경 후 |
|-------------------|---------|
| Python ML API (`alumni-matcher.ts`) | **SQL 조건 검색** |
| `/api/analysis/compare` 외부 호출 | **Server Action 내부 처리** |
| 별도 ML 서비스 배포 필요 | 추가 인프라 불필요 |

### E13.2 SQL 기반 졸업생 검색

```typescript
// lib/domains/student-record/alumni-search.ts

type AlumniSearchParams = {
  // 필터 조건
  schoolCategory?: SchoolCategory;         // 학교 유형 (일반고/자사고 등)
  gradeRange?: { min: number; max: number }; // 전체 평균등급 범위
  majorGradeRange?: { min: number; max: number }; // 전공교과 평균등급
  careerField?: string;                    // 계열
  targetUniversity?: string;               // 대학명
  admissionType?: string;                  // 전형 유형
  graduationYearRange?: { min: number; max: number };
};

type AlumniSearchResult = {
  studentId: string;
  studentName: string;          // 마스킹 처리 (이○은)
  schoolName: string;
  graduationYear: number;
  overallAvgGrade: number;
  majorAvgGrade: number;
  applications: {
    universityName: string;
    department: string;
    round: string;
    result: 'accepted' | 'rejected' | 'waitlisted';
  }[];
  similarityScore: number;     // 현재 학생과의 유사도 (0~100)
};

/**
 * SQL 기반 졸업생 검색
 * 84명 규모에서는 Python ML 불필요 → SQL 조건 필터링으로 충분
 * 수천 명 규모 도달 시 ML 검토 (Phase 10+)
 */
async function searchAlumni(
  currentStudentId: string,
  params: AlumniSearchParams
): Promise<AlumniSearchResult[]> {
  // 1. student_record_applications (result='accepted') JOIN students
  // 2. 조건 필터링 (학교유형, 성적대, 계열, 대학)
  // 3. 현재 학생과의 유사도 = 가중 거리 계산 (SQL CASE WHEN)
  //    - 학교유형 일치: +20
  //    - 전체평균 ±0.5 이내: +30
  //    - 전공평균 ±0.5 이내: +30
  //    - 동일 계열: +20
  // 4. 유사도 내림차순 정렬, LIMIT 20
}
```

### E13.3 규모 확장 기준

> **84명 → SQL 검색 (현재)**
> **500명+ → 인덱스 최적화 + materialized view**
> **2,000명+ → ML 검토 (벡터 유사도 등)**

현재 단계에서 Python ML API는 삭제. `alumni-matcher.ts`는 순수 TypeScript + SQL로 구현.

---

## E14. Phase 재배치 (종합, v6)

### 생기부 트랙 — Phase 세분화

```
Phase 1a  🔧 DB: 핵심 기록 6개 (seteks, personal_seteks, changche,
          haengteuk, reading, subject_pairs)
          + RLS + updated_at 트리거
          + 다형 참조 정리 트리거 (cleanup_polymorphic_refs)
          → 마이그레이션: 001_core_records.sql (독립 rollback 가능)

Phase 1b  🔧 DB: 보조 기록 5개 (attendance, awards, volunteer,
          disciplinary, applications)
          + applications round 세분화 (학종/교과/논술/정시 가나다)
          + 면접일(interview_date), 가채점/실채점(score_type) 컬럼
          + RLS + 트리거
          → 마이그레이션: 002_supplementary_records.sql (독립 rollback)

Phase 1c  🔧 DB: 확장 기능 8개 (storylines, storyline_links,
          roadmap_items, reading_links, interview_questions,
          min_score_targets, min_score_simulations, school_profiles)
          + school_offered_subjects junction (JSONB 대체)
          + RLS + 트리거
          → 마이그레이션: 003_extended_features.sql (1a 이후 가능)

Phase 2   도메인 레이어 (기존 + grade-normalizer, min-score-simulator,
          alumni-search, school-profile, NEIS 바이트 보정,
          interview-conflict-checker)
          + 🆕 자동 테스트: validation 30+, simulator 20+,
            normalizer 15+, calculator 25+ (결정론적 엔진 100% 커버)

Phase 3   관리자 UI 기록 탭 (탭별 lazy loading)
          + 🆕 스토리라인 트래커 UI
          + 🆕 선제적 로드맵 UI
          + 🆕 독서→세특 연계 UI
          + 🆕 9등급↔5등급 정규화 표시

Phase 3.5 P2 기록 UI (수상/봉사/징계) + 지원결과 탭
          + 🆕 수시 6장 카드 UI + 정시 군별 UI
          + 🆕 면접일 겹침 체크 경고

Phase 4   학생 뷰 (읽기전용)
          + 🆕 학부모 생기부 뷰
          + 🆕 수능최저 시뮬레이션 UI ← (Phase 8.5에서 앞당김)
          + 🆕 고교 프로파일 뷰 (school_offered_subjects 연동)
          + 🆕 재수생 전용 뷰 (수능 중심 대시보드)

Phase 4.5 PDF Import (기존, 변경 없음)

Phase 5   진단 DB + 도메인 + 교과이수적합도 (기존)
          교과이수적합도: 🆕 school_offered_subjects junction 연동
            (학교 미개설 과목 = "이수불가" 별도 표시)
          + 🆕 RLS 통합 테스트 20+

Phase 5.5 AI 역량 태그 자동 제안 (기존)
          + 🆕 AI 응답 파싱 테스트 10+

Phase 6   진단 탭 + AI 종합 진단 (기존)
          + 🆕 AI 스토리라인 분석 제안

Phase 6.5 조기 경보 확장 (기존)
          + 🆕 스토리라인 경고 (weak, gap, inconsistent)
          + 🆕 수능최저 경고 (critical, bottleneck, trend_down)
          + 🆕 AI 면접 예상 질문 생성 ← (Phase 10에서 앞당김)

Phase 7   보완전략 + AI 제안 (기존, 변경 없음)

Phase 8.1 대학 입시 DB 이관 (기존 + 갱신 메타데이터 컬럼
          + 🆕 교과전형 grade_weight JSONB 구조화)
Phase 8.2 정시 환산 엔진 (기존 + 🆕 자동 테스트 25+)
Phase 8.3 data.go.kr API (기존, 변경 없음)
Phase 8.4 연간 갱신 (기존 + 🆕 4단계 갱신 사이클 UI
          + 🆕 전형 변경 알림 — 목표 대학 전형 변경 시 push)
Phase 8.5 모평 배치 자동 분석 (기존)
          + 🆕 가채점/실채점 분리 배치
          + 🆕 수시 6장 최적 배분 시뮬레이션 엔진
Phase 8.6 졸업생 검색 (🆕 SQL 기반으로 간소화, Python ML 삭제)

Phase 9   🆕 AI 활동 지원 3모드:
          + 모드 A: 학생→교사 활동 요약서 AI 생성 (Claude standard)
          + 모드 B: 컨설턴트 내부 세특 방향 가이드 (Claude standard)
          + 모드 C: 학생 직접 활동 가이드 (탐구DB 원본 전달, AI 불필요)
          + 수시 Report 자동 생성

Phase 10  버전 이력, 일괄 상태 변경
          + 🆕 ML 졸업생 매칭 (규모 확장 시 재검토)
```

### CMS 트랙 (독립)

```
Phase C1  DB: 탐구DB 이관 — exploration_guides 3분할 (meta/content/review)
          + guide_assignments, guide_usage_history
          + Access 7,836건 마이그레이션 + 과목명 매칭
          → 마이그레이션: C01_guide_tables.sql

Phase C2  가이드 CMS 핵심: 리치 텍스트 에디터 (수식/이미지/단계별)
          + 관리자 가이드 CRUD UI (Access 대체)
          + 수동 작성 워크플로우

Phase C3  AI 생성 + 적대적 검증
          + 5가지 소스 AI 초안 생성 (키워드/PDF/URL/복제/혼합)
          + AI 적대적 검증 엔진 (6개 항목 자동 채점)
          + 유사도 탐지 (pg_trgm + AI 의미 비교)
          + 원클릭 생성 UI + SSE 프로그레스

Phase C4  버전 관리 + 품질 시스템 + guide_feedback 테이블
          + 버전 생성/이력/diff 비교
          + 품질 등급 + 학생 피드백 루프 + 사용 통계

Phase C5  학생 APP 가이드 뷰 + 모드 A/B/C AI 생성
          + 가이드 ↔ 생기부 기록 연동
```

> CMS 트랙은 생기부 트랙 Phase 3 이후 착수 가능. 인터페이스(guide_assignments ↔ 생기부)만 공유.

### 변경 전후 비교 (v6 보완 포함)

| 항목 | 기존 Phase | 변경 Phase | 이유 |
|------|-----------|-----------|------|
| 스토리라인 | 없음 | **3** | 학종 핵심, 기록과 동시 필요 |
| 선제적 로드맵 | 없음 | **3** | 기록 시점에 계획 대비 |
| 고교 프로파일 | 없음 | **1c+4** | 교과이수적합도 전제 |
| 수능최저 시뮬레이션 | 8.5 (메모) | **4** | 수시 전략의 50% |
| 전형 세분화 | 1 (부실) | **1b** (보강) | DB 설계 시점에 반영 |
| 학부모 뷰 | 없음 | **4** | 학생 뷰와 동시 |
| 독서→세특 연계 | 없음 | **3** | 기록 연결의 일부 |
| 면접 예상 질문 | 10 | **6.5** | 역량 분석과 동시 |
| 세특 AI → 활동요약서 | 9 | **9** (리네이밍) | 윤리적 포지셔닝 |
| 졸업생 ML → SQL | 8.6 (Python) | **8.6** (SQL) | 오버엔지니어링 제거 |
| 갱신 사이클 | 8.4 (연 1회) | **8.4** (연 4회) | 현장 실제 사이클 |
| **Phase 1 분할** | 19개 한 번에 | **1a/1b/1c** | 마이그레이션 위험 분산 |
| **CMS 트랙 분리** | Phase 2.5~2.8 | **C1~C5** (독립) | 별도 프로젝트 규모 |
| **면접일 겹침** | 없음 | **3.5** | 수시 6장 실전 필수 |
| **교과전형 산출** | 없음 | **8.1** | 교과전형도 1급 시민 |
| **가채점/실채점** | 없음 | **8.5** | 정시 필수 구분 |
| **6장 최적 배분** | UI 표시만 | **8.5** (엔진) | 입결 기반 추천 |
| **전형 변경 알림** | 없음 | **8.4** | 목표 대학 변경 push |
| **재수생 관리** | 없음 | **4** | 정시 전용 뷰 |
| **테스트 자동화** | 수동만 | **2** (엔진 100%) | 결정론적 코드 검증 |
| **탭별 lazy load** | full JOIN | **3** (분리) | 초기 로딩 1/3 |

### 신규 DB 테이블 총괄 (기존 17 + 신규 14 = 31개)

| # | 테이블 | 용도 | Phase | 트랙 |
|---|--------|------|-------|------|
| 18 | `student_record_storylines` | 스토리라인 정의 | 1c | 생기부 |
| 19 | `student_record_storyline_links` | 활동↔스토리라인 연결 | 1c | 생기부 |
| 20 | `student_record_roadmap_items` | 선제적 로드맵 (계획+실행) | 1c | 생기부 |
| 21 | `student_record_reading_links` | 독서↔세특 연결 | 1c | 생기부 |
| 22 | `student_record_interview_questions` | 면접 예상 질문 | 1c | 생기부 |
| 23 | `student_record_min_score_targets` | 수능최저 목표 | 1c | 생기부 |
| 24 | `student_record_min_score_simulations` | 최저 시뮬레이션 캐시 | 1c | 생기부 |
| 25 | `school_profiles` | 고교 프로파일 | 1c | 생기부 |
| 26 | `school_offered_subjects` | **학교 개설 과목 (junction, JSONB 대체)** | 1c | 생기부 |
| 27 | `exploration_guides` | **탐구DB 메타 (3분할)** | C1 | CMS |
| 28 | `exploration_guide_content` | **탐구DB 콘텐츠 (3분할)** | C1 | CMS |
| 29 | `exploration_guide_reviews` | **탐구DB CMS/검증 (3분할)** | C1 | CMS |
| 30 | `guide_assignments` | 학생별 가이드 배정+이용 추적 | C1 | CMS |
| 31 | `guide_usage_history` | 학교별 주제 고유성 추적 (3년) | C1 | CMS |
| (32) | `guide_feedback` | 학생 피드백 (품질 개선) | C4 | CMS |

### 신규 도메인 파일 구조

```
lib/domains/student-record/
├── ... (기존 파일)
├── storyline-repository.ts          # 스토리라인 CRUD
├── roadmap-repository.ts            # 로드맵 CRUD
├── min-score-simulator.ts           # 수능최저 시뮬레이션 엔진
├── min-score-simulator.test.ts      # 🆕 시뮬레이션 자동 테스트 20+
├── grade-normalizer.ts              # 9등급↔5등급 환산
├── grade-normalizer.test.ts         # 🆕 환산 자동 테스트 15+
├── alumni-search.ts                 # 졸업생 SQL 검색 (ML 대체)
├── school-profile-repository.ts     # 고교 프로파일 CRUD
├── interview-conflict-checker.ts    # 🆕 면접일 겹침 체크
├── validation.test.ts               # 🆕 NEIS 바이트 자동 테스트 30+
├── guide/                           # 탐구 가이드 시스템
│   ├── guide-repository.ts          # exploration_guides CRUD + 검색
│   ├── assignment-repository.ts     # guide_assignments CRUD
│   ├── uniqueness-checker.ts        # 주제 고유성 엔진 (학교/계열 3년 체크)
│   ├── guide-recommender.ts         # 학생 조건 기반 가이드 추천
│   └── migration/                   # Access DB → Supabase 이관
│       ├── export-access.ts         # mdb-export CSV 파싱
│       ├── transform.ts             # CSV → JSON 정제
│       └── import.ts                # bulk insert + 과목 매칭
├── llm/
│   ├── prompts/
│   │   ├── ... (기존)
│   │   ├── storylineAnalysis.ts     # AI 스토리라인 분석
│   │   ├── interviewQuestionGeneration.ts # AI 면접 질문
│   │   ├── activitySummaryForTeacher.ts   # 모드 A: 학생→교사 활동 요약서
│   │   └── setekDirectionGuide.ts         # 모드 B: 컨설턴트 세특 방향
│   └── actions/
│       ├── ... (기존)
│       ├── suggestStorylines.ts     # AI 스토리라인 제안
│       ├── generateInterviewQuestions.ts # AI 면접 질문 생성
│       ├── generateActivitySummary.ts    # 모드 A: 활동 요약서 생성
│       └── generateSetekDirection.ts     # 모드 B: 세특 방향 가이드 생성
├── warnings/
│   └── recordWarnings.ts            # 확장: 스토리라인 + 최저 경고 추가
├── actions/
│   ├── ... (기존)
│   ├── storyline.ts                 # "use server" 스토리라인 CRUD
│   ├── roadmap.ts                   # "use server" 로드맵 CRUD
│   ├── min-score.ts                 # "use server" 최저 시뮬레이션
│   ├── interview.ts                 # "use server" 면접 질문 CRUD
│   ├── school-profile.ts           # "use server" 고교 프로파일
│   ├── guide.ts                     # "use server" 가이드 검색/배정/이용
│   └── guide-ai.ts                  # "use server" 모드 A/B AI 생성
```

### 신규 UI 컴포넌트 총괄 (+80개+)

```
── 스토리라인 (5개) ──
StorylineManager.tsx, StorylineTimeline.tsx, StorylineStrengthBadge.tsx,
StorylineSuggestionPanel.tsx, OrphanedActivityAlert.tsx

── 로드맵 (6개) ──
RoadmapPlanEditor.tsx, RoadmapExecutionEditor.tsx, RoadmapComparisonView.tsx,
RoadmapMatchRateChart.tsx, CourseSelectionPlanner.tsx, RoadmapDeviationAlert.tsx

── 수능최저 (5개) ──
MinScoreTargetEditor.tsx, MinScoreSimulationView.tsx, MinScoreBottleneckChart.tsx,
MinScoreWhatIfPanel.tsx, MinScoreExamSelector.tsx

── 면접 (5개) ──
InterviewQuestionList.tsx, InterviewQuestionCard.tsx, InterviewPracticeMode.tsx,
InterviewQuestionGenerator.tsx, InterviewSourceLink.tsx

── 학부모 (8개) ──
ParentRecordDashboard.tsx, ParentScoreTrend.tsx, ParentMockScoreTrend.tsx,
ParentMinScoreStatus.tsx, ParentCompetencySummary.tsx, ParentStorylineSummary.tsx,
ParentRoadmapProgress.tsx, ParentStrategyOverview.tsx

── 고교 프로파일 (2개) ──
SchoolProfileEditor.tsx, SchoolProfileSummary.tsx

── 입시 데이터 갱신 (3개) ──
DataFreshnessIndicator.tsx, UpdateCycleTimeline.tsx, ChangelogView.tsx

── 탐구 가이드 시스템: 관리자 (7개) ──
GuideSearchFilter.tsx, GuideDetailView.tsx, GuideAssignButton.tsx,
GuideUniquenessWarning.tsx, GuideUsageStats.tsx,
GuideAssignmentList.tsx, GuideAssignmentModal.tsx

── 탐구 가이드 시스템: AI 모드 (3개) ──
ActivitySummaryGenerator.tsx (모드A), SetekDirectionPanel.tsx (모드B),
GuideToRecordLinker.tsx

── 탐구 가이드 시스템: 학생 APP (3개) ──
StudentGuideView.tsx (모드C), StudentNoteEditor.tsx, StudentGuideSubmit.tsx

── 가이드 CMS: 생성 (6개) ──
GuideGeneratorPanel.tsx, GuideGenerationProgress.tsx, GuidePdfExtractor.tsx,
GuideUrlExtractor.tsx, GuideCloneVariant.tsx, GuideRichEditor.tsx

── 가이드 CMS: 편집 (6개) ──
TheoryStageEditor.tsx, FormulaEditor.tsx, ImageUploader.tsx,
RelatedBookEditor.tsx, RelatedPaperEditor.tsx, SetekExampleEditor.tsx

── 가이드 CMS: 검증 (5개) ──
AiReviewPanel.tsx, AiReviewScoreCard.tsx, ManualCheckList.tsx,
SimilarGuideWarning.tsx, ApprovalActions.tsx

── 가이드 CMS: 버전/품질 (6개) ──
VersionHistoryTimeline.tsx, VersionDiffView.tsx, VersionCreateModal.tsx,
QualityDashboard.tsx, FeedbackSummary.tsx, UsageAnalytics.tsx

── 가이드 CMS: 목록 (4개) ──
GuideListView.tsx, GuideStatusBadge.tsx, GuideQualityBadge.tsx, GuideSearchFilter.tsx
```

---

## E15. 검증 방법 (확장분)

### 스토리라인 (Phase 3)
1. 스토리라인 생성 → 키워드 + 계열 연결 → 활동 드래그앤드롭 연결
2. 학년 간 타임라인 시각화 → 연결된 활동 클릭 시 원본 이동
3. strength 판단: 연결된 활동 수 + 학년 분포로 자동 계산
4. 고아 활동(어디에도 연결 안 된 것) 경고 표시

### 선제적 로드맵 (Phase 3)
5. 3년치 계획 입력 (그리드 형태) → 영역별/학년별 작성
6. 실행 결과 기록 → 계획과 연결 → match_rate 산출
7. 계획 vs 실행 비교 뷰 → 일치율 < 50% 항목 하이라이트
8. 교과 이수 경로: 계획 과목 vs 실제 이수 과목 비교

### 수능최저 시뮬레이션 (Phase 4)
9. 목표 대학별 최저 조건 입력 (구조화된 JSON)
10. 모평 선택 → 자동 시뮬레이션 → 충족/미달 표시
11. what-if: "수학이 2등급이면?" → 추가 충족 대학 표시
12. bottleneck 과목 시각화: "수학이 3개 대학의 미달 원인"

### 학부모 뷰 (Phase 4)
13. 학부모 로그인 → 자녀 선택 → 생기부 대시보드 표시
14. 성적 추이, 모평 추이, 최저 충족 현황 → 읽기전용
15. 세특/창체 원문, AI 진단 원문 → 접근 불가 확인

### 면접 예상 질문 (Phase 6.5)
16. AI 질문 생성 → 유형별(사실/사고력/적용/가치/쟁점) 분류 표시
17. 각 질문 ↔ 원본 기록 연결 확인
18. 모의 면접 모드: 질문 → 타이머 → 답변 기록

### 9등급↔5등급 (Phase 3)
19. 동일 학생 1학년(5등급) + 2학년(9등급) → 학년 간 비교 시 환산 표시
20. 환산 주석: "5등급제(B) ≈ 9등급제(3등급)" 표시

---

## E16. exploration_guides 테이블 3분할 (보완 #18)

### E16.1 문제

기존 `exploration_guides`는 Access DB 52컬럼 + CMS 확장 = **60+ 컬럼**으로, 단일 테이블 유지보수가 극도로 어렵다. SELECT 시 불필요한 대량 컬럼 로드, 인덱스 비대화, 스키마 변경 시 리스크 증가.

### E16.2 3분할 설계

```
exploration_guides (메타)          1:1   exploration_guide_content (콘텐츠)
       │                                          │
       │ 1:1                                      │
       └── exploration_guide_reviews (CMS/검증)    │
                                                   │
  검색/필터 → exploration_guides                   │
  상세 보기 → JOIN content                         │
  CMS 관리 → JOIN reviews                         │
```

#### `exploration_guides` (메타 — 검색/필터 전용, ~20컬럼)

```sql
CREATE TABLE IF NOT EXISTS exploration_guides (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_id        integer,
  guide_type       varchar(30) NOT NULL
                     CHECK (guide_type IN (
                       'subject_performance', 'experiment',
                       'topic_exploration', 'reading', 'program'
                     )),
  curriculum_years  text[] DEFAULT '{}',
  subject_areas     text[] DEFAULT '{}',
  subject_names     text[] DEFAULT '{}',
  unit_major        varchar(200),
  unit_minor        varchar(200),
  career_fields     text[] DEFAULT '{}',
  departments       text[] DEFAULT '{}',
  title             text NOT NULL,
  -- 독서 정보 (간략)
  book_title        varchar(300),
  book_author       varchar(200),
  -- 관리
  status           varchar(20) NOT NULL DEFAULT 'draft'
                     CHECK (status IN (
                       'draft', 'ai_reviewing', 'review_failed',
                       'pending_approval', 'approved', 'archived'
                     )),
  source_type      varchar(30) DEFAULT 'manual',
  parent_guide_id  uuid REFERENCES exploration_guides(id) ON DELETE SET NULL,
  version          integer NOT NULL DEFAULT 1,
  is_latest        boolean NOT NULL DEFAULT true,
  usage_count      integer DEFAULT 0,
  registered_by    varchar(100),
  registered_at    timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_eg_type ON exploration_guides(guide_type);
CREATE INDEX idx_eg_subjects ON exploration_guides USING GIN(subject_names);
CREATE INDEX idx_eg_careers ON exploration_guides USING GIN(career_fields);
CREATE INDEX idx_eg_status ON exploration_guides(status);
CREATE INDEX idx_eg_title_trgm ON exploration_guides USING gin(title gin_trgm_ops);
```

#### `exploration_guide_content` (콘텐츠 — 상세 보기 시 JOIN)

```sql
CREATE TABLE IF NOT EXISTS exploration_guide_content (
  guide_id         uuid PRIMARY KEY REFERENCES exploration_guides(id) ON DELETE CASCADE,
  motivation       text,
  theory           text,
  theory_sections  jsonb DEFAULT '[]',
  reflection       text,
  impression       text,
  summary          text,
  follow_up        text,
  -- 독서 상세
  book_publisher   varchar(200),
  book_year        integer,
  book_description text,
  -- 참고 자료
  related_papers   jsonb DEFAULT '[]',
  related_books    text[] DEFAULT '{}',
  -- 교과세특 예시 (컨설턴트 전용)
  setek_example_1  text,
  setek_example_2  text,
  -- 이미지
  image_paths      text[] DEFAULT '{}',
  guide_url        text,
  -- 관리
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);
```

#### `exploration_guide_reviews` (CMS — 검증/품질 관리)

```sql
CREATE TABLE IF NOT EXISTS exploration_guide_reviews (
  guide_id         uuid PRIMARY KEY REFERENCES exploration_guides(id) ON DELETE CASCADE,
  -- AI 검증
  ai_review_score  integer CHECK (ai_review_score BETWEEN 0 AND 100),
  ai_review_result jsonb,
  ai_reviewed_at   timestamptz,
  -- 승인
  approved_by      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at      timestamptz,
  rejection_reason text,
  -- 품질
  quality_tier     varchar(30) DEFAULT 'ai_draft'
                     CHECK (quality_tier IN (
                       'expert_authored', 'expert_reviewed',
                       'ai_reviewed_approved', 'ai_draft'
                     )),
  quality_score    numeric(4,1) DEFAULT 0,
  feedback_count   integer DEFAULT 0,
  -- 소스
  source_reference text,
  version_note     text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);
```

### E16.3 조회 패턴

```typescript
// 목록 (검색/필터): exploration_guides만 조회
const guides = await supabase
  .from('exploration_guides')
  .select('id, title, guide_type, subject_names, career_fields, status, usage_count')
  .eq('status', 'approved');

// 상세 보기: content JOIN
const guide = await supabase
  .from('exploration_guides')
  .select('*, exploration_guide_content(*)')
  .eq('id', guideId)
  .single();

// CMS 관리: reviews JOIN
const guideWithReview = await supabase
  .from('exploration_guides')
  .select('*, exploration_guide_reviews(*)')
  .eq('id', guideId)
  .single();
```

---

## E17. school_profiles JSONB → junction 테이블 분리 (보완 #28)

### E17.1 문제

`school_profiles.offered_subjects`가 JSONB이면:
- `subjects` 테이블과의 FK 무결성 없음
- "이 과목을 개설하는 학교 목록" 역방향 쿼리 비효율
- 교과이수적합도 계산 시 JSONB 파싱 오버헤드

### E17.2 `school_offered_subjects` junction 테이블

```sql
CREATE TABLE IF NOT EXISTS school_offered_subjects (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_profile_id uuid NOT NULL REFERENCES school_profiles(id) ON DELETE CASCADE,
  subject_id       uuid NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  grades           integer[] NOT NULL DEFAULT '{}',     -- {2, 3}
  semesters        integer[] NOT NULL DEFAULT '{}',     -- {1, 2}
  is_elective      boolean DEFAULT true,                -- 선택과목 여부
  notes            varchar(200),
  UNIQUE(school_profile_id, subject_id)
);

CREATE INDEX idx_sos_school ON school_offered_subjects(school_profile_id);
CREATE INDEX idx_sos_subject ON school_offered_subjects(subject_id);
```

### E17.3 school_profiles 수정

`offered_subjects jsonb` → 삭제. `programs`, `notable_alumni`는 빈도 낮은 참조 데이터이므로 JSONB 유지.

```sql
-- school_profiles에서 offered_subjects 컬럼 제거
-- programs, avg_grade_trend, notable_alumni는 JSONB 유지 (검색 대상 아님)
ALTER TABLE school_profiles DROP COLUMN IF EXISTS offered_subjects;
```

### E17.4 교과이수적합도 연동

```typescript
// course-adequacy.ts에서 school_offered_subjects 활용
async function calculateCourseAdequacy(studentId: string): Promise<CourseAdequacyResult> {
  const student = await getStudent(studentId);
  const recommended = MAJOR_RECOMMENDED_COURSES[student.targetMajor];

  // 학교에서 개설하는 과목 목록 조회 (junction 테이블)
  const offeredSubjects = await getSchoolOfferedSubjects(student.schoolProfileId);
  const offeredSubjectIds = new Set(offeredSubjects.map(s => s.subjectId));

  // 추천 과목 중 학교 미개설 과목 식별
  const notOffered = recommended.filter(r => !offeredSubjectIds.has(r.subjectId));

  return {
    totalRecommended: recommended.length,
    taken: ...,
    notTaken: ...,
    notOfferedBySchool: notOffered, // "학교 미개설" → 학생 탓 아님
    adequacyScore: ...,
  };
}
```

---

## E18. 면접일 겹침 체크 + 전형 캘린더 (보완 #22)

### E18.1 겹침 감지 로직

```typescript
// lib/domains/student-record/interview-conflict-checker.ts

type InterviewConflict = {
  applicationId1: string;
  applicationId2: string;
  university1: string;
  university2: string;
  conflictDate: string;
  severity: 'critical' | 'warning';  // 동일일=critical, 전일=warning
};

/**
 * 수시 지원 6장의 면접일 겹침 체크
 */
function checkInterviewConflicts(applications: Application[]): InterviewConflict[] {
  const earlyApps = applications.filter(a => a.round.startsWith('early_'));
  const conflicts: InterviewConflict[] = [];

  for (let i = 0; i < earlyApps.length; i++) {
    for (let j = i + 1; j < earlyApps.length; j++) {
      const a = earlyApps[i], b = earlyApps[j];
      if (!a.interviewDate || !b.interviewDate) continue;

      if (a.interviewDate === b.interviewDate) {
        conflicts.push({
          applicationId1: a.id, applicationId2: b.id,
          university1: a.universityName, university2: b.universityName,
          conflictDate: a.interviewDate,
          severity: 'critical',
        });
      }
      // 전날/다음날도 경고 (이동 시간)
      const diff = Math.abs(
        new Date(a.interviewDate).getTime() - new Date(b.interviewDate).getTime()
      );
      if (diff === 86400000) { // 1일 차이
        conflicts.push({
          .../* 생략 */,
          severity: 'warning',
        });
      }
    }
  }
  return conflicts;
}
```

### E18.2 UI

```
┌────────── 수시 면접 일정 ──────────┐
│  12/2 (토)  고려대 심리학 [학종]     │
│  12/3 (일)  성균관대 사회과학 [학종]  │ ← ⚠️ 연일 면접
│  12/9 (토)  이화여대 뇌인지 [학종]   │
│  12/10(일)  서울시립대 행정 [교과]    │ ← ⚠️ 연일 면접
│                                      │
│  ⚠️ 경고: 12/2~12/3 연일 면접       │
│     → 이동거리/체력 고려 필요        │
└──────────────────────────────────────┘
```

---

## E19. 교과전형 내신 산출 (보완 #23)

### E19.1 문제

학종과 정시는 상세하게 다루지만, **교과전형의 대학별 내신 산출 방식**이 구조화되지 않았다.

### E19.2 university_admissions 확장

```sql
-- 기존 grade_weight (text) → JSONB 구조화
ALTER TABLE university_admissions
  ALTER COLUMN grade_weight TYPE jsonb USING grade_weight::jsonb;

-- grade_weight JSONB 구조:
-- {
--   "type": "selected_top",          // selected_top | all_subjects | weighted
--   "count": 10,                     // 반영 과목 수 (selected_top)
--   "subjects": ["국어","수학","영어","사회"], // 반영 교과
--   "weights": { "전공관련": 1.5, "기타": 1.0 }, // 가중치 (weighted)
--   "achievement_conversion": {       // 5등급 성취평가 → 점수 환산
--     "A": 100, "B": 95, "C": 90, "D": 85, "E": 80
--   },
--   "grade9_conversion": {            // 9등급 → 점수 환산
--     "1": 100, "2": 98, "3": 96, "4": 94, "5": 92,
--     "6": 90, "7": 85, "8": 80, "9": 70
--   }
-- }
```

### E19.3 내신 산출 엔진

```typescript
// lib/domains/admission/gpa-calculator.ts

type GpaCalculationResult = {
  universityName: string;
  department: string;
  calculatedGpa: number;           // 대학별 환산 내신
  maxGpa: number;                  // 만점
  percentile: number;              // 환산 백분위
  reflectedSubjects: {
    subjectName: string;
    grade: number | string;        // 9등급 or A/B/C/D/E
    weight: number;
    convertedScore: number;
  }[];
  // 2022 교육과정 5등급 → 9등급 환산 여부 표시
  hasGradeConversion: boolean;
  conversionNote?: string;
};

/**
 * 대학별 교과전형 내신 산출
 * @param studentId 학생 ID
 * @param universityAdmissionId 대학/전형 ID
 */
async function calculateGpa(
  studentId: string,
  universityAdmissionId: string
): Promise<GpaCalculationResult> { ... }
```

---

## E20. 가채점/실채점 분리 + 6장 최적 배분 (보완 #24, #26)

### E20.1 가채점/실채점 이중 배치

```typescript
// lib/domains/admission/placement.ts 확장

type PlacementAnalysis = {
  examType: 'estimated' | 'actual';  // 가채점/실채점
  placementDate: string;              // 분석 시점
  results: PlacementResult[];
  // 가채점→실채점 변동 분석 (실채점 결과 있을 때)
  changeFromEstimate?: {
    universityName: string;
    estimatedLevel: PlacementLevel;
    actualLevel: PlacementLevel;
    scoreDiff: number;
  }[];
};
```

### E20.2 수시 6장 최적 배분 시뮬레이션

```typescript
// lib/domains/admission/allocation-simulator.ts

type AllocationSimulationInput = {
  studentId: string;
  candidateApplications: {
    universityName: string;
    department: string;
    round: ApplicationRound;
    placementLevel: PlacementLevel;      // 현재 배치 판정
    interviewDate?: string;
  }[];
};

type AllocationRecommendation = {
  recommended: Application[];            // 추천 6장 조합
  distribution: {
    byLevel: Record<PlacementLevel, number>;  // 소신2 + 적정2 + 안정2 등
    byRound: Record<string, number>;          // 학종3 + 교과2 + 논술1 등
  };
  score: number;                          // 배분 점수 (0~100, 균형도)
  warnings: string[];                     // "소신 비중 과다", "안정 지원 없음"
  interviewConflicts: InterviewConflict[];
};

/**
 * 수시 6장 최적 배분 시뮬레이션
 *
 * 입결 3개년 데이터 기반으로 소신/적정/안정 배분 제안.
 * 면접일 겹침, 전형 다양화(학종+교과+논술 혼합) 고려.
 *
 * 규칙:
 * 1. 소신 1~2장 (danger/unstable) — 상향 지원
 * 2. 적정 2~3장 (bold/possible) — 실질 목표
 * 3. 안정 1~2장 (safe) — 최소 1곳 확보
 * 4. 전형 다양화 권장 (학종만 6장 → 위험)
 * 5. 면접일 겹침 시 자동 제외
 */
async function simulateAllocation(
  input: AllocationSimulationInput
): Promise<AllocationRecommendation[]> {
  // 가능한 6장 조합 생성 (C(n, 6))
  // 각 조합에 대해 배분 점수 계산
  // 상위 3~5개 추천 조합 반환
}
```

---

## E21. 전형 변경 알림 (보완 #27)

### E21.1 설계

입시 데이터 갱신(E12) 시, **학생별 목표 대학의 변경사항을 자동 감지하여 알림**한다.

```typescript
// lib/domains/admission/change-detector.ts

type AdmissionChange = {
  universityName: string;
  department: string;
  changeType: 'min_score_changed' | 'recruitment_changed' | 'admission_type_changed'
            | 'new_restriction' | 'removed' | 'added';
  before: string;
  after: string;
  affectedStudents: { studentId: string; studentName: string }[];
};

/**
 * 입시 데이터 갱신 전후 diff → 영향받는 학생 식별
 *
 * 매핑: student_record_min_score_targets.university_name
 *       ↔ university_admissions.university_name
 */
async function detectAdmissionChanges(
  oldData: UniversityAdmission[],
  newData: UniversityAdmission[]
): Promise<AdmissionChange[]> { ... }

/**
 * 기존 통합 알림 시스템(unified-notification) 경유 push
 */
async function notifyAffectedStudents(changes: AdmissionChange[]): Promise<void> {
  for (const change of changes) {
    for (const student of change.affectedStudents) {
      await sendNotification({
        userId: student.studentId,
        type: 'admission_change',
        title: `${change.universityName} ${change.department} 전형 변경`,
        body: `${change.changeType}: ${change.before} → ${change.after}`,
      });
    }
  }
}
```

---

## E22. 재수생/N수생 관리 (보완 #25)

### E22.1 students 테이블 확장

```sql
-- 기존 students에 학생 상태 구분 추가
ALTER TABLE students
  ADD COLUMN IF NOT EXISTS student_status varchar(20) DEFAULT 'current'
    CHECK (student_status IN (
      'current',     -- 재학생
      'graduate',    -- 졸업생 (합격 DB용)
      'repeating',   -- 재수생
      'n_repeating'  -- N수생 (2년 이상)
    ));
```

### E22.2 재수생 전용 뷰

재수생은 내신이 확정되어 있으므로, **수능 중심 뷰**를 제공:

```
┌─────────── 재수생 대시보드 ──────────┐
│  김○○ (2025년 졸업, 재수 중)          │
│                                        │
│  ── 확정 내신 ──                      │
│  전체 평균: 2.3등급                    │
│  전공교과 평균: 1.8등급                │
│  (수정 불가, 졸업 시점 확정)            │
│                                        │
│  ── 수능 관리 (핵심) ──               │
│  3월 모평  6월 모평  9월 모평  수능    │
│  [입력]   [입력]   [입력]   [입력]    │
│                                        │
│  ── 배치 분석 ──                      │
│  정시 가/나/다군 배치표                │
│  수시 지원 가능 대학 (졸업생 허용 전형) │
│                                        │
│  ── 수능최저 시뮬레이션 ──            │
│  (재수생도 수시 지원 시 최저 필요)      │
└────────────────────────────────────────┘
```

### E22.3 재수생 지원 가능 전형 필터

```typescript
// 졸업생 지원 가능 전형만 필터
const eligibleAdmissions = await supabase
  .from('university_admissions')
  .select('*')
  .or('eligibility.ilike.%졸업생%,eligibility.ilike.%졸업예정%,eligibility.is.null');
```

---

## E23. 확장 설계 원칙 요약

| 원칙 | 내용 |
|------|------|
| **기록 → 컨설팅 전환** | 단순 데이터 입력 도구가 아닌, 3년간의 전략적 컨설팅 플랫폼 |
| **선행 설계 → 후행 기록** | 먼저 계획(로드맵)을 세우고, 실행을 기록하고, 차이를 분석 |
| **스토리라인 중심** | 모든 활동이 일관된 서사로 연결되는지를 추적 |
| **수능최저 = 1급 시민** | 메모가 아닌, 구조화된 시뮬레이션 엔진으로 |
| **학부모 = 핵심 이해관계자** | 적절한 범위의 정보를 적절한 형태로 공유 |
| **윤리적 AI** | "세특 대필"이 아닌 "활동 요약 도우미" — 명확한 포지셔닝 |
| **규모에 맞는 도구** | 84명에 Python ML은 과잉 — SQL 검색으로 시작, 확장 시 재검토 |
| **현장 사이클 반영** | 입시 데이터는 연 1회가 아닌 연 4회 갱신 |
| **점진적 안정성** | Phase 1을 3단계로 분할, 각 단계 독립 rollback 가능 |
| **비용 의식** | AI 월간 비용 추정 + 모니터링으로 예산 초과 방지 |
| **테스트 우선** | 결정론적 엔진(환산/시뮬레이션)은 100% 자동 테스트 |
| **CMS 독립 트랙** | 탐구 가이드 CMS는 별도 프로젝트로 분리, 병렬 진행 |

---

## E24. 추가 현장 보완 사항 (v6.1)

### E24.1 수시 원서접수 기간 경쟁률 트래킹 (Phase 3.5)

수시 원서접수 기간(9월 중순 3일간)에는 실시간 경쟁률이 전략의 핵심. 자동 크롤링은 법적 이슈가 있으므로 **수동 입력** 방식.

```sql
-- student_record_applications에 경쟁률 모니터링 필드 추가
ALTER TABLE student_record_applications
  ADD COLUMN IF NOT EXISTS current_competition_rate numeric(6,2),  -- 접수 기간 중 모니터링한 경쟁률
  ADD COLUMN IF NOT EXISTS competition_updated_at timestamptz;     -- 마지막 경쟁률 업데이트 시각
```

### E24.2 정시 충원 합격 시뮬레이션 (Phase 8.5)

정시 충원율이 200~300%에 달하는 대학이 많으므로, 단순 배치 판정 외에 **충원 합격 가능성**도 표시.

```typescript
type PlacementLevel = 'danger' | 'unstable' | 'bold' | 'possible' | 'safe'
  | 'possible_with_replacement';  // 충원 시 합격 가능

// 충원 가능성 = replacement_count / recruitment_count × 연도별 추세
function estimateReplacementChance(
  universityAdmissionId: string,
  studentScore: number
): { chance: 'high' | 'medium' | 'low'; historicalRate: number } { ... }
```

### E24.3 진로선택과목 3단계 성취도 반영 (Phase 8.1)

2022 개정교육과정 진로선택과목은 A/B/C 3단계 성취평가. 대학마다 반영 방식이 상이.

```typescript
// university_admissions.grade_weight JSONB에 추가 필드
type GradeWeight = {
  // ... 기존 필드
  career_subject_conversion?: {
    type: 'grade_equivalent' | 'bonus_points' | 'excluded';
    // grade_equivalent: A=1등급, B=3등급, C=5등급 환산
    mapping?: Record<string, number>;  // { "A": 1, "B": 3, "C": 5 }
    // bonus_points: A=+0.5, B=+0.2, C=0 가산
    bonus?: Record<string, number>;    // { "A": 0.5, "B": 0.2, "C": 0 }
  };
};
```

### E24.4 수시 등록금 납부/포기 관리 (Phase 3.5)

수시 합격 후 등록금 납부 시 정시 지원 불가. 의사결정 타이밍 관리 필요.

```
┌──── 수시 합격 → 등록 의사결정 ────┐
│  이화여대 뇌인지 [학종] ✅ 합격    │
│                                    │
│  등록금 납부 마감: 12/20           │
│  ⚠️ 등록 시 정시 지원 불가         │
│                                    │
│  현재 정시 배치 전망:              │
│  서울대 심리학: 🟡 소신            │
│  고려대 심리학: 🟠 불안            │
│                                    │
│  💡 판단 기준: 정시에서 상향 가능성 │
│     vs 수시 합격 확정의 안정성      │
│                                    │
│  [ 등록 ] [ 포기 (정시 지원) ]      │
└────────────────────────────────────┘
```

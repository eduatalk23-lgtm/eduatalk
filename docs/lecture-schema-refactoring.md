# 강의 관련 테이블 스키마 리팩토링 가이드

**작성일**: 2024년 11월 29일  
**마이그레이션 파일**:
- `supabase/migrations/YYYYMMDDHHMMSS_refactor_master_lectures_and_episodes.sql`
- `supabase/migrations/YYYYMMDDHHMMSS_refactor_lectures_and_student_episodes.sql`

---

## 📋 목차

1. [개요](#개요)
2. [변경 사항 요약](#변경-사항-요약)
3. [테이블별 상세 변경 내역](#테이블별-상세-변경-내역)
4. [코드 마이그레이션 가이드](#코드-마이그레이션-가이드)
5. [주의사항](#주의사항)
6. [후속 작업](#후속-작업)

---

## 개요

### 목적
강의 관련 테이블(`master_lectures`, `lecture_episodes`, `lectures`, `student_lecture_episodes`)을 최종 요구사항에 맞춰 리팩토링하여, 교육과정 연계, 플랫폼 관리, 진도 추적 등을 체계적으로 관리할 수 있도록 개선합니다.

### 전제 조건
- **서비스 운영 전**: 강의 관련 데이터는 모두 삭제해도 무방
- **데이터 초기화**: 마이그레이션 과정에서 모든 강의 데이터 TRUNCATE
- **코드 리팩토링 필요**: 컬럼명 변경 및 새 컬럼 활용을 위한 코드 수정 필요

---

## 변경 사항 요약

### 1. master_lectures (마스터 강의)

| 변경 유형 | 컬럼명 | 변경 내용 |
|---------|--------|----------|
| **추가** | `is_active` | 활성화 상태 (boolean) |
| **추가** | `curriculum_revision_id` | 교육과정 개정 ID (FK) |
| **추가** | `subject_id` | 과목 ID (FK) |
| **추가** | `grade_min`, `grade_max` | 학년 범위 (1-3) |
| **추가** | `school_type` | 학교 유형 (MIDDLE/HIGH/OTHER) |
| **변경** | `platform` → `platform_name` | 컬럼명 변경 |
| **추가** | `platform_id` | 플랫폼 ID (FK) |
| **추가** | `subtitle`, `series_name`, `instructor` | 강의 상세 정보 |
| **추가** | `description`, `toc`, `tags` | 설명, 목차, 태그 |
| **추가** | `target_exam_type` | 대상 시험 유형 (배열) |
| **추가** | `source`, `source_product_code`, `source_url`, `cover_image_url` | 외부 소스 메타데이터 |

### 2. lecture_episodes (마스터 강의 회차)

| 변경 유형 | 컬럼명 | 변경 내용 |
|---------|--------|----------|
| **변경** | `episode_title` → `title` | 컬럼명 변경 |
| **추가** | `difficulty_level`, `difficulty_score`, `tags` | 회차별 난이도/태그 |
| **제약** | `UNIQUE (lecture_id, display_order)` | 중복 방지 |
| **제약** | `ON DELETE CASCADE` | 마스터 강의 삭제 시 회차도 삭제 |

### 3. lectures (강의 인스턴스)

| 변경 유형 | 컬럼명 | 변경 내용 |
|---------|--------|----------|
| **변경** | `master_content_id` → `master_lecture_id` | 컬럼명 변경 |
| **추가** | `nickname` | 사용자 정의 강의 별명 |
| **추가** | `completed_episodes`, `progress` | 진도 관리 |
| **삭제** | `duration` | 혼란 방지 (master_lectures 사용) |
| **레거시** | `platform`, `subject`, `chapter_info` 등 | 호환성 유지, 향후 제거 예정 |

### 4. student_lecture_episodes (학생 회차 진도)

| 변경 유형 | 컬럼명 | 변경 내용 |
|---------|--------|----------|
| **변경** | `episode_title` → `title` | 컬럼명 변경 |
| **추가** | `master_episode_id` | 마스터 회차 참조 (FK) |
| **추가** | `is_completed`, `watched_seconds`, `last_watched_at`, `note` | 진도 상세 추적 |
| **제약** | `UNIQUE (lecture_id, display_order)` | 중복 방지 |
| **제약** | `ON DELETE CASCADE` | 강의 인스턴스 삭제 시 회차도 삭제 |

---

## 테이블별 상세 변경 내역

### 1. master_lectures (마스터 강의 데이터)

#### 최종 스키마

```sql
CREATE TABLE public.master_lectures (
  -- ① 공통
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE SET NULL,  -- null: 공용, not null: 테넌트 전용
  is_active boolean NOT NULL DEFAULT true,

  -- ② 교육과정/교과 연계
  curriculum_revision_id uuid REFERENCES public.curriculum_revisions(id) ON DELETE SET NULL,
  subject_id uuid REFERENCES public.subjects(id) ON DELETE SET NULL,
  grade_min integer CHECK (grade_min IS NULL OR (grade_min BETWEEN 1 AND 3)),
  grade_max integer CHECK (grade_max IS NULL OR (grade_max BETWEEN 1 AND 3)),
  school_type text CHECK (school_type IS NULL OR school_type IN ('MIDDLE','HIGH','OTHER')),

  -- ③ 기본 강의 정보
  title text NOT NULL,
  subtitle text,
  series_name text,
  instructor text,
  platform_id uuid REFERENCES public.platforms(id) ON DELETE SET NULL,
  platform_name text,  -- 레거시
  linked_book_id uuid REFERENCES public.master_books(id) ON DELETE SET NULL,

  -- ④ 회차/시간/난이도
  total_episodes integer CHECK (total_episodes > 0),
  total_duration integer,
  difficulty_level text,
  overall_difficulty numeric,
  revision text,           -- 레거시
  content_category text,   -- 레거시
  semester text,           -- 레거시
  target_exam_type text[],

  -- ⑤ 설명/텍스트/태그
  description text,
  toc text,
  tags text[],

  -- ⑥ 크롤링/외부 소스 메타
  source text,
  source_product_code text,
  source_url text,
  cover_image_url text,

  -- ⑦ 파일/AI 분석 결과
  video_url text,
  transcript text,
  episode_analysis jsonb,

  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
```

#### 주요 변경 사항

1. **교육과정 연계 강화**
   - `curriculum_revision_id`: 2009/2015/2022 개정 구분
   - `subject_id`: 과목 정규화 (subjects 테이블 참조)
   - `grade_min`, `grade_max`: 대상 학년 범위
   - `school_type`: 중학교/고등학교 구분

2. **플랫폼 관리 개선**
   - `platform_id`: platforms 테이블 참조 (정규화)
   - `platform_name`: 레거시 호환용 (기존 `platform` 컬럼)

3. **메타데이터 확장**
   - `subtitle`, `series_name`, `instructor`: 강의 상세 정보
   - `description`, `toc`: 설명, 목차
   - `tags`: 태그 배열 (검색 최적화)
   - `target_exam_type`: 대상 시험 유형 (내신, 모의고사, 수능 등)

4. **외부 연동 준비**
   - `source`, `source_product_code`, `source_url`: 크롤링/API 연동용
   - `cover_image_url`: 썸네일 이미지

---

### 2. lecture_episodes (마스터 강의 회차)

#### 최종 스키마

```sql
CREATE TABLE public.lecture_episodes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lecture_id uuid NOT NULL REFERENCES public.master_lectures(id) ON DELETE CASCADE,

  episode_number integer NOT NULL,      -- 1, 2, 3 ...
  title text,                            -- 회차 제목 (기존 episode_title)
  duration integer,
  display_order integer NOT NULL DEFAULT 0,

  -- 선택: 회차 단위 난이도/태그
  difficulty_level text,
  difficulty_score numeric,
  tags text[],

  created_at timestamptz DEFAULT now(),

  CONSTRAINT lecture_episodes_lecture_display_order_key
    UNIQUE (lecture_id, display_order)
);
```

#### 주요 변경 사항

1. **컬럼명 정리**
   - `episode_title` → `title`: 간결한 네이밍

2. **CASCADE 삭제**
   - `ON DELETE CASCADE`: 마스터 강의 삭제 시 회차도 자동 삭제

3. **회차별 메타데이터**
   - `difficulty_level`, `difficulty_score`: 회차별 난이도
   - `tags`: 회차별 태그 (예: "핵심개념", "문제풀이")

4. **UNIQUE 제약**
   - `(lecture_id, display_order)`: 중복 회차 방지

---

### 3. lectures (강의 인스턴스)

#### 최종 스키마

```sql
CREATE TABLE public.lectures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  student_id uuid REFERENCES public.students(id) ON DELETE SET NULL,

  master_lecture_id uuid REFERENCES public.master_lectures(id) ON DELETE SET NULL,  -- 기존 master_content_id

  -- 인스턴스용 표시 정보
  title text,                             -- 커스텀 제목 (필요시 마스터와 다르게)
  nickname text,                          -- 예: '6평 대비 패키지'
  notes text,

  -- 진도/상태
  total_episodes integer CHECK (total_episodes IS NULL OR total_episodes > 0),
  completed_episodes integer DEFAULT 0,
  progress numeric CHECK (progress IS NULL OR (progress >= 0 AND progress <= 100)),

  linked_book_id uuid REFERENCES public.books(id) ON DELETE SET NULL,

  -- 레거시 컬럼 (호환성 유지, 향후 제거 예정)
  platform text,                          -- TODO: master_lectures.platform_name 사용
  subject text,                           -- TODO: master_lectures.subject 사용
  subject_category text,                  -- TODO: master_lectures.subject_category 사용
  revision text,                          -- TODO: master_lectures.revision 사용
  semester text,                          -- TODO: master_lectures.semester 사용
  chapter_info jsonb,                     -- TODO: lecture_episodes/student_lecture_episodes 사용
  difficulty_level text,                  -- TODO: master_lectures.difficulty_level 사용
  latest_version text,                    -- 사용 안 함

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

#### 주요 변경 사항

1. **컬럼명 변경**
   - `master_content_id` → `master_lecture_id`: 명확한 네이밍

2. **인스턴스 메타데이터 추가**
   - `nickname`: 사용자 정의 별명 (예: "6평 대비 패키지")
   - `title`: 인스턴스별 커스텀 제목 (마스터와 다를 수 있음)

3. **진도 관리 강화**
   - `completed_episodes`: 완료한 회차 수
   - `progress`: 전체 진도율 (0-100)

4. **컬럼 삭제**
   - `duration`: 혼란 방지 (master_lectures의 total_duration 사용)

5. **레거시 컬럼 유지**
   - `platform`, `subject`, `chapter_info` 등: 기존 코드 호환성
   - TODO 주석 추가: 점진적 마이그레이션 유도

---

### 4. student_lecture_episodes (학생 회차 진도)

#### 최종 스키마

```sql
CREATE TABLE public.student_lecture_episodes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lecture_id uuid NOT NULL REFERENCES public.lectures(id) ON DELETE CASCADE,

  master_episode_id uuid REFERENCES public.lecture_episodes(id) ON DELETE SET NULL,

  episode_number integer NOT NULL,
  title text,                             -- 기존 episode_title
  duration integer,
  display_order integer NOT NULL DEFAULT 0,

  -- 진도/상태
  is_completed boolean DEFAULT false,
  watched_seconds integer DEFAULT 0,
  last_watched_at timestamptz,
  note text,

  created_at timestamptz DEFAULT now(),

  CONSTRAINT student_lecture_episodes_lecture_display_order_key
    UNIQUE (lecture_id, display_order)
);
```

#### 주요 변경 사항

1. **컬럼명 변경**
   - `episode_title` → `title`: 간결한 네이밍

2. **마스터 회차 연동**
   - `master_episode_id`: lecture_episodes 참조
   - 마스터 회차 정보 동기화 가능

3. **진도 추적 강화**
   - `is_completed`: 완료 여부
   - `watched_seconds`: 시청 시간(초)
   - `last_watched_at`: 마지막 시청 시간
   - `note`: 회차별 메모

4. **CASCADE 삭제**
   - `ON DELETE CASCADE`: 강의 인스턴스 삭제 시 회차도 자동 삭제

5. **UNIQUE 제약**
   - `(lecture_id, display_order)`: 중복 회차 방지

---

## 코드 마이그레이션 가이드

### 1. 컬럼명 변경 대응

#### master_lectures
```typescript
// ❌ Before
const platform = lecture.platform;

// ✅ After
const platformId = lecture.platform_id;      // 우선 사용
const platformName = lecture.platform_name;  // 레거시 호환
```

#### lecture_episodes
```typescript
// ❌ Before
const episodeTitle = episode.episode_title;

// ✅ After
const title = episode.title;
```

#### lectures
```typescript
// ❌ Before
const masterContentId = lecture.master_content_id;
const duration = lecture.duration;

// ✅ After
const masterLectureId = lecture.master_lecture_id;
// duration은 master_lectures.total_duration 사용
const masterLecture = await getMasterLecture(masterLectureId);
const duration = masterLecture?.total_duration;
```

#### student_lecture_episodes
```typescript
// ❌ Before
const episodeTitle = studentEpisode.episode_title;

// ✅ After
const title = studentEpisode.title;
const isCompleted = studentEpisode.is_completed;
const watchedSeconds = studentEpisode.watched_seconds;
```

---

### 2. 새 컬럼 활용 예시

#### master_lectures - 교육과정 연계

```typescript
interface MasterLecture {
  id: string;
  curriculum_revision_id?: string;  // 교육과정 개정
  subject_id?: string;               // 과목 ID
  grade_min?: number;                // 최소 학년
  grade_max?: number;                // 최대 학년
  school_type?: 'MIDDLE' | 'HIGH' | 'OTHER';
  platform_id?: string;              // 플랫폼 ID (우선)
  platform_name?: string;            // 플랫폼명 (레거시)
  target_exam_type?: string[];       // 대상 시험 유형
  tags?: string[];                   // 태그
}

// 검색 예시
const lectures = await supabase
  .from('master_lectures')
  .select(`
    *,
    curriculum_revision:curriculum_revisions(*),
    subject:subjects(*),
    platform:platforms(*)
  `)
  .eq('curriculum_revision_id', '2022개정')
  .gte('grade_min', 1)
  .lte('grade_max', 3)
  .eq('school_type', 'HIGH')
  .contains('target_exam_type', ['수능'])
  .eq('is_active', true);
```

#### lectures - 진도 관리

```typescript
interface Lecture {
  id: string;
  master_lecture_id?: string;
  nickname?: string;                 // 사용자 정의 별명
  total_episodes?: number;
  completed_episodes?: number;
  progress?: number;                 // 0-100
}

// 진도 업데이트
const updateLectureProgress = async (
  lectureId: string,
  completedEpisodes: number,
  totalEpisodes: number
) => {
  const progress = (completedEpisodes / totalEpisodes) * 100;

  await supabase
    .from('lectures')
    .update({
      completed_episodes: completedEpisodes,
      progress: progress,
    })
    .eq('id', lectureId);
};
```

#### student_lecture_episodes - 시청 기록

```typescript
interface StudentLectureEpisode {
  id: string;
  lecture_id: string;
  master_episode_id?: string;
  episode_number: number;
  title?: string;
  is_completed: boolean;
  watched_seconds: number;
  last_watched_at?: Date;
  note?: string;
}

// 시청 기록 업데이트
const updateWatchProgress = async (
  episodeId: string,
  watchedSeconds: number,
  isCompleted: boolean
) => {
  await supabase
    .from('student_lecture_episodes')
    .update({
      watched_seconds: watchedSeconds,
      is_completed: isCompleted,
      last_watched_at: new Date().toISOString(),
    })
    .eq('id', episodeId);
};
```

---

### 3. 수정이 필요한 파일 목록

#### Server Actions
- `app/actions/lectures.ts` (생성 필요 또는 기존 파일)
- `app/(student)/actions/masterContentActions.ts`

#### Data Fetching
- `lib/data/lectures.ts` (생성 필요)
- `lib/data/masterLectures.ts` (생성 필요)

#### Components
- `app/(admin)/admin/master-lectures/**/*.tsx` (관리자 UI)
- `app/(student)/contents/**/*.tsx` (학생 강의 목록/상세)

#### Types
- `lib/types/lecture.ts` (생성 필요)

---

## 주의사항

### 1. 컬럼명 변경으로 인한 영향

**영향받는 컬럼**:
- `master_lectures.platform` → `master_lectures.platform_name`
- `lecture_episodes.episode_title` → `lecture_episodes.title`
- `lectures.master_content_id` → `lectures.master_lecture_id`
- `student_lecture_episodes.episode_title` → `student_lecture_episodes.title`

**대응 방법**:
1. 코드에서 해당 컬럼을 사용하는 모든 곳 검색
2. 점진적으로 새 컬럼명으로 변경
3. TypeScript 타입 정의 업데이트

### 2. 삭제된 컬럼

**lectures.duration**:
- 삭제 이유: master_lectures.total_duration과 혼란 방지
- 대체 방법: master_lectures JOIN하여 total_duration 사용

```typescript
// ✅ 올바른 방법
const { data } = await supabase
  .from('lectures')
  .select(`
    *,
    master_lecture:master_lectures(total_duration)
  `)
  .eq('id', lectureId)
  .single();

const duration = data.master_lecture?.total_duration;
```

### 3. 레거시 컬럼

**유지되는 레거시 컬럼** (lectures 테이블):
- `platform`, `subject`, `subject_category`, `revision`, `semester`, `chapter_info`, `difficulty_level`, `latest_version`

**권장 사항**:
- 새로운 코드에서는 사용하지 않기
- 기존 코드는 점진적으로 마이그레이션
- 향후 충분한 마이그레이션 후 컬럼 제거 고려

---

## 후속 작업

### Phase 1: 즉시 (마이그레이션 직후)
- [ ] TypeScript 타입 정의 업데이트
- [ ] 컬럼명 변경된 부분 코드 수정
- [ ] Server Actions 수정 (master_content_id → master_lecture_id)
- [ ] 빌드 에러 확인 및 수정

### Phase 2: 단기 (1-2주)
- [ ] 새 컬럼(curriculum_revision_id, subject_id, platform_id) 활용 UI 개발
- [ ] 진도 관리 기능 구현 (completed_episodes, progress)
- [ ] 시청 기록 기능 구현 (watched_seconds, is_completed)
- [ ] 관리자 UI에서 새 필드 입력/표시

### Phase 3: 중기 (1개월)
- [ ] 레거시 컬럼 사용 코드 전면 리팩토링
  - lectures.platform → master_lectures.platform_id
  - lectures.subject → master_lectures.subject_id
  - lectures.chapter_info → lecture_episodes/student_lecture_episodes
- [ ] master_episode_id 활용하여 마스터 회차와 학생 회차 동기화
- [ ] 태그 기반 검색/필터링 구현

### Phase 4: 장기 (2-3개월)
- [ ] 레거시 컬럼 제거
- [ ] 교육과정 기반 강의 추천 시스템
- [ ] 학습 분석 대시보드 (진도, 시청 패턴 분석)
- [ ] 외부 플랫폼 API 연동 (source_url, source_product_code 활용)

---

## 검증 체크리스트

### 데이터베이스
- [ ] 마이그레이션 성공 확인
- [ ] FK 제약 정상 작동 확인
- [ ] UNIQUE 제약 정상 작동 확인
- [ ] CASCADE 삭제 정상 작동 확인

### 코드
- [ ] TypeScript 빌드 에러 없음
- [ ] ESLint 에러 없음
- [ ] 기존 기능 정상 작동 (강의 목록, 상세, 등록)
- [ ] 새 컬럼 활용 기능 테스트

### UI
- [ ] 관리자: 강의 등록/수정 정상 작동
- [ ] 학생: 강의 목록 조회 정상 작동
- [ ] 학생: 강의 상세 조회 정상 작동
- [ ] 진도 표시 정상 작동

---

## 참고 자료

- ERD: `timetable/erd-cloud/`
- 기존 스키마: `supabase/migrations/`
- 관련 이슈: (이슈 번호 추가)

---

**마지막 업데이트**: 2024년 11월 29일


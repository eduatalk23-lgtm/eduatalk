# 생기부(학교생활기록부) 모형 구현 계획

> 작성일: 2026-02-23
> 상태: 미구현 (계획 완료)

## 1. 개요

TimeLevelUp에 **생기부 초안 작성 + 조회 + 분석** 기능을 추가한다.
학원/컨설팅 환경에서 관리자가 학생별 생기부 초안을 작성·편집하고, 학생은 본인 기록을 열람할 수 있다.
실제 NEIS 양식과 동일한 레이아웃으로 렌더링한다.

---

## 2. 실제 생기부 구조 (NEIS 기준)

### 2.1 공식 항목

| 번호 | 항목 | 기재 단위 | 대입 반영 | 비고 |
|------|------|-----------|-----------|------|
| 1 | 인적·학적사항 | - | O | students 테이블에 이미 존재 |
| 2 | 출결상황 | 학년(연간) | O | attendance 시스템 존재 |
| 3 | 수상경력 | - | **X** (2021~) | 구현 제외 |
| 4 | 자격증·인증 | - | **X** (2022~) | 구현 제외 |
| 5 | 창의적 체험활동 | 학년(연간) | O | **신규 구현** |
| 6 | 교과학습 발달상황 | 학기별 | O | 성적: 기존, 세특: **신규 구현** |
| 7 | 자유학기활동 | - | - | 중학교만, 구현 제외 |
| 8 | 독서활동 | 학년(연간) | **X** (2021~) | 기록 관리 차원 **신규 구현** |
| 9 | 행동특성 및 종합의견 | 학년(연간) | O | **신규 구현** |

### 2.2 글자수 제한 (NEIS 바이트 기준)

| 항목 | 2025학년도 이전 | 2026학년도~ | NEIS 바이트 |
|------|----------------|-------------|-------------|
| 자율활동 | 500자 | 500자 | 1,500B |
| 동아리활동 | 500자 | 500자 | 1,500B |
| 진로활동 | **700자** | **500자** | 2,100B→1,500B |
| 교과 세특 (과목당) | 500자 | 500자 | 1,500B |
| 행동특성 및 종합의견 | **500자** | **300자** | 1,500B→900B |

> NEIS 바이트 계산: 한글 1자=3B, 영문/숫자/특수문자=1B

### 2.3 2025-2026 주요 변경사항

#### 세특 기재 단위
- 세특은 여전히 **과목×학기** 단위로 기재
- 마감 방식만 변경: 학기 마감 → **학년 말 통합 마감** (2026~)
- 2022 개정교육과정(2025 고1~): 공통과목이 학기별 별개 과목으로 분리
  - 예: 공통국어1(1학기) + 공통국어2(2학기) = 별개 레코드, **합산 500자 제한**

#### 창체 영역 변경 (2025 고1~)
- 4개 영역 → **3개 영역**: 자율·자치, 동아리, 진로 (봉사활동 독립 영역 폐지)

#### 성적 등급 체계
- 9등급 → **5등급** (2025 고1~)

---

## 3. 포함 항목 (6개)

| 우선순위 | 항목 | 데이터 소스 | 구현 |
|----------|------|-------------|------|
| P0 | 교과 세특 | `student_record_seteks` (신규) | 과목별 textarea 에디터 |
| P0 | 창체 | `student_record_changche` (신규) | 자율/동아리/진로 textarea |
| P0 | 행특 | `student_record_haengteuk` (신규) | 단일 textarea |
| P1 | 교과 성적 | `student_internal_scores` (기존) | 읽기전용 뷰 통합 |
| P1 | 출결상황 | attendance 시스템 (기존) | 읽기전용 뷰 통합 |
| P2 | 독서활동 | `student_record_reading` (신규) | 테이블 형태 행 추가/삭제 |

---

## 4. 핵심 설계 결정

| 결정 | 근거 |
|------|------|
| `student_terms`를 부모 앵커로 활용 (별도 parent 테이블 X) | 이미 `student_id + school_year + grade + semester + curriculum_revision_id` 존재, `getOrCreateStudentTerm()` 재사용 |
| 공통과목 쌍 제약은 앱 레벨에서 검증 | DB CHECK로 구현 시 subject pair 조회 필요 → 복잡, 마이그레이션 부담 |
| 성적·출결은 기존 테이블에서 JOIN (비정규화 X) | 이미 존재하는 데이터, 동기화 이슈 방지 |
| 학생 뷰는 admin 컴포넌트 `readOnly` prop 재사용 | NEIS 레이아웃 렌더러 중복 방지 |
| RLS는 `get_user_tenant_id()` 패턴 사용 | 프로젝트 전체 일관성 (admin+student+parent 커버) |

---

## 5. DB 스키마

### 5.1 `student_record_seteks` (교과 세특)

```sql
CREATE TABLE IF NOT EXISTS student_record_seteks (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  student_id       uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  student_term_id  uuid REFERENCES student_terms(id) ON DELETE SET NULL,
  school_year      integer NOT NULL,
  grade            integer NOT NULL CHECK (grade BETWEEN 1 AND 3),
  semester         integer NOT NULL CHECK (semester IN (1, 2)),
  subject_id       uuid NOT NULL REFERENCES subjects(id) ON DELETE RESTRICT,
  content          text NOT NULL DEFAULT '',
  content_bytes    integer GENERATED ALWAYS AS (octet_length(content)) STORED,
  char_limit       integer NOT NULL DEFAULT 500,
  status           varchar(20) NOT NULL DEFAULT 'draft'
                     CHECK (status IN ('draft', 'review', 'final')),
  reviewed_by      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at      timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, student_id, school_year, grade, semester, subject_id)
);
```

### 5.2 `student_record_changche` (창체)

```sql
CREATE TABLE IF NOT EXISTS student_record_changche (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  student_id       uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  school_year      integer NOT NULL,
  grade            integer NOT NULL CHECK (grade BETWEEN 1 AND 3),
  activity_type    varchar(20) NOT NULL
                     CHECK (activity_type IN ('autonomy', 'club', 'career')),
  content          text NOT NULL DEFAULT '',
  content_bytes    integer GENERATED ALWAYS AS (octet_length(content)) STORED,
  char_limit       integer NOT NULL DEFAULT 500,
  status           varchar(20) NOT NULL DEFAULT 'draft'
                     CHECK (status IN ('draft', 'review', 'final')),
  reviewed_by      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at      timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, student_id, school_year, grade, activity_type)
);
```

### 5.3 `student_record_haengteuk` (행특)

```sql
CREATE TABLE IF NOT EXISTS student_record_haengteuk (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  student_id       uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  school_year      integer NOT NULL,
  grade            integer NOT NULL CHECK (grade BETWEEN 1 AND 3),
  content          text NOT NULL DEFAULT '',
  content_bytes    integer GENERATED ALWAYS AS (octet_length(content)) STORED,
  char_limit       integer NOT NULL DEFAULT 500,
  status           varchar(20) NOT NULL DEFAULT 'draft'
                     CHECK (status IN ('draft', 'review', 'final')),
  reviewed_by      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at      timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, student_id, school_year, grade)
);
```

### 5.4 `student_record_reading` (독서활동)

```sql
CREATE TABLE IF NOT EXISTS student_record_reading (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  student_id       uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  school_year      integer NOT NULL,
  grade            integer NOT NULL CHECK (grade BETWEEN 1 AND 3),
  subject_area     varchar(50) NOT NULL,
  book_title       varchar(200) NOT NULL,
  author           varchar(100),
  notes            text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);
```

### 5.5 `student_record_subject_pairs` (공통과목 쌍 참조)

```sql
CREATE TABLE IF NOT EXISTS student_record_subject_pairs (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  curriculum_revision_id uuid NOT NULL REFERENCES curriculum_revisions(id) ON DELETE CASCADE,
  subject_id_1           uuid NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  subject_id_2           uuid NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  shared_char_limit      integer NOT NULL DEFAULT 500,
  created_at             timestamptz NOT NULL DEFAULT now(),
  UNIQUE(curriculum_revision_id, subject_id_1, subject_id_2)
);
```

### 5.6 인덱스

```sql
-- seteks
CREATE INDEX IF NOT EXISTS idx_srs_student_year ON student_record_seteks(student_id, school_year);
CREATE INDEX IF NOT EXISTS idx_srs_tenant ON student_record_seteks(tenant_id);
CREATE INDEX IF NOT EXISTS idx_srs_status ON student_record_seteks(status) WHERE status != 'final';

-- changche
CREATE INDEX IF NOT EXISTS idx_src_student_year ON student_record_changche(student_id, school_year);
CREATE INDEX IF NOT EXISTS idx_src_tenant ON student_record_changche(tenant_id);

-- haengteuk
CREATE INDEX IF NOT EXISTS idx_srh_student_year ON student_record_haengteuk(student_id, school_year);
CREATE INDEX IF NOT EXISTS idx_srh_tenant ON student_record_haengteuk(tenant_id);

-- reading
CREATE INDEX IF NOT EXISTS idx_srr_student_year ON student_record_reading(student_id, school_year);
CREATE INDEX IF NOT EXISTS idx_srr_tenant ON student_record_reading(tenant_id);

-- subject_pairs
CREATE INDEX IF NOT EXISTS idx_srsp_curriculum ON student_record_subject_pairs(curriculum_revision_id);
```

### 5.7 RLS (4개 메인 테이블 동일)

```sql
ALTER TABLE {table} ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON {table}
  FOR ALL USING (tenant_id = get_user_tenant_id());
```

### 5.8 updated_at 트리거

```sql
CREATE OR REPLACE FUNCTION update_student_record_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trigger_srs_updated_at BEFORE UPDATE ON student_record_seteks
  FOR EACH ROW EXECUTE FUNCTION update_student_record_updated_at();
CREATE TRIGGER trigger_src_updated_at BEFORE UPDATE ON student_record_changche
  FOR EACH ROW EXECUTE FUNCTION update_student_record_updated_at();
CREATE TRIGGER trigger_srh_updated_at BEFORE UPDATE ON student_record_haengteuk
  FOR EACH ROW EXECUTE FUNCTION update_student_record_updated_at();
CREATE TRIGGER trigger_srr_updated_at BEFORE UPDATE ON student_record_reading
  FOR EACH ROW EXECUTE FUNCTION update_student_record_updated_at();
```

---

## 6. 학년 구분 구조

생기부는 **학년 단위**로 누적 기록된다:

```
고1 (2024학년도)          고2 (2025학년도)          고3 (2026학년도)
├─ 출결상황 (연간)       ├─ 출결상황 (연간)       ├─ 출결상황 (연간)
├─ 창체 (연간)           ├─ 창체 (연간)           ├─ 창체 (연간)
│  ├─ 자율 500자         │  ├─ 자율 500자         │  ├─ 자율 500자
│  ├─ 동아리 500자       │  ├─ 동아리 500자       │  ├─ 동아리 500자
│  └─ 진로 700→500자     │  └─ 진로 700→500자     │  └─ 진로 500자
├─ 교과학습 (학기별)     ├─ 교과학습 (학기별)     ├─ 교과학습 (학기별)
│  ├─ 1학기 성적+세특    │  ├─ 1학기 성적+세특    │  ├─ 1학기 성적+세특
│  └─ 2학기 성적+세특    │  └─ 2학기 성적+세특    │  └─ 2학기 성적+세특
├─ 독서활동 (연간)       ├─ 독서활동 (연간)       ├─ 독서활동 (연간)
└─ 행특 500→300자        └─ 행특 500→300자        └─ 행특 300자
```

### 기존 테이블 연결

- `student_terms` (학기 단위): 세특의 `student_term_id`로 연결
- `student_internal_scores`: 성적 데이터 (기존)
- `students.grade` + `students.school_type`: 현재 학년 확인
- `curriculum_revisions`: 2015/2022 개정교육과정 구분

### 교육과정별 분기

| 구분 | 2015 개정 (현 고2·고3) | 2022 개정 (2025 고1~) |
|------|------------------------|------------------------|
| 과목 편성 | 공통과목 1년 단위 | 공통국어1(1학기)+공통국어2(2학기) 별개 |
| 세특 | 과목당 500자 (연간) | 과목별 500자, **공통과목 쌍 합산 500자** |
| 창체 | 4영역 (자율/동아리/봉사/진로) | 3영역 (자율·자치/동아리/진로) |
| 등급 | 9등급 | 5등급 |

---

## 7. 도메인 레이어 구조

```
lib/domains/student-record/
├── types.ts           # DB 파생 타입, StudentRecordYear 집계 타입
├── validation.ts      # 글자수/바이트 제한 룰, NEIS 바이트 카운팅
├── repository.ts      # Supabase CRUD (throw on error)
├── service.ts         # 비즈니스 로직 (char limit 검증, subject pair 체크)
├── actions/
│   ├── index.ts       # Re-exports
│   ├── core.ts        # "use server" 관리자 CRUD (requireAdminOrConsultant)
│   └── student.ts     # "use server" 학생 조회 (resolveAuthContext)
└── index.ts           # Domain barrel
```

### 핵심 타입

```typescript
type StudentRecordYear = {
  schoolYear: number;
  grade: number;
  seteks: RecordSetek[];
  changche: RecordChangche[];
  haengteuk: RecordHaengteuk | null;
  readings: RecordReading[];
  scores: InternalScore[];       // 기존 student_internal_scores
  attendance: AttendanceSummary; // 기존 출결 데이터
};
```

### 글자수 제한 룰

```typescript
const CHAR_LIMITS = {
  setek: { default: 500 },
  autonomy: { default: 500 },
  club: { default: 500 },
  career: { before2026: 700, from2026: 500 },
  haengteuk: { before2026: 500, from2026: 300 },
};

function countNeisBytes(text: string): number {
  return new TextEncoder().encode(text).length;
}
```

---

## 8. UI 컴포넌트 구조

### 관리자 UI

```
app/(admin)/admin/students/[id]/_components/student-record/
├── StudentRecordSection.tsx       # Server Component (데이터 fetch)
├── StudentRecordClient.tsx        # Client Component (학년 선택 + 에디터)
├── StudentRecordSkeleton.tsx      # Suspense fallback
├── RecordYearSelector.tsx         # 학년도 드롭다운
├── SetekEditor.tsx                # 과목별 세특 textarea + 바이트 카운터
├── ChangcheEditor.tsx             # 자율/동아리/진로 3개 textarea
├── HaengteukEditor.tsx            # 행특 textarea
├── ReadingEditor.tsx              # 독서활동 테이블 (행 추가/삭제)
├── ScoreSummaryView.tsx           # 성적 통합 뷰 (읽기전용)
├── AttendanceSummaryView.tsx      # 출결 통합 뷰 (읽기전용)
├── CharacterCounter.tsx           # 바이트/글자수 카운터
├── RecordStatusBadge.tsx          # draft/review/final 뱃지
└── NEISLayoutRenderer.tsx         # NEIS 양식 레이아웃 (admin/student 공유)
```

### 학생 UI

```
app/(student)/student-record/
├── page.tsx                                    # Server Component
└── _components/
    └── StudentRecordViewClient.tsx             # NEISLayoutRenderer readOnly={true}
```

### 수정할 기존 파일

| 파일 | 변경 |
|------|------|
| `StudentDetailTabs.tsx` | `TabKey`에 `"student-record"` 추가 |
| `page.tsx` (admin student detail) | 생기부 탭 조건부 렌더링 추가 |
| `database.types.ts` | 마이그레이션 후 재생성 |

---

## 9. React Query

```typescript
// lib/query-options/studentRecord.ts
export const studentRecordKeys = {
  all: ["studentRecord"] as const,
  byYear: (studentId: string, schoolYear: number) =>
    [...studentRecordKeys.all, studentId, schoolYear] as const,
};

export function studentRecordQueryOptions(studentId: string, schoolYear: number) {
  return queryOptions({
    queryKey: studentRecordKeys.byYear(studentId, schoolYear),
    queryFn: () => getStudentRecordByYearAction(studentId, schoolYear),
    staleTime: 1000 * 300,
  });
}
```

---

## 10. 구현 순서

| Phase | 내용 | 산출물 |
|-------|------|--------|
| 1 | DB 마이그레이션 + 타입 재생성 | migration SQL, database.types.ts |
| 2 | 도메인 레이어 (types → validation → repository → service → actions) | lib/domains/student-record/ |
| 3 | React Query + 관리자 UI (탭 등록 + 에디터 컴포넌트) | admin 탭 + 14개 컴포넌트 |
| 4 | 학생 뷰 (읽기전용) | student-record 페이지 |
| 5 (향후) | 고도화: PDF 내보내기, AI 초안, 버전 이력, 일괄 상태 변경 | - |

총 새 파일 약 25개, 수정 파일 3개.

---

## 11. 검증 방법

1. `supabase db push` → 테이블 생성 확인
2. `npx supabase gen types typescript --local` → 타입 재생성
3. `pnpm lint` → 타입 에러 없음
4. `pnpm build` → 빌드 성공
5. 관리자: 학생 상세 → 생기부 탭 → 세특/창체/행특 입력 → 저장 → 새로고침 유지
6. 학생: `/student-record` → 본인 데이터 읽기전용 표시
7. 글자수: 한도 초과 시 카운터 빨간색 + 저장 차단
8. RLS: 다른 tenant 데이터 접근 불가

---

## 12. 참고 서비스

| 서비스 | 유형 | 핵심 기능 |
|--------|------|-----------|
| 세특PRO (setk.pro) | 교사용 AI 작성 | NEIS 연동, AI 세특 생성, 연 5만원 |
| Inline AI (inline-ai.com) | 교사용 AI 작성 | 세특+창체+행특 완성형 생성 |
| 바이브온 (vibeon.ai) | 학생용 분석 | 생기부 업로드 → 30p 리포트, 합격가능성 진단 |
| 그들의 생기부 (saenggibu.com) | 합격생 열람 | 27,500장+ 합격생 생기부 DB |
| 진학사 학생부 AI | 학생용 분석 | 비교과/교과 AI 점수화 |
| 임팩터스 | 교사용 올인원 | 수업관리 + AI 평가 + 세특 연동 |

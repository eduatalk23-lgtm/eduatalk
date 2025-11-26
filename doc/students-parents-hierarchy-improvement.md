# 학생 및 학부모 테이블 위계 분석 및 개선안

## 개요

이 문서는 TimeLevelUp 프로젝트의 학생 및 학부모 관련 테이블의 위계 구조를 분석하고, 현재 구조의 문제점을 파악하며, 개선 방안을 제시하는 종합 문서입니다.

**작성 일자**: 2025-01-31  
**목적**: 테이블 구조 최적화 및 확장성 개선

---

## 1. 위계 분석

### 1.1 테이블 간 의존성 관계

#### 최상위 계층: tenants (테넌트)
```
tenants
  └── 모든 하위 테이블의 tenant_id 참조
```

#### 사용자 계층: users (통합 사용자)
```
users
  ├── students (1:1, ON DELETE CASCADE)
  ├── parent_users (1:1, ON DELETE CASCADE)
  ├── admin_users (1:1, ON DELETE CASCADE)
  └── student_teacher_assignments (teacher_id 참조)
```

#### 학생 계층: students (학생 정보)
```
students
  ├── parent_student_links (1:N, ON DELETE CASCADE)
  ├── student_teacher_assignments (1:N, ON DELETE CASCADE)
  │
  ├── 콘텐츠 관련 (3개 테이블)
  │   ├── student_books (1:N, ON DELETE CASCADE)
  │   ├── student_lectures (1:N, ON DELETE CASCADE)
  │   └── student_custom_contents (1:N, ON DELETE CASCADE)
  │
  ├── 성적 관련 (3개 테이블)
  │   ├── school_scores (1:N, ON DELETE CASCADE)
  │   ├── mock_scores (1:N, ON DELETE CASCADE)
  │   └── student_analysis (1:N, ON DELETE CASCADE)
  │
  ├── 플랜 관련 (4개 테이블)
  │   ├── plan_groups (1:N, ON DELETE CASCADE)
  │   ├── student_plans (1:N, ON DELETE CASCADE)
  │   ├── study_sessions (1:N, ON DELETE CASCADE)
  │   └── plan_recommendations (1:N, ON DELETE CASCADE)
  │
  ├── 관리 관련 (4개 테이블)
  │   ├── attendance_records (1:N, ON DELETE CASCADE)
  │   ├── tuition_fees (1:N, ON DELETE CASCADE)
  │   ├── payment_records (1:N, ON DELETE CASCADE)
  │   └── consulting_notes (1:N, ON DELETE CASCADE)
  │
  └── 기타 (4개 테이블)
      ├── goals (1:N, ON DELETE CASCADE)
      ├── student_global_settings (1:1 UNIQUE, ON DELETE CASCADE)
      ├── academy_schedules (1:N, nullable, ON DELETE CASCADE)
      ├── reports (1:N, nullable, ON DELETE CASCADE)
      └── student_history (1:N, ON DELETE CASCADE)
```

### 1.2 students 테이블을 참조하는 모든 테이블 목록

총 **20개 이상의 테이블**이 `students` 테이블을 참조합니다:

#### 핵심 관계 테이블 (3개)
1. **parent_student_links** - 학생-학부모 연결
2. **student_teacher_assignments** - 학생-담당자 연결
3. **student_global_settings** - 학생 전역 설정 (1:1 UNIQUE)

#### 콘텐츠 관련 (3개)
4. **student_books** - 학생 교재
5. **student_lectures** - 학생 강의
6. **student_custom_contents** - 학생 커스텀 콘텐츠

#### 성적 관련 (3개)
7. **school_scores** - 내신 성적
8. **mock_scores** - 모의고사 성적
9. **student_analysis** - 학생 분석

#### 플랜 관련 (4개)
10. **plan_groups** - 플랜 그룹
11. **student_plans** - 학생 플랜
12. **study_sessions** - 학습 세션
13. **plan_recommendations** - 플랜 추천

#### 관리 관련 (4개)
14. **attendance_records** - 출석 기록
15. **tuition_fees** - 수강료
16. **payment_records** - 결제 기록
17. **consulting_notes** - 상담 기록

#### 기타 (4개)
18. **goals** - 목표
19. **academy_schedules** - 학원 일정 (nullable)
20. **reports** - 리포트 (nullable)
21. **student_history** - 학생 이력

### 1.3 CASCADE 삭제 정책 분석

모든 `students` 참조는 **ON DELETE CASCADE**로 설정되어 있습니다:

**장점**:
- 학생 삭제 시 관련 데이터 자동 정리
- 데이터 무결성 보장

**단점**:
- 학생 삭제 시 20개 이상의 테이블에서 데이터가 삭제됨
- 복구 불가능 (Soft Delete 미적용)
- 대량 삭제로 인한 성능 저하 가능성

**권장사항**:
- `students` 테이블에 `deleted_at` 필드 추가 (Soft Delete)
- 중요한 데이터(성적, 플랜 등)는 Soft Delete 적용 검토

### 1.4 데이터 흐름도

```
[인증] Supabase Auth
    ↓
[users] 통합 사용자 (email, role)
    ↓
[students] 학생 기본 정보
    ├──→ [student_profiles] 프로필 정보 (제안)
    ├──→ [student_career_goals] 진로 정보 (제안)
    │
    ├──→ [콘텐츠] student_books, student_lectures
    ├──→ [성적] school_scores, mock_scores
    ├──→ [플랜] plan_groups → student_plans
    └──→ [관리] attendance_records, tuition_fees

[parent_users] 학부모 기본 정보
    ├──→ [parent_profiles] 프로필 정보 (제안)
    └──→ [parent_student_links] 학생 연결
```

---

## 2. 현재 구조의 문제점 분석

### 2.1 students 테이블의 과도한 책임 (God Object 안티패턴)

#### 문제점
`students` 테이블이 다음 세 가지 책임을 모두 가지고 있습니다:

1. **기본 정보**: `id`, `grade`, `class`, `birth_date`, `school`
2. **프로필 정보**: `gender`, `phone`, `mother_phone`, `father_phone`
3. **진로 정보**: `exam_year`, `curriculum_revision`, `desired_university_1~3`, `desired_career_field`

#### 영향
- **응집도 저하**: 서로 다른 목적의 필드가 혼재
- **확장성 제한**: 새로운 프로필/진로 필드 추가 시 테이블 구조 변경 필요
- **쿼리 성능**: 필요한 필드만 조회하기 어려움
- **유지보수 어려움**: 필드 그룹별 업데이트 로직 분리 필요

#### 필드 그룹화 분석

| 그룹 | 필드 수 | 업데이트 빈도 | 접근 패턴 |
|------|--------|-------------|----------|
| 기본 정보 | 5개 | 낮음 | 자주 조회 |
| 프로필 정보 | 4개 | 중간 | 가끔 조회 |
| 진로 정보 | 6개 | 낮음 | 가끔 조회 |

### 2.2 미사용 필드 및 불일치 사항

#### students 테이블

**ERD에 있으나 미사용 필드 (9개)**:
- `student_number` - 학번
- `class_number` - 반 번호 (실제로는 `class` 사용)
- `address` - 주소
- `parent_contact` - 부모 연락처 (실제로는 `mother_phone`, `father_phone` 분리)
- `emergency_contact` - 비상 연락처
- `medical_info` - 의료 정보
- `notes` - 메모
- `is_active` - 활성 상태
- `enrolled_at` - 입학일

**필드명 불일치**:
- ERD: `class_number` → 실제: `class`
- ERD: `parent_contact` → 실제: `mother_phone`, `father_phone`

**값 형식 불일치**:
- ERD: `gender` = 'male'/'female'/'other' → 실제: "남"/"여"

#### parent_users 테이블

**ERD에 있으나 미사용 필드 (3개)**:
- `relationship` - 관계
- `occupation` - 직업
- `updated_at` - 수정 시간

**실제 사용 필드 (3개만)**:
- `id`, `tenant_id`, `created_at`

#### parent_student_links 테이블

**테이블명 불일치**:
- ERD: `student_parent_links`
- 실제: `parent_student_links`

**필드명 불일치**:
- ERD: `relationship`
- 실제: `relation`

**ERD에 있으나 미사용 필드 (3개)**:
- `is_primary` - 주 보호자 여부
- `is_approved` - 승인 여부
- `approved_at` - 승인 시간

### 2.3 데이터 정규화 문제

#### 문제 1: 대학교 정보 비정규화
- `desired_university_1~3`이 text로 저장되어 `schools` 테이블과 분리됨
- 대학교 정보 중복 저장 가능성
- 대학교 정보 변경 시 일관성 문제

#### 문제 2: 학교 정보 비정규화
- `school` 필드가 text로 저장되어 `schools` 테이블과 분리됨
- `school_id` 필드가 ERD에는 있으나 미사용

---

## 3. 추가 필드 및 테이블 제안

### 3.1 부족한 필드 식별

#### students 테이블
- **학생 사진**: `profile_image_url` (users 테이블에 있으나 students 전용 필요)
- **학생 상태**: `status` (재학, 휴학, 졸업 등)
- **입학일**: `enrolled_at` (ERD에는 있으나 미사용, 활용 필요)
- **학번**: `student_number` (ERD에는 있으나 미사용, 활용 필요)

#### parent_users 테이블
- **학부모 이름**: `name` (users 테이블과 조인 필요하나 별도 저장 고려)
- **학부모 전화번호**: `phone` (users 테이블과 조인 필요하나 별도 저장 고려)
- **학부모 이메일**: `email` (users 테이블과 조인 필요하나 별도 저장 고려)
- **학부모 프로필 이미지**: `profile_image_url`

### 3.2 새로운 테이블 필요성 검토

#### 3.2.1 student_profiles (학생 프로필 테이블) - 제안

**목적**: 학생의 프로필 정보를 별도 테이블로 분리

**필드 제안**:
```sql
CREATE TABLE student_profiles (
  id uuid PRIMARY KEY REFERENCES students(id) ON DELETE CASCADE,
  tenant_id uuid REFERENCES tenants(id) ON DELETE RESTRICT,
  gender text CHECK (gender IN ('남', '여')),
  phone text,
  mother_phone text,
  father_phone text,
  profile_image_url text,
  bio text, -- 자기소개
  interests jsonb, -- 관심사
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);
```

**장점**:
- 프로필 정보만 조회 시 성능 향상
- 프로필 필드 확장 용이
- 기본 정보와 프로필 정보 분리

#### 3.2.2 student_career_goals (학생 진로 목표 테이블) - 제안

**목적**: 학생의 진로 정보를 별도 테이블로 분리하고, 대학교 정보를 정규화

**필드 제안**:
```sql
CREATE TABLE student_career_goals (
  id uuid PRIMARY KEY,
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  tenant_id uuid REFERENCES tenants(id) ON DELETE RESTRICT,
  exam_year integer, -- 수능/입시 연도
  curriculum_revision text CHECK (curriculum_revision IN ('2009 개정', '2015 개정', '2022 개정')),
  desired_university_1_id uuid REFERENCES schools(id) ON DELETE SET NULL, -- FK로 변경
  desired_university_2_id uuid REFERENCES schools(id) ON DELETE SET NULL, -- FK로 변경
  desired_university_3_id uuid REFERENCES schools(id) ON DELETE SET NULL, -- FK로 변경
  desired_career_field text CHECK (desired_career_field IN ('인문계열', '사회계열', '자연계열', '공학계열', '의약계열', '예체능계열', '교육계열', '농업계열', '해양계열', '기타')),
  target_major text, -- 희망 전공
  target_score jsonb, -- 목표 점수 (과목별)
  notes text, -- 진로 관련 메모
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(student_id) -- 학생당 하나의 진로 목표
);
```

**장점**:
- 대학교 정보 정규화 (schools 테이블 FK 참조)
- 진로 정보 확장 용이 (전공, 목표 점수 등)
- 대학교 정보 일관성 보장

#### 3.2.3 parent_profiles (학부모 프로필 테이블) - 제안

**목적**: 학부모의 프로필 정보를 별도 테이블로 분리

**필드 제안**:
```sql
CREATE TABLE parent_profiles (
  id uuid PRIMARY KEY REFERENCES parent_users(id) ON DELETE CASCADE,
  tenant_id uuid REFERENCES tenants(id) ON DELETE RESTRICT,
  name text, -- 학부모 이름 (users.name과 동기화)
  phone text, -- 학부모 전화번호 (users.phone과 동기화)
  email text, -- 학부모 이메일 (users.email과 동기화)
  profile_image_url text,
  occupation text, -- 직업
  company text, -- 회사명
  position text, -- 직책
  relationship text CHECK (relationship IN ('father', 'mother', 'guardian', 'other')),
  notes text, -- 메모
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);
```

**장점**:
- 학부모 정보 확장 용이
- users 테이블과의 정보 동기화 관리
- ERD의 미사용 필드 활용

### 3.3 확장성 고려사항

#### 3.3.1 학생 상태 관리
- **student_status_history** 테이블 제안
  - 학생 상태 변경 이력 추적
  - 재학 → 휴학 → 복학 등 상태 전환 기록

#### 3.3.2 학부모-학생 관계 관리 강화
- **parent_student_links** 테이블 확장
  - `is_primary` 필드 활용 (주 보호자 지정)
  - `is_approved` 필드 활용 (승인 프로세스)
  - 관계 변경 이력 추적

#### 3.3.3 대학교 정보 확장
- **university_majors** 테이블 제안
  - 대학교별 전공 정보
  - `student_career_goals.target_major`와 연결

---

## 4. 테이블 분할 제안

### 4.1 students 테이블 분할 전략

#### 전략 1: 수직 분할 (Vertical Partitioning)

**현재 구조**:
```
students (모든 필드)
```

**제안 구조**:
```
students (기본 정보만)
  ├── student_profiles (프로필 정보)
  └── student_career_goals (진로 정보)
```

**분할 기준**:
- **기본 정보**: 자주 조회, 업데이트 빈도 낮음
- **프로필 정보**: 가끔 조회, 업데이트 빈도 중간
- **진로 정보**: 가끔 조회, 업데이트 빈도 낮음

#### 전략 2: 분할 후 테이블 구조

##### students (기본 정보)
```sql
CREATE TABLE students (
  id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  tenant_id uuid REFERENCES tenants(id) ON DELETE RESTRICT,
  school_id uuid REFERENCES schools(id) ON DELETE SET NULL, -- 활성화
  grade text NOT NULL,
  class text NOT NULL, -- class_number → class 통일
  birth_date date NOT NULL,
  student_number text, -- 활성화
  status text DEFAULT 'enrolled' CHECK (status IN ('enrolled', 'on_leave', 'graduated', 'transferred')),
  enrolled_at date, -- 활성화
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);
```

**변경 사항**:
- 프로필 정보 제거 → `student_profiles`로 이동
- 진로 정보 제거 → `student_career_goals`로 이동
- `school_id` 필드 활성화 (text → FK)
- `student_number`, `enrolled_at` 필드 활성화
- `status` 필드 추가

##### student_profiles (프로필 정보)
```sql
CREATE TABLE student_profiles (
  id uuid PRIMARY KEY REFERENCES students(id) ON DELETE CASCADE,
  tenant_id uuid REFERENCES tenants(id) ON DELETE RESTRICT,
  gender text CHECK (gender IN ('남', '여')),
  phone text,
  mother_phone text,
  father_phone text,
  profile_image_url text,
  address text, -- ERD 필드 활용
  emergency_contact text, -- ERD 필드 활용
  medical_info text, -- ERD 필드 활용 (민감 정보)
  bio text,
  interests jsonb,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);
```

##### student_career_goals (진로 정보)
```sql
CREATE TABLE student_career_goals (
  id uuid PRIMARY KEY,
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  tenant_id uuid REFERENCES tenants(id) ON DELETE RESTRICT,
  exam_year integer,
  curriculum_revision text CHECK (curriculum_revision IN ('2009 개정', '2015 개정', '2022 개정')),
  desired_university_1_id uuid REFERENCES schools(id) ON DELETE SET NULL,
  desired_university_2_id uuid REFERENCES schools(id) ON DELETE SET NULL,
  desired_university_3_id uuid REFERENCES schools(id) ON DELETE SET NULL,
  desired_career_field text CHECK (desired_career_field IN ('인문계열', '사회계열', '자연계열', '공학계열', '의약계열', '예체능계열', '교육계열', '농업계열', '해양계열', '기타')),
  target_major text,
  target_score jsonb,
  notes text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(student_id)
);
```

### 4.2 정규화 및 비정규화 고려

#### 정규화 적용

**1. 대학교 정보 정규화**
- `desired_university_1~3` text → `schools.id` FK
- 대학교 정보 중복 제거
- 대학교 정보 일관성 보장

**2. 학교 정보 정규화**
- `school` text → `school_id` FK
- 학교 정보 중복 제거

#### 비정규화 고려

**1. 조회 성능 최적화**
- 자주 함께 조회되는 필드는 같은 테이블에 유지
- `students` + `student_profiles` 조인 최소화를 위한 뷰 생성 고려

**2. 캐싱 전략**
- 학생 기본 정보는 자주 조회되므로 캐싱
- 프로필/진로 정보는 필요 시에만 조회

### 4.3 마이그레이션 계획

#### Phase 1: 준비 단계
1. **새 테이블 생성**
   - `student_profiles` 테이블 생성
   - `student_career_goals` 테이블 생성
   - `parent_profiles` 테이블 생성

2. **데이터 마이그레이션 스크립트 작성**
   - 기존 `students` 데이터를 새 테이블로 분할
   - `desired_university_1~3` text를 `schools.id`로 변환

#### Phase 2: 데이터 마이그레이션
1. **기존 데이터 백업**
2. **데이터 분할 마이그레이션**
   ```sql
   -- student_profiles 데이터 이동
   INSERT INTO student_profiles (id, tenant_id, gender, phone, mother_phone, father_phone, ...)
   SELECT id, tenant_id, gender, phone, mother_phone, father_phone, ...
   FROM students;
   
   -- student_career_goals 데이터 이동
   INSERT INTO student_career_goals (student_id, tenant_id, exam_year, curriculum_revision, ...)
   SELECT id, tenant_id, exam_year, curriculum_revision, ...
   FROM students;
   ```

3. **대학교 정보 정규화**
   ```sql
   -- desired_university_1~3 text를 schools.id로 변환
   UPDATE student_career_goals
   SET desired_university_1_id = (
     SELECT id FROM schools 
     WHERE name = student_career_goals.desired_university_1_text 
     AND type = '대학교'
     LIMIT 1
   );
   ```

#### Phase 3: 코드 업데이트
1. **데이터 접근 레이어 수정**
   - `lib/data/students.ts` 업데이트
   - 조인 쿼리로 변경

2. **타입 정의 업데이트**
   - `Student` 타입 분리
   - `StudentProfile`, `StudentCareerGoals` 타입 추가

3. **API/Server Actions 업데이트**
   - 학생 정보 조회/수정 로직 변경

#### Phase 4: 정리 단계
1. **기존 필드 제거**
   - `students` 테이블에서 프로필/진로 필드 제거
   - 마이그레이션 완료 후 실행

2. **인덱스 최적화**
   - 새 테이블에 인덱스 추가
   - 조인 성능 최적화

#### Phase 5: 검증
1. **데이터 무결성 검증**
2. **성능 테스트**
3. **기능 테스트**

---

## 5. 개선안 요약

### 5.1 즉시 적용 가능한 개선사항

1. **테이블명/필드명 통일**
   - `parent_student_links` vs `student_parent_links` 통일
   - `relation` vs `relationship` 통일
   - `class` vs `class_number` 통일

2. **미사용 필드 정리**
   - ERD와 실제 코드 간 불일치 해결
   - 미사용 필드 제거 또는 활용 계획 수립

3. **값 형식 통일**
   - `gender` 필드 값 형식 통일 (영어 vs 한글)

### 5.2 중기 개선사항 (1-2개월)

1. **테이블 분할**
   - `student_profiles` 테이블 생성
   - `student_career_goals` 테이블 생성
   - 데이터 마이그레이션

2. **대학교 정보 정규화**
   - `desired_university_1~3`을 `schools.id` FK로 변경

3. **학교 정보 정규화**
   - `school` text를 `school_id` FK로 변경

### 5.3 장기 개선사항 (3-6개월)

1. **학부모 프로필 확장**
   - `parent_profiles` 테이블 생성
   - 학부모 정보 확장

2. **Soft Delete 적용**
   - `students` 테이블에 `deleted_at` 필드 추가
   - 중요한 데이터 Soft Delete 적용

3. **상태 관리 강화**
   - `student_status_history` 테이블 생성
   - 학생 상태 변경 이력 추적

---

## 6. 참고 자료

### 관련 문서
- `doc/students-parents-tables-analysis.md`: 테이블 구성 분석
- `doc/students-parents-core-tables.md`: 핵심 테이블과 속성 정리

### ERD 문서
- `timetable/erd-cloud/01_core_tables.sql`: 핵심 테이블 정의
- `timetable/erd-cloud/all_tables.sql`: 전체 테이블 정의

### 실제 코드
- `lib/data/students.ts`: 학생 데이터 조회/저장 로직
- `lib/data/parents.ts`: 학부모 데이터 조회 로직
- `app/(parent)/_utils.ts`: 학부모-학생 연결 조회 로직

---

**마지막 업데이트**: 2025-01-31










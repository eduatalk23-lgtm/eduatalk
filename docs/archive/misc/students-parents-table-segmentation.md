# 학생 및 학부모 정보 관련 테이블 세분화 제안

## 개요

이 문서는 학생 및 학부모 정보 관련 테이블의 세분화 방안을 제안하고, 기존 구현 테이블 사용 현황과 별도 관리 필요성을 분석한 문서입니다.

**작성 일자**: 2025-01-31  
**목적**: 테이블 세분화를 통한 유지보수성 및 확장성 향상

---

## 1. 현재 구조 분석

### 1.1 기존 테이블 구조

#### students 테이블 (현재)

```sql
students (
  -- 기본 정보 (5개)
  id, tenant_id, name, grade, class, birth_date, school,

  -- 프로필 정보 (4개)
  gender, phone, mother_phone, father_phone,

  -- 진로 정보 (6개)
  exam_year, curriculum_revision,
  desired_university_1, desired_university_2, desired_university_3,
  desired_career_field,

  -- 타임스탬프 (2개)
  created_at, updated_at
)
```

#### parent_users 테이블 (현재)

```sql
parent_users (
  id, tenant_id, created_at
  -- relationship, occupation, updated_at (ERD에는 있으나 미사용)
)
```

### 1.2 실제 사용 현황 분석

#### UI/UX 관점에서의 필드 그룹화

**학생 설정 페이지** (`app/(student)/settings/page.tsx`)에서 탭으로 구분:

1. **기본 정보 탭** (`basic`):

   - `name`, `school`, `grade`, `birth_date`
   - `gender`, `phone`, `mother_phone`, `father_phone`

2. **입시 정보 탭** (`exam`):

   - `exam_year`, `curriculum_revision`

3. **진로 정보 탭** (`career`):
   - `desired_university_1`, `desired_university_2`, `desired_university_3`
   - `desired_career_field`

#### 데이터 접근 패턴 분석

| 필드 그룹   | 조회 빈도 | 업데이트 빈도 | 접근 권한            | 별도 관리 필요성 |
| ----------- | --------- | ------------- | -------------------- | ---------------- |
| 기본 정보   | 매우 높음 | 낮음          | 학생, 관리자         | ⚠️ 중간          |
| 프로필 정보 | 높음      | 중간          | 학생, 관리자         | ✅ 높음          |
| 진로 정보   | 낮음      | 낮음          | 학생, 관리자, 학부모 | ✅ 높음          |

### 1.3 기존 테이블 사용 현황

#### students 테이블 사용 위치

**데이터 조회**:

- `lib/data/students.ts`: `getStudentById()`, `listStudentsByTenant()`
- `app/(student)/actions/studentActions.ts`: `getCurrentStudent()`

**데이터 업데이트**:

- `lib/data/students.ts`: `upsertStudent()`
- `app/(student)/actions/studentActions.ts`: `updateStudentProfile()`

**사용 패턴**:

- 모든 필드를 한 번에 조회 (`SELECT *`)
- 모든 필드를 한 번에 업데이트 (`upsert`)
- 필요한 필드만 조회하는 경우가 거의 없음

#### 문제점

1. **불필요한 데이터 조회**: 프로필만 필요한 경우에도 진로 정보까지 조회
2. **업데이트 충돌 가능성**: 프로필과 진로 정보를 동시에 업데이트할 때
3. **확장성 제한**: 새로운 프로필/진로 필드 추가 시 테이블 구조 변경 필요
4. **권한 관리 어려움**: 학부모는 진로 정보만 조회 가능해야 하나, 현재는 전체 조회

---

## 2. 별도 관리 필요성 분석

### 2.1 데이터 특성별 분리 필요성

#### 2.1.1 기본 정보 (students 테이블 유지)

**특성**:

- 자주 조회되지만 업데이트 빈도 낮음
- 다른 테이블에서 FK로 참조됨 (20개 이상)
- 학생 식별에 필수

**별도 관리 필요성**: ❌ 낮음

- 현재 `students` 테이블에 유지
- 단, 프로필/진로 정보는 분리

#### 2.1.2 프로필 정보 (별도 테이블 필요)

**특성**:

- 업데이트 빈도 중간 (학생이 직접 수정)
- 민감 정보 포함 가능 (전화번호, 주소 등)
- 확장 가능성 높음 (프로필 이미지, 자기소개 등)

**별도 관리 필요성**: ✅ 높음

**이유**:

1. **보안**: 민감 정보 분리 관리
2. **성능**: 프로필만 필요한 경우 조회 최적화
3. **확장성**: 새로운 프로필 필드 추가 용이
4. **권한**: 프로필 정보 접근 권한 별도 관리

#### 2.1.3 진로 정보 (별도 테이블 필요)

**특성**:

- 업데이트 빈도 낮음 (입시 시즌에만 수정)
- 학부모도 조회 가능해야 함
- 대학교 정보 정규화 필요 (`schools` 테이블 FK 참조)
- 확장 가능성 높음 (전공, 목표 점수 등)

**별도 관리 필요성**: ✅ 매우 높음

**이유**:

1. **정규화**: 대학교 정보를 `schools` 테이블 FK로 참조
2. **권한**: 학부모는 진로 정보만 조회 가능
3. **확장성**: 진로 관련 필드 확장 용이
4. **성능**: 진로 정보만 필요한 경우 조회 최적화

### 2.2 업데이트 패턴 분석

#### 현재 업데이트 패턴

```typescript
// 모든 필드를 한 번에 업데이트
await upsertStudent({
  id, name, grade, class, birth_date, school,
  gender, phone, mother_phone, father_phone,
  exam_year, curriculum_revision,
  desired_university_1, desired_university_2, desired_university_3,
  desired_career_field
});
```

#### 문제점

1. **불필요한 업데이트**: 프로필만 수정해도 진로 정보까지 업데이트
2. **트랜잭션 복잡도**: 모든 필드가 하나의 트랜잭션에 포함
3. **충돌 가능성**: 동시 업데이트 시 충돌 가능

#### 개선 후 업데이트 패턴

```typescript
// 필요한 부분만 업데이트
await updateStudentProfile({ gender, phone, ... }); // 프로필만
await updateStudentCareerGoals({ exam_year, desired_university_1, ... }); // 진로만
```

### 2.3 접근 권한 분석

#### 현재 접근 권한

| 역할   | 기본 정보 | 프로필 정보 | 진로 정보 |
| ------ | --------- | ----------- | --------- |
| 학생   | 읽기/쓰기 | 읽기/쓰기   | 읽기/쓰기 |
| 학부모 | 읽기      | 읽기        | 읽기      |
| 관리자 | 읽기/쓰기 | 읽기/쓰기   | 읽기/쓰기 |

#### 문제점

- 학부모가 프로필 정보(전화번호 등)에 접근할 필요 없음
- 진로 정보만 별도 관리하면 권한 제어 용이

#### 개선 후 접근 권한

| 역할   | 기본 정보 | 프로필 정보  | 진로 정보 |
| ------ | --------- | ------------ | --------- |
| 학생   | 읽기/쓰기 | 읽기/쓰기    | 읽기/쓰기 |
| 학부모 | 읽기      | ❌ 접근 불가 | 읽기      |
| 관리자 | 읽기/쓰기 | 읽기/쓰기    | 읽기/쓰기 |

---

## 3. 테이블 세분화 제안

### 3.1 세분화 전략

#### 전략: 수직 분할 (Vertical Partitioning)

**원칙**:

1. **기본 정보**: `students` 테이블 유지 (FK 참조 많음)
2. **프로필 정보**: `student_profiles` 테이블 분리
3. **진로 정보**: `student_career_goals` 테이블 분리

### 3.2 제안 테이블 구조

#### 3.2.1 students (기본 정보) - 유지 및 정리

**목적**: 학생의 기본 식별 정보 및 학적 정보

```sql
CREATE TABLE students (
  -- 기본 식별 정보
  id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  tenant_id uuid REFERENCES tenants(id) ON DELETE RESTRICT,

  -- 학적 정보
  school_id uuid REFERENCES schools(id) ON DELETE SET NULL, -- 활성화 (text → FK)
  grade text NOT NULL,
  class text NOT NULL, -- class_number → class 통일
  birth_date date NOT NULL,
  student_number text, -- 활성화 (ERD 필드 활용)

  -- 상태 정보
  status text DEFAULT 'enrolled' CHECK (status IN ('enrolled', 'on_leave', 'graduated', 'transferred')),
  enrolled_at date, -- 활성화 (ERD 필드 활용)

  -- 타임스탬프
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- 인덱스
CREATE INDEX idx_students_school_id ON students(school_id);
CREATE INDEX idx_students_status ON students(status);
CREATE INDEX idx_students_grade ON students(grade);
```

**변경 사항**:

- 프로필 정보 제거 → `student_profiles`로 이동
- 진로 정보 제거 → `student_career_goals`로 이동
- `school` text → `school_id` FK (정규화)
- `student_number`, `enrolled_at` 필드 활성화
- `status` 필드 추가

**별도 관리 필요성**: ❌ 낮음 (기본 테이블 유지)

#### 3.2.2 student_profiles (프로필 정보) - 신규 생성

**목적**: 학생의 프로필 및 연락처 정보

```sql
CREATE TABLE student_profiles (
  id uuid PRIMARY KEY REFERENCES students(id) ON DELETE CASCADE,
  tenant_id uuid REFERENCES tenants(id) ON DELETE RESTRICT,

  -- 개인 정보
  gender text CHECK (gender IN ('남', '여')),
  phone text,
  profile_image_url text,

  -- 가족 연락처
  mother_phone text,
  father_phone text,

  -- 주소 정보 (ERD 필드 활용)
  address text,
  address_detail text,
  postal_code text,

  -- 비상 연락처 (ERD 필드 활용)
  emergency_contact text,
  emergency_contact_phone text,

  -- 의료 정보 (ERD 필드 활용, 민감 정보)
  medical_info text, -- 암호화 고려

  -- 추가 프로필 정보
  bio text, -- 자기소개
  interests jsonb, -- 관심사 배열

  -- 타임스탬프
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- 인덱스
CREATE INDEX idx_student_profiles_tenant_id ON student_profiles(tenant_id);
```

**별도 관리 필요성**: ✅ 높음

**이유**:

1. **보안**: 민감 정보(전화번호, 주소, 의료 정보) 분리
2. **성능**: 프로필만 필요한 경우 조회 최적화
3. **확장성**: 프로필 필드 확장 용이
4. **권한**: 프로필 정보 접근 권한 별도 관리

#### 3.2.3 student_career_goals (진로 정보) - 신규 생성

**목적**: 학생의 진로 목표 및 입시 정보

```sql
CREATE TABLE student_career_goals (
  id uuid PRIMARY KEY,
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  tenant_id uuid REFERENCES tenants(id) ON DELETE RESTRICT,

  -- 입시 정보
  exam_year integer, -- 수능/입시 연도
  curriculum_revision text CHECK (curriculum_revision IN ('2009 개정', '2015 개정', '2022 개정')),

  -- 희망 대학교 (정규화: schools 테이블 FK 참조)
  desired_university_1_id uuid REFERENCES schools(id) ON DELETE SET NULL,
  desired_university_2_id uuid REFERENCES schools(id) ON DELETE SET NULL,
  desired_university_3_id uuid REFERENCES schools(id) ON DELETE SET NULL,

  -- 희망 진로
  desired_career_field text CHECK (desired_career_field IN (
    '인문계열', '사회계열', '자연계열', '공학계열',
    '의약계열', '예체능계열', '교육계열', '농업계열',
    '해양계열', '기타'
  )),

  -- 확장 필드
  target_major text, -- 희망 전공
  target_major_2 text, -- 희망 전공 2순위
  target_score jsonb, -- 목표 점수 (과목별)
  target_university_type text, -- 목표 대학 유형 (4년제/2년제)

  -- 메모
  notes text, -- 진로 관련 메모

  -- 타임스탬프
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,

  -- 제약조건
  UNIQUE(student_id) -- 학생당 하나의 진로 목표
);

-- 인덱스
CREATE INDEX idx_student_career_goals_student_id ON student_career_goals(student_id);
CREATE INDEX idx_student_career_goals_exam_year ON student_career_goals(exam_year);
CREATE INDEX idx_student_career_goals_university_1 ON student_career_goals(desired_university_1_id);
CREATE INDEX idx_student_career_goals_university_2 ON student_career_goals(desired_university_2_id);
CREATE INDEX idx_student_career_goals_university_3 ON student_career_goals(desired_university_3_id);
```

**별도 관리 필요성**: ✅ 매우 높음

**이유**:

1. **정규화**: 대학교 정보를 `schools` 테이블 FK로 참조
2. **권한**: 학부모는 진로 정보만 조회 가능
3. **확장성**: 진로 관련 필드 확장 용이
4. **성능**: 진로 정보만 필요한 경우 조회 최적화

#### 3.2.4 parent_profiles (학부모 프로필) - 신규 생성

**목적**: 학부모의 프로필 정보

```sql
CREATE TABLE parent_profiles (
  id uuid PRIMARY KEY REFERENCES parent_users(id) ON DELETE CASCADE,
  tenant_id uuid REFERENCES tenants(id) ON DELETE RESTRICT,

  -- 기본 정보 (users 테이블과 동기화)
  name text, -- users.name과 동기화
  phone text, -- users.phone과 동기화
  email text, -- users.email과 동기화
  profile_image_url text,

  -- 직업 정보 (ERD 필드 활용)
  occupation text,
  company text, -- 회사명
  position text, -- 직책
  department text, -- 부서

  -- 관계 정보 (ERD 필드 활용)
  relationship text CHECK (relationship IN ('father', 'mother', 'guardian', 'other')),

  -- 연락처 정보
  work_phone text, -- 직장 전화번호
  home_address text, -- 집 주소

  -- 메모
  notes text,

  -- 타임스탬프
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- 인덱스
CREATE INDEX idx_parent_profiles_tenant_id ON parent_profiles(tenant_id);
CREATE INDEX idx_parent_profiles_relationship ON parent_profiles(relationship);
```

**별도 관리 필요성**: ✅ 높음

**이유**:

1. **확장성**: 학부모 정보 확장 용이
2. **ERD 필드 활용**: 미사용 필드(`relationship`, `occupation`) 활용
3. **users 동기화**: users 테이블과의 정보 동기화 관리

### 3.3 테이블 관계도

```
users (통합 사용자)
  ├── students (기본 정보)
  │     ├── student_profiles (프로필 정보) [1:1]
  │     └── student_career_goals (진로 정보) [1:1]
  │
  └── parent_users (기본 정보)
        └── parent_profiles (프로필 정보) [1:1]

schools (학교)
  ├── students.school_id [FK]
  └── student_career_goals.desired_university_1~3_id [FK]
```

---

## 4. 기존 테이블 사용 + 별도 관리 필요성 분석

### 4.1 students 테이블 유지 이유

#### ✅ 유지해야 하는 이유

1. **FK 참조 많음**: 20개 이상의 테이블이 `students.id`를 FK로 참조
2. **기본 식별 정보**: 학생 식별에 필수적인 정보
3. **조회 빈도 높음**: 자주 조회되는 기본 정보
4. **마이그레이션 복잡도**: FK 참조가 많아 분리 시 마이그레이션 복잡

#### ⚠️ 정리 필요 사항

1. **프로필 정보 제거**: `gender`, `phone`, `mother_phone`, `father_phone` → `student_profiles`
2. **진로 정보 제거**: `exam_year`, `curriculum_revision`, `desired_university_1~3`, `desired_career_field` → `student_career_goals`
3. **정규화**: `school` text → `school_id` FK
4. **필드 활성화**: `student_number`, `enrolled_at` 활용

### 4.2 별도 관리 필요성 상세 분석

#### 4.2.1 student_profiles 별도 관리 필요성

**필요성 점수**: 9/10

**이유**:

1. **보안 (3점)**:

   - 민감 정보(전화번호, 주소, 의료 정보) 분리
   - 프로필 정보 접근 권한 별도 관리 가능
   - GDPR 등 개인정보 보호 규정 준수 용이

2. **성능 (2점)**:

   - 프로필만 필요한 경우 조회 최적화
   - 불필요한 데이터 조회 방지

3. **확장성 (2점)**:

   - 프로필 필드 확장 용이 (프로필 이미지, 자기소개 등)
   - 새로운 프로필 필드 추가 시 테이블 구조 변경 최소화

4. **유지보수 (2점)**:
   - 프로필 정보 업데이트 로직 분리
   - 프로필 관련 버그 격리

#### 4.2.2 student_career_goals 별도 관리 필요성

**필요성 점수**: 10/10

**이유**:

1. **정규화 (3점)**:

   - 대학교 정보를 `schools` 테이블 FK로 참조
   - 데이터 일관성 보장
   - 대학교 정보 중복 제거

2. **권한 (3점)**:

   - 학부모는 진로 정보만 조회 가능
   - 프로필 정보 접근 제한 가능

3. **확장성 (2점)**:

   - 진로 관련 필드 확장 용이 (전공, 목표 점수 등)
   - 진로 정보 확장 시 테이블 구조 변경 최소화

4. **성능 (2점)**:
   - 진로 정보만 필요한 경우 조회 최적화
   - 불필요한 데이터 조회 방지

#### 4.2.3 parent_profiles 별도 관리 필요성

**필요성 점수**: 7/10

**이유**:

1. **확장성 (2점)**:

   - 학부모 정보 확장 용이
   - ERD의 미사용 필드 활용

2. **users 동기화 (2점)**:

   - users 테이블과의 정보 동기화 관리
   - 학부모 정보 업데이트 로직 분리

3. **일관성 (2점)**:

   - students와 동일한 구조로 프로필 분리
   - 코드 일관성 유지

4. **현재 사용도 낮음 (1점 감점)**:
   - 현재 parent_users 테이블 사용도가 낮음
   - 우선순위는 students보다 낮음

---

## 5. 세분화 구현 계획

### 5.1 단계별 구현 계획

#### Phase 1: student_career_goals 테이블 생성 (최우선)

**이유**:

- 정규화 필요성 가장 높음 (대학교 FK 참조)
- 학부모 권한 관리 필요
- 확장성 요구사항 높음

**작업 내용**:

1. `student_career_goals` 테이블 생성
2. 기존 `students` 테이블의 진로 정보 마이그레이션
3. `desired_university_1~3` text → `schools.id` FK 변환
4. 코드 업데이트 (조회/수정 로직)

#### Phase 2: student_profiles 테이블 생성

**이유**:

- 보안 및 성능 개선
- 프로필 정보 확장 필요

**작업 내용**:

1. `student_profiles` 테이블 생성
2. 기존 `students` 테이블의 프로필 정보 마이그레이션
3. ERD 필드 활용 (`address`, `emergency_contact`, `medical_info`)
4. 코드 업데이트 (조회/수정 로직)

#### Phase 3: students 테이블 정리

**이유**:

- 프로필/진로 정보 제거 후 기본 정보만 유지
- 정규화 (`school` → `school_id`)

**작업 내용**:

1. 프로필/진로 필드 제거
2. `school` text → `school_id` FK 변경
3. `student_number`, `enrolled_at` 필드 활성화
4. `status` 필드 추가

#### Phase 4: parent_profiles 테이블 생성 (선택)

**이유**:

- students와 일관성 유지
- 학부모 정보 확장

**작업 내용**:

1. `parent_profiles` 테이블 생성
2. ERD 필드 활용 (`relationship`, `occupation`)
3. 코드 업데이트

### 5.2 마이그레이션 시 주의사항

#### 데이터 무결성

- 기존 데이터 백업 필수
- 마이그레이션 중 데이터 손실 방지
- FK 제약조건 확인

#### 성능 고려

- 대량 데이터 마이그레이션 시 배치 처리
- 인덱스 생성 후 마이그레이션
- 트랜잭션 범위 최소화

#### 롤백 계획

- 마이그레이션 실패 시 롤백 스크립트 준비
- 단계별 검증 포인트 설정

---

## 6. 세분화 효과 분석

### 6.1 예상 효과

#### 성능 개선

- **조회 성능**: 필요한 필드만 조회하여 성능 향상 (20-30% 예상)
- **업데이트 성능**: 부분 업데이트로 성능 향상 (10-20% 예상)
- **인덱스 효율**: 테이블별 인덱스 최적화 가능

#### 유지보수성 향상

- **코드 분리**: 프로필/진로 정보 업데이트 로직 분리
- **버그 격리**: 프로필/진로 관련 버그 영향 범위 축소
- **테스트 용이**: 테이블별 단위 테스트 가능

#### 확장성 향상

- **필드 추가**: 새로운 프로필/진로 필드 추가 용이
- **기능 확장**: 진로 관련 기능 확장 용이 (전공, 목표 점수 등)

#### 보안 강화

- **권한 관리**: 프로필/진로 정보 접근 권한 별도 관리
- **민감 정보 보호**: 민감 정보 분리 관리

### 6.2 비용 분석

#### 개발 비용

- **테이블 생성**: 1-2일
- **마이그레이션 스크립트**: 2-3일
- **코드 업데이트**: 3-5일
- **테스트**: 2-3일
- **총 예상 기간**: 8-13일

#### 운영 비용

- **데이터베이스 용량**: 거의 동일 (데이터 분리만)
- **쿼리 복잡도**: 조인 필요로 인한 약간의 증가
- **유지보수**: 테이블 증가로 인한 약간의 증가

---

## 7. 권장사항

### 7.1 즉시 적용 (High Priority)

1. **student_career_goals 테이블 생성**

   - 정규화 필요성 가장 높음
   - 학부모 권한 관리 필요
   - 대학교 정보 FK 참조

2. **students 테이블 정규화**
   - `school` text → `school_id` FK
   - `desired_university_1~3` → `schools.id` FK (student_career_goals로 이동)

### 7.2 중기 적용 (Medium Priority)

3. **student_profiles 테이블 생성**

   - 보안 및 성능 개선
   - 프로필 정보 확장

4. **students 테이블 정리**
   - 프로필/진로 필드 제거
   - 기본 정보만 유지

### 7.3 장기 적용 (Low Priority)

5. **parent_profiles 테이블 생성**
   - students와 일관성 유지
   - 학부모 정보 확장

---

## 8. 참고 자료

### 관련 문서

- `doc/students-parents-tables-analysis.md`: 테이블 구성 분석
- `doc/students-parents-core-tables.md`: 핵심 테이블과 속성 정리
- `doc/students-parents-hierarchy-improvement.md`: 위계 분석 및 개선안

### 실제 코드

- `app/(student)/settings/page.tsx`: 학생 설정 페이지 (탭 구분)
- `app/(student)/actions/studentActions.ts`: 학생 정보 업데이트 로직
- `lib/data/students.ts`: 학생 데이터 조회/저장 로직

---

**마지막 업데이트**: 2025-01-31









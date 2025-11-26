# 학생 및 학부모 테이블 구성 분석

## 개요

이 문서는 TimeLevelUp 프로젝트의 학생(students) 및 학부모(parent_users) 테이블의 구조와 관계를 분석한 문서입니다.

**분석 일자**: 2025-01-31  
**데이터 소스**: ERD 문서, 실제 코드, 마이그레이션 파일

---

## 테이블 구조

### 1. students (학생 정보 테이블)

#### 기본 정보

- **테이블명**: `students`
- **Primary Key**: `id` (uuid, FK → users.id)
- **Foreign Keys**:
  - `id` → `users.id` (ON DELETE CASCADE)
  - `tenant_id` → `tenants.id` (ON DELETE RESTRICT)
  - `school_id` → `schools.id` (nullable)

#### ERD 문서 기준 필드 (timetable/erd-cloud/01_core_tables.sql)

```sql
CREATE TABLE students (
  id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  student_number text,
  school_id uuid,
  grade text,
  class_number text,
  birth_date date,
  gender text CHECK (gender IN ('male', 'female', 'other')),
  address text,
  parent_contact text,
  emergency_contact text,
  medical_info text,
  notes text,
  is_active boolean DEFAULT true,
  enrolled_at date,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);
```

#### 실제 코드에서 사용되는 필드 (lib/data/students.ts)

실제 애플리케이션 코드에서는 ERD 문서와 다른 필드명과 추가 필드들이 사용됩니다:

**기본 필드**:

- `id`: uuid (PK)
- `tenant_id`: uuid (nullable, deprecated - 더 이상 사용하지 않음)
- `name`: text (nullable) - users 테이블과 조인하여 사용
- `grade`: text (nullable)
- `class`: text (nullable) - ERD의 `class_number`와 매핑
- `birth_date`: date (nullable, string으로 저장)

**마이페이지 필드** (학생 설정 페이지에서 사용):

- `school`: text (nullable) - 학교명
- `gender`: "남" | "여" | null - ERD의 `gender`와 값 형식이 다름 (한글 사용)
- `phone`: text (nullable) - 학생 연락처
- `mother_phone`: text (nullable) - 어머니 연락처
- `father_phone`: text (nullable) - 아버지 연락처
- `exam_year`: number (nullable) - 수능/입시 연도
- `curriculum_revision`: "2009 개정" | "2015 개정" | "2022 개정" | null - 교육과정 개정 버전
- `desired_university_1`: text (nullable) - 희망 대학 1
- `desired_university_2`: text (nullable) - 희망 대학 2
- `desired_university_3`: text (nullable) - 희망 대학 3
- `desired_career_field`: CareerField | null - 희망 진로 분야
  - 가능한 값: "인문계열", "사회계열", "자연계열", "공학계열", "의약계열", "예체능계열", "교육계열", "농업계열", "해양계열", "기타"

**타임스탬프**:

- `created_at`: timestamptz (nullable)
- `updated_at`: timestamptz (nullable)

#### 필드 매핑 불일치 사항

| ERD 문서                     | 실제 코드                      | 비고                   |
| ---------------------------- | ------------------------------ | ---------------------- |
| `class_number`               | `class`                        | 필드명 불일치          |
| `gender` (male/female/other) | `gender` ("남"/"여")           | 값 형식 불일치         |
| `parent_contact`             | `mother_phone`, `father_phone` | 분리된 필드로 사용     |
| `student_number`             | 미사용                         | 코드에서 사용되지 않음 |
| `address`                    | 미사용                         | 코드에서 사용되지 않음 |
| `emergency_contact`          | 미사용                         | 코드에서 사용되지 않음 |
| `medical_info`               | 미사용                         | 코드에서 사용되지 않음 |
| `notes`                      | 미사용                         | 코드에서 사용되지 않음 |
| `is_active`                  | 미사용                         | 코드에서 사용되지 않음 |
| `enrolled_at`                | 미사용                         | 코드에서 사용되지 않음 |

#### 사용 위치

- **데이터 조회**: `lib/data/students.ts`

  - `getStudentById()`: 학생 ID로 조회
  - `listStudentsByTenant()`: 테넌트별 학생 목록 조회 (deprecated)
  - `upsertStudent()`: 학생 정보 생성/업데이트

- **타입 정의**: `lib/data/students.ts`의 `Student` 타입

- **폼 데이터**: `app/(student)/settings/types.ts`의 `StudentFormData` 타입

---

### 2. parent_users (학부모 정보 테이블)

#### 기본 정보

- **테이블명**: `parent_users`
- **Primary Key**: `id` (uuid, FK → users.id)
- **Foreign Keys**:
  - `id` → `users.id` (ON DELETE CASCADE)
  - `tenant_id` → `tenants.id` (ON DELETE RESTRICT)

#### ERD 문서 기준 필드 (timetable/erd-cloud/01_core_tables.sql)

```sql
CREATE TABLE parent_users (
  id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  tenant_id uuid REFERENCES tenants(id) ON DELETE RESTRICT,
  relationship text CHECK (relationship IN ('father', 'mother', 'guardian', 'other')),
  occupation text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);
```

#### 실제 코드에서 사용되는 필드 (lib/data/parents.ts)

실제 코드에서는 매우 제한적인 필드만 사용됩니다:

**사용 필드**:

- `id`: uuid (PK)
- `tenant_id`: uuid (nullable)
- `created_at`: timestamptz (nullable)

**ERD에 있으나 미사용 필드**:

- `relationship`: text - ERD에는 있으나 코드에서 사용되지 않음
- `occupation`: text - ERD에는 있으나 코드에서 사용되지 않음
- `updated_at`: timestamptz - ERD에는 있으나 코드에서 사용되지 않음

#### 사용 위치

- **데이터 조회**: `lib/data/parents.ts`

  - `getParentById()`: 학부모 ID로 조회
  - `listParentsByTenant()`: 테넌트별 학부모 목록 조회

- **타입 정의**: `lib/data/parents.ts`의 `Parent` 타입

- **역할 확인**: `lib/auth/getCurrentUserRole.ts`에서 학부모 역할 확인 시 사용

---

### 3. 학생-학부모 연결 테이블

#### 테이블명 불일치 발견

**ERD 문서**: `student_parent_links`  
**실제 코드**: `parent_student_links`

> ⚠️ **주의**: 테이블명이 ERD 문서와 실제 코드에서 다릅니다. 실제 데이터베이스에서는 `parent_student_links`를 사용하는 것으로 보입니다.

#### ERD 문서 기준 구조 (timetable/erd-cloud/01_core_tables.sql)

```sql
CREATE TABLE student_parent_links (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  parent_id uuid NOT NULL REFERENCES parent_users(id) ON DELETE CASCADE,
  relationship text CHECK (relationship IN ('father', 'mother', 'guardian', 'other')),
  is_primary boolean DEFAULT false,
  is_approved boolean DEFAULT false,
  approved_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(student_id, parent_id)
);
```

#### 실제 코드에서 사용되는 구조 (app/(parent)/\_utils.ts)

**사용 필드**:

- `id`: uuid (PK)
- `tenant_id`: uuid (nullable, 코드에서 명시적으로 사용되지 않음)
- `student_id`: uuid (FK → students.id)
- `parent_id`: uuid (FK → parent_users.id)
- `relation`: text - ERD의 `relationship`과 필드명이 다름
- `created_at`: timestamptz (추정)

**ERD에 있으나 미사용 필드**:

- `is_primary`: boolean - 코드에서 사용되지 않음
- `is_approved`: boolean - 코드에서 사용되지 않음
- `approved_at`: timestamptz - 코드에서 사용되지 않음

#### 필드명 불일치

| ERD 문서       | 실제 코드  | 비고          |
| -------------- | ---------- | ------------- |
| `relationship` | `relation` | 필드명 불일치 |

#### 사용 위치

- **학생 목록 조회**: `app/(parent)/_utils.ts`

  - `getLinkedStudents()`: 학부모가 연결된 학생 목록 조회
    ```typescript
    .from("parent_student_links")
    .select("student_id, relation, students(id, name, grade, class)")
    ```

- **접근 권한 확인**: `app/(parent)/_utils.ts`
  - `canAccessStudent()`: 학부모가 특정 학생에 접근 권한이 있는지 확인

---

## 테이블 관계도

```
users (통합 사용자)
  ├── id (PK)
  ├── email
  ├── role ('student' | 'parent')
  └── name, phone, etc.

students (학생 정보)
  ├── id (PK, FK → users.id)
  ├── tenant_id (FK → tenants.id)
  ├── grade, class, birth_date
  ├── school, gender, phone
  ├── mother_phone, father_phone
  ├── exam_year, curriculum_revision
  ├── desired_university_1, 2, 3
  └── desired_career_field

parent_users (학부모 정보)
  ├── id (PK, FK → users.id)
  ├── tenant_id (FK → tenants.id)
  ├── relationship (미사용)
  └── occupation (미사용)

parent_student_links (학생-학부모 연결)
  ├── id (PK)
  ├── tenant_id (FK → tenants.id)
  ├── student_id (FK → students.id)
  ├── parent_id (FK → parent_users.id)
  ├── relation (학생과의 관계)
  ├── is_primary (미사용)
  ├── is_approved (미사용)
  └── approved_at (미사용)
```

---

## 주요 발견 사항

### 1. ERD 문서와 실제 코드 간 불일치

#### students 테이블

- **필드명 불일치**: `class_number` → `class`
- **값 형식 불일치**: `gender`의 값이 ERD는 영어, 코드는 한글
- **추가 필드**: 코드에서만 사용되는 마이페이지 관련 필드 다수 존재
- **미사용 필드**: ERD에는 있으나 코드에서 사용되지 않는 필드 다수

#### parent_users 테이블

- **미사용 필드**: `relationship`, `occupation`, `updated_at`이 ERD에는 있으나 코드에서 사용되지 않음
- **최소한의 필드만 사용**: `id`, `tenant_id`, `created_at`만 실제로 사용됨

#### 학생-학부모 연결 테이블

- **테이블명 불일치**: ERD는 `student_parent_links`, 코드는 `parent_student_links`
- **필드명 불일치**: `relationship` → `relation`
- **미사용 필드**: 승인 관련 필드(`is_approved`, `approved_at`)가 코드에서 사용되지 않음

### 2. 데이터베이스 스키마와 코드 간 동기화 필요

현재 상태로는 다음 문제가 발생할 수 있습니다:

1. **테이블명 불일치**: `student_parent_links` vs `parent_student_links`
2. **필드명 불일치**: `relationship` vs `relation`, `class_number` vs `class`
3. **값 형식 불일치**: `gender` 필드의 값 형식 차이
4. **미사용 필드**: ERD에는 있으나 실제로 사용되지 않는 필드들

### 3. 권장 사항

1. **스키마 문서화**: 실제 데이터베이스 스키마를 기준으로 문서 업데이트
2. **마이그레이션 파일 확인**: 실제 마이그레이션 파일에서 테이블 생성 구문 확인 필요
3. **코드-스키마 동기화**: ERD 문서와 실제 코드 간의 불일치 해결
4. **타입 정의 정확성**: TypeScript 타입 정의가 실제 데이터베이스 스키마와 일치하도록 보장

---

## 참고 파일

### ERD 문서

- `timetable/erd-cloud/01_core_tables.sql`: 핵심 테이블 정의
- `timetable/erd-cloud/all_tables.sql`: 전체 테이블 정의

### 실제 코드

- `lib/data/students.ts`: 학생 데이터 조회/저장 로직
- `lib/data/parents.ts`: 학부모 데이터 조회 로직
- `app/(parent)/_utils.ts`: 학부모-학생 연결 조회 로직
- `app/(student)/settings/types.ts`: 학생 폼 데이터 타입 정의

### 스키마 분석 문서

- `doc/supabase-schema-analysis.md`: 전체 스키마 분석 문서

---

**마지막 업데이트**: 2025-01-31









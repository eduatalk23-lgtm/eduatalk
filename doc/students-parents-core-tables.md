# 학생 및 학부모 핵심 테이블과 속성 정리

## 개요

이 문서는 TimeLevelUp 프로젝트의 학생 및 학부모 관련 핵심 테이블의 구조와 속성을 정리한 문서입니다.

**작성 일자**: 2025-01-31  
**목적**: 핵심 테이블의 필수/선택 속성, 외래키 관계, 실제 사용 현황을 명확히 정리

---

## 핵심 테이블 목록

1. **users** - 통합 사용자 테이블
2. **students** - 학생 정보 테이블
3. **parent_users** - 학부모 정보 테이블
4. **parent_student_links** - 학생-학부모 연결 테이블
5. **schools** - 학교 정보 테이블 (중학교, 고등학교, 대학교 포함)

---

## 1. users (통합 사용자 테이블)

### 기본 정보

- **테이블명**: `users`
- **Primary Key**: `id` (uuid, Supabase Auth 연동)
- **역할**: 모든 사용자(학생, 학부모, 관리자, 담당자)의 기본 인증 정보

### 핵심 속성

| 필드명              | 타입        | 제약조건                | 필수 | 설명                                                               |
| ------------------- | ----------- | ----------------------- | ---- | ------------------------------------------------------------------ |
| `id`                | uuid        | PRIMARY KEY             | ✅   | Supabase Auth의 사용자 ID                                          |
| `email`             | text        | UNIQUE, NOT NULL        | ✅   | 이메일 주소 (로그인 ID)                                            |
| `role`              | text        | CHECK                   | ✅   | 사용자 역할: 'superadmin', 'admin', 'teacher', 'student', 'parent' |
| `tenant_id`         | uuid        | FK → tenants.id         | ❌   | 테넌트 ID (멀티테넌트)                                             |
| `name`              | text        | -                       | ❌   | 사용자 이름                                                        |
| `phone`             | text        | -                       | ❌   | 전화번호                                                           |
| `profile_image_url` | text        | -                       | ❌   | 프로필 이미지 URL                                                  |
| `is_active`         | boolean     | DEFAULT true            | ❌   | 활성 상태                                                          |
| `last_login_at`     | timestamptz | -                       | ❌   | 마지막 로그인 시간                                                 |
| `created_at`        | timestamptz | DEFAULT now(), NOT NULL | ✅   | 생성 시간                                                          |
| `updated_at`        | timestamptz | DEFAULT now(), NOT NULL | ✅   | 수정 시간                                                          |

### 외래키 관계

- `tenant_id` → `tenants.id` (ON DELETE RESTRICT)

### 특징

- Supabase Auth와 연동되어 인증 정보 관리
- 역할(role)에 따라 `students`, `parent_users`, `admin_users` 테이블과 1:1 관계
- 모든 사용자 타입의 공통 정보를 담는 통합 테이블

---

## 2. students (학생 정보 테이블)

### 기본 정보

- **테이블명**: `students`
- **Primary Key**: `id` (uuid, FK → users.id)
- **역할**: 학생의 상세 정보 및 프로필 데이터

### 핵심 속성

#### 기본 정보 (필수/자주 사용)

| 필드명       | 타입 | 제약조건                   | 필수 | 실제 사용 | 설명                             |
| ------------ | ---- | -------------------------- | ---- | --------- | -------------------------------- |
| `id`         | uuid | PRIMARY KEY, FK → users.id | ✅   | ✅        | 학생 ID (users.id와 동일)        |
| `tenant_id`  | uuid | FK → tenants.id            | ⚠️   | ❌        | 테넌트 ID (deprecated)           |
| `name`       | text | -                          | ❌   | ✅        | 학생 이름 (users.name과 조인)    |
| `grade`      | text | -                          | ❌   | ✅        | 학년 (예: "1학년", "2학년")      |
| `class`      | text | -                          | ❌   | ✅        | 반 (ERD의 `class_number`와 매핑) |
| `birth_date` | date | -                          | ❌   | ✅        | 생년월일                         |
| `school`     | text | -                          | ❌   | ✅        | 학교명 (text로 저장)             |
| `school_id`  | uuid | FK → schools.id            | ❌   | ❌        | 학교 ID (ERD에는 있으나 미사용)  |

#### 프로필 정보 (마이페이지)

| 필드명         | 타입 | 제약조건 | 필수 | 실제 사용 | 설명                           |
| -------------- | ---- | -------- | ---- | --------- | ------------------------------ |
| `gender`       | text | -        | ❌   | ✅        | 성별: "남" \| "여" (한글 사용) |
| `phone`        | text | -        | ❌   | ✅        | 학생 연락처                    |
| `mother_phone` | text | -        | ❌   | ✅        | 어머니 연락처                  |
| `father_phone` | text | -        | ❌   | ✅        | 아버지 연락처                  |

#### 진로 정보

| 필드명                 | 타입   | 제약조건 | 필수 | 실제 사용 | 설명                                                                                                                                 |
| ---------------------- | ------ | -------- | ---- | --------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `exam_year`            | number | -        | ❌   | ✅        | 수능/입시 연도                                                                                                                       |
| `curriculum_revision`  | text   | -        | ❌   | ✅        | 교육과정: "2009 개정" \| "2015 개정" \| "2022 개정"                                                                                  |
| `desired_university_1` | text   | -        | ❌   | ✅        | 희망 대학 1 (현재 text, schools.id로 변경 제안)                                                                                      |
| `desired_university_2` | text   | -        | ❌   | ✅        | 희망 대학 2 (현재 text, schools.id로 변경 제안)                                                                                      |
| `desired_university_3` | text   | -        | ❌   | ✅        | 희망 대학 3 (현재 text, schools.id로 변경 제안)                                                                                      |
| `desired_career_field` | text   | -        | ❌   | ✅        | 희망 진로 분야: "인문계열", "사회계열", "자연계열", "공학계열", "의약계열", "예체능계열", "교육계열", "농업계열", "해양계열", "기타" |

#### 타임스탬프

| 필드명       | 타입        | 제약조건      | 필수 | 실제 사용 |
| ------------ | ----------- | ------------- | ---- | --------- |
| `created_at` | timestamptz | DEFAULT now() | ✅   | ✅        |
| `updated_at` | timestamptz | DEFAULT now() | ✅   | ✅        |

#### ERD에 있으나 미사용 필드

| 필드명              | 타입    | 설명        | 미사용 이유                             |
| ------------------- | ------- | ----------- | --------------------------------------- |
| `student_number`    | text    | 학번        | 코드에서 사용되지 않음                  |
| `class_number`      | text    | 반 번호     | `class` 필드로 대체됨                   |
| `address`           | text    | 주소        | 코드에서 사용되지 않음                  |
| `parent_contact`    | text    | 부모 연락처 | `mother_phone`, `father_phone`으로 분리 |
| `emergency_contact` | text    | 비상 연락처 | 코드에서 사용되지 않음                  |
| `medical_info`      | text    | 의료 정보   | 코드에서 사용되지 않음                  |
| `notes`             | text    | 메모        | 코드에서 사용되지 않음                  |
| `is_active`         | boolean | 활성 상태   | 코드에서 사용되지 않음                  |
| `enrolled_at`       | date    | 입학일      | 코드에서 사용되지 않음                  |

### 외래키 관계

- `id` → `users.id` (ON DELETE CASCADE)
- `tenant_id` → `tenants.id` (ON DELETE RESTRICT) - deprecated
- `school_id` → `schools.id` (nullable) - ERD에는 있으나 미사용

### 특징

- **God Object 안티패턴**: 기본 정보, 프로필 정보, 진로 정보가 모두 한 테이블에 혼재
- **필드명 불일치**: ERD의 `class_number` → 실제 코드의 `class`
- **값 형식 불일치**: `gender` 필드가 ERD는 영어, 코드는 한글
- **대학교 정보**: `desired_university_1~3`이 text로 저장되어 있으나, `schools` 테이블의 대학교 항목을 FK로 참조하도록 변경 제안

---

## 3. parent_users (학부모 정보 테이블)

### 기본 정보

- **테이블명**: `parent_users`
- **Primary Key**: `id` (uuid, FK → users.id)
- **역할**: 학부모의 상세 정보

### 핵심 속성

| 필드명         | 타입        | 제약조건                   | 필수 | 실제 사용 | 설명                                                                  |
| -------------- | ----------- | -------------------------- | ---- | --------- | --------------------------------------------------------------------- |
| `id`           | uuid        | PRIMARY KEY, FK → users.id | ✅   | ✅        | 학부모 ID (users.id와 동일)                                           |
| `tenant_id`    | uuid        | FK → tenants.id            | ❌   | ✅        | 테넌트 ID                                                             |
| `created_at`   | timestamptz | DEFAULT now(), NOT NULL    | ✅   | ✅        | 생성 시간                                                             |
| `updated_at`   | timestamptz | DEFAULT now(), NOT NULL    | ✅   | ❌        | 수정 시간 (ERD에는 있으나 미사용)                                     |
| `relationship` | text        | CHECK                      | ❌   | ❌        | 관계: 'father', 'mother', 'guardian', 'other' (ERD에는 있으나 미사용) |
| `occupation`   | text        | -                          | ❌   | ❌        | 직업 (ERD에는 있으나 미사용)                                          |

### 외래키 관계

- `id` → `users.id` (ON DELETE CASCADE)
- `tenant_id` → `tenants.id` (ON DELETE RESTRICT)

### 특징

- **최소한의 필드만 사용**: `id`, `tenant_id`, `created_at`만 실제로 사용됨
- **미사용 필드 다수**: ERD에는 `relationship`, `occupation`, `updated_at`이 있으나 코드에서 사용되지 않음
- **확장 필요**: 학부모 프로필 정보를 위한 별도 테이블(`parent_profiles`) 분리 제안

---

## 4. parent_student_links (학생-학부모 연결 테이블)

### 기본 정보

- **테이블명**: `parent_student_links` (실제 코드) / `student_parent_links` (ERD 문서)
- **Primary Key**: `id` (uuid)
- **역할**: 학생과 학부모 간의 다대다 관계 관리

### 핵심 속성

| 필드명        | 타입        | 제약조건             | 필수 | 실제 사용 | 설명                                        |
| ------------- | ----------- | -------------------- | ---- | --------- | ------------------------------------------- |
| `id`          | uuid        | PRIMARY KEY          | ✅   | ✅        | 연결 ID                                     |
| `tenant_id`   | uuid        | FK → tenants.id      | ✅   | ❌        | 테넌트 ID (코드에서 명시적 사용 안 함)      |
| `student_id`  | uuid        | FK → students.id     | ✅   | ✅        | 학생 ID                                     |
| `parent_id`   | uuid        | FK → parent_users.id | ✅   | ✅        | 학부모 ID                                   |
| `relation`    | text        | -                    | ❌   | ✅        | 관계 (ERD의 `relationship`과 필드명 불일치) |
| `created_at`  | timestamptz | DEFAULT now()        | ✅   | ✅        | 생성 시간                                   |
| `is_primary`  | boolean     | DEFAULT false        | ❌   | ❌        | 주 보호자 여부 (ERD에는 있으나 미사용)      |
| `is_approved` | boolean     | DEFAULT false        | ❌   | ❌        | 승인 여부 (ERD에는 있으나 미사용)           |
| `approved_at` | timestamptz | -                    | ❌   | ❌        | 승인 시간 (ERD에는 있으나 미사용)           |

### 제약조건

- `UNIQUE(student_id, parent_id)` - 한 학생과 한 학부모는 하나의 연결만 가능

### 외래키 관계

- `tenant_id` → `tenants.id` (ON DELETE RESTRICT)
- `student_id` → `students.id` (ON DELETE CASCADE)
- `parent_id` → `parent_users.id` (ON DELETE CASCADE)

### 특징

- **테이블명 불일치**: ERD는 `student_parent_links`, 실제 코드는 `parent_student_links`
- **필드명 불일치**: ERD는 `relationship`, 실제 코드는 `relation`
- **승인 기능 미구현**: `is_approved`, `approved_at` 필드가 있으나 사용되지 않음
- **주 보호자 기능 미구현**: `is_primary` 필드가 있으나 사용되지 않음

---

## 5. schools (학교 정보 테이블)

### 기본 정보

- **테이블명**: `schools`
- **Primary Key**: `id` (uuid)
- **역할**: 중학교, 고등학교, 대학교 정보 관리

### 핵심 속성

#### 공통 속성

| 필드명           | 타입        | 제약조건        | 필수 | 설명                                          |
| ---------------- | ----------- | --------------- | ---- | --------------------------------------------- |
| `id`             | uuid        | PRIMARY KEY     | ✅   | 학교 ID                                       |
| `name`           | text        | NOT NULL        | ✅   | 학교명                                        |
| `type`           | text        | CHECK           | ✅   | 학교 유형: "중학교" \| "고등학교" \| "대학교" |
| `region_id`      | uuid        | FK → regions.id | ❌   | 지역 ID                                       |
| `address`        | text        | -               | ❌   | 주소                                          |
| `postal_code`    | text        | -               | ❌   | 우편번호                                      |
| `address_detail` | text        | -               | ❌   | 상세 주소                                     |
| `city`           | text        | -               | ❌   | 시/도                                         |
| `district`       | text        | -               | ❌   | 시/군/구                                      |
| `phone`          | text        | -               | ❌   | 전화번호                                      |
| `display_order`  | number      | -               | ❌   | 표시 순서                                     |
| `is_active`      | boolean     | DEFAULT true    | ❌   | 활성 상태                                     |
| `created_at`     | timestamptz | DEFAULT now()   | ✅   | 생성 시간                                     |
| `updated_at`     | timestamptz | DEFAULT now()   | ✅   | 수정 시간                                     |

#### 고등학교 전용 속성

| 필드명     | 타입 | 제약조건 | 설명                                                          |
| ---------- | ---- | -------- | ------------------------------------------------------------- |
| `category` | text | CHECK    | 고등학교 유형: "일반고" \| "특목고" \| "자사고" \| "특성화고" |

#### 대학교 전용 속성

| 필드명                 | 타입 | 제약조건 | 설명                                      |
| ---------------------- | ---- | -------- | ----------------------------------------- |
| `university_type`      | text | CHECK    | 대학교 유형: "4년제" \| "2년제"           |
| `university_ownership` | text | CHECK    | 설립 유형: "국립" \| "사립"               |
| `campus_name`          | text | -        | 캠퍼스명 (같은 대학교의 다른 캠퍼스 구분) |

### 외래키 관계

- `region_id` → `regions.id` (nullable)

### 특징

- **다형성 테이블**: 하나의 테이블에 중학교, 고등학교, 대학교를 모두 저장
- **타입별 속성**: `type`에 따라 사용되는 필드가 다름
  - 고등학교: `category` 사용
  - 대학교: `university_type`, `university_ownership`, `campus_name` 사용
- **대학교 활용**: `students.desired_university_1~3`이 현재 text로 저장되어 있으나, `schools.id`로 FK 참조하도록 변경 제안

---

## 테이블 관계도

```
tenants (테넌트)
  └── users (통합 사용자)
        ├── students (학생 정보)
        │     ├── school_id → schools.id (미사용)
        │     └── desired_university_1~3 → schools.id (변경 제안)
        │
        └── parent_users (학부모 정보)
              └── parent_student_links (학생-학부모 연결)
                    ├── student_id → students.id
                    └── parent_id → parent_users.id

schools (학교)
  ├── type: "중학교" | "고등학교" | "대학교"
  ├── category (고등학교 전용)
  └── university_type, university_ownership, campus_name (대학교 전용)
```

---

## 핵심 속성 요약

### 필수 필드 (NOT NULL)

#### users

- `id`, `email`, `role`, `created_at`, `updated_at`

#### students

- `id`, `created_at`, `updated_at`
- ⚠️ `tenant_id`는 ERD에서 NOT NULL이지만 deprecated

#### parent_users

- `id`, `created_at`, `updated_at`

#### parent_student_links

- `id`, `tenant_id`, `student_id`, `parent_id`, `created_at`

#### schools

- `id`, `name`, `type`, `created_at`, `updated_at`

### 실제 사용되는 필드 (코드 기준)

#### students (실제 사용)

- 기본: `id`, `name`, `grade`, `class`, `birth_date`, `school`
- 프로필: `gender`, `phone`, `mother_phone`, `father_phone`
- 진로: `exam_year`, `curriculum_revision`, `desired_university_1~3`, `desired_career_field`
- 타임스탬프: `created_at`, `updated_at`

#### parent_users (실제 사용)

- `id`, `tenant_id`, `created_at` (최소한의 필드만 사용)

#### parent_student_links (실제 사용)

- `id`, `student_id`, `parent_id`, `relation`, `created_at`

---

## 개선 제안 요약

### 1. 테이블 분할

- **student_profiles**: 프로필 정보 분리
- **student_career_goals**: 진로 정보 분리 (대학교 FK 참조 포함)

### 2. 필드 정규화

- `desired_university_1~3`을 `schools.id` FK로 변경
- `school` text 필드를 `school_id` FK로 변경

### 3. 테이블명/필드명 통일

- `parent_student_links` vs `student_parent_links` 통일
- `relation` vs `relationship` 통일
- `class` vs `class_number` 통일

### 4. 미사용 필드 정리

- ERD와 실제 코드 간 불일치 해결
- 미사용 필드 제거 또는 활용 계획 수립

---

**마지막 업데이트**: 2025-01-31









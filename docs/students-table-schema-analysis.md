# students 테이블 스키마 분석

## 개요

이 문서는 TimeLevelUp 프로젝트의 `students` 테이블 스키마를 분석한 문서입니다. ERD 문서, 실제 코드 사용 현황, 마이그레이션 파일을 종합하여 작성되었습니다.

**분석 일자**: 2025-01-XX  
**목적**: Phase 2 중기 개선을 위한 스키마 검토 및 분석

---

## 1. ERD 문서 기준 스키마

### 1.1 테이블 정의

**파일**: `timetable/erd-cloud/01_core_tables.sql` (54-72줄)

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

### 1.2 제약조건 요약

| 제약조건 | 내용 |
|---------|------|
| **Primary Key** | `id` (uuid, FK → users.id) |
| **Foreign Keys** | `id` → `users.id` (ON DELETE CASCADE)<br>`tenant_id` → `tenants.id` (ON DELETE RESTRICT) |
| **NOT NULL** | `id`, `tenant_id`, `created_at`, `updated_at` |
| **CHECK** | `gender IN ('male', 'female', 'other')` |
| **DEFAULT** | `is_active = true`, `created_at = now()`, `updated_at = now()` |

### 1.3 핵심 발견사항

- **`tenant_id`는 NOT NULL 제약조건**이 ERD 문서에 명시되어 있음
- **`tenant_id`는 필수 필드**로 설계됨

---

## 2. 실제 코드에서 사용되는 필드

### 2.1 타입 정의

**파일**: `lib/data/students.ts` (5-19줄)

```typescript
export type Student = {
  id: string;
  tenant_id?: string | null;  // ⚠️ nullable로 정의됨
  name?: string | null;
  grade?: string | null;
  class?: string | null;
  birth_date?: string | null;
  school_id?: string | null;
  school_type?: "MIDDLE" | "HIGH" | "UNIVERSITY" | null;
  student_number?: string | null;
  enrolled_at?: string | null;
  status?: "enrolled" | "on_leave" | "graduated" | "transferred" | null;
  created_at?: string | null;
  updated_at?: string | null;
};
```

### 2.2 실제 사용 필드

#### 필수 필드 (코드에서 사용)
- `id`: uuid (PK, FK → users.id)
- `tenant_id`: uuid (nullable로 처리됨, ERD와 불일치)

#### 선택 필드 (코드에서 사용)
- `name`: text (nullable) - users 테이블과 조인하여 사용
- `grade`: text (nullable)
- `class`: text (nullable) - ERD의 `class_number`와 매핑
- `birth_date`: date (nullable, string으로 저장)
- `school_id`: text (nullable) - 통합 ID (SCHOOL_123 또는 UNIV_456)
- `school_type`: text (nullable) - "MIDDLE" | "HIGH" | "UNIVERSITY"
- `student_number`: text (nullable)
- `enrolled_at`: date (nullable)
- `status`: text (nullable) - "enrolled" | "on_leave" | "graduated" | "transferred"
- `created_at`: timestamptz (nullable)
- `updated_at`: timestamptz (nullable)

#### ERD에 있으나 미사용 필드
- `gender`: text - ERD에는 있으나 코드에서 사용되지 않음
- `address`: text - 코드에서 사용되지 않음
- `parent_contact`: text - 코드에서 사용되지 않음
- `emergency_contact`: text - 코드에서 사용되지 않음
- `medical_info`: text - 코드에서 사용되지 않음
- `notes`: text - 코드에서 사용되지 않음
- `is_active`: boolean - 코드에서 사용되지 않음

### 2.3 필드명 불일치

| ERD 문서 | 실제 코드 | 비고 |
|---------|---------|------|
| `class_number` | `class` | 필드명이 다름 |

### 2.4 값 형식 불일치

| 필드 | ERD 문서 | 실제 코드 | 비고 |
|------|---------|---------|------|
| `gender` | 'male', 'female', 'other' | 한글 사용 (추정) | 코드에서 미사용 |

---

## 3. tenant_id 제약조건 분석

### 3.1 ERD vs 실제 코드

| 항목 | ERD 문서 | 실제 코드 | 불일치 |
|------|---------|---------|--------|
| **제약조건** | `NOT NULL` | `nullable` | ✅ 불일치 |
| **타입 정의** | 필수 | `tenant_id?: string \| null` | ✅ 불일치 |
| **사용 패턴** | 항상 값 필요 | nullable 처리 | ✅ 불일치 |

### 3.2 코드에서의 nullable 처리

**파일**: `lib/data/students.ts` (138-165줄)

```typescript
// tenant_id가 없으면 기본 tenant 조회
let tenantId = student.tenant_id;
if (!tenantId) {
  const { data: defaultTenant, error: tenantError } = await supabase
    .from("tenants")
    .select("id")
    .eq("name", "Default Tenant")
    .maybeSingle();
  // ...
  tenantId = defaultTenant.id;
}
```

**발견사항**:
- 코드에서는 `tenant_id`가 없을 경우 "Default Tenant"를 조회하여 할당
- 이는 회원가입 시 `tenant_id`가 없을 수 있음을 의미
- Phase 1에서 구현한 fallback 로직과 일치

### 3.3 영향 범위 분석

#### RLS 정책 영향
- `tenant_id`가 NOT NULL이면 RLS 정책에서 항상 tenant 기반 필터링 가능
- nullable이면 NULL 값 처리 로직 필요

#### 인덱스 영향
- `tenant_id` 기반 인덱스는 nullable 값도 처리 가능
- 부분 인덱스(`WHERE tenant_id IS NOT NULL`) 사용 가능

#### 외래키 제약조건 영향
- NOT NULL: 항상 `tenants.id` 참조 보장
- nullable: NULL 값 허용, 참조 무결성은 유지

---

## 4. 마이그레이션 파일 검토

### 4.1 검토 결과

- `supabase/migrations/` 디렉토리에서 `students` 테이블 생성 구문을 찾지 못함
- 대부분의 마이그레이션 파일은 다른 테이블 관련 변경사항
- `students` 테이블은 초기 스키마에 포함되어 있을 가능성

### 4.2 제약조건 변경 이력

- `tenant_id` NOT NULL → nullable 변경 이력 없음
- 현재 데이터베이스 상태 확인 필요

---

## 5. 필수 필드 vs 선택 필드 분류

### 5.1 필수 필드 (제약조건 기준)

| 필드 | 제약조건 | 비고 |
|------|---------|------|
| `id` | PRIMARY KEY, NOT NULL | 필수 |
| `tenant_id` | NOT NULL (ERD 기준) | ⚠️ 코드에서는 nullable 처리 |
| `created_at` | NOT NULL, DEFAULT now() | 필수 |
| `updated_at` | NOT NULL, DEFAULT now() | 필수 |

### 5.2 선택 필드

- `student_number`
- `school_id`
- `grade`
- `class_number` (코드에서는 `class`)
- `birth_date`
- `gender`
- `address`
- `parent_contact`
- `emergency_contact`
- `medical_info`
- `notes`
- `is_active` (DEFAULT true)
- `enrolled_at`

---

## 6. 결론 및 권장사항

### 6.1 주요 발견사항

1. **ERD와 코드 간 불일치**
   - ERD: `tenant_id NOT NULL`
   - 코드: `tenant_id nullable`
   - 실제 사용: nullable 처리 및 기본 tenant 할당 로직 존재

2. **회원가입 플로우와의 연관성**
   - Phase 1에서 구현한 fallback 로직과 일치
   - 회원가입 시 `tenant_id`가 없을 수 있음
   - `/settings`에서 정보 입력 후 `tenant_id` 할당

3. **필드 사용 현황**
   - ERD에 정의된 필드 중 상당수가 미사용
   - 실제 사용 필드는 제한적

### 6.2 권장사항

#### Option 1: tenant_id를 nullable로 변경 (권장)
- **장점**:
  - 현재 코드 사용 패턴과 일치
  - 회원가입 플로우 개선 가능 (Phase 3)
  - Phase 1 fallback 로직과 일관성 유지
- **단점**:
  - RLS 정책 수정 필요
  - NULL 값 처리 로직 추가 필요
- **작업**:
  - 마이그레이션: `ALTER TABLE students ALTER COLUMN tenant_id DROP NOT NULL;`
  - RLS 정책 검토 및 수정

#### Option 2: tenant_id를 NOT NULL 유지
- **장점**:
  - ERD 문서와 일치
  - 데이터 무결성 보장
- **단점**:
  - 회원가입 시 기본 tenant 할당 필수
  - Phase 1 fallback 로직과 불일치
- **작업**:
  - 회원가입 플로우 수정 (Phase 3)
  - 기본 tenant 할당 로직 필수

### 6.3 Phase 2에서의 결정

**권장**: Option 1 (tenant_id nullable 변경)

**이유**:
1. 현재 코드 사용 패턴과 일치
2. Phase 1 fallback 로직과 일관성
3. 회원가입 플로우 개선 가능성 (Phase 3)
4. 기존 데이터에 영향 최소화

---

## 7. 참고 파일

- [ERD 문서](timetable/erd-cloud/01_core_tables.sql) - 테이블 정의
- [학생 데이터 타입](lib/data/students.ts) - 실제 사용 타입
- [역할 조회 로직](lib/auth/getCurrentUserRole.ts) - Phase 1 fallback 로직
- [테넌트 컨텍스트](lib/tenant/getTenantContext.ts) - tenant_id 사용 패턴

---

**작성 일자**: 2025-01-XX  
**최종 수정**: 2025-01-XX










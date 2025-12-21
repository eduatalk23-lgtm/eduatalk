# parent_users 테이블 스키마 분석

## 개요

이 문서는 TimeLevelUp 프로젝트의 `parent_users` 테이블 스키마를 분석한 문서입니다. ERD 문서, 실제 코드 사용 현황, 마이그레이션 파일을 종합하여 작성되었습니다.

**분석 일자**: 2025-01-XX  
**목적**: Phase 2 중기 개선을 위한 스키마 검토 및 분석

---

## 1. ERD 문서 기준 스키마

### 1.1 테이블 정의

**파일**: `timetable/erd-cloud/01_core_tables.sql` (76-84줄)

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

### 1.2 제약조건 요약

| 제약조건 | 내용 |
|---------|------|
| **Primary Key** | `id` (uuid, FK → users.id) |
| **Foreign Keys** | `id` → `users.id` (ON DELETE CASCADE)<br>`tenant_id` → `tenants.id` (ON DELETE RESTRICT) |
| **NOT NULL** | `id`, `created_at`, `updated_at` |
| **CHECK** | `relationship IN ('father', 'mother', 'guardian', 'other')` |
| **DEFAULT** | `created_at = now()`, `updated_at = now()` |

### 1.3 핵심 발견사항

- **`tenant_id`는 nullable** (ERD 문서 기준)
- **`tenant_id`는 선택 필드**로 설계됨
- `students` 테이블과 달리 `tenant_id`에 NOT NULL 제약조건 없음

---

## 2. 실제 코드에서 사용되는 필드

### 2.1 타입 정의

**파일**: `lib/data/parents.ts` (3-7줄)

```typescript
export type Parent = {
  id: string;
  tenant_id?: string | null;  // nullable로 정의됨 (ERD와 일치)
  created_at?: string | null;
};
```

### 2.2 실제 사용 필드

#### 필수 필드 (코드에서 사용)
- `id`: uuid (PK, FK → users.id)

#### 선택 필드 (코드에서 사용)
- `tenant_id`: uuid (nullable) - ERD와 일치
- `created_at`: timestamptz (nullable)

#### ERD에 있으나 미사용 필드
- `relationship`: text - ERD에는 있으나 코드에서 사용되지 않음
- `occupation`: text - ERD에는 있으나 코드에서 사용되지 않음
- `updated_at`: timestamptz - ERD에는 있으나 코드에서 사용되지 않음

### 2.3 필드 사용 현황

**파일**: `lib/data/parents.ts`

```typescript
// 조회 시 사용 필드
.select("id,tenant_id,created_at")

// 필터링 시 사용
.eq("tenant_id", tenantId)  // tenant_id로 필터링
```

**발견사항**:
- 코드에서는 매우 제한적인 필드만 사용
- `tenant_id`는 필터링에 사용되지만 nullable 처리됨
- ERD에 정의된 대부분의 필드가 미사용

---

## 3. tenant_id 제약조건 분석

### 3.1 ERD vs 실제 코드

| 항목 | ERD 문서 | 실제 코드 | 일치 여부 |
|------|---------|---------|----------|
| **제약조건** | nullable | nullable | ✅ 일치 |
| **타입 정의** | 선택 | `tenant_id?: string \| null` | ✅ 일치 |
| **사용 패턴** | nullable 처리 | nullable 처리 | ✅ 일치 |

### 3.2 코드에서의 nullable 처리

**파일**: `lib/data/parents.ts` (46-53줄)

```typescript
export async function listParentsByTenant(
  tenantId: string | null
): Promise<Parent[]> {
  const supabase = await createSupabaseServerClient();

  if (!tenantId) {
    return [];  // tenant_id가 없으면 빈 배열 반환
  }
  // ...
}
```

**발견사항**:
- `tenant_id`가 없으면 빈 배열 반환
- `tenant_id` 기반 필터링 사용
- nullable 처리와 일치

### 3.3 영향 범위 분석

#### RLS 정책 영향
- `tenant_id`가 nullable이므로 RLS 정책에서 NULL 값 처리 필요
- NULL 값에 대한 접근 정책 정의 필요

#### 인덱스 영향
- `tenant_id` 기반 인덱스는 nullable 값도 처리 가능
- 부분 인덱스(`WHERE tenant_id IS NOT NULL`) 사용 가능

#### 외래키 제약조건 영향
- nullable: NULL 값 허용, 참조 무결성은 유지
- NOT NULL 제약조건 없음

---

## 4. 마이그레이션 파일 검토

### 4.1 검토 결과

- `supabase/migrations/` 디렉토리에서 `parent_users` 테이블 생성 구문을 찾지 못함
- 대부분의 마이그레이션 파일은 다른 테이블 관련 변경사항
- `parent_users` 테이블은 초기 스키마에 포함되어 있을 가능성

### 4.2 제약조건 변경 이력

- `tenant_id` nullable → nullable 변경 이력 없음
- ERD와 코드가 일치하므로 변경 불필요

---

## 5. 필수 필드 vs 선택 필드 분류

### 5.1 필수 필드 (제약조건 기준)

| 필드 | 제약조건 | 비고 |
|------|---------|------|
| `id` | PRIMARY KEY, NOT NULL | 필수 |
| `created_at` | NOT NULL, DEFAULT now() | 필수 |
| `updated_at` | NOT NULL, DEFAULT now() | 필수 (ERD 기준, 코드 미사용) |

### 5.2 선택 필드

- `tenant_id` - nullable (ERD와 코드 일치)
- `relationship` - nullable (ERD 기준, 코드 미사용)
- `occupation` - nullable (ERD 기준, 코드 미사용)

---

## 6. students 테이블과의 비교

### 6.1 tenant_id 제약조건 비교

| 테이블 | ERD 문서 | 실제 코드 | 일치 여부 |
|--------|---------|---------|----------|
| `students` | NOT NULL | nullable | ❌ 불일치 |
| `parent_users` | nullable | nullable | ✅ 일치 |

### 6.2 사용 패턴 비교

| 항목 | students | parent_users |
|------|----------|--------------|
| **필드 사용 수** | 많음 (10개 이상) | 적음 (3개) |
| **tenant_id 처리** | 기본 tenant 할당 로직 | nullable 처리 |
| **ERD 일치도** | 낮음 (불일치 다수) | 높음 (일치) |

---

## 7. 결론 및 권장사항

### 7.1 주요 발견사항

1. **ERD와 코드 일치**
   - `tenant_id` nullable로 ERD와 코드가 일치
   - `students` 테이블과 달리 불일치 없음

2. **필드 사용 현황**
   - ERD에 정의된 필드 중 대부분 미사용
   - 실제 사용 필드는 `id`, `tenant_id`, `created_at`만 사용

3. **회원가입 플로우와의 연관성**
   - Phase 1에서 구현한 fallback 로직과 일치
   - 회원가입 시 `tenant_id`가 없을 수 있음
   - `/settings`에서 정보 입력 후 `tenant_id` 할당 가능

### 7.2 권장사항

#### tenant_id 제약조건 유지 (변경 불필요)

**이유**:
1. ERD와 코드가 일치
2. 현재 사용 패턴과 일치
3. Phase 1 fallback 로직과 일관성
4. 변경 불필요

#### 추가 개선 사항 (선택사항)

1. **필드 사용 확대**
   - `relationship`, `occupation` 필드 활용 검토
   - 필요 시 UI/UX 개선

2. **타입 정의 확장**
   - `Parent` 타입에 `relationship`, `occupation` 추가 (필요 시)

---

## 8. Phase 2에서의 결정

**결론**: `parent_users` 테이블의 `tenant_id`는 변경 불필요

**이유**:
1. ERD와 코드가 일치
2. 현재 사용 패턴과 일치
3. Phase 1 fallback 로직과 일관성
4. 추가 마이그레이션 불필요

**참고**: `students` 테이블의 `tenant_id`는 nullable로 변경 검토 필요 (별도 문서 참조)

---

## 9. 참고 파일

- [ERD 문서](timetable/erd-cloud/01_core_tables.sql) - 테이블 정의
- [학부모 데이터 타입](lib/data/parents.ts) - 실제 사용 타입
- [역할 조회 로직](lib/auth/getCurrentUserRole.ts) - Phase 1 fallback 로직
- [테넌트 컨텍스트](lib/tenant/getTenantContext.ts) - tenant_id 사용 패턴
- [students 테이블 분석](students-table-schema-analysis.md) - 비교 참고

---

**작성 일자**: 2025-01-XX  
**최종 수정**: 2025-01-XX










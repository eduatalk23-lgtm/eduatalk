# 미사용 필드 분석 및 정리 계획

**작성 일자**: 2025-02-10  
**목적**: ERD에 있으나 실제 코드에서 사용되지 않는 필드 확인 및 정리 계획 수립

---

## 1. students 테이블 미사용 필드

### ERD에 있으나 미사용 (doc/students-parents-core-tables.md 기준)

| 필드명 | 타입 | 상태 | 비고 |
|--------|------|------|------|
| `address` | text | ❌ 미사용 | student_profiles로 이동 가능 |
| `emergency_contact` | ❌ 미사용 | student_profiles로 이동 가능 |
| `medical_info` | ❌ 미사용 | student_profiles로 이동 가능 |
| `notes` | text | ❌ 미사용 | - |
| `is_active` | boolean | ❌ 미사용 | status 필드로 대체 가능 |

### 활성화된 필드

| 필드명 | 타입 | 상태 | 비고 |
|--------|------|------|------|
| `student_number` | text | ✅ 활성화 | 마이그레이션으로 추가됨 |
| `enrolled_at` | date | ✅ 활성화 | 마이그레이션으로 추가됨 |
| `status` | text | ✅ 활성화 | 마이그레이션으로 추가됨 |

**결론**: 대부분의 필드는 이미 student_profiles로 이동되었거나, 마이그레이션으로 활성화됨. 남은 미사용 필드는 제거 또는 활용 계획 수립 필요.

---

## 2. parent_users 테이블 미사용 필드

### ERD에 있으나 미사용

| 필드명 | 타입 | 상태 | 비고 |
|--------|------|------|------|
| `relationship` | text | ❌ 미사용 | parent_student_links.relation으로 대체됨 |
| `occupation` | text | ❌ 미사용 | - |
| `updated_at` | timestamptz | ❌ 미사용 | ERD에는 있으나 코드에서 사용 안 함 |

**현재 사용 중인 필드**:
- `id` - ✅ 사용
- `tenant_id` - ✅ 사용
- `created_at` - ✅ 사용

**결론**: 미사용 필드 제거 또는 parent_profiles 테이블로 이동 고려

---

## 3. parent_student_links 테이블 미사용 필드

### ERD에 있으나 미사용

| 필드명 | 타입 | 상태 | 비고 |
|--------|------|------|------|
| `is_primary` | boolean | ❌ 미사용 | 주 보호자 기능 미구현 |
| `is_approved` | boolean | ❌ 미사용 | 승인 기능 미구현 |
| `approved_at` | timestamptz | ❌ 미사용 | 승인 기능 미구현 |

**현재 사용 중인 필드**:
- `id` - ✅ 사용
- `student_id` - ✅ 사용
- `parent_id` - ✅ 사용
- `relation` - ✅ 사용
- `created_at` - ✅ 사용

**결론**: 향후 기능 확장을 위해 유지하거나, 제거 후 필요 시 재추가

---

## 4. 정리 계획

### 우선순위 1: parent_users 테이블 정리

**옵션 A: 미사용 필드 제거**
```sql
-- 마이그레이션 파일 생성
ALTER TABLE parent_users DROP COLUMN IF EXISTS relationship;
ALTER TABLE parent_users DROP COLUMN IF EXISTS occupation;
ALTER TABLE parent_users DROP COLUMN IF EXISTS updated_at;
```

**옵션 B: parent_profiles 테이블 생성 (권장)**
- students와 일관성 유지
- 향후 확장성 고려
- ERD 필드 활용

**권장**: 옵션 B (parent_profiles 테이블 생성)

### 우선순위 2: students 테이블 미사용 필드 정리

**옵션 A: 미사용 필드 제거**
```sql
ALTER TABLE students DROP COLUMN IF EXISTS address;
ALTER TABLE students DROP COLUMN IF EXISTS emergency_contact;
ALTER TABLE students DROP COLUMN IF EXISTS medical_info;
ALTER TABLE students DROP COLUMN IF EXISTS notes;
ALTER TABLE students DROP COLUMN IF EXISTS is_active;
```

**옵션 B: student_profiles로 이동**
- 이미 student_profiles 테이블에 해당 필드 존재
- 데이터 마이그레이션 후 제거

**권장**: 옵션 B (student_profiles로 이동 확인 후 제거)

### 우선순위 3: parent_student_links 테이블 미사용 필드

**옵션 A: 미사용 필드 제거**
```sql
ALTER TABLE parent_student_links DROP COLUMN IF EXISTS is_primary;
ALTER TABLE parent_student_links DROP COLUMN IF EXISTS is_approved;
ALTER TABLE parent_student_links DROP COLUMN IF EXISTS approved_at;
```

**옵션 B: 유지 (향후 기능 확장)**
- 주 보호자 기능, 승인 기능은 향후 필요할 수 있음
- 제거 후 재추가보다 유지가 더 안전

**권장**: 옵션 B (향후 기능 확장을 위해 유지)

---

## 5. 실행 계획

### Phase 1: parent_users 테이블 정리

1. [ ] parent_profiles 테이블 생성 여부 확인
2. [ ] parent_profiles 테이블이 없으면 생성 계획 수립
3. [ ] 미사용 필드 제거 또는 parent_profiles로 이동

### Phase 2: students 테이블 미사용 필드 정리

1. [ ] student_profiles 테이블에 해당 필드 존재 여부 확인
2. [ ] 데이터 마이그레이션 필요 여부 확인
3. [ ] 미사용 필드 제거

### Phase 3: parent_student_links 테이블 미사용 필드

1. [ ] 향후 기능 확장 계획 확인
2. [ ] 미사용 필드 유지 또는 제거 결정

---

## 6. 주의사항

### 데이터 손실 방지

- 미사용 필드라도 데이터가 있을 수 있음
- 제거 전 데이터 백업 필수
- 데이터 마이그레이션 필요 여부 확인

### 기능 확장 고려

- 향후 필요할 수 있는 필드는 유지 고려
- 제거 후 재추가보다 유지가 더 안전

### 일관성 유지

- students와 parent_users의 구조 일관성 고려
- parent_profiles 테이블 생성으로 일관성 유지

---

**마지막 업데이트**: 2025-02-10










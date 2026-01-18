# 관리자 플랜 생성 데이터베이스 스키마 점검 결과

**작성일**: 2025-01-15  
**점검 범위**: 관리자 플랜 생성 관련 주요 테이블의 제약 조건, 인덱스, RLS 정책

---

## 📋 개요

관리자 플랜 생성 기능과 관련된 핵심 테이블들의 데이터베이스 스키마를 점검하여 성능, 보안, 무결성 측면에서의 이슈를 파악하고 개선 방안을 제시합니다.

### 주요 테이블

1. **`plan_groups`** - 플랜 그룹 (핵심 엔티티)
2. **`ad_hoc_plans`** - 임시 플랜
3. **`flexible_contents`** - 유연한 콘텐츠
4. **`plan_contents`** - 플랜 콘텐츠
5. **`plan_exclusions`** - 플랜 제외일
6. **`student_plan`** - 학생 플랜
7. **`academy_schedules`** - 학원 일정

---

## 🔗 제약 조건 (Constraints) 분석

### 1. Primary Keys

모든 주요 테이블에 `id` 컬럼에 PRIMARY KEY 제약이 올바르게 설정되어 있습니다.

```sql
-- 예시: plan_groups
PRIMARY KEY (id)
```

### 2. Foreign Keys

#### `plan_groups` 테이블

- ✅ `tenant_id` → `tenants(id)`
- ✅ `student_id` → `students(id)`
- ✅ `block_set_id` → `student_block_sets(id)`
- ✅ `camp_invitation_id` → `camp_invitations(id)` (UNIQUE 제약 포함)
- ✅ `camp_template_id` → `camp_templates(id)`
- ✅ `template_plan_group_id` → `plan_groups(id)` (자기 참조)
- ✅ `last_admin_id` → `users(id)`
- ✅ `migrated_from_adhoc_id` → `ad_hoc_plans(id)`

#### `ad_hoc_plans` 테이블

- ✅ `tenant_id` → `tenants(id)`
- ✅ `student_id` → `students(id)`
- ✅ `plan_group_id` → `plan_groups(id)`
- ✅ `flexible_content_id` → `flexible_contents(id)`
- ✅ `created_by` → `users(id)`
- ✅ `recurrence_parent_id` → `ad_hoc_plans(id)` (자기 참조)

#### `flexible_contents` 테이블

- ✅ `tenant_id` → `tenants(id)`
- ✅ `student_id` → `students(id)`
- ✅ `subject_id` → `subjects(id)`
- ✅ `master_book_id` → `master_books(id)`
- ✅ `master_lecture_id` → `master_lectures(id)`
- ✅ `master_custom_content_id` → `master_custom_contents(id)`
- ✅ `created_by` → `users(id)`

#### `plan_exclusions` 테이블

- ✅ `plan_group_id` → `plan_groups(id)`
- ✅ `student_id` → `students(id)`
- ✅ `tenant_id` → `tenants(id)`
- ✅ UNIQUE 제약: `(plan_group_id, exclusion_date)`

### 3. 제약 조건 평가

**✅ 강점:**

- 모든 외래 키 관계가 명확하게 정의됨
- UNIQUE 제약으로 중복 데이터 방지 (`plan_exclusions`, `plan_groups.camp_invitation_id`)
- CASCADE 삭제 정책이 적절히 설정됨

**⚠️ 주의사항:**

- 일부 외래 키에 인덱스가 없어 조인 성능에 영향 가능 (아래 인덱스 섹션 참조)

---

## 📊 인덱스 (Indexes) 분석

### 1. 기존 인덱스 현황

#### `plan_groups` 테이블

```sql
-- 학생별 활성 플랜 그룹 조회
idx_plan_groups_student_status (student_id, status) WHERE deleted_at IS NULL

-- 캠프 초대 ID로 조회
idx_plan_groups_camp_invitation (camp_invitation_id) WHERE camp_invitation_id IS NOT NULL

-- 기간 기반 조회 (겹침 확인용)
idx_plan_groups_period (student_id, period_start, period_end) WHERE deleted_at IS NULL

-- 템플릿 기반 조회
idx_plan_groups_template (template_plan_group_id) WHERE template_plan_group_id IS NOT NULL

-- 스터디 타입별 조회
idx_plan_groups_study_type (study_type) WHERE study_type IS NOT NULL

-- 콘텐츠 기반 플랜 그룹 조회
idx_plan_groups_student_content_based (student_id, creation_mode)
  WHERE creation_mode = 'content_based'
```

#### `student_plan` 테이블

```sql
-- 플랜 그룹별 조회 및 삭제
idx_student_plan_plan_group_id (plan_group_id)

-- 학생별 날짜 기준 조회
idx_student_plan_student_date (student_id, plan_date)

-- 활성 플랜만 조회 (부분 인덱스)
idx_student_plan_active (student_id, plan_date) WHERE is_active = true

-- 플랜 그룹 + 날짜 범위 조회
idx_student_plan_group_date_range (plan_group_id, plan_date)
```

#### `ad_hoc_plans` 테이블

```sql
-- 학생별 날짜 기준 조회
idx_ad_hoc_plans_student_date (student_id, plan_date)

-- 콘텐츠 ID로 조회
idx_ad_hoc_plans_content (flexible_content_id) WHERE flexible_content_id IS NOT NULL

-- 반복 부모 ID로 조회
idx_ad_hoc_plans_recurrence_parent (recurrence_parent_id)
  WHERE recurrence_parent_id IS NOT NULL

-- 플랜 그룹 ID로 조회
idx_ad_hoc_plans_plan_group (plan_group_id)
```

#### `plan_contents` 테이블

```sql
-- 플랜 그룹별 콘텐츠 조회
idx_plan_contents_plan_group_id (plan_group_id)

-- 콘텐츠 타입별 조회
idx_plan_contents_content_type (content_type, content_id)
```

#### `plan_exclusions` 테이블

```sql
-- 플랜 그룹별 제외일 조회
idx_plan_exclusions_plan_group_id (plan_group_id)

-- 날짜 기준 조회
idx_plan_exclusions_date (plan_group_id, exclusion_date)
```

#### `academy_schedules` 테이블

```sql
-- 플랜 그룹별 학원 일정 조회
idx_academy_schedules_plan_group_id (plan_group_id)
```

### 2. 인덱스 평가

**✅ 강점:**

- 주요 조회 패턴에 맞는 인덱스가 잘 구성됨
- 부분 인덱스(Partial Index) 활용으로 인덱스 크기 최적화
- 복합 인덱스가 자주 사용되는 쿼리 패턴에 맞춰 설계됨

**⚠️ 개선 필요:**

- Database Linter에서 많은 미사용 인덱스(unused_index) 발견
- 일부 외래 키에 인덱스가 없음 (아래 섹션 참조)

---

## 🚨 Database Linter 결과 분석

### 1. Critical Issues

#### ❌ Security Definer View

- **이슈**: `public.scores` 뷰가 `SECURITY DEFINER`로 정의됨
- **영향**: 보안 위험 (권한 상승 가능성)
- **우선순위**: 높음
- **조치**: 뷰 정의 검토 및 필요시 `SECURITY INVOKER`로 변경

### 2. Performance Warnings

#### ⚠️ Auth RLS InitPlan (auth_rls_initplan)

**문제:**

- 많은 테이블의 RLS 정책이 각 행마다 `current_setting()` 또는 `auth.<function>()`을 재평가
- 성능 저하 원인

**영향받는 테이블 (관리자 플랜 생성 관련):**

- `plan_groups`
- `student_plan`
- `plan_exclusions`
- `academy_schedules`
- `ad_hoc_plans`
- `flexible_contents`
- `plan_contents`

**개선 방안:**

```sql
-- 현재 (비효율적)
CREATE POLICY "policy_name" ON plan_groups
  FOR SELECT
  USING (tenant_id = current_setting('app.tenant_id')::UUID);

-- 개선 (효율적)
CREATE POLICY "policy_name" ON plan_groups
  FOR SELECT
  USING (tenant_id = (SELECT tenant_id FROM user_sessions WHERE user_id = auth.uid()));
```

#### ⚠️ Multiple Permissive Policies (multiple_permissive_policies)

**문제:**

- 동일한 역할과 액션에 대해 여러 개의 허용 정책이 존재
- PostgreSQL이 모든 정책을 평가해야 함

**영향받는 테이블:**

- `plan_groups`
- `student_plan`
- `plan_exclusions`
- `academy_schedules`
- `ad_hoc_plans`
- `flexible_contents`
- `plan_contents`

**개선 방안:**

- 여러 정책을 하나로 통합
- OR 조건을 사용하여 단일 정책으로 병합

#### ⚠️ Unindexed Foreign Keys (unindexed_foreign_keys)

**문제:**

- 외래 키 컬럼에 인덱스가 없어 조인 및 삭제 성능 저하

**영향받는 테이블 (관리자 플랜 생성 관련):**

- `plan_creation_history` - `plan_group_id` 외래 키
- `plan_history` - `plan_group_id` 외래 키
- `plan_timer_logs` - `plan_group_id` 외래 키
- `plan_views` - `plan_group_id` 외래 키
- `reschedule_log` - `plan_group_id` 외래 키

**개선 방안:**

```sql
-- 예시: plan_creation_history 테이블
CREATE INDEX IF NOT EXISTS idx_plan_creation_history_plan_group_id
ON plan_creation_history(plan_group_id);
```

#### ⚠️ Duplicate Index

**문제:**

- `student_milestone_settings` 테이블에 동일한 인덱스가 중복 존재
  - `idx_milestone_settings_student`
  - `idx_student_milestone_settings_student_id`

**조치:**

- 중복 인덱스 제거 (이미 `20260104105631_drop_duplicate_indexes_and_constraints.sql`에서 처리됨)

#### ⚠️ Unused Indexes (unused_index)

**문제:**

- 많은 인덱스가 실제로 사용되지 않음
- 불필요한 저장 공간 및 쓰기 성능 저하

**조치:**

- 실제 쿼리 패턴 분석 후 미사용 인덱스 제거
- 주의: 인덱스 사용 여부는 쿼리 패턴에 따라 달라질 수 있으므로 신중하게 판단 필요

### 3. Security Warnings

#### ⚠️ Extension in Public Schema

- `pg_trgm` 확장이 `public` 스키마에 설치됨
- 권한 관리 주의 필요

#### ⚠️ Leaked Password Protection Disabled

- 비밀번호 유출 보호 기능이 비활성화됨
- 보안 강화를 위해 활성화 권장

---

## 🔧 개선 방안

### 1. 즉시 조치 (High Priority)

#### 1.1 외래 키 인덱스 추가

```sql
-- plan_creation_history
CREATE INDEX IF NOT EXISTS idx_plan_creation_history_plan_group_id
ON plan_creation_history(plan_group_id);

-- plan_history
CREATE INDEX IF NOT EXISTS idx_plan_history_plan_group_id
ON plan_history(plan_group_id);

-- plan_timer_logs
CREATE INDEX IF NOT EXISTS idx_plan_timer_logs_plan_group_id
ON plan_timer_logs(plan_group_id);

-- plan_views
CREATE INDEX IF NOT EXISTS idx_plan_views_plan_group_id
ON plan_views(plan_group_id);

-- reschedule_log
CREATE INDEX IF NOT EXISTS idx_reschedule_log_plan_group_id
ON reschedule_log(plan_group_id);
```

#### 1.2 RLS 정책 최적화

관리자 플랜 생성 관련 테이블의 RLS 정책을 최적화하여 `current_setting()` 재평가를 줄입니다.

```sql
-- 예시: plan_groups 테이블
-- 기존 정책 확인 후 최적화된 버전으로 교체
-- (실제 정책 내용에 맞게 수정 필요)
```

### 2. 중기 조치 (Medium Priority)

#### 2.1 중복 정책 통합

여러 개의 허용 정책을 하나로 통합하여 성능을 개선합니다.

#### 2.2 미사용 인덱스 정리

실제 쿼리 패턴을 분석한 후 미사용 인덱스를 제거합니다.

### 3. 장기 조치 (Low Priority)

#### 3.1 Security Definer View 검토

`scores` 뷰의 보안 설정을 검토하고 필요시 수정합니다.

#### 3.2 비밀번호 유출 보호 활성화

Supabase 설정에서 비밀번호 유출 보호 기능을 활성화합니다.

---

## 📈 성능 최적화 전략

### 1. 트랜잭션 함수 활용

관리자 플랜 생성 시 이미 구현된 RPC 함수를 활용하여 원자적 처리를 보장합니다:

- `create_plan_group_atomic()` - 플랜 그룹 생성
- `generate_plans_atomic()` - 플랜 생성
- `delete_plan_group_cascade()` - 플랜 그룹 삭제
- `create_quick_plan_atomic()` - 빠른 플랜 생성

**장점:**

- 트랜잭션 보장
- 네트워크 라운드트립 감소
- RLS 우회 (SECURITY DEFINER)

### 2. 배치 작업 최적화

관리자 플랜 생성 시 여러 학생에 대한 일괄 처리가 필요한 경우:

- 단일 트랜잭션 내에서 처리
- 인덱스 활용 최적화
- 부분 인덱스 활용

### 3. 쿼리 패턴 분석

실제 사용되는 쿼리 패턴을 분석하여:

- 필요한 인덱스 추가
- 불필요한 인덱스 제거
- 쿼리 최적화

---

## ✅ 체크리스트

### 제약 조건

- [x] 모든 주요 테이블에 PRIMARY KEY 설정
- [x] 외래 키 관계 명확히 정의
- [x] UNIQUE 제약으로 중복 방지
- [ ] 모든 외래 키에 인덱스 존재 확인

### 인덱스

- [x] 주요 조회 패턴에 맞는 인덱스 구성
- [x] 부분 인덱스 활용
- [ ] 미사용 인덱스 정리
- [ ] 외래 키 인덱스 보완

### RLS 정책

- [ ] `auth_rls_initplan` 이슈 해결
- [ ] 중복 정책 통합
- [ ] 정책 성능 최적화

### 보안

- [ ] Security Definer View 검토
- [ ] 비밀번호 유출 보호 활성화
- [ ] Extension 권한 관리

---

## 📝 결론

관리자 플랜 생성 관련 데이터베이스 스키마는 전반적으로 잘 설계되어 있습니다. 다만, 다음과 같은 개선이 필요합니다:

1. **즉시 조치**: 외래 키 인덱스 추가, RLS 정책 최적화
2. **중기 조치**: 중복 정책 통합, 미사용 인덱스 정리
3. **장기 조치**: 보안 설정 검토 및 강화

이러한 개선을 통해 관리자 플랜 생성 기능의 성능과 보안을 향상시킬 수 있습니다.

---

## 📚 참고 자료

- [Supabase RLS 최적화 가이드](https://supabase.com/docs/guides/auth/row-level-security)
- [PostgreSQL 인덱스 최적화](https://www.postgresql.org/docs/current/indexes.html)
- [Database Linter 도구](https://github.com/supabase/database-linter)







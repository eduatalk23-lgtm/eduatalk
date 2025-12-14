# 재조정 인덱스 최적화 마이그레이션 수정

**작업일**: 2025-12-12  
**관련 마이그레이션**: `20251209213000_optimize_reschedule_indexes.sql`

---

## 📋 문제 상황

Supabase 마이그레이션 푸시 시 다음 오류 발생:

```
ERROR: CREATE INDEX CONCURRENTLY cannot be executed within a pipeline (SQLSTATE 25001)
```

### 원인

- Supabase 마이그레이션은 트랜잭션 내에서 실행됨
- `CREATE INDEX CONCURRENTLY`는 트랜잭션 내에서 실행할 수 없음
- PostgreSQL의 제약사항: `CONCURRENTLY` 옵션은 별도 트랜잭션에서만 실행 가능

---

## 🔧 해결 방법

### 1. 마이그레이션 파일 수정

`supabase/migrations/20251209213000_optimize_reschedule_indexes.sql` 파일에서 모든 `CONCURRENTLY` 키워드 제거:

**변경 전**:
```sql
CREATE INDEX CONCURRENTLY IF NOT EXISTS 
  idx_student_plan_group_active 
  ON student_plan (plan_group_id, is_active, status)
  WHERE is_active = true AND status IN ('pending', 'in_progress');
```

**변경 후**:
```sql
CREATE INDEX IF NOT EXISTS 
  idx_student_plan_group_active 
  ON student_plan (plan_group_id, is_active, status)
  WHERE is_active = true AND status IN ('pending', 'in_progress');
```

### 2. 수정된 인덱스 목록

다음 7개의 인덱스에서 `CONCURRENTLY` 제거:
1. `idx_student_plan_group_active`
2. `idx_student_plan_due_date`
3. `idx_student_plan_version_active`
4. `idx_reschedule_log_group_created`
5. `idx_reschedule_log_student_created`
6. `idx_plan_history_log_plan`
7. `idx_plan_history_group_created`

### 3. 마이그레이션 적용

```bash
npx supabase db push --include-all
```

`--include-all` 플래그 사용 이유:
- 로컬 마이그레이션 파일(`20251209213000`)이 원격 DB의 마지막 마이그레이션보다 이전 타임스탬프이지만 아직 적용되지 않은 상황
- 중간에 삽입되어야 하는 마이그레이션을 적용하기 위해 필요

---

## ✅ 적용 결과

```
Applying migration 20251209213000_optimize_reschedule_indexes.sql...
NOTICE (42P07): relation "idx_student_plan_group_active" already exists, skipping
NOTICE (42P07): relation "idx_student_plan_version_active" already exists, skipping
Finished supabase db push.
```

- 마이그레이션 성공적으로 적용됨
- 일부 인덱스는 이미 존재하여 `IF NOT EXISTS`로 인해 스킵됨 (정상 동작)

---

## 📝 참고사항

### CONCURRENTLY 옵션의 특징

- **장점**: 인덱스 생성 시 테이블 잠금 없이 수행 가능 (운영 중 서비스 영향 최소화)
- **단점**: 트랜잭션 내에서 실행 불가, 더 오래 걸림

### Supabase 마이그레이션에서의 제약

- Supabase는 모든 마이그레이션을 트랜잭션으로 실행
- 따라서 `CONCURRENTLY` 옵션 사용 불가
- 대신 일반 인덱스 생성 사용 (마이그레이션 실행 시점에는 서비스 영향 최소화 가능)

### 대안 고려사항

만약 운영 중인 큰 테이블에 인덱스를 추가해야 하는 경우:
1. 마이그레이션 파일에서 일반 `CREATE INDEX` 사용
2. 필요시 수동으로 `CREATE INDEX CONCURRENTLY` 실행 (트랜잭션 외부에서)
3. 또는 유지보수 시간대에 마이그레이션 적용

---

## 🔗 관련 문서

- 재조정 기능 TODO: `docs/refactoring/reschedule_feature_todo.md`
- Phase 3 TODO 리스트: `docs/refactoring/03_phase_todo_list.md`








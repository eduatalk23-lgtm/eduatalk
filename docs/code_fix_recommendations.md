# 코드 수정 권장 사항

## 1. student_goal_progress 컬럼명 통일

### 문제
- 스키마: `recorded_at` 컬럼 사용
- 코드: `created_at` 컬럼 사용

### 해결 방안
마이그레이션 파일 `20250109000001_fix_student_schema_columns.sql`에서 `recorded_at`을 `created_at`으로 변경하도록 설정했습니다.

**코드 수정 불필요** - 마이그레이션 실행 후 자동으로 통일됩니다.

---

## 2. tenant_id fallback 처리 확인

### 현재 상태
대부분의 데이터 접근 함수에서 `tenant_id` 컬럼이 없을 경우를 대비한 fallback 처리가 되어 있습니다:

```typescript
if (error && error.code === "42703") {
  // fallback 처리
}
```

### 권장 사항
마이그레이션 실행 후 모든 테이블에 `tenant_id`가 추가되므로, fallback 코드는 유지하되 주석으로 표시하는 것을 권장합니다:

```typescript
// Fallback: tenant_id 컬럼이 없는 경우 (마이그레이션 전 호환성)
if (error && error.code === "42703") {
  ({ data, error } = await selectQuery());
}
```

---

## 3. student_plan.completed_amount, progress 사용 확인

### 현재 상태
일부 코드에서 `student_plan` 테이블의 `completed_amount`와 `progress` 컬럼을 사용합니다.

### 해결 방안
마이그레이션 파일 `20250109000001_fix_student_schema_columns.sql`에서 이 컬럼들을 추가하도록 설정했습니다.

**코드 수정 불필요** - 마이그레이션 실행 후 사용 가능합니다.

---

## 4. 테이블 생성 확인

### 생성되는 테이블
1. `student_plan`
2. `student_block_schedule`
3. `books`
4. `lectures`
5. `student_custom_contents`

### 확인 사항
마이그레이션 실행 전에 다음을 확인하세요:

1. **기존 데이터 백업**
   - 기존 테이블에 데이터가 있다면 백업 필요

2. **테이블 존재 여부 확인**
   - 마이그레이션 파일은 `IF NOT EXISTS` 체크를 포함하므로 안전하게 실행 가능

3. **RLS 정책 확인**
   - 기본 RLS 정책이 추가되지만, tenant 기반 정책은 별도 마이그레이션에서 관리됨

---

## 5. 실행 순서

### 마이그레이션 실행 순서
1. `20250109000000_create_missing_student_tables.sql` - 테이블 생성
2. `20250109000001_fix_student_schema_columns.sql` - 컬럼 수정

### 실행 방법
```bash
# Supabase CLI 사용
supabase migration up

# 또는 Supabase Dashboard에서 직접 실행
```

---

## 6. 검증 체크리스트

마이그레이션 실행 후 다음을 확인하세요:

- [ ] `student_plan` 테이블 생성 확인
- [ ] `student_block_schedule` 테이블 생성 확인
- [ ] `books` 테이블 생성 확인
- [ ] `lectures` 테이블 생성 확인
- [ ] `student_custom_contents` 테이블 생성 확인
- [ ] `student_goals.updated_at` 컬럼 추가 확인
- [ ] `student_goal_progress.created_at` 컬럼명 통일 확인
- [ ] `student_plan.completed_amount`, `progress` 컬럼 추가 확인
- [ ] RLS 정책이 올바르게 설정되었는지 확인
- [ ] 인덱스가 올바르게 생성되었는지 확인

---

## 7. 추가 권장 사항

### 7.1 데이터 무결성
- 외래 키 제약조건이 올바르게 설정되었는지 확인
- `tenant_id`가 모든 레코드에 올바르게 할당되었는지 확인

### 7.2 성능 최적화
- 인덱스가 쿼리 패턴에 맞게 생성되었는지 확인
- 필요시 추가 인덱스 생성 고려

### 7.3 모니터링
- 마이그레이션 실행 후 애플리케이션 로그 확인
- 에러 발생 시 롤백 계획 수립


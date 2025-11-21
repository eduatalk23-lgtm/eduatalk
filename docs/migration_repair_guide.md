# 마이그레이션 수동 적용 가이드

Supabase SQL Editor에서 직접 마이그레이션을 실행한 경우, Supabase 마이그레이션 시스템에 이를 등록해야 합니다.

## 문제 상황

Supabase SQL Editor에서 직접 마이그레이션을 실행하면, Supabase CLI는 해당 마이그레이션이 적용되었다는 것을 알 수 없습니다. 따라서 다음에 `supabase db push`를 실행하면 다시 마이그레이션을 시도할 수 있습니다.

## 해결 방법

### 방법 1: Supabase SQL Editor에서 직접 실행 (권장)

1. Supabase Dashboard → SQL Editor 열기
2. 다음 SQL 실행:

```sql
-- 마이그레이션을 적용된 것으로 표시
INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES 
  ('20250110000000', 'create_block_sets'),
  ('20250110000001', 'add_block_sets_trigger')
ON CONFLICT (version) DO NOTHING;
```

3. 확인:

```sql
SELECT * FROM supabase_migrations.schema_migrations 
WHERE version IN ('20250110000000', '20250110000001')
ORDER BY version DESC;
```

### 방법 2: Supabase CLI 사용

```bash
# 마이그레이션 상태 확인
npx supabase db remote commit

# 또는 직접 SQL 실행
npx supabase db execute --sql "
INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES 
  ('20250110000000', 'create_block_sets'),
  ('20250110000001', 'add_block_sets_trigger')
ON CONFLICT (version) DO NOTHING;
"
```

## 주의사항

- `ON CONFLICT DO NOTHING`을 사용하여 이미 존재하는 경우 에러가 발생하지 않도록 합니다.
- 마이그레이션 파일명과 버전 번호가 정확히 일치해야 합니다.
- 해시 값이 필요한 경우, Supabase CLI가 자동으로 생성합니다.

## 확인 방법

마이그레이션이 제대로 등록되었는지 확인:

```bash
npx supabase migration list
```

또는 SQL로 확인:

```sql
SELECT version, name, inserted_at 
FROM supabase_migrations.schema_migrations 
ORDER BY version DESC;
```


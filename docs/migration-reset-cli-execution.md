# 마이그레이션 히스토리 리셋 실행 가이드 (CLI 방법)

> 방법 2: CLI를 사용하여 마이그레이션 히스토리를 리셋하는 방법

---

## 현재 상태 확인

```powershell
npx supabase migration list
```

현재 상태:
```
   Local          | Remote         | Time (UTC)          
  ----------------|----------------|---------------------
   20250131000000 | 20250131000000 | 2025-01-31 00:00:00 
```

---

## 실행 방법

### 방법 A: Supabase Dashboard에서 실행 (가장 권장)

1. **Supabase Dashboard 접속**
   - https://app.supabase.com 접속
   - 프로젝트 선택
   - 좌측 메뉴에서 **SQL Editor** 클릭

2. **SQL 실행**
   - 다음 파일의 내용을 복사하여 실행:
   - `supabase/migrations_reset_execute.sql`

또는 직접 실행:

```sql
-- 기존 마이그레이션 히스토리 삭제
DELETE FROM supabase_migrations.schema_migrations;

-- 새로운 초기 마이그레이션으로 등록
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES ('20250131000000', 'initial_schema', ARRAY[]::text[]);

-- 확인
SELECT * FROM supabase_migrations.schema_migrations ORDER BY version DESC;
```

### 방법 B: psql을 사용하여 직접 실행

```powershell
# 스크립트 실행
.\scripts\execute-reset-sql.ps1
```

또는 직접 실행:

```powershell
# 데이터베이스 연결 문자열 필요
# Supabase Dashboard > Settings > Database > Connection string에서 확인
psql "postgresql://postgres:[password]@[host]:5432/postgres" -f supabase/migrations_reset_execute.sql
```

---

## 실행 후 확인

### 1. 마이그레이션 목록 확인

```powershell
npx supabase migration list
```

예상 결과:
```
   Local          | Remote         | Time (UTC)          
  ----------------|----------------|---------------------
   20250131000000 | 20250131000000 | 2025-01-31 00:00:00 
```

### 2. 데이터베이스 상태 확인

Supabase Dashboard > Database > Tables에서 테이블들이 정상적으로 존재하는지 확인하세요.

---

## 생성된 파일

- **SQL 파일**: `supabase/migrations_reset_execute.sql`
- **실행 스크립트**: `scripts/execute-reset-sql.ps1`
- **초기 마이그레이션**: `supabase/migrations/20250131000000_initial_schema.sql`

---

## 다음 단계

마이그레이션 히스토리 리셋이 완료되면:

1. **새로운 마이그레이션 생성**
   ```powershell
   npx supabase migration new <migration_name>
   ```

2. **마이그레이션 적용**
   ```powershell
   npx supabase db push
   ```

3. **애플리케이션 테스트**
   - 데이터베이스 연결 확인
   - 주요 기능 테스트

---

## 문제 해결

### 오류: 테이블이 존재하지 않음

```
ERROR: relation "supabase_migrations.schema_migrations" does not exist
```

**해결**: Supabase CLI로 마이그레이션을 한 번 이상 실행했는지 확인하세요.

### 오류: 권한 없음

```
ERROR: permission denied for table schema_migrations
```

**해결**: Service Role Key를 사용하거나 Supabase Dashboard에서 실행하세요.

---

**마지막 업데이트**: 2025-11-23















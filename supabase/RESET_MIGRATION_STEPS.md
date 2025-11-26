# 마이그레이션 히스토리 리셋 실행 단계

## ⚠️ 중요: 실행 전 확인사항

- [ ] 데이터베이스 백업 완료
- [ ] 프로덕션 환경인지 확인
- [ ] 팀원들과 협의 완료

---

## 실행 방법

### 방법 1: Supabase Dashboard (권장)

1. [Supabase Dashboard](https://app.supabase.com) 접속
2. 프로젝트 선택
3. **SQL Editor** 열기
4. 아래 SQL 실행:

```sql
-- 기존 마이그레이션 히스토리 삭제
DELETE FROM supabase_migrations.schema_migrations;

-- 새로운 초기 마이그레이션으로 등록
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES ('20250131000000', 'initial_schema', ARRAY[]::text[]);

-- 확인
SELECT * FROM supabase_migrations.schema_migrations ORDER BY version DESC;
```

### 방법 2: CLI 스크립트

```powershell
# 환경 변수 설정 후 실행
npx tsx scripts/execute-migration-reset.ts
```

---

## 실행 후 확인

```powershell
# 마이그레이션 목록 확인
npx supabase migration list
```

예상 결과:
```
Applied migrations:
  20250131000000  initial_schema
```

---

## 생성된 파일

- 초기 마이그레이션: `supabase/migrations/20250131000000_initial_schema.sql`
- 리셋 SQL: `supabase/migrations_reset_20251123.sql`
- 백업: `supabase/migrations_backup_20251123_214831/`

---

## 다음 단계

1. 새로운 마이그레이션 생성: `npx supabase migration new <name>`
2. 마이그레이션 적용: `npx supabase db push`















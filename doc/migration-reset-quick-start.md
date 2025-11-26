# Supabase 마이그레이션 새로 시작 - 빠른 시작 가이드

> 프로덕션/원격 환경에서 마이그레이션을 새로 시작하는 단계별 가이드

---

## 🚀 빠른 실행 (스크립트 사용)

```powershell
# 프로젝트 루트에서 실행
.\scripts\reset-migrations-production.ps1
```

스크립트가 다음 작업을 자동으로 수행합니다:
1. 기존 마이그레이션 파일 백업
2. 스키마 덤프 생성 (선택)
3. 기존 마이그레이션 파일 정리
4. 마이그레이션 히스토리 리셋 SQL 생성

---

## 📝 수동 실행 단계

### 1단계: 기존 마이그레이션 파일 백업

```powershell
# 백업 폴더 생성
$backupDir = "supabase/migrations_backup_$(Get-Date -Format 'yyyyMMdd_HHmmss')"
New-Item -ItemType Directory -Path $backupDir -Force

# 마이그레이션 파일 복사
Copy-Item -Path "supabase/migrations/*.sql" -Destination $backupDir -Force
```

### 2단계: 현재 스키마 덤프 생성

```powershell
# 초기 마이그레이션 파일 생성
npx supabase db dump --schema public --data-only=false > supabase/migrations/20250131000000_initial_schema.sql
```

**또는 Supabase Dashboard에서:**
1. SQL Editor 열기
2. 다음 쿼리로 스키마 확인:
```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;
```

### 3단계: 기존 마이그레이션 파일 정리

```powershell
# 초기 마이그레이션 파일만 남기고 나머지 삭제
Get-ChildItem supabase/migrations/*.sql | 
    Where-Object { $_.Name -ne "20250131000000_initial_schema.sql" } | 
    Remove-Item
```

### 4단계: 마이그레이션 히스토리 리셋

**Supabase Dashboard > SQL Editor**에서 다음 SQL 실행:

```sql
-- 기존 마이그레이션 히스토리 삭제
DELETE FROM supabase_migrations.schema_migrations;

-- 새로운 초기 마이그레이션으로 등록
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES ('20250131000000', 'initial_schema', ARRAY[]::text[]);

-- 확인
SELECT * FROM supabase_migrations.schema_migrations ORDER BY version DESC;
```

### 5단계: 확인

```powershell
# 마이그레이션 목록 확인
npx supabase migration list

# 또는 Supabase Dashboard에서 확인
```

---

## ⚠️ 중요 주의사항

1. **데이터 백업 필수**: 프로덕션 환경에서는 반드시 데이터베이스 백업을 먼저 수행하세요
2. **팀 협의**: 마이그레이션 리셋은 팀원들과 사전에 협의하세요
3. **Git 커밋**: 변경사항을 Git에 커밋하기 전에 팀원들에게 알리세요

---

## 🔍 문제 해결

### 스키마 덤프 생성 실패

```powershell
# Supabase 연결 확인
npx supabase status

# 원격 프로젝트 연결 확인
npx supabase link --project-ref <your-project-ref>
```

### 마이그레이션 히스토리 확인

```sql
-- Supabase Dashboard > SQL Editor에서 실행
SELECT * FROM supabase_migrations.schema_migrations 
ORDER BY version DESC;
```

---

## 📚 참고 문서

- [상세 가이드](./supabase-migration-reset-guide.md)
- [Supabase CLI 문서](https://supabase.com/docs/reference/cli/introduction)















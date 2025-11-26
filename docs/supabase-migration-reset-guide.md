# Supabase 마이그레이션 새로 시작 가이드

> Supabase 마이그레이션을 새 시점부터 시작하는 방법을 안내하는 문서입니다.

**작성일**: 2025-01-31  
**버전**: 1.0

---

## 📋 목차

1. [개요](#개요)
2. [방법 1: 로컬 개발 환경 리셋](#방법-1-로컬-개발-환경-리셋)
3. [방법 2: 프로덕션/원격 환경 새로 시작](#방법-2-프로덕션원격-환경-새로-시작)
4. [방법 3: 현재 스키마 기반 초기 마이그레이션 생성](#방법-3-현재-스키마-기반-초기-마이그레이션-생성)
5. [주의사항](#주의사항)

---

## 개요

Supabase 마이그레이션을 새로 시작하는 경우는 다음과 같습니다:

- **로컬 개발 환경**: 테스트 데이터와 함께 완전히 새로 시작
- **프로덕션 환경**: 현재 스키마를 기반으로 마이그레이션 히스토리 정리
- **마이그레이션 통합**: 여러 마이그레이션을 하나로 통합

---

## 방법 1: 로컬 개발 환경 리셋

### ⚠️ 주의사항

이 방법은 **모든 데이터와 마이그레이션 히스토리를 삭제**합니다. 로컬 개발 환경에서만 사용하세요!

### 실행 방법

#### 옵션 A: 스크립트 사용 (권장)

```powershell
# 프로젝트 루트에서 실행
.\scripts\reset-migrations.ps1
```

#### 옵션 B: 수동 실행

```powershell
# 1. 데이터베이스 완전 리셋
npx supabase db reset

# 2. 마이그레이션 파일 확인
Get-ChildItem supabase/migrations

# 3. 새로운 마이그레이션 생성 (필요시)
npx supabase migration new initial_schema
```

### 결과

- 모든 테이블과 데이터 삭제
- 마이그레이션 히스토리 초기화
- `supabase/migrations/` 폴더의 마이그레이션 파일은 유지됨
- `npx supabase db push` 명령으로 마이그레이션 재적용 가능

---

## 방법 2: 프로덕션/원격 환경 새로 시작

### ⚠️ 주의사항

이 방법은 **프로덕션 데이터를 보존**하면서 마이그레이션 히스토리만 정리합니다. 신중하게 진행하세요!

### 실행 방법

#### 옵션 A: 스크립트 사용

```powershell
# 프로젝트 루트에서 실행
.\scripts\start-fresh-migrations.ps1
```

#### 옵션 B: 수동 실행

```powershell
# 1. 기존 마이그레이션 파일 백업
$backupDir = "supabase/migrations_backup_$(Get-Date -Format 'yyyyMMdd_HHmmss')"
New-Item -ItemType Directory -Path $backupDir -Force
Copy-Item -Path "supabase/migrations/*" -Destination $backupDir -Recurse

# 2. 현재 스키마 덤프 생성
npx supabase db dump --schema public > supabase/migrations/20250131000000_initial_schema.sql

# 3. 기존 마이그레이션 파일 삭제 (백업 후)
Remove-Item supabase/migrations/*.sql -Exclude "20250131000000_initial_schema.sql"

# 4. 마이그레이션 히스토리 리셋 (SQL 직접 실행)
# Supabase Dashboard > SQL Editor에서 실행:
```

```sql
-- 기존 마이그레이션 히스토리 삭제
DELETE FROM supabase_migrations.schema_migrations;

-- 새로운 초기 마이그레이션으로 등록
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES ('20250131000000', 'initial_schema', ARRAY[]::text[]);
```

### 결과

- 데이터는 보존됨
- 마이그레이션 히스토리가 새로 시작됨
- 기존 마이그레이션 파일은 백업됨
- 새로운 초기 마이그레이션 파일 생성됨

---

## 방법 3: 현재 스키마 기반 초기 마이그레이션 생성

현재 데이터베이스 스키마를 기반으로 새로운 초기 마이그레이션을 생성하는 방법입니다.

### 실행 방법

```powershell
# 1. 현재 스키마 덤프 생성
npx supabase db dump --schema public --data-only=false > supabase/migrations/20250131000000_initial_schema.sql

# 2. 생성된 파일 검토 및 수정
# - 불필요한 함수/트리거 제거
# - 데이터 마이그레이션 로직 추가 (필요시)
# - 주석 및 설명 추가

# 3. 기존 마이그레이션 파일 백업
$backupDir = "supabase/migrations_backup_$(Get-Date -Format 'yyyyMMdd_HHmmss')"
New-Item -ItemType Directory -Path $backupDir -Force
Copy-Item -Path "supabase/migrations/*" -Destination $backupDir -Recurse

# 4. 기존 마이그레이션 파일 삭제 (초기 마이그레이션 제외)
Get-ChildItem supabase/migrations/*.sql | 
    Where-Object { $_.Name -ne "20250131000000_initial_schema.sql" } | 
    Remove-Item

# 5. 마이그레이션 히스토리 업데이트
# Supabase Dashboard > SQL Editor에서 실행:
```

```sql
-- 기존 마이그레이션 히스토리 삭제
DELETE FROM supabase_migrations.schema_migrations;

-- 새로운 초기 마이그레이션으로 등록
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES ('20250131000000', 'initial_schema', ARRAY[]::text[]);
```

### 초기 마이그레이션 파일 구조 예시

```sql
-- Migration: Initial Schema
-- Description: 현재 데이터베이스 스키마를 기반으로 생성된 초기 마이그레이션
-- Date: 2025-01-31

-- ============================================
-- 1. 테이블 생성
-- ============================================
CREATE TABLE IF NOT EXISTS tenants (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- ============================================
-- 2. 인덱스 생성
-- ============================================
CREATE INDEX IF NOT EXISTS idx_tenants_name ON tenants(name);

-- ============================================
-- 3. 함수 및 트리거 생성
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ... 나머지 스키마 ...
```

---

## 주의사항

### ⚠️ 프로덕션 환경

1. **데이터 백업 필수**: 작업 전 반드시 데이터베이스 백업을 수행하세요
2. **다운타임 계획**: 마이그레이션 히스토리 리셋 시 잠시 다운타임이 발생할 수 있습니다
3. **롤백 계획**: 문제 발생 시 롤백 방법을 미리 준비하세요

### ⚠️ 마이그레이션 히스토리

- `supabase_migrations.schema_migrations` 테이블을 직접 수정하는 것은 위험할 수 있습니다
- 가능하면 `supabase migration repair` 명령을 사용하세요
- 마이그레이션 버전은 타임스탬프 형식(`YYYYMMDDHHmmss`)을 사용하세요

### ⚠️ 팀 협업

- 마이그레이션 리셋은 팀원들과 사전에 협의하세요
- Git에 변경사항을 커밋하기 전에 팀원들에게 알리세요
- 마이그레이션 파일 백업을 Git에 포함시키지 마세요 (`.gitignore`에 추가)

---

## 문제 해결

### 마이그레이션 적용 실패

```powershell
# 마이그레이션 상태 확인
npx supabase migration list

# 특정 마이그레이션 상태 수정
npx supabase migration repair --status applied <version>
npx supabase migration repair --status reverted <version>
```

### 스키마 덤프 생성 실패

```powershell
# 연결 확인
npx supabase status

# 수동으로 스키마 추출 (Supabase Dashboard 사용)
# SQL Editor > Show create table 쿼리 실행
```

### 마이그레이션 히스토리 확인

```sql
-- Supabase Dashboard > SQL Editor에서 실행
SELECT * FROM supabase_migrations.schema_migrations 
ORDER BY version DESC;
```

---

## 참고 자료

- [Supabase CLI 문서](https://supabase.com/docs/reference/cli/introduction)
- [Supabase 마이그레이션 가이드](https://supabase.com/docs/guides/cli/local-development#database-migrations)
- [PostgreSQL 덤프 문서](https://www.postgresql.org/docs/current/app-pgdump.html)

---

**마지막 업데이트**: 2025-01-31















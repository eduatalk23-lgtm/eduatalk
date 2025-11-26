# 마이그레이션 히스토리 리셋 실행 가이드

> Supabase 마이그레이션 히스토리를 리셋하는 단계별 실행 가이드

---

## 🎯 목표

프로덕션 데이터베이스의 마이그레이션 히스토리를 리셋하고, 새로운 초기 마이그레이션(`20250131000000_initial_schema.sql`)부터 시작합니다.

**⚠️ 중요**: 이 작업은 마이그레이션 히스토리만 삭제하며, 실제 데이터는 보존됩니다.

---

## 방법 1: Supabase Dashboard에서 실행 (권장)

### 1단계: Supabase Dashboard 접속

1. [Supabase Dashboard](https://app.supabase.com)에 로그인
2. 프로젝트 선택
3. 좌측 메뉴에서 **SQL Editor** 클릭

### 2단계: 리셋 SQL 실행

다음 SQL을 복사하여 SQL Editor에 붙여넣고 실행하세요:

```sql
-- ============================================
-- Supabase 마이그레이션 히스토리 리셋 SQL
-- ============================================

-- 기존 마이그레이션 히스토리 삭제
DELETE FROM supabase_migrations.schema_migrations;

-- 새로운 초기 마이그레이션으로 등록
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES ('20250131000000', 'initial_schema', ARRAY[]::text[]);

-- 확인 쿼리
SELECT * FROM supabase_migrations.schema_migrations ORDER BY version DESC;
```

### 3단계: 결과 확인

실행 후 다음과 같은 결과가 표시되어야 합니다:

```
version          | name            | statements
-----------------|-----------------|------------
20250131000000   | initial_schema | {}
```

---

## 방법 2: CLI 스크립트 실행

### 전제 조건

`.env.local` 파일에 다음 환경 변수가 설정되어 있어야 합니다:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### 실행

```powershell
# 프로젝트 루트에서 실행
npx tsx scripts/execute-migration-reset.ts
```

---

## 방법 3: Supabase CLI 사용

### 전제 조건

Supabase CLI가 설치되어 있고 프로젝트에 연결되어 있어야 합니다:

```powershell
# Supabase CLI 설치 확인
npx supabase --version

# 프로젝트 연결 (처음 한 번만)
npx supabase link --project-ref <your-project-ref>
```

### 실행

```powershell
# 마이그레이션 히스토리 확인
npx supabase migration list

# 마이그레이션 히스토리 리셋 (로컬 개발 환경만)
npx supabase db reset
```

**⚠️ 주의**: `db reset`은 로컬 개발 환경에서만 사용하세요. 프로덕션에서는 SQL을 직접 실행하세요.

---

## ✅ 실행 후 확인

### 1. 마이그레이션 목록 확인

```powershell
npx supabase migration list
```

예상 결과:
```
Applied migrations:
  20250131000000  initial_schema
```

### 2. 데이터베이스 상태 확인

Supabase Dashboard > Database > Tables에서 테이블들이 정상적으로 존재하는지 확인하세요.

### 3. 새로운 마이그레이션 생성 테스트

```powershell
# 새로운 마이그레이션 생성
npx supabase migration new test_migration

# 마이그레이션 파일이 생성되었는지 확인
Get-ChildItem supabase/migrations
```

---

## 🔍 문제 해결

### 오류: 테이블이 존재하지 않음

```
ERROR: relation "supabase_migrations.schema_migrations" does not exist
```

**해결 방법**:
1. Supabase CLI로 마이그레이션을 한 번 이상 실행했는지 확인
2. Supabase Dashboard > Database > Tables에서 `supabase_migrations` 스키마 확인
3. 없다면 Supabase CLI로 초기화: `npx supabase init`

### 오류: 권한 없음

```
ERROR: permission denied for table schema_migrations
```

**해결 방법**:
- Service Role Key를 사용하여 실행하거나
- Supabase Dashboard에서 직접 실행하세요

### 마이그레이션 목록이 비어있음

```powershell
npx supabase migration list
# 결과: (비어있음)
```

**해결 방법**:
1. Supabase Dashboard에서 마이그레이션 히스토리 확인:
```sql
SELECT * FROM supabase_migrations.schema_migrations;
```

2. 없다면 다시 등록:
```sql
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES ('20250131000000', 'initial_schema', ARRAY[]::text[]);
```

---

## 📋 체크리스트

마이그레이션 리셋 전:

- [ ] 데이터베이스 백업 완료
- [ ] 팀원들과 협의 완료
- [ ] 프로덕션 환경인지 확인
- [ ] 다운타임 계획 수립 (필요시)

마이그레이션 리셋 후:

- [ ] 마이그레이션 히스토리 확인 완료
- [ ] 데이터베이스 테이블 정상 작동 확인
- [ ] 새로운 마이그레이션 생성 테스트 완료
- [ ] 애플리케이션 정상 작동 확인

---

## 📚 관련 문서

- [상세 가이드](./supabase-migration-reset-guide.md)
- [빠른 시작 가이드](./migration-reset-quick-start.md)
- [Supabase CLI 문서](https://supabase.com/docs/reference/cli/introduction)

---

**마지막 업데이트**: 2025-11-23















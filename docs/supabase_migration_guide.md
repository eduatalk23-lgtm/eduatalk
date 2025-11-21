# Supabase 마이그레이션 실행 가이드

## 📋 현재 마이그레이션 파일 목록

다음 순서로 실행해야 합니다:

1. `20250101000000_create_school_and_mock_scores_tables.sql`
2. `20250102000000_create_study_sessions_table.sql`
3. `20250103000000_create_goals_tables.sql`
4. `20250104000000_create_student_history_table.sql`
5. `20250105000000_create_admin_users_and_consulting_notes.sql`
6. `20250106000000_create_parent_users_and_links.sql`
7. `20250107000000_create_tenants_table.sql`
8. `20250107000001_add_tenant_id_to_users.sql`
9. `20250107000002_add_tenant_id_to_core_tables.sql`
10. `20250107000003_create_default_tenant_and_assign.sql`
11. `20250107000004_update_rls_policies_for_tenants.sql`
12. `20250108000000_create_missing_tables.sql` ⭐ (새로 생성)
13. `20250108000001_add_tenant_id_to_existing_tables.sql` ⭐ (새로 생성)

## 🚀 방법 1: Supabase CLI 사용 (권장)

### 장점
- ✅ 자동으로 모든 마이그레이션을 순서대로 실행
- ✅ 이미 실행된 마이그레이션은 자동으로 건너뜀
- ✅ 마이그레이션 상태 추적 가능
- ✅ 롤백 가능

### 설치 및 설정

1. **Supabase CLI 설치**
```bash
# Windows (PowerShell)
winget install Supabase.CLI

# 또는 npm으로 설치
npm install -g supabase
```

2. **Supabase 프로젝트 연결**
```bash
# Supabase Dashboard에서 프로젝트 설정 → API → Project URL과 anon key 확인

# 로그인
supabase login

# 프로젝트 연결
supabase link --project-ref YOUR_PROJECT_REF
```

3. **마이그레이션 실행**
```bash
cd supabase
supabase db push
```

또는 특정 마이그레이션만 실행:
```bash
supabase migration up
```

### 마이그레이션 상태 확인
```bash
supabase migration list
```

## 📝 방법 2: 수동 실행 (SQL Editor)

### 장점
- ✅ CLI 설치 불필요
- ✅ 각 마이그레이션을 개별적으로 확인하며 실행 가능
- ✅ 에러 발생 시 즉시 확인 가능

### 단점
- ⚠️ 순서를 직접 관리해야 함
- ⚠️ 이미 실행된 마이그레이션을 다시 실행할 수 있음 (에러 가능)

### 실행 방법

1. **Supabase Dashboard 접속**
   - https://supabase.com/dashboard 접속
   - 프로젝트 선택

2. **SQL Editor 열기**
   - 왼쪽 메뉴에서 "SQL Editor" 클릭
   - "New query" 클릭

3. **마이그레이션 파일 순서대로 실행**
   - 각 `.sql` 파일의 내용을 복사
   - SQL Editor에 붙여넣기
   - "Run" 버튼 클릭
   - 에러가 없으면 다음 파일로 진행

### ⚠️ 주의사항

- **반드시 순서대로 실행**: 파일명의 날짜/시간 순서대로 실행해야 합니다
- **에러 확인**: 각 마이그레이션 실행 후 에러가 없는지 확인하세요
- **중복 실행 방지**: 이미 실행된 마이그레이션은 다시 실행하지 마세요

## 🔍 이미 실행된 마이그레이션 확인 방법

### SQL Editor에서 확인

```sql
-- 실행된 마이그레이션 확인 (Supabase 내부 테이블)
SELECT * FROM supabase_migrations.schema_migrations 
ORDER BY version;

-- 또는 테이블 존재 여부 확인
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;
```

### 확인해야 할 주요 테이블

다음 테이블들이 존재하는지 확인:
- ✅ `students`
- ✅ `student_plan`
- ✅ `student_study_sessions`
- ✅ `student_goals`
- ✅ `student_goal_progress`
- ✅ `student_history`
- ✅ `tenants`
- ✅ `admin_users`
- ✅ `parent_users`
- ✅ `student_analysis` (새로 생성)
- ✅ `student_scores` (새로 생성)
- ✅ `student_daily_schedule` (새로 생성)

## 📌 현재 상황별 가이드

### 시나리오 1: 처음부터 모든 마이그레이션 실행

**방법 A: CLI 사용 (권장)**
```bash
cd supabase
supabase db push
```

**방법 B: 수동 실행**
1. `20250101000000_create_school_and_mock_scores_tables.sql`부터 시작
2. 순서대로 모든 파일 실행
3. 마지막으로 `20250108000001_add_tenant_id_to_existing_tables.sql` 실행

### 시나리오 2: 일부 마이그레이션만 실행 (새로 생성된 파일만)

이미 기존 마이그레이션을 실행했다면:

1. **`20250108000000_create_missing_tables.sql` 실행**
   - `student_analysis` 테이블 생성
   - `student_scores` 테이블 생성
   - `student_daily_schedule` 테이블 생성
   - `student_content_progress` 컬럼 추가

2. **`20250108000001_add_tenant_id_to_existing_tables.sql` 실행**
   - 기존 테이블에 `tenant_id` 추가

### 시나리오 3: 특정 마이그레이션만 다시 실행

에러가 발생한 마이그레이션만 다시 실행:
- SQL Editor에서 해당 파일 내용 복사
- 실행
- 에러 메시지 확인 및 수정

## ⚠️ 에러 발생 시

### 에러: "relation already exists"
- 테이블이 이미 존재함
- `CREATE TABLE IF NOT EXISTS`를 사용하므로 안전하게 재실행 가능

### 에러: "column already exists"
- 컬럼이 이미 존재함
- `ADD COLUMN IF NOT EXISTS`를 사용하므로 안전하게 재실행 가능

### 에러: "column does not exist"
- 테이블은 존재하지만 컬럼이 없음
- 마이그레이션 파일이 수정되어 `DO $$ ... END $$;` 블록으로 처리됨
- 다시 실행하면 자동으로 컬럼 추가됨

## ✅ 실행 후 확인

모든 마이그레이션 실행 후 다음을 확인하세요:

```sql
-- 1. 새로 생성된 테이블 확인
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('student_analysis', 'student_scores', 'student_daily_schedule')
ORDER BY table_name;

-- 2. student_content_progress에 새 컬럼 확인
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'student_content_progress'
AND column_name IN ('plan_id', 'start_page_or_time', 'end_page_or_time', 'last_updated');

-- 3. tenant_id 컬럼 확인
SELECT table_name, column_name
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name IN (
  'student_study_sessions',
  'student_goals',
  'student_goal_progress',
  'student_history',
  'student_analysis',
  'student_scores',
  'student_daily_schedule'
)
AND column_name = 'tenant_id'
ORDER BY table_name;
```

## 🎯 권장 사항

1. **CLI 사용 권장**: 가능하면 Supabase CLI를 사용하는 것이 안전하고 편리합니다
2. **백업**: 중요한 데이터가 있다면 마이그레이션 전에 백업하세요
3. **테스트 환경**: 가능하면 먼저 테스트 환경에서 실행해보세요
4. **순서 준수**: 반드시 파일명 순서대로 실행하세요


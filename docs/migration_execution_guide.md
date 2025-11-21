# 마이그레이션 실행 가이드

## 1. 마이그레이션 파일 확인

다음 마이그레이션 파일들이 생성되었습니다:

1. `supabase/migrations/20250108000000_create_missing_tables.sql`
   - student_analysis 테이블 생성
   - student_scores 테이블 생성
   - student_daily_schedule 테이블 생성
   - student_content_progress 컬럼 추가

2. `supabase/migrations/20250108000001_add_tenant_id_to_existing_tables.sql`
   - student_study_sessions에 tenant_id 추가
   - student_goals에 tenant_id 추가
   - student_goal_progress에 tenant_id 추가
   - student_history에 tenant_id 추가

## 2. Supabase 마이그레이션 실행 방법

### 방법 1: Supabase CLI 사용 (권장)

```bash
# Supabase 프로젝트 디렉토리로 이동
cd supabase

# 마이그레이션 적용
supabase db push

# 또는 특정 마이그레이션만 적용
supabase migration up
```

### 방법 2: Supabase Dashboard 사용

1. Supabase Dashboard 접속
2. SQL Editor 열기
3. 각 마이그레이션 파일의 내용을 복사하여 순서대로 실행:
   - 먼저 `20250108000000_create_missing_tables.sql` 실행
   - 그 다음 `20250108000001_add_tenant_id_to_existing_tables.sql` 실행

### 방법 3: 직접 SQL 실행

Supabase Dashboard의 SQL Editor에서:

```sql
-- 1단계: 누락된 테이블 생성
-- 파일: supabase/migrations/20250108000000_create_missing_tables.sql
-- 내용 복사하여 실행

-- 2단계: 기존 테이블에 tenant_id 추가
-- 파일: supabase/migrations/20250108000001_add_tenant_id_to_existing_tables.sql
-- 내용 복사하여 실행
```

## 3. 마이그레이션 실행 순서

**중요**: 반드시 다음 순서로 실행해야 합니다:

1. ✅ `20250108000000_create_missing_tables.sql` (먼저 실행)
2. ✅ `20250108000001_add_tenant_id_to_existing_tables.sql` (나중에 실행)

이유: 두 번째 마이그레이션에서 기존 테이블을 참조하므로, 첫 번째 마이그레이션이 먼저 완료되어야 합니다.

## 4. 마이그레이션 실행 후 확인 사항

### 4.1 테이블 생성 확인

```sql
-- 다음 테이블들이 생성되었는지 확인
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN (
  'student_analysis',
  'student_scores',
  'student_daily_schedule'
);
```

### 4.2 컬럼 추가 확인

```sql
-- student_content_progress에 새 컬럼이 추가되었는지 확인
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'student_content_progress'
AND column_name IN ('plan_id', 'start_page_or_time', 'end_page_or_time', 'last_updated');
```

### 4.3 tenant_id 추가 확인

```sql
-- 다음 테이블들에 tenant_id가 추가되었는지 확인
SELECT table_name, column_name
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name IN (
  'student_study_sessions',
  'student_goals',
  'student_goal_progress',
  'student_history'
)
AND column_name = 'tenant_id';
```

### 4.4 RLS 정책 확인

```sql
-- RLS가 활성화되었는지 확인
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN (
  'student_analysis',
  'student_scores',
  'student_daily_schedule'
);
```

## 5. 문제 해결

### 5.1 마이그레이션 실패 시

**에러: "relation already exists"**
- 테이블이 이미 존재하는 경우
- 해결: `CREATE TABLE IF NOT EXISTS`를 사용하므로 안전하게 재실행 가능

**에러: "column already exists"**
- 컬럼이 이미 존재하는 경우
- 해결: `ADD COLUMN IF NOT EXISTS`를 사용하므로 안전하게 재실행 가능

**에러: "foreign key constraint"**
- 참조 무결성 오류
- 해결: 참조되는 테이블(students, tenants)이 먼저 존재하는지 확인

### 5.2 데이터 마이그레이션

기존 데이터가 있는 경우:
- `20250108000001_add_tenant_id_to_existing_tables.sql`에서 자동으로 tenant_id를 배정합니다
- students 테이블의 tenant_id를 참조하여 자동 업데이트됩니다

## 6. 테스트 체크리스트

마이그레이션 실행 후 다음 기능들을 테스트하세요:

- [ ] 성적 추가/수정/삭제 (`/scores`)
- [ ] 취약 과목 분석 (`/analysis`)
- [ ] 일일 스케줄 생성/조회 (`/schedule/[date]`)
- [ ] 학습 진행률 업데이트 (`/plan/[id]/progress`)
- [ ] 학습 세션 기록
- [ ] 학습 목표 관리
- [ ] 학습 히스토리 조회

## 7. 롤백 방법

마이그레이션을 롤백해야 하는 경우:

```sql
-- 주의: 데이터 손실 가능성이 있으므로 백업 후 실행

-- 1. 새로 생성된 테이블 삭제
DROP TABLE IF EXISTS student_daily_schedule CASCADE;
DROP TABLE IF EXISTS student_scores CASCADE;
DROP TABLE IF EXISTS student_analysis CASCADE;

-- 2. 추가된 컬럼 삭제 (student_content_progress)
ALTER TABLE student_content_progress 
DROP COLUMN IF EXISTS plan_id,
DROP COLUMN IF EXISTS start_page_or_time,
DROP COLUMN IF EXISTS end_page_or_time,
DROP COLUMN IF EXISTS last_updated;

-- 3. tenant_id 컬럼 삭제 (기존 테이블들)
ALTER TABLE student_study_sessions DROP COLUMN IF EXISTS tenant_id;
ALTER TABLE student_goals DROP COLUMN IF EXISTS tenant_id;
ALTER TABLE student_goal_progress DROP COLUMN IF EXISTS tenant_id;
ALTER TABLE student_history DROP COLUMN IF EXISTS tenant_id;
```

## 8. 다음 단계

마이그레이션 실행 후:

1. ✅ 애플리케이션 재시작
2. ✅ 기능 테스트 실행
3. ✅ 에러 로그 확인
4. ✅ 데이터 정합성 확인


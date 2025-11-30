# 빠른 마이그레이션 실행 가이드

## 📋 상황

`npx supabase db push` 명령이 네트워크 연결 오류로 실패하는 경우, Supabase Studio에서 직접 SQL을 실행할 수 있습니다.

## 🚀 실행 방법

### 1. Supabase Studio 접속

1. [Supabase Dashboard](https://supabase.com/dashboard) 접속
2. 프로젝트 선택
3. 좌측 메뉴에서 **SQL Editor** 클릭

### 2. 마이그레이션 SQL 복사 및 실행

#### 마이그레이션: notes 컬럼 추가

**파일**: `supabase/migrations/20251201000002_add_notes_to_score_tables.sql`

**SQL 내용**:

```sql
-- Migration: Add notes column to score tables for dummy data tagging
-- Description:
--   student_internal_scores와 student_mock_scores에 notes 컬럼 추가
--   students 테이블에 memo 컬럼 추가
--   더미 데이터를 쉽게 식별하고 삭제하기 위한 태깅 용도
-- Date: 2025-12-01

-- ============================================
-- 1. students 테이블에 memo 컬럼 추가
-- ============================================

ALTER TABLE public.students
ADD COLUMN IF NOT EXISTS memo text;

COMMENT ON COLUMN public.students.memo IS '학생 메모 (더미 데이터 태깅용)';

-- ============================================
-- 2. student_internal_scores에 notes 컬럼 추가
-- ============================================

ALTER TABLE public.student_internal_scores
ADD COLUMN IF NOT EXISTS notes text;

COMMENT ON COLUMN public.student_internal_scores.notes IS '비고 (더미 데이터 태깅용)';

-- ============================================
-- 3. student_mock_scores에 notes 컬럼 추가
-- ============================================

ALTER TABLE public.student_mock_scores
ADD COLUMN IF NOT EXISTS notes text;

COMMENT ON COLUMN public.student_mock_scores.notes IS '비고 (더미 데이터 태깅용)';
```

### 3. 실행 단계

1. SQL Editor에서 **New Query** 클릭
2. 위 SQL 내용을 복사하여 붙여넣기
3. **Run** 버튼 클릭 (또는 `Cmd/Ctrl + Enter`)
4. 성공 메시지 확인

### 4. 실행 결과 확인

다음 쿼리로 컬럼이 추가되었는지 확인:

```sql
-- students 테이블에 memo 컬럼 확인
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'students' AND column_name = 'memo';

-- student_internal_scores 테이블에 notes 컬럼 확인
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'student_internal_scores' AND column_name = 'notes';

-- student_mock_scores 테이블에 notes 컬럼 확인
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'student_mock_scores' AND column_name = 'notes';
```

모두 1개씩 조회되면 정상입니다.

## ✅ 다음 단계

마이그레이션이 완료되면:

1. 더미 데이터 생성:

   ```bash
   npm run seed:score-dashboard-dummy
   ```

2. API 테스트:
   ```bash
   npm run test:score-dashboard <studentId> <tenantId> <termId>
   ```

## 🔧 네트워크 문제 해결 (선택사항)

CLI를 사용하고 싶다면:

1. 네트워크 연결 확인
2. 방화벽/프록시 설정 확인
3. Supabase CLI 재설치:
   ```bash
   npm install -g supabase
   ```
4. Supabase 로그인 확인:
   ```bash
   npx supabase login
   ```








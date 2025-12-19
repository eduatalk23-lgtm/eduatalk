# 레거시 student_scores 테이블 정리 계획

**작성일**: 2025-02-04  
**작업 상태**: 계획 단계

---

## 📋 작업 개요

레거시 `student_scores` 테이블을 안전하게 정리합니다.

---

## 🔍 현재 상태 확인 필요

### 1. 테이블 존재 여부 확인
```sql
SELECT EXISTS (
  SELECT FROM information_schema.tables 
  WHERE table_schema = 'public' 
  AND table_name = 'student_scores'
);
```

### 2. 데이터 존재 여부 확인
```sql
SELECT COUNT(*) FROM student_scores;
```

### 3. 참조 관계 확인
```sql
-- 외래 키 참조 확인
SELECT 
  tc.table_name, 
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY' 
  AND ccu.table_name = 'student_scores';
```

### 4. 코드베이스 참조 확인
- ✅ 이미 완료: 모든 코드에서 새 구조로 마이그레이션 완료
- 레거시 함수들은 deprecated 표시만 되어 있음

---

## 🎯 정리 전략

### Option 1: 안전한 정리 (권장)

#### Step 1: 데이터 백업
```sql
-- 백업 테이블 생성
CREATE TABLE student_scores_backup AS 
SELECT * FROM student_scores;
```

#### Step 2: 데이터 마이그레이션 확인
- 모든 데이터가 `student_internal_scores` 또는 `student_mock_scores`로 마이그레이션되었는지 확인
- 데이터 불일치가 없는지 검증

#### Step 3: 테이블 제거
```sql
-- 외래 키 제약 조건 제거 (있는 경우)
ALTER TABLE student_scores 
DROP CONSTRAINT IF EXISTS <constraint_name>;

-- 테이블 제거
DROP TABLE IF EXISTS student_scores CASCADE;
```

### Option 2: 점진적 정리

#### Step 1: 테이블 이름 변경 (보관)
```sql
ALTER TABLE student_scores 
RENAME TO student_scores_deprecated;
```

#### Step 2: 일정 기간 후 제거
- 1-2개월 후 최종 제거
- 문제 발생 시 빠른 복구 가능

---

## ⚠️ 주의사항

### 1. 데이터 손실 방지
- 반드시 백업 후 진행
- 마이그레이션 데이터 검증 필수

### 2. 의존성 확인
- 다른 테이블에서 참조하는지 확인
- 뷰, 함수, 트리거에서 사용하는지 확인

### 3. RLS 정책
- RLS 정책이 있다면 함께 제거

### 4. 인덱스
- 테이블 제거 시 인덱스도 자동 제거됨

---

## 📝 마이그레이션 스크립트

### 안전한 제거 마이그레이션

```sql
-- Migration: Remove Legacy student_scores Table
-- Description: 레거시 student_scores 테이블 제거
-- Date: 2025-02-04
--
-- ⚠️ 주의: 이 마이그레이션을 실행하기 전에:
-- 1. 모든 데이터가 student_internal_scores 또는 student_mock_scores로 마이그레이션되었는지 확인
-- 2. 백업 테이블 생성 (CREATE TABLE student_scores_backup AS SELECT * FROM student_scores;)
-- 3. 코드베이스에서 student_scores 테이블 참조가 없는지 확인

-- ============================================
-- 1. 백업 테이블 생성 (안전장치)
-- ============================================

-- 백업 테이블이 없으면 생성
CREATE TABLE IF NOT EXISTS student_scores_backup AS 
SELECT * FROM student_scores WHERE false; -- 스키마만 복사

-- 기존 데이터 백업 (데이터가 있는 경우)
INSERT INTO student_scores_backup 
SELECT * FROM student_scores 
ON CONFLICT DO NOTHING;

-- ============================================
-- 2. 외래 키 제약 조건 확인 및 제거
-- ============================================

-- 외래 키 제약 조건이 있는지 확인하고 제거
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT constraint_name
        FROM information_schema.table_constraints
        WHERE table_name = 'student_scores'
        AND constraint_type = 'FOREIGN KEY'
    ) LOOP
        EXECUTE 'ALTER TABLE student_scores DROP CONSTRAINT IF EXISTS ' || quote_ident(r.constraint_name);
    END LOOP;
END $$;

-- ============================================
-- 3. 테이블 제거
-- ============================================

-- 테이블 제거 (CASCADE로 모든 의존성 제거)
DROP TABLE IF EXISTS student_scores CASCADE;

-- ============================================
-- 4. 코멘트 추가
-- ============================================

COMMENT ON TABLE student_scores_backup IS 
    '레거시 student_scores 테이블 백업 (2025-02-04). 
     모든 데이터는 student_internal_scores 또는 student_mock_scores로 마이그레이션되었습니다.
     안전 확인 후 삭제 가능.';
```

---

## ✅ 체크리스트

### 정리 전
- [ ] 테이블 존재 여부 확인
- [ ] 데이터 존재 여부 확인
- [ ] 데이터 백업 생성
- [ ] 마이그레이션 데이터 검증
- [ ] 외래 키 참조 확인
- [ ] 코드베이스 참조 확인 (완료)

### 정리 중
- [ ] 백업 테이블 생성
- [ ] 외래 키 제약 조건 제거
- [ ] 테이블 제거
- [ ] 마이그레이션 파일 생성

### 정리 후
- [ ] 애플리케이션 테스트
- [ ] 데이터 무결성 확인
- [ ] 백업 테이블 보관 기간 결정

---

## 🔗 관련 문서

- [Phase 4 마이그레이션 완료](./2025-02-04-phase4-migration-complete.md)
- [Phase 4 마이그레이션 계획](./2025-02-04-phase4-student-scores-migration-plan.md)

---

**작성자**: AI Assistant  
**마지막 업데이트**: 2025-02-04


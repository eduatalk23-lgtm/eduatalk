# 레거시 student_scores 테이블 정리 요약

**작성일**: 2025-02-04  
**작업 상태**: 준비 완료

---

## 📋 작업 개요

레거시 `student_scores` 테이블을 안전하게 정리하기 위한 준비 작업을 완료했습니다.

---

## ✅ 준비된 파일

### 1. 마이그레이션 파일
**파일**: `supabase/migrations/20250204000000_remove_legacy_student_scores_table.sql`

- 테이블 존재 여부 확인
- 백업 테이블 자동 생성 (`student_scores_backup`)
- 외래 키 제약 조건 자동 제거
- 안전한 테이블 제거

### 2. 확인 스크립트
**파일**: `scripts/check-legacy-student-scores-table.ts`

- 테이블 존재 여부 확인
- 데이터 개수 확인
- 새 구조 데이터 확인
- 권장 사항 제공

**실행 방법**:
```bash
npm run check-legacy-scores-table
```

**주의**: 환경 변수(`.env.local`)가 설정되어 있어야 합니다.

### 3. 정리 계획 문서
**파일**: `docs/2025-02-04-legacy-table-cleanup-plan.md`

- 상세한 작업 계획
- 안전한 정리 전략
- 체크리스트

---

## 🎯 다음 단계

### Step 1: 테이블 상태 확인

#### 방법 1: 스크립트 사용 (권장)
```bash
# 환경 변수 설정 확인 후
npm run check-legacy-scores-table
```

#### 방법 2: Supabase 대시보드에서 직접 확인
1. Supabase 대시보드 접속
2. Table Editor에서 `student_scores` 테이블 확인
3. 데이터 개수 확인

#### 방법 3: SQL 직접 실행
```sql
-- 테이블 존재 여부 확인
SELECT EXISTS (
  SELECT FROM information_schema.tables 
  WHERE table_schema = 'public' 
  AND table_name = 'student_scores'
);

-- 데이터 개수 확인
SELECT COUNT(*) FROM student_scores;
```

### Step 2: 데이터 확인

테이블에 데이터가 있는 경우:
1. **데이터 마이그레이션 확인**
   - 모든 데이터가 `student_internal_scores` 또는 `student_mock_scores`로 마이그레이션되었는지 확인
   - 데이터 불일치가 없는지 검증

2. **백업 생성** (마이그레이션 파일이 자동으로 수행)

### Step 3: 마이그레이션 실행

#### 로컬 개발 환경
```bash
# Supabase CLI 사용
supabase migration up

# 또는 Supabase 대시보드에서 직접 실행
```

#### 프로덕션 환경
1. 마이그레이션 파일 검토
2. 백업 확인
3. Supabase 대시보드에서 마이그레이션 실행
4. 애플리케이션 테스트

---

## ⚠️ 주의사항

### 1. 데이터 손실 방지
- 반드시 백업 후 진행
- 마이그레이션 데이터 검증 필수
- 프로덕션 환경에서는 특히 신중하게 진행

### 2. 의존성 확인
- 다른 테이블에서 참조하는지 확인
- 뷰, 함수, 트리거에서 사용하는지 확인
- 마이그레이션 파일이 자동으로 처리하지만, 수동 확인 권장

### 3. 롤백 계획
- 백업 테이블(`student_scores_backup`) 보관
- 문제 발생 시 백업에서 복구 가능

---

## 📊 현재 상태

### 코드베이스
- ✅ 모든 코드가 새 구조 사용
- ✅ 레거시 함수들은 deprecated 표시
- ✅ 마이그레이션 완료

### 데이터베이스
- ⏳ 테이블 상태 확인 필요
- ⏳ 데이터 마이그레이션 확인 필요
- ⏳ 마이그레이션 실행 대기

---

## 🔗 관련 문서

- [레거시 테이블 정리 계획](./2025-02-04-legacy-table-cleanup-plan.md)
- [Phase 4 마이그레이션 완료](./2025-02-04-phase4-migration-complete.md)
- [Phase 4 마이그레이션 계획](./2025-02-04-phase4-student-scores-migration-plan.md)

---

## 💡 권장 작업 순서

1. **테이블 상태 확인** (스크립트 또는 Supabase 대시보드)
2. **데이터 확인** (데이터가 있는 경우 마이그레이션 검증)
3. **백업 확인** (마이그레이션 실행 시 자동 생성)
4. **마이그레이션 실행** (로컬 환경에서 먼저 테스트)
5. **애플리케이션 테스트** (모든 기능 정상 작동 확인)
6. **프로덕션 적용** (검증 완료 후)

---

**작성자**: AI Assistant  
**마지막 업데이트**: 2025-02-04


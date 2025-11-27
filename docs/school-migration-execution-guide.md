# 학교 테이블 마이그레이션 실행 가이드

## ⚠️ 중요

**마이그레이션을 실행하기 전에 반드시 백업을 수행하세요!**

---

## 마이그레이션 실행 방법

### 방법 1: Supabase CLI 사용 (권장)

```bash
# 1. Supabase CLI 로그인
supabase login

# 2. 프로젝트 연결
supabase link --project-ref <your-project-ref>

# 3. 마이그레이션 실행
supabase db push
```

### 방법 2: Supabase Studio에서 직접 실행 (CLI 연결 불가 시 권장)

1. **Supabase Dashboard 접속**
   - https://supabase.com/dashboard 접속
   - 프로젝트 선택

2. **SQL Editor 열기**
   - 좌측 메뉴에서 "SQL Editor" 클릭
   - "New query" 클릭

3. **마이그레이션 SQL 복사 및 실행**
   - 파일 열기: `supabase/migrations/20251128000000_remove_schools_add_unified_view.sql`
   - 전체 내용 복사 (Ctrl+A → Ctrl+C)
   - SQL Editor에 붙여넣기 (Ctrl+V)
   - "Run" 버튼 클릭 또는 `Ctrl+Enter`

4. **실행 결과 확인**
   - 성공 메시지 확인
   - 에러 발생 시 에러 메시지 확인

---

## 마이그레이션 전 체크리스트

- [ ] 데이터베이스 백업 완료
- [ ] `school_info`, `universities`, `university_campuses` 테이블에 데이터 존재 확인
- [ ] `students.school_id`에 데이터가 있는지 확인
  - 확인 스크립트 실행: `pnpm tsx scripts/check-students-school-columns.ts`
  - 현재 상태: students 테이블 비어있음 (0명)
- [ ] 프로덕션 환경이면 **유지보수 시간대**에 실행

### 현재 상태 확인

```bash
# students 테이블의 학교 관련 컬럼 상태 확인
pnpm tsx scripts/check-students-school-columns.ts
```

**확인 결과 (2025-11-28)**:
- ✅ `school_info`, `universities`, `university_campuses` 테이블 존재
- ⚠️ `students` 테이블 비어있음 (학생 데이터 없음)
- ❌ `students.school_type` 컬럼 없음 (마이그레이션 필요)
- ⚠️ `schools` 테이블 아직 존재 (마이그레이션 필요)

---

## 마이그레이션 실행 순서

### 1단계: FK 제약조건 제거
- `students_school_id_fkey` 제거

### 2단계: school_id 타입 변경
- `uuid` → `text` (통합 ID 형식 지원)

### 3단계: school_type 컬럼 추가
- `students.school_type` 컬럼 추가
- CHECK 제약조건: `MIDDLE`, `HIGH`, `UNIVERSITY`

### 4단계: 기존 schools 테이블 제거
- `schools` 테이블 삭제
- 관련 인덱스 삭제

### 5단계: 통합 VIEW 생성 (선택사항)
- `all_schools_view` 생성 (현재 코드에서는 사용하지 않음)

### 6단계: 인덱스 생성
- 새 테이블들에 검색용 인덱스 추가

### 7단계: RLS 정책 설정
- 읽기 전용 정책 적용

---

## 마이그레이션 후 확인 사항

### 1. 테이블 확인

```sql
-- students 테이블 구조 확인
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'students'
ORDER BY ordinal_position;

-- school_type 컬럼 확인
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'students' AND column_name = 'school_type';
```

### 2. 데이터 확인

```sql
-- students.school_id 타입 확인
SELECT 
  school_id,
  school_type,
  pg_typeof(school_id) as school_id_type
FROM students
LIMIT 5;

-- schools 테이블 제거 확인
SELECT EXISTS (
  SELECT 1 FROM information_schema.tables 
  WHERE table_name = 'schools'
) as schools_table_exists;
```

### 3. 새 테이블 데이터 확인

```sql
-- school_info 레코드 수
SELECT COUNT(*) FROM school_info;

-- universities 레코드 수
SELECT COUNT(*) FROM universities;

-- university_campuses 레코드 수
SELECT COUNT(*) FROM university_campuses;
```

---

## 롤백 방법

마이그레이션 실행 후 문제가 발생하면:

### 1. schools 테이블 복구 (필요시)

```sql
-- schools 테이블 재생성 (기존 마이그레이션 파일 참고)
-- 주의: 기존 데이터는 복구 불가 (백업에서만 복구 가능)
```

### 2. students.school_id 타입 복구

```sql
-- text → uuid로 변경 (기존 데이터가 있으면 복잡)
-- 주의: 통합 ID 형식(SCHOOL_xxx, UNIV_xxx)은 uuid로 변환 불가
```

---

## 문제 해결

### 에러: "column students.school_type does not exist"

**원인**: 마이그레이션이 아직 실행되지 않음

**해결**:
1. 마이그레이션 SQL 실행
2. 또는 코드의 fallback 처리로 임시 동작 (school_type 없이)

### 에러: "Could not find the table 'public.all_schools_view'"

**원인**: VIEW가 생성되지 않았거나 Supabase 클라이언트가 인식하지 못함

**해결**: 
- 현재 코드는 VIEW를 사용하지 않고 각 테이블을 직접 조회하므로 문제 없음
- VIEW는 선택사항이므로 생성하지 않아도 됨

### 에러: "foreign key constraint violation"

**원인**: `students.school_id`가 기존 `schools` 테이블을 참조하고 있음

**해결**: 마이그레이션 SQL의 1단계(FK 제거)가 실행되었는지 확인

---

## 참고

- 마이그레이션 파일: `supabase/migrations/20251128000000_remove_schools_add_unified_view.sql`
- 상세 문서: `docs/school-table-migration-to-new-structure.md`

---

**작성일**: 2025-11-28


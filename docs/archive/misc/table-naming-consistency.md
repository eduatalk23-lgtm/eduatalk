# 테이블명/필드명 통일 가이드

**작성 일자**: 2025-02-10  
**목적**: ERD 문서와 실제 코드/데이터베이스 간의 테이블명/필드명 불일치 해결

---

## 발견된 불일치 사항

### 1. 테이블명: parent_student_links vs student_parent_links

**ERD 문서** (`timetable/erd-cloud/`):
- 테이블명: `student_parent_links`

**실제 코드** (`app/(parent)/_utils.ts`):
- 테이블명: `parent_student_links`

**결정**: 실제 코드에서 사용하는 `parent_student_links`를 기준으로 통일

**이유**:
- 실제 코드에서 이미 `parent_student_links`를 사용 중
- 데이터베이스 마이그레이션 파일 확인 필요 (실제 DB 스키마 확인)

---

### 2. 필드명: relation vs relationship

**ERD 문서** (`timetable/erd-cloud/01_core_tables.sql`):
- 필드명: `relationship`

**실제 코드** (`app/(parent)/_utils.ts`):
- 필드명: `relation`

**결정**: 실제 코드에서 사용하는 `relation`을 기준으로 통일

**이유**:
- 실제 코드에서 이미 `relation`을 사용 중
- 더 짧고 간결한 이름

---

## 조치 사항

### 1. ERD 문서 업데이트

**파일**: `timetable/erd-cloud/01_core_tables.sql`

**변경 내용**:
```sql
-- 변경 전
CREATE TABLE student_parent_links (
  ...
  relationship text CHECK (relationship IN ('father', 'mother', 'guardian', 'other')),
  ...
);

-- 변경 후
CREATE TABLE parent_student_links (
  ...
  relation text CHECK (relation IN ('father', 'mother', 'guardian', 'other')),
  ...
);
```

### 2. 실제 데이터베이스 확인

**확인 필요 사항**:
1. 실제 데이터베이스에서 사용 중인 테이블명 확인
2. 실제 데이터베이스에서 사용 중인 필드명 확인
3. 마이그레이션 파일에서 테이블명/필드명 확인

**확인 방법**:
```sql
-- 테이블명 확인
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name LIKE '%parent%student%link%';

-- 필드명 확인
SELECT column_name 
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'parent_student_links'  -- 또는 'student_parent_links'
  AND column_name IN ('relation', 'relationship');
```

### 3. 마이그레이션 파일 확인

**확인 필요**:
- 초기 스키마 마이그레이션에서 테이블명/필드명 확인
- 테이블명/필드명 변경 마이그레이션 존재 여부 확인

---

## 권장 사항

### 테이블명 통일 규칙

**규칙**: 실제 코드에서 사용하는 이름을 기준으로 통일

**이유**:
- 코드 변경보다 문서 변경이 더 안전
- 실제 사용 중인 이름이 정확한 기준

### 필드명 통일 규칙

**규칙**: 실제 코드에서 사용하는 이름을 기준으로 통일

**이유**:
- 코드 변경보다 문서 변경이 더 안전
- `relation`이 더 짧고 간결함

---

## 다음 단계

1. [ ] 실제 데이터베이스 스키마 확인
2. [ ] 마이그레이션 파일에서 테이블명/필드명 확인
3. [ ] ERD 문서 업데이트 (실제 DB와 일치하도록)
4. [ ] 문서 일관성 확인

---

**마지막 업데이트**: 2025-02-10










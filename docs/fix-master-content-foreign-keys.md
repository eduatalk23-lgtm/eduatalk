# 마스터 콘텐츠 외래 키 제약조건 수정 가이드

## 🔍 문제 분석

### 발생한 오류

```
insert or update on table "books" violates foreign key constraint "books_master_content_id_fkey"
Key is not present in table "content_masters".
```

### 원인

1. **외래 키 제약조건 불일치**
   - `books.master_content_id`가 `content_masters` 테이블을 참조하고 있음
   - `lectures.master_content_id`도 `content_masters` 테이블을 참조하고 있음
   - 하지만 실제 데이터는 `master_books`와 `master_lectures` 테이블에 있음

2. **마이그레이션 누락**
   - `20250116000000_separate_content_masters.sql`에서 테이블을 분리했지만
   - 외래 키 제약조건이 업데이트되지 않았음

## ✅ 해결 방법

### 1. 마이그레이션 파일 실행

```bash
npx supabase db push
```

또는 Supabase 대시보드에서 `20250124000000_fix_master_content_foreign_keys.sql` 파일 실행

### 2. 수정 내용

- `books.master_content_id` → `master_books.id` 참조로 변경
- `lectures.master_content_id` → `master_lectures.id` 참조로 변경

## 📋 영향받는 기능

### 교재 가져오기
- ✅ `copyMasterBookToStudent` 함수 정상 작동
- ✅ `books` 테이블에 `master_books.id` 참조 가능

### 강의 가져오기
- ✅ `copyMasterLectureToStudent` 함수 정상 작동
- ✅ `lectures` 테이블에 `master_lectures.id` 참조 가능

## 🔧 마이그레이션 상세 내용

### 변경 전
```sql
-- books 테이블
FOREIGN KEY (master_content_id) REFERENCES content_masters(id)

-- lectures 테이블
FOREIGN KEY (master_content_id) REFERENCES content_masters(id)
```

### 변경 후
```sql
-- books 테이블
FOREIGN KEY (master_content_id) REFERENCES master_books(id)

-- lectures 테이블
FOREIGN KEY (master_content_id) REFERENCES master_lectures(id)
```

## ⚠️ 주의사항

1. **기존 데이터 확인**
   - 마이그레이션 실행 전에 `books`와 `lectures` 테이블의 `master_content_id` 값이
   - `master_books` 또는 `master_lectures` 테이블에 존재하는지 확인 필요

2. **NULL 값 처리**
   - `ON DELETE SET NULL`로 설정되어 있어 삭제 시 NULL로 설정됨
   - 기존 데이터의 무결성은 유지됨

## 🧪 테스트 방법

1. 마이그레이션 실행 후
2. 서비스 마스터 교재 페이지에서 교재 가져오기 테스트
3. 서비스 마스터 강의 페이지에서 강의 가져오기 테스트

## 📝 관련 파일

- `supabase/migrations/20250124000000_fix_master_content_foreign_keys.sql`
- `lib/data/contentMasters.ts` - `copyMasterBookToStudent`, `copyMasterLectureToStudent`
- `app/(student)/actions/contentMasterActions.ts` - `copyMasterToStudentContentAction`


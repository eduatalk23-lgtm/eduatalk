# 서비스 마스터 콘텐츠 데이터 무결성 가이드

## ✅ 확인 결과

**가져온 교재나 강의를 수정해도 서비스 마스터 데이터에는 영향을 미치지 않습니다.**

## 📋 데이터 구조

### 1. 테이블 분리

- **서비스 마스터 데이터**: `master_books`, `master_lectures` 테이블
  - 모든 사용자가 공유하는 공개 데이터
  - 관리자만 수정 가능

- **학생 개인 데이터**: `books`, `lectures` 테이블
  - 각 학생의 개인 콘텐츠
  - 학생이 자유롭게 수정 가능

### 2. 데이터 복사 방식

```typescript
// copyMasterBookToStudent 함수
// master_books의 데이터를 읽어서
// books 테이블에 새로운 레코드로 INSERT
// → 완전히 독립적인 복사본 생성
```

### 3. 외래 키 관계

```sql
-- books 테이블
master_content_id uuid REFERENCES master_books(id) ON DELETE SET NULL

-- lectures 테이블  
master_content_id uuid REFERENCES master_lectures(id) ON DELETE SET NULL
```

**중요**: `master_content_id`는 단순히 **참조만** 하는 필드입니다.
- 마스터 데이터를 수정하지 않음
- 마스터 데이터 삭제 시 NULL로만 변경됨 (`ON DELETE SET NULL`)

## 🔒 데이터 무결성 보장

### 학생 콘텐츠 수정 시

```typescript
// updateBook 함수
supabase
  .from("books")  // ← books 테이블만 UPDATE
  .update(payload)
  .eq("id", bookId)
  .eq("student_id", studentId);

// master_books 테이블은 전혀 건드리지 않음
```

### 확인 사항

1. ✅ `updateBook` → `books` 테이블만 UPDATE
2. ✅ `updateLecture` → `lectures` 테이블만 UPDATE
3. ✅ `master_books`, `master_lectures` 테이블을 UPDATE하는 코드 없음
4. ✅ 외래 키는 참조만 하고, 역방향 업데이트 없음

## 📊 데이터 흐름

```
[서비스 마스터]
master_books (읽기 전용)
    ↓ 복사 (INSERT)
[학생 개인 데이터]
books (독립적인 복사본)
    ↓ 수정 (UPDATE)
books (변경됨, 마스터는 영향 없음)
```

## 🎯 결론

- ✅ 학생이 가져온 교재/강의를 수정해도 마스터 데이터는 변경되지 않음
- ✅ 각 학생의 데이터는 완전히 독립적
- ✅ 마스터 데이터는 안전하게 보호됨

## 🔍 추가 확인 방법

데이터베이스에서 직접 확인:

```sql
-- 학생 교재 수정 테스트
UPDATE books 
SET title = '수정된 제목' 
WHERE id = '학생_교재_ID';

-- 마스터 교재 확인 (변경되지 않았는지)
SELECT title FROM master_books WHERE id = '마스터_교재_ID';
-- → 원래 제목 그대로 유지됨
```


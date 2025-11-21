# Contents 등록 폼과 DB 스키마 비교 분석

## 📋 최종 요약

### ✅ 완료된 작업
1. **DB 스키마 수정**: `lectures` 테이블에 `platform`, `difficulty_level` 컬럼 추가 마이그레이션 생성
2. **타입 정의 업데이트**: `Lecture` 타입에 `platform`, `difficulty_level` 필드 추가
3. **데이터 레이어 수정**: 조회/생성/수정 함수에 새 필드 반영
4. **Server Actions 수정**: 등록/수정 액션에 새 필드 전달 추가

### 📊 현재 상태
- **학생 교재**: 등록 폼과 DB 스키마 일치 ✅
- **학생 강의**: 등록 폼과 DB 스키마 일치 (수정 완료) ✅
- **서비스 마스터 교재**: 완전한 필드 구성 ✅
- **서비스 마스터 강의**: 완전한 필드 구성 ✅

### 📄 상세보기 페이지
모든 콘텐츠 타입에 상세보기 페이지가 존재하며 정상 작동합니다:
- 학생 교재 상세: `/contents/books/[id]` ✅
- 학생 강의 상세: `/contents/lectures/[id]` ✅
- 서비스 마스터 교재 상세: `/contents/master-books/[id]` ✅
- 서비스 마스터 강의 상세: `/contents/master-lectures/[id]` ✅

---

## 📊 현재 상태 분석

### 1. 학생 교재 등록 폼 vs DB 스키마

#### 현재 등록 폼 (`/contents/books/new`)
```
- title (필수)
- publisher
- difficulty
- total_pages
- subject
```

#### DB 스키마 (`books` 테이블)
```sql
- id (자동)
- tenant_id (자동)
- student_id (자동)
- title (필수) ✅
- publisher ✅
- difficulty_level ✅ (폼에서는 "difficulty")
- total_pages ✅
- subject ✅
- created_at (자동)
- updated_at (자동)
- master_content_id (참조용, 선택사항)
```

**✅ 상태**: 대체로 일치하지만 필드명 불일치 (`difficulty` vs `difficulty_level`)

---

### 2. 학생 강의 등록 폼 vs DB 스키마

#### 현재 등록 폼 (`/contents/lectures/new`)
```
- title (필수)
- platform
- difficulty
- duration
- subject
```

#### DB 스키마 (`lectures` 테이블)
```sql
- id (자동)
- tenant_id (자동)
- student_id (자동)
- title (필수) ✅
- subject ✅
- duration ✅
- created_at (자동)
- updated_at (자동)
- master_content_id (참조용, 선택사항)
- platform ❌ (DB에 없음!)
- difficulty_level ❌ (DB에 없음!)
```

**⚠️ 문제점**: 
- `platform` 필드가 DB에 없는데 폼에서 사용 중
- `difficulty_level` 필드가 DB에 없는데 폼에서 사용 중
- 상세 페이지에서도 `platform`, `difficulty_level`을 조회하려고 시도

---

### 3. 서비스 마스터 교재/강의 등록 폼

#### 서비스 마스터 교재 (`/contents/master-books/new`)
```
✅ 완전한 필드:
- title (필수)
- revision (개정교육과정)
- semester (학년/학기)
- subject_category (교과)
- subject (과목)
- publisher
- total_pages (필수)
- difficulty_level
- notes (메모)
```

#### 서비스 마스터 강의 (`/contents/master-lectures/new`)
```
✅ 완전한 필드:
- title (필수)
- revision (개정교육과정)
- semester (학년/학기)
- subject_category (교과)
- subject (과목)
- platform
- total_episodes (필수)
- total_duration
- difficulty_level
- linked_book_id (연결된 교재)
- notes (메모)
```

---

## 🔍 발견된 문제점

### 1. 학생 강의 테이블에 필드 누락

**현재 상황:**
- 등록 폼에서 `platform`, `difficulty` 입력
- 상세 페이지에서 `platform`, `difficulty_level` 표시 시도
- 하지만 DB 스키마에 해당 필드 없음

**해결 방안:**
1. `lectures` 테이블에 `platform`, `difficulty_level` 컬럼 추가
2. 또는 등록 폼에서 해당 필드 제거

### 2. 학생 교재/강의 등록 폼이 단순함

**서비스 마스터와 비교:**
- 서비스 마스터: 개정교육과정, 학년/학기, 교과 등 상세 정보
- 학생 콘텐츠: 기본 정보만 (제목, 출판사/플랫폼, 과목, 난이도, 페이지/시간)

**고려사항:**
- 학생이 직접 등록할 때는 기본 정보만으로도 충분할 수 있음
- 서비스 마스터에서 복사한 경우 상세 정보는 마스터에서 가져옴
- 하지만 필요시 학생도 상세 정보를 입력할 수 있도록 확장 가능

---

## 📋 상세보기 페이지 현황

### ✅ 이미 존재하는 상세보기 페이지

1. **학생 교재 상세**: `/contents/books/[id]` ✅
2. **학생 강의 상세**: `/contents/lectures/[id]` ✅
3. **서비스 마스터 교재 상세**: `/contents/master-books/[id]` ✅
4. **서비스 마스터 강의 상세**: `/contents/master-lectures/[id]` ✅

### 📝 상세보기 페이지 개선 필요사항

#### 학생 교재/강의 상세 페이지
- 현재는 기본 정보만 표시
- 서비스 마스터처럼 더 많은 정보 표시 가능
- `master_content_id`가 있으면 원본 마스터 정보 링크 표시

#### 서비스 마스터 상세 페이지
- 교재: 상세 정보(대단원/중단원/페이지) 표시 ✅
- 강의: 연결된 교재 표시 ✅
- 추가 개선 가능: 더 많은 정보 표시

---

## 🎯 권장 개선사항

### 1. 즉시 수정 필요 (Critical)

#### `lectures` 테이블에 필드 추가
```sql
ALTER TABLE lectures 
ADD COLUMN IF NOT EXISTS platform TEXT;

ALTER TABLE lectures 
ADD COLUMN IF NOT EXISTS difficulty_level TEXT;
```

### 2. 등록 폼 개선 (Optional)

#### 학생 교재/강의 등록 폼 확장
- 서비스 마스터처럼 개정교육과정, 학년/학기, 교과 등 추가
- 또는 현재 구조 유지 (기본 정보만)

### 3. 상세보기 페이지 개선 (Optional)

#### 학생 교재/강의 상세 페이지
- 마스터 콘텐츠에서 복사한 경우 원본 링크 표시
- 더 많은 정보 표시

---

## ✅ 체크리스트

### DB 스키마
- [x] `lectures.platform` 컬럼 추가 (마이그레이션 생성 완료)
- [x] `lectures.difficulty_level` 컬럼 추가 (마이그레이션 생성 완료)
- [x] 인덱스 추가 (마이그레이션에 포함)

### 타입 정의
- [x] `lib/data/studentContents.ts`의 `Lecture` 타입에 `platform`, `difficulty_level` 추가
- [x] `app/types/content.ts`의 `Lecture` 타입 - 이미 존재함

### 데이터 레이어
- [x] `getLectures` 함수에 `platform`, `difficulty_level` 조회 추가
- [x] `createLecture` 함수에 `platform`, `difficulty_level` 저장 추가
- [x] `updateLecture` 함수에 `platform`, `difficulty_level` 업데이트 추가

### Server Actions
- [x] `addLecture`에 `platform`, `difficulty_level` 전달 추가
- [x] `updateLecture`에 `platform`, `difficulty_level` 전달 추가

### 등록 폼
- [x] 학생 교재 등록 폼 - DB와 일치 ✅
- [x] 학생 강의 등록 폼 - DB 필드 추가 완료 ✅
- [x] 서비스 마스터 교재 등록 폼 - 완전함 ✅
- [x] 서비스 마스터 강의 등록 폼 - 완전함 ✅

### 상세보기 페이지
- [x] 학생 교재 상세 - 존재함 ✅
- [x] 학생 강의 상세 - 존재함 (DB 필드 추가 완료) ✅
- [x] 서비스 마스터 교재 상세 - 존재함 ✅
- [x] 서비스 마스터 강의 상세 - 존재함 ✅

### 수정 폼
- [x] 학생 교재 수정 폼 - 존재함 ✅
- [x] 학생 강의 수정 폼 - 존재함 ✅
- [x] 서비스 마스터 교재 수정 폼 - 존재함 ✅
- [x] 서비스 마스터 강의 수정 폼 - 존재함 ✅


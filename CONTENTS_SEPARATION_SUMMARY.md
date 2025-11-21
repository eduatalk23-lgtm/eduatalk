# Contents 테이블 분리 작업 완료 요약

## ✅ 완료된 작업

### 1. 데이터베이스 마이그레이션 스크립트
- **파일**: `supabase/migrations/20250116000000_separate_content_masters.sql`
- **내용**:
  - `master_books` 테이블 생성 (교재 전용)
  - `master_lectures` 테이블 생성 (강의 전용)
  - `book_details` 테이블 생성 (교재 상세 정보)
  - 기존 `content_masters` 데이터 마이그레이션
  - 기존 `content_master_details` → `book_details` 마이그레이션
  - RLS 정책 설정
  - 인덱스 생성

### 2. 타입 정의 업데이트
- **파일**: `lib/types/plan.ts`
- **추가된 타입**:
  - `CommonContentFields`: 공통 필드
  - `MasterBook`: 서비스 마스터 교재
  - `MasterLecture`: 서비스 마스터 강의
  - `BookDetail`: 교재 상세 정보
- **레거시 타입 유지**: 하위 호환성을 위해 `ContentMaster`, `ContentMasterDetail` 유지

### 3. 데이터 액세스 레이어 업데이트
- **파일**: `lib/data/contentMasters.ts`
- **새로운 함수**:
  - `searchMasterBooks()`: 교재 검색
  - `searchMasterLectures()`: 강의 검색
  - `getMasterBookById()`: 교재 상세 조회
  - `getMasterLectureById()`: 강의 상세 조회
  - `createMasterBook()`: 교재 생성
  - `updateMasterBook()`: 교재 수정
  - `deleteMasterBook()`: 교재 삭제
  - `createMasterLecture()`: 강의 생성
  - `updateMasterLecture()`: 강의 수정
  - `deleteMasterLecture()`: 강의 삭제
  - `createBookDetail()`: 교재 상세 정보 추가
  - `updateBookDetail()`: 교재 상세 정보 수정
  - `deleteBookDetail()`: 교재 상세 정보 삭제
  - `deleteAllBookDetails()`: 교재 상세 정보 일괄 삭제
- **하위 호환성 함수 유지**: 기존 함수들은 내부적으로 새 함수 호출

## 📋 다음 단계

### 1. 마이그레이션 실행
```bash
# Supabase 마이그레이션 실행
supabase db push
# 또는
supabase migration up
```

### 2. 데이터 검증
- 마이그레이션 후 데이터 무결성 확인
- `content_masters` → `master_books`, `master_lectures` 데이터 확인
- `content_master_details` → `book_details` 데이터 확인

### 3. 기존 코드 업데이트 (점진적)
- 기존 `content_masters` 사용 코드를 새 함수로 점진적 교체
- 레거시 함수는 하위 호환성 유지

### 4. UI 컴포넌트 개발
- 서비스 마스터 교재/강의 관리 UI
- 검색 필터 컴포넌트
- CRUD 폼 컴포넌트

## 🔄 마이그레이션 전략

### 안전한 마이그레이션 순서

1. **새 테이블 생성** ✅
   - `master_books`, `master_lectures`, `book_details` 생성

2. **데이터 마이그레이션** ✅
   - 기존 `content_masters` 데이터를 새 테이블로 복사
   - ID 유지 (참조 무결성 보장)

3. **참조 업데이트** (필요시)
   - `books.master_content_id`는 이미 올바른 ID 참조
   - `lectures.master_content_id`도 동일

4. **기존 테이블 보관** (선택사항)
   - `content_masters` 테이블은 일정 기간 보관 후 제거
   - 또는 레거시 지원용으로 유지

## ⚠️ 주의사항

### 1. RLS 정책
- 현재 RLS 정책은 기본 설정만 포함
- 관리자 권한 체크 로직은 실제 권한 시스템에 맞게 수정 필요

### 2. 트리거 함수
- `update_books_updated_at()`, `update_lectures_updated_at()` 함수 재사용
- 이미 존재하는 함수이므로 추가 생성 불필요

### 3. 하위 호환성
- 기존 코드는 레거시 함수를 통해 계속 작동
- 점진적으로 새 함수로 교체 가능

## 📊 테이블 구조 비교

### 이전 (통합)
```
content_masters
├── content_type: 'book' | 'lecture'
├── total_pages: NULL (강의인 경우)
├── total_episodes: NULL (교재인 경우)
└── publisher_or_academy: 출판사/플랫폼 혼용
```

### 이후 (분리)
```
master_books
├── total_pages: 필수
├── publisher: 출판사
└── AI 분석 필드 준비됨

master_lectures
├── total_episodes: 필수
├── total_duration: 총 강의시간
├── platform: 플랫폼
├── linked_book_id: 연결된 교재
└── AI 분석 필드 준비됨
```

## 🎯 장점

1. **타입 안전성**: 각 테이블의 목적이 명확
2. **NULL 값 최소화**: 불필요한 NULL 값 제거
3. **AI 분석 데이터 확장 용이**: 교재/강의별 전용 필드
4. **제약조건 설정 간단**: 각 테이블별 명확한 제약조건
5. **인덱스 최적화**: 테이블별 최적화된 인덱스

## 📝 체크리스트

- [x] 마이그레이션 스크립트 작성
- [x] 타입 정의 업데이트
- [x] 데이터 액세스 레이어 업데이트
- [x] CRUD 함수 추가
- [ ] 마이그레이션 실행 및 검증
- [ ] 기존 코드 점진적 업데이트
- [ ] UI 컴포넌트 개발
- [ ] 테스트 작성


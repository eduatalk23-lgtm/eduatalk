# Contents 데이터베이스 설계 분석: 통합 vs 분리 관리

## 🤔 핵심 질문

1. **서비스 마스터**: `content_masters` 테이블이 교재/강의를 통합 관리하는 것이 적절한가?
2. **학생 콘텐츠**: `books`, `lectures`를 분리 관리하는 것이 맞는가? 통합해야 하는가?
3. **AI 분석 데이터 확장**: 향후 난이도, PDF URL 등 AI 분석 데이터 추가 시 어떤 구조가 유리한가?

---

## 📊 현재 구조 분석

### 서비스 마스터: 통합 관리 (`content_masters`)

```typescript
// content_masters 테이블
{
  content_type: "book" | "lecture",  // 구분자
  total_pages: number | null,         // 교재만 사용
  total_episodes: number | null,       // 강의만 사용
  publisher_or_academy: string | null, // 둘 다 사용하지만 의미 다름
  // ... 공통 필드들
}
```

**특징:**
- `content_type`으로 구분
- 교재 전용 필드: `total_pages`
- 강의 전용 필드: `total_episodes`
- 많은 NULL 값 발생 가능

### 학생 콘텐츠: 분리 관리

```typescript
// books 테이블
{
  total_pages: number,
  publisher: string,
  // ...
}

// lectures 테이블
{
  duration: number,  // 분 단위
  platform: string,
  // ...
}
```

**특징:**
- 명확한 타입 분리
- NULL 값 최소화
- 각 테이블의 목적이 명확

---

## 🔍 통합 vs 분리 관리 비교

### 1. 통합 관리의 장점 ✅

#### 공통 필드 관리 용이
```sql
-- 한 번의 쿼리로 교재/강의 모두 검색
SELECT * FROM content_masters 
WHERE subject_category = '국어' 
  AND semester = '고3-1';
```

#### 코드 중복 감소
```typescript
// 하나의 함수로 처리 가능
function searchContent(filters: ContentFilters) {
  return supabase
    .from('content_masters')
    .select('*')
    .eq('content_type', filters.type);
}
```

#### 통합 검색/필터링 간편
- 교재와 강의를 동시에 검색 가능
- 공통 필터 로직 재사용

### 2. 통합 관리의 단점 ❌

#### 타입 안전성 저하
```typescript
// TypeScript에서 타입 가드 필요
if (content.content_type === 'book') {
  // total_pages 사용 가능
  const pages = content.total_pages; // number | null
} else {
  // total_episodes 사용 가능
  const episodes = content.total_episodes; // number | null
}
```

#### NULL 값 증가
```sql
-- 교재 레코드: total_episodes는 항상 NULL
-- 강의 레코드: total_pages는 항상 NULL
-- 데이터베이스 공간 낭비
```

#### 스키마 확장 시 복잡도 증가
```sql
-- AI 분석 데이터 추가 시
ALTER TABLE content_masters ADD COLUMN pdf_url TEXT;  -- 교재만 사용
ALTER TABLE content_masters ADD COLUMN video_url TEXT; -- 강의만 사용
ALTER TABLE content_masters ADD COLUMN transcript TEXT; -- 강의만 사용
-- → 많은 NULL 값, 의미 불명확
```

#### 제약조건 설정 어려움
```sql
-- 교재는 total_pages 필수, 강의는 total_episodes 필수
-- 통합 테이블에서는 CHECK 제약조건이 복잡해짐
CHECK (
  (content_type = 'book' AND total_pages IS NOT NULL) OR
  (content_type = 'lecture' AND total_episodes IS NOT NULL)
)
```

### 3. 분리 관리의 장점 ✅

#### 명확한 타입 안전성
```typescript
// 각 타입이 명확
type Book = {
  total_pages: number;  // 항상 존재
  publisher: string;
  // ...
}

type Lecture = {
  duration: number;     // 항상 존재
  platform: string;
  // ...
}
```

#### 스키마 확장 용이
```sql
-- 교재 전용 필드 추가
ALTER TABLE master_books ADD COLUMN pdf_url TEXT;
ALTER TABLE master_books ADD COLUMN ocr_data JSONB;
ALTER TABLE master_books ADD COLUMN page_analysis JSONB;

-- 강의 전용 필드 추가
ALTER TABLE master_lectures ADD COLUMN video_url TEXT;
ALTER TABLE master_lectures ADD COLUMN transcript TEXT;
ALTER TABLE master_lectures ADD COLUMN episode_analysis JSONB;
```

#### 제약조건 설정 간단
```sql
-- 각 테이블에서 명확한 제약조건
ALTER TABLE master_books 
  ADD CONSTRAINT check_total_pages 
  CHECK (total_pages > 0);

ALTER TABLE master_lectures 
  ADD CONSTRAINT check_total_episodes 
  CHECK (total_episodes > 0);
```

#### 인덱스 최적화
```sql
-- 교재 전용 인덱스
CREATE INDEX idx_books_pages ON master_books(total_pages);

-- 강의 전용 인덱스
CREATE INDEX idx_lectures_episodes ON master_lectures(total_episodes);
```

### 4. 분리 관리의 단점 ❌

#### 코드 중복 가능성
```typescript
// 비슷한 로직 반복
function searchBooks(filters) { /* ... */ }
function searchLectures(filters) { /* ... */ }
```

#### 통합 검색 복잡
```sql
-- UNION 또는 별도 쿼리 필요
SELECT * FROM master_books WHERE ...
UNION ALL
SELECT * FROM master_lectures WHERE ...;
```

---

## 🤖 AI 분석 데이터 확장 시나리오

### 교재 AI 분석 데이터 (예상)

```typescript
type BookAIAnalysis = {
  pdf_url: string;                    // PDF 파일 URL
  ocr_data: JSONB;                     // OCR 결과
  page_analysis: {                    // 페이지별 분석
    page_number: number;
    difficulty_score: number;
    topic_tags: string[];
    key_concepts: string[];
  }[];
  overall_difficulty: number;         // 전체 난이도 점수
  estimated_study_time: number;        // 예상 학습 시간 (분)
  chapter_summary: JSONB;             // 단원별 요약
  question_bank: JSONB;               // 추출된 문제
}
```

### 강의 AI 분석 데이터 (예상)

```typescript
type LectureAIAnalysis = {
  video_url: string;                   // 비디오 URL
  transcript: string;                  // 자막/전사본
  episode_analysis: {                  // 회차별 분석
    episode_number: number;
    duration: number;
    difficulty_score: number;
    topic_tags: string[];
    key_points: string[];
  }[];
  overall_difficulty: number;          // 전체 난이도 점수
  estimated_study_time: number;        // 예상 학습 시간 (분)
  summary: string;                     // 강의 요약
  quiz_questions: JSONB;               // 추출된 퀴즈
}
```

### 통합 관리 시 문제점 ⚠️

```sql
-- content_masters 테이블에 추가하면
ALTER TABLE content_masters ADD COLUMN pdf_url TEXT;        -- 교재만
ALTER TABLE content_masters ADD COLUMN video_url TEXT;      -- 강의만
ALTER TABLE content_masters ADD COLUMN ocr_data JSONB;        -- 교재만
ALTER TABLE content_masters ADD COLUMN transcript TEXT;     -- 강의만
ALTER TABLE content_masters ADD COLUMN page_analysis JSONB;  -- 교재만
ALTER TABLE content_masters ADD COLUMN episode_analysis JSONB; -- 강의만

-- 결과: 많은 NULL 값, 의미 불명확, 타입 안전성 저하
```

### 분리 관리 시 장점 ✅

```sql
-- master_books 테이블
ALTER TABLE master_books ADD COLUMN pdf_url TEXT;
ALTER TABLE master_books ADD COLUMN ocr_data JSONB;
ALTER TABLE master_books ADD COLUMN page_analysis JSONB;
ALTER TABLE master_books ADD COLUMN overall_difficulty DECIMAL;
-- → 모든 필드가 의미 있음, NULL 없음

-- master_lectures 테이블
ALTER TABLE master_lectures ADD COLUMN video_url TEXT;
ALTER TABLE master_lectures ADD COLUMN transcript TEXT;
ALTER TABLE master_lectures ADD COLUMN episode_analysis JSONB;
ALTER TABLE master_lectures ADD COLUMN overall_difficulty DECIMAL;
-- → 모든 필드가 의미 있음, NULL 없음
```

---

## 💡 권장 설계 방안

### 옵션 1: 하이브리드 접근 (권장) ⭐

**서비스 마스터: 분리 관리**
- `master_books` 테이블
- `master_lectures` 테이블
- 공통 필드는 Base 테이블 또는 공통 함수로 관리

**학생 콘텐츠: 분리 관리 유지**
- `books` 테이블 (현재 구조 유지)
- `lectures` 테이블 (현재 구조 유지)

**이유:**
1. ✅ AI 분석 데이터 확장 시 명확한 구조
2. ✅ 타입 안전성 보장
3. ✅ NULL 값 최소화
4. ✅ 제약조건 설정 용이
5. ✅ 인덱스 최적화 가능

### 옵션 2: 현재 구조 유지 (비권장)

**서비스 마스터: 통합 관리 유지**
- `content_masters` 테이블 (현재 구조)

**문제점:**
1. ❌ AI 분석 데이터 추가 시 복잡도 급증
2. ❌ 많은 NULL 값 발생
3. ❌ 타입 안전성 저하
4. ❌ 제약조건 복잡

---

## 🏗️ 하이브리드 설계 상세안

### 1. 서비스 마스터 테이블 분리

```sql
-- 공통 메타데이터 테이블 (선택사항)
CREATE TABLE content_metadata (
  id UUID PRIMARY KEY,
  revision VARCHAR(20),
  semester VARCHAR(20),
  subject_category VARCHAR(50),
  subject VARCHAR(50),
  -- 공통 필드만
);

-- 교재 마스터 테이블
CREATE TABLE master_books (
  id UUID PRIMARY KEY,
  -- content_metadata 참조 또는 직접 필드
  revision VARCHAR(20),
  semester VARCHAR(20),
  subject_category VARCHAR(50),
  subject VARCHAR(50),
  title VARCHAR(255) NOT NULL,
  publisher VARCHAR(255),
  total_pages INTEGER NOT NULL,  -- 필수
  difficulty_level VARCHAR(20),
  notes TEXT,
  -- AI 분석 필드
  pdf_url TEXT,
  ocr_data JSONB,
  page_analysis JSONB,
  overall_difficulty DECIMAL(3,2),
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);

-- 강의 마스터 테이블
CREATE TABLE master_lectures (
  id UUID PRIMARY KEY,
  -- content_metadata 참조 또는 직접 필드
  revision VARCHAR(20),
  semester VARCHAR(20),
  subject_category VARCHAR(50),
  subject VARCHAR(50),
  title VARCHAR(255) NOT NULL,
  platform VARCHAR(255),
  total_episodes INTEGER NOT NULL,  -- 필수
  total_duration INTEGER,  -- 분 단위
  difficulty_level VARCHAR(20),
  notes TEXT,
  linked_book_id UUID REFERENCES master_books(id),
  -- AI 분석 필드
  video_url TEXT,
  transcript TEXT,
  episode_analysis JSONB,
  overall_difficulty DECIMAL(3,2),
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);
```

### 2. 공통 로직 처리

```typescript
// 공통 검색 함수 (제네릭)
async function searchContent<T extends 'book' | 'lecture'>(
  type: T,
  filters: ContentFilters
): Promise<T extends 'book' ? MasterBook[] : MasterLecture[]> {
  const table = type === 'book' ? 'master_books' : 'master_lectures';
  return supabase.from(table).select('*').match(filters);
}

// 통합 검색 (필요시)
async function searchAllContent(filters: ContentFilters) {
  const [books, lectures] = await Promise.all([
    searchContent('book', filters),
    searchContent('lecture', filters)
  ]);
  return { books, lectures };
}
```

### 3. 학생 콘텐츠는 현재 구조 유지

```sql
-- books 테이블 (현재 구조 유지)
-- master_content_id로 master_books 참조

-- lectures 테이블 (현재 구조 유지)
-- master_content_id로 master_lectures 참조
```

---

## 📋 마이그레이션 전략

### Phase 1: 데이터 분석
1. 현재 `content_masters` 데이터 분석
2. 교재/강의 비율 확인
3. 공통 필드 vs 전용 필드 분류

### Phase 2: 새 테이블 생성
1. `master_books` 테이블 생성
2. `master_lectures` 테이블 생성
3. 기존 `content_masters` 데이터 마이그레이션

### Phase 3: 데이터 마이그레이션
```sql
-- content_masters → master_books
INSERT INTO master_books (id, title, publisher, total_pages, ...)
SELECT id, title, publisher_or_academy, total_pages, ...
FROM content_masters
WHERE content_type = 'book';

-- content_masters → master_lectures
INSERT INTO master_lectures (id, title, platform, total_episodes, ...)
SELECT id, title, publisher_or_academy, total_episodes, ...
FROM content_masters
WHERE content_type = 'lecture';
```

### Phase 4: 참조 업데이트
```sql
-- books.master_content_id 업데이트 (필요시)
-- lectures.master_content_id 업데이트 (필요시)
```

### Phase 5: 기존 테이블 제거 (선택사항)
- `content_masters` 테이블 제거 또는 보관
- `content_master_details`는 `book_details`로 이름 변경

---

## ✅ 최종 권장사항

### 서비스 마스터: **분리 관리** ⭐

**이유:**
1. AI 분석 데이터 확장 시 명확한 구조
2. 타입 안전성 보장
3. NULL 값 최소화
4. 제약조건 설정 용이
5. 인덱스 최적화 가능

### 학생 콘텐츠: **분리 관리 유지** ⭐

**이유:**
1. 현재 구조가 이미 적절함
2. 서비스 마스터와 일관성 유지
3. 각 테이블의 목적이 명확

### 공통 로직: **함수/유틸리티로 추상화**

```typescript
// 공통 필드 처리
type CommonContentFields = {
  revision: string | null;
  semester: string | null;
  subject_category: string | null;
  subject: string | null;
  title: string;
  difficulty_level: string | null;
};

// 타입별 확장
type MasterBook = CommonContentFields & {
  content_type: 'book';
  publisher: string;
  total_pages: number;
  // ...
};

type MasterLecture = CommonContentFields & {
  content_type: 'lecture';
  platform: string;
  total_episodes: number;
  // ...
};
```

---

## 🎯 결론

**현재 `content_masters` 통합 구조는 단기적으로는 편리하지만, AI 분석 데이터 확장을 고려하면 분리 관리가 더 적절합니다.**

**권장 방안:**
- ✅ 서비스 마스터: `master_books`, `master_lectures` 분리
- ✅ 학생 콘텐츠: `books`, `lectures` 분리 유지
- ✅ 공통 로직: 함수/유틸리티로 추상화

이렇게 하면 **확장성**, **타입 안전성**, **성능** 모두를 확보할 수 있습니다.


# AI 콘텐츠 추천 기능 분석 및 개선 계획

> 작성일: 2026-01-17
> 위치: `lib/domains/plan/llm/`

## 1. 개요

### 1.1 현재 상황

AI 콘텐츠 추천 기능이 구현되어 있으나, 다음과 같은 한계가 있습니다:

| 항목 | 현재 상태 | 문제점 |
|------|----------|--------|
| 콜드 스타트 | ❌ 미지원 | 학생 데이터(성적, 학습패턴) 없으면 추천 불가 |
| 마스터 데이터 | ⚠️ 미정규화 | subject_id, difficulty_level_id 대부분 null |
| 웹 검색 저장 | ⚠️ 기본 정보만 | 목차/페이지 정보 없어 플랜 생성 불가 |
| UI 연결 | ❌ 미사용 | AdminContentRecommendationPanel 렌더링 안 됨 |

### 1.2 목표 방향

```
목표: 콜드 스타트에서 동작하며, 웹 검색 결과를 축적하여 점진적으로 데이터 정규화

1. 사용자가 교과/과목/난이도/타입을 직접 선택
2. 웹 검색으로 콘텐츠 추천
3. 추천 결과를 DB에 저장 (구조 정보 포함)
4. 점점 정규화된 데이터 확보
5. 학습 플랜 생성에 활용
```

---

## 2. 현재 구현 분석

### 2.1 파일 구조

```
lib/domains/plan/llm/
├── actions/
│   ├── recommendContent.ts          # 기본 AI 추천 (학생 데이터 기반)
│   ├── enhancedRecommendContent.ts  # 향상된 추천 (시너지, 난이도 진행)
│   └── searchContent.ts             # 외부 콘텐츠 구조 검색 (Gemini Grounding)
├── prompts/
│   ├── contentRecommendation.ts     # 추천 프롬프트
│   └── enhancedContentRecommendation.ts
├── services/
│   └── webSearchContentService.ts   # 웹 검색 결과 저장 서비스
└── providers/
    └── gemini.ts                    # Gemini Grounding 지원

app/(admin)/admin/students/[id]/plans/_components/
└── AdminContentRecommendationPanel.tsx  # UI 컴포넌트 (미사용)
```

### 2.2 두 가지 웹 검색 방식

#### A. recommendContentWithAI (추천용)

```typescript
// lib/domains/plan/llm/actions/recommendContent.ts

interface RecommendContentInput {
  studentId: string;                 // ❌ 필수 - 콜드 스타트 불가
  subjectCategories?: string[];
  maxRecommendations?: number;
  focusArea?: "weak_subjects" | "all_subjects" | "exam_prep";
  enableWebSearch?: boolean;         // Gemini Grounding
  webSearchConfig?: {
    mode?: "dynamic" | "always";
    saveResults?: boolean;           // DB 저장 옵션
  };
}
```

**저장되는 정보** (webSearchContentService 사용):
```typescript
// master_books에 저장
{
  title: content.title,
  source: "web_search",
  source_url: content.url,
  subject: context.subject,
  subject_category: context.subjectCategory,
  notes: content.snippet,
  description: `웹 검색 결과 - 검색어: ${searchQuery}`,
  // ❌ total_pages: null
  // ❌ toc: null
  // ❌ page_analysis: null
}
```

#### B. searchExternalContentAction (구조 검색용)

```typescript
// lib/domains/plan/llm/actions/searchContent.ts

interface VirtualContentItem {
  title: string;
  author?: string;
  publisher?: string;
  contentType: "book" | "lecture";
  totalRange: number;               // ✅ 총 페이지/강의 수
  chapters: {                       // ✅ 목차 정보
    title: string;
    startRange: number;
    endRange: number;
  }[];
  description?: string;
}
```

**문제점**: 이 결과가 **DB에 저장되지 않음**

### 2.3 데이터 흐름 비교

```
┌─────────────────────────────────────────────────────────────────┐
│                 현재: recommendContentWithAI                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  학생 데이터 로드 (필수)                                        │
│  ├── loadStudentProfile()      → 학생 정보                     │
│  ├── loadScoreInfo()           → 성적 (50개)                   │
│  ├── loadLearningPattern()     → 학습 패턴                     │
│  ├── loadOwnedContents()       → 보유 콘텐츠                   │
│  └── loadCandidateContents()   → 마스터 콘텐츠 (50개)          │
│                    ↓                                            │
│  LLM 요청 빌드 + 호출                                          │
│                    ↓                                            │
│  (선택) 웹 검색 결과 저장 → 기본 정보만                        │
│                                                                 │
│  ❌ 학생 데이터 없으면 추천 근거 없음                          │
│  ❌ 저장된 정보로 플랜 생성 불가                               │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                 현재: searchExternalContentAction               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  검색어 입력                                                    │
│                    ↓                                            │
│  Gemini Grounding (웹 검색)                                    │
│                    ↓                                            │
│  구조 정보 파싱 (목차, 페이지수)                               │
│                    ↓                                            │
│  VirtualContentItem 반환                                       │
│                                                                 │
│  ✅ 플랜 생성에 필요한 정보 있음                               │
│  ❌ DB에 저장되지 않음                                         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. DB 스키마 분석

### 3.1 master_books 테이블

| 필드 | 타입 | 용도 | 현재 상태 |
|------|------|------|----------|
| `id` | uuid | PK | ✅ |
| `title` | text | 제목 | ✅ 채워짐 |
| `total_pages` | integer | **플랜 생성 필수** | ⚠️ 대부분 null |
| `toc` | text | 목차 (텍스트) | ❌ null |
| `page_analysis` | jsonb | **챕터별 페이지 범위** | ❌ null |
| `estimated_hours` | numeric | 예상 학습 시간 | ❌ null |
| `difficulty_level` | varchar | 난이도 (텍스트) | ⚠️ 일부만 |
| `difficulty_level_id` | uuid | 난이도 (정규화) | ❌ 대부분 null |
| `subject_category` | text | 교과 (텍스트) | ✅ 채워짐 |
| `subject` | text | 과목 (텍스트) | ⚠️ 일부만 |
| `subject_group_id` | uuid | 교과 (정규화) | ⚠️ 일부만 |
| `subject_id` | uuid | 과목 (정규화) | ❌ 대부분 null |
| `source` | text | 데이터 출처 | 'web_search' |
| `source_url` | text | 원본 URL | ✅ 채워짐 |
| `author` | text | 저자 | ⚠️ 일부만 |
| `publisher_name` | text | 출판사 | ⚠️ 일부만 |

### 3.2 master_lectures 테이블

| 필드 | 타입 | 용도 | 현재 상태 |
|------|------|------|----------|
| `id` | uuid | PK | ✅ |
| `title` | varchar | 제목 | ✅ 채워짐 |
| `total_episodes` | integer | **플랜 생성 필수** | ✅ 채워짐 (필수 필드) |
| `total_duration` | integer | 총 시간 (초) | ✅ 일부 채워짐 |
| `episode_analysis` | jsonb | **강의별 정보** | ❌ null |
| `estimated_hours` | numeric | 예상 학습 시간 | ✅ 일부 채워짐 |
| `difficulty_level` | varchar | 난이도 | ❌ 대부분 null |
| `subject_category` | varchar | 교과 | ✅ 채워짐 |
| `subject` | varchar | 과목 | ⚠️ 일부만 |
| `platform` | varchar | 플랫폼 | ✅ 일부 채워짐 |
| `instructor_name` | varchar | 강사명 | ❌ 대부분 null |
| `lecture_source_url` | text | 원본 URL | ✅ 채워짐 |

### 3.3 저장된 데이터 현황

#### 웹 검색 저장 콘텐츠

```sql
-- master_books (source = 'web_search')
총 1건
- total_pages: null
- toc: null
- page_analysis: null

-- master_lectures (lecture_source_url IS NOT NULL)
총 129건
- 국어: 34건, 수학: 28건, 영어: 27건, 사회: 17건, 과학: 16건
- total_episodes: 채워짐 (16, 17, 20, 21 등)
- total_duration: 채워짐 (초 단위)
- episode_analysis: null
```

### 3.4 정규화 마스터 테이블

#### subject_groups (교과)

```
국어, 수학, 영어, 한국사, 사회(역사/도덕 포함), 과학
```

#### subjects (과목)

| 교과 | 과목 |
|------|------|
| 국어 | 국어, 화법과 작문, 독서, 언어와 매체, 문학, 실용 국어, 심화 국어, 고전 읽기 |
| 수학 | 수학, 수학I, 수학II, 미적분, 확률과 통계, 기본 수학, 기하, 경제 수학 등 |
| 영어 | 영어, 영어 회화, 영어I, 영어II, 영어 독해와 작문, 영미 문학 읽기 등 |

#### difficulty_levels (난이도)

| content_type | 난이도 |
|--------------|--------|
| book | 개념, 기본, 심화, 하 |
| lecture | 개념, 기본, 심화 |

---

## 4. 플랜 생성 요구사항 분석

### 4.1 플랜 생성에 필요한 정보

```
┌─────────────────────────────────────────────────────────────────┐
│                    플랜 생성 필수 정보                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  교재 (Book) 플랜:                                              │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ [필수] total_pages        → 전체 일정 계산              │   │
│  │ [권장] toc/page_analysis  → 챕터별 범위 지정            │   │
│  │ [권장] estimated_hours    → 일일 학습량 계산            │   │
│  │ [선택] difficulty_level   → 난이도 매칭                 │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  강의 (Lecture) 플랜:                                           │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ [필수] total_episodes     → 전체 일정 계산              │   │
│  │ [권장] episode_analysis   → 강의별 시간/범위            │   │
│  │ [권장] total_duration     → 일일 학습량 계산            │   │
│  │ [선택] difficulty_level   → 난이도 매칭                 │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 4.2 현재 플랜 생성 가능 여부

| 콘텐츠 유형 | 현재 상태 | 플랜 생성 |
|------------|----------|----------|
| 웹 검색 교재 | total_pages=null, toc=null | ❌ 불가능 |
| 웹 검색 강의 | total_episodes=있음, episode_analysis=null | ⚠️ 기본만 가능 |
| 기존 마스터 교재 | 일부 total_pages 있음 | ⚠️ 일부 가능 |
| 기존 마스터 강의 | total_episodes 있음 | ✅ 가능 |

---

## 5. 개선 설계

### 5.1 목표 플로우

```
┌─────────────────────────────────────────────────────────────────┐
│              콜드 스타트 웹 검색 추천 + 플랜 생성 플로우         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Phase 1: 사용자 선택 (콜드 스타트)                             │
│  ┌────────┐ → ┌────────┐ → ┌────────┐ → ┌────────┐            │
│  │ 교과   │   │ 과목   │   │ 난이도 │   │ 타입   │            │
│  │ (수학) │   │(미적분)│   │ (개념) │   │(교재)  │            │
│  └────────┘   └────────┘   └────────┘   └────────┘            │
│                         ↓                                       │
│  Phase 2: 하이브리드 데이터 조회                                │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ 2-1. 저장된 웹 검색 콘텐츠 먼저 조회                    │   │
│  │      - 조건: subject_category, subject, difficulty      │   │
│  │      - 우선: total_pages/total_episodes NOT NULL        │   │
│  │                                                         │   │
│  │ 2-2. 부족하면 Gemini 웹 검색 실행                      │   │
│  │      - searchExternalContentAction 사용                 │   │
│  │      - 구조 정보 (totalRange, chapters) 포함           │   │
│  └─────────────────────────────────────────────────────────┘   │
│                         ↓                                       │
│  Phase 3: AI 추천 정리                                         │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ - 검색 결과 병합 및 중복 제거                          │   │
│  │ - 난이도/적합성 분석 (AI)                              │   │
│  │ - 우선순위 정렬                                        │   │
│  └─────────────────────────────────────────────────────────┘   │
│                         ↓                                       │
│  Phase 4: 결과 저장 (데이터 축적)                              │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ master_books/lectures에 저장:                          │   │
│  │ - title, source='web_search', source_url               │   │
│  │ - total_pages / total_episodes (구조 검색에서)         │   │
│  │ - toc / episode_analysis (chapters 변환)               │   │
│  │ - subject_category, subject (사용자 선택)              │   │
│  │ - difficulty_level (사용자 선택 또는 AI 추론)          │   │
│  └─────────────────────────────────────────────────────────┘   │
│                         ↓                                       │
│  Phase 5: 플랜 생성 (선택적)                                   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ - 저장된 구조 정보로 일정 계산                         │   │
│  │ - 챕터별 범위 자동 배분                                │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 5.2 데이터 축적 사이클

```
┌───────────────────────────────────────────────────────────────┐
│                     데이터 축적 선순환                        │
├───────────────────────────────────────────────────────────────┤
│                                                               │
│   처음 검색 (수학 > 미적분 > 개념 > 교재)                     │
│   └── 저장된 콘텐츠: 0건                                      │
│   └── Gemini 웹 검색 실행 → 10건 결과                        │
│   └── 구조 정보 포함하여 DB 저장                             │
│                                                               │
│                         ↓                                     │
│                                                               │
│   두 번째 검색 (같은 조건)                                    │
│   └── 저장된 콘텐츠: 10건 (이전 검색 결과)                   │
│   └── 웹 검색 생략 또는 추가 검색만                          │
│   └── 응답 속도 향상                                         │
│                                                               │
│                         ↓                                     │
│                                                               │
│   N번째 검색                                                  │
│   └── 저장된 콘텐츠: 충분                                    │
│   └── 웹 검색 불필요                                         │
│   └── 정규화된 데이터로 빠른 추천                            │
│                                                               │
└───────────────────────────────────────────────────────────────┘
```

### 5.3 새로운 타입 정의

```typescript
// 콜드 스타트 추천 입력
interface ColdStartRecommendInput {
  // 사용자 선택 (필수)
  subjectCategory: string;           // 교과 (국어, 수학, 영어...)
  subject?: string;                  // 과목 (미적분, 문학...)
  difficulty?: string;               // 난이도 (개념, 기본, 심화)
  contentType?: "book" | "lecture" | "all";

  // 선택적 컨텍스트
  grade?: number;                    // 학년 (1, 2, 3)
  additionalKeywords?: string;       // 추가 검색어

  // 설정
  tenantId: string;
  maxRecommendations?: number;       // 기본: 5
  alwaysWebSearch?: boolean;         // 항상 웹 검색 (기본: false)
  saveResults?: boolean;             // 결과 저장 (기본: true)
}

// 콜드 스타트 추천 결과
interface ColdStartRecommendResult {
  success: boolean;
  recommendations: Array<{
    id: string;                      // 저장된 콘텐츠 ID
    title: string;
    contentType: "book" | "lecture";
    subjectCategory: string;
    subject?: string;
    difficulty?: string;

    // 플랜 생성용 정보
    totalRange: number;              // total_pages 또는 total_episodes
    chapters?: Array<{
      title: string;
      startRange: number;
      endRange: number;
    }>;
    estimatedHours?: number;

    // 메타 정보
    source: "existing" | "web_search";
    sourceUrl?: string;
    matchScore?: number;             // AI 추천 점수
  }>;

  // 통계
  stats: {
    existingCount: number;           // 기존 저장 데이터 사용 수
    webSearchCount: number;          // 새 웹 검색 결과 수
    savedCount: number;              // 새로 저장된 수
  };

  error?: string;
}
```

### 5.4 저장 데이터 구조

```typescript
// 웹 검색 결과 저장 시 채워야 할 필드

// master_books
{
  // 기본 정보
  title: string;
  source: "web_search";
  source_url: string;

  // 분류 (사용자 선택 기반)
  subject_category: string;          // 교과
  subject: string | null;            // 과목
  difficulty_level: string | null;   // 난이도

  // 플랜 생성용 정보 (구조 검색에서)
  total_pages: number;               // ✅ 필수
  toc: string;                       // JSON 문자열 (chapters)
  page_analysis: jsonb;              // chapters 배열
  estimated_hours: number | null;    // AI 추정 가능

  // 추가 정보 (있으면)
  author: string | null;
  publisher_name: string | null;
  description: string | null;
}

// master_lectures
{
  // 기본 정보
  title: string;
  lecture_source_url: string;

  // 분류
  subject_category: string;
  subject: string | null;
  difficulty_level: string | null;

  // 플랜 생성용 정보
  total_episodes: number;            // ✅ 필수
  episode_analysis: jsonb;           // chapters 배열
  total_duration: number | null;     // 초 단위
  estimated_hours: number | null;

  // 추가 정보
  platform: string | null;
  instructor_name: string | null;
}
```

---

## 6. 구현 계획

### 6.1 우선순위

| 순위 | 작업 | 설명 | 의존성 |
|------|------|------|--------|
| **1** | findExistingWebContent 개선 | 다중 조건 필터 지원 | 없음 |
| **2** | searchExternalContentAction 저장 연동 | 구조 정보 DB 저장 | 없음 |
| **3** | recommendContentColdStart 신규 | 콜드 스타트 전용 Action | 1, 2 |
| **4** | 저장 시 자동 정규화 | 사용자 선택 기반 태깅 | 3 |
| **5** | 단계별 선택 UI | 교과→과목→난이도→타입 | 3, 4 |
| **6** | 플랜 생성 연동 | 구조 정보 활용 | 2, 3 |

### 6.2 Phase 1: 기반 개선

#### 6.2.1 findExistingWebContent 확장

```typescript
// 현재
async findExistingWebContent(
  tenantId: string,
  options?: { subject?: string; limit?: number }
)

// 개선
async findExistingWebContent(
  tenantId: string,
  options?: {
    subjectCategory?: string;
    subject?: string;
    difficulty?: string;
    contentType?: "book" | "lecture" | "all";
    hasStructure?: boolean;          // total_pages/episodes NOT NULL
    limit?: number;
  }
)
```

#### 6.2.2 searchExternalContentAction 저장 연동

```typescript
// 저장 옵션 추가
async function searchExternalContentAction(
  query: string,
  subject?: string,
  options?: {
    saveToDb?: boolean;
    tenantId?: string;
    subjectCategory?: string;
    difficulty?: string;
  }
): Promise<SearchContentResult> {

  const result = await searchWithGemini(query, subject);

  if (options?.saveToDb && result.data && options.tenantId) {
    await saveSearchResults(result.data, {
      tenantId: options.tenantId,
      subjectCategory: options.subjectCategory,
      subject: subject,
      difficulty: options.difficulty,
    });
  }

  return result;
}

async function saveSearchResults(
  items: VirtualContentItem[],
  context: SaveContext
) {
  for (const item of items) {
    if (item.contentType === "book") {
      await supabase.from("master_books").insert({
        title: item.title,
        author: item.author,
        publisher_name: item.publisher,
        total_pages: item.totalRange,
        toc: JSON.stringify(item.chapters),
        page_analysis: item.chapters,
        source: "web_search",
        subject_category: context.subjectCategory,
        subject: context.subject,
        difficulty_level: context.difficulty,
        tenant_id: context.tenantId,
        is_active: true,
      });
    } else {
      await supabase.from("master_lectures").insert({
        title: item.title,
        total_episodes: item.totalRange,
        episode_analysis: item.chapters,
        lecture_source_url: `search://${item.title}`,
        subject_category: context.subjectCategory,
        subject: context.subject,
        difficulty_level: context.difficulty,
        tenant_id: context.tenantId,
        is_active: true,
      });
    }
  }
}
```

### 6.3 Phase 2: 콜드 스타트 Action

```typescript
// lib/domains/plan/llm/actions/recommendContentColdStart.ts

export async function recommendContentColdStart(
  input: ColdStartRecommendInput
): Promise<ColdStartRecommendResult> {

  // 1. 저장된 콘텐츠 조회 (구조 정보 있는 것 우선)
  const existingContents = await findExistingWebContent(input.tenantId, {
    subjectCategory: input.subjectCategory,
    subject: input.subject,
    difficulty: input.difficulty,
    contentType: input.contentType,
    hasStructure: true,
    limit: 20,
  });

  let webSearchResults: VirtualContentItem[] = [];

  // 2. 부족하면 웹 검색
  if (existingContents.length < 5 || input.alwaysWebSearch) {
    const searchQuery = buildSearchQuery(input);
    const searchResult = await searchExternalContentAction(
      searchQuery,
      input.subject,
      {
        saveToDb: input.saveResults !== false,
        tenantId: input.tenantId,
        subjectCategory: input.subjectCategory,
        difficulty: input.difficulty,
      }
    );

    if (searchResult.success && searchResult.data) {
      webSearchResults = searchResult.data;
    }
  }

  // 3. 결과 병합 및 추천 정리
  const allContents = mergeContents(existingContents, webSearchResults);
  const recommendations = await rankRecommendations(allContents, input);

  return {
    success: true,
    recommendations: recommendations.slice(0, input.maxRecommendations || 5),
    stats: {
      existingCount: existingContents.length,
      webSearchCount: webSearchResults.length,
      savedCount: webSearchResults.length,
    },
  };
}

function buildSearchQuery(input: ColdStartRecommendInput): string {
  const parts = [];

  if (input.grade) {
    parts.push(`고${input.grade}`);
  }

  parts.push(input.subjectCategory);

  if (input.subject) {
    parts.push(input.subject);
  }

  if (input.difficulty) {
    parts.push(input.difficulty);
  }

  if (input.contentType === "book") {
    parts.push("교재 추천");
  } else if (input.contentType === "lecture") {
    parts.push("인강 추천");
  } else {
    parts.push("학습자료");
  }

  if (input.additionalKeywords) {
    parts.push(input.additionalKeywords);
  }

  return parts.join(" ");
}
```

### 6.4 Phase 3: UI 컴포넌트

```typescript
// 단계별 선택 컴포넌트 구조

interface ContentRecommendationWizardProps {
  tenantId: string;
  onSelect: (contents: RecommendedContent[]) => void;
}

function ContentRecommendationWizard({ tenantId, onSelect }: Props) {
  const [step, setStep] = useState(1);
  const [selections, setSelections] = useState({
    subjectCategory: null,
    subject: null,
    difficulty: null,
    contentType: null,
  });

  return (
    <div>
      {step === 1 && (
        <SubjectCategorySelector
          onSelect={(cat) => {
            setSelections({ ...selections, subjectCategory: cat });
            setStep(2);
          }}
        />
      )}

      {step === 2 && (
        <SubjectSelector
          subjectCategory={selections.subjectCategory}
          onSelect={(sub) => {
            setSelections({ ...selections, subject: sub });
            setStep(3);
          }}
          onSkip={() => setStep(3)}
        />
      )}

      {step === 3 && (
        <DifficultySelector
          onSelect={(diff) => {
            setSelections({ ...selections, difficulty: diff });
            setStep(4);
          }}
          onSkip={() => setStep(4)}
        />
      )}

      {step === 4 && (
        <ContentTypeSelector
          onSelect={(type) => {
            setSelections({ ...selections, contentType: type });
            setStep(5);
          }}
        />
      )}

      {step === 5 && (
        <RecommendationResults
          input={{ ...selections, tenantId }}
          onSelect={onSelect}
        />
      )}
    </div>
  );
}
```

---

## 7. 기존 기능과의 관계

### 7.1 기능 구분

| 기능 | 대상 | 입력 | 출력 |
|------|------|------|------|
| `recommendContentWithAI` | 기존 학생 | 학생 데이터 | 마스터 콘텐츠 추천 |
| `enhancedRecommendContentWithAI` | 기존 학생 | 학생 데이터 + 시험 | 시너지 추천 |
| **`recommendContentColdStart`** (신규) | 신규 학생/콜드 스타트 | 사용자 선택 | 웹 검색 기반 추천 |

### 7.2 점진적 전환

```
1단계: 콜드 스타트 사용자 → recommendContentColdStart
       - 웹 검색 기반
       - 데이터 축적

2단계: 데이터 축적 후 → 기존 recommendContentWithAI 활용 가능
       - 저장된 콘텐츠 풀 확대
       - 정규화 데이터 증가

3단계: 학생 데이터 생성 후 → recommendContentWithAI + enhancedRecommendContentWithAI
       - 성적 기반 추천
       - 시너지 추천
```

---

## 8. 관련 파일 참조

### 8.1 현재 구현 파일

```
lib/domains/plan/llm/
├── actions/
│   ├── recommendContent.ts              # 기존 추천
│   ├── enhancedRecommendContent.ts      # 향상된 추천
│   └── searchContent.ts                 # 구조 검색
├── services/
│   └── webSearchContentService.ts       # 웹 검색 저장
├── prompts/
│   └── contentRecommendation.ts         # 추천 프롬프트
└── providers/
    ├── base.ts                          # Grounding 타입
    └── gemini.ts                        # Gemini Provider
```

### 8.2 UI 컴포넌트 파일

```
app/(admin)/admin/students/[id]/plans/_components/
└── AdminContentRecommendationPanel.tsx  # 기존 UI (미사용 상태)
```

### 8.3 DB 테이블

```
master_books          # 교재 마스터
master_lectures       # 강의 마스터
subject_groups        # 교과 마스터
subjects              # 과목 마스터
difficulty_levels     # 난이도 마스터
```

---

## 9. 사이드 이펙트 분석

> 분석일: 2026-01-17

### 9.1 의존관계 맵

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          함수/클래스 참조 관계                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  recommendContentWithAI                                                     │
│  ├── [Export] lib/domains/plan/llm/index.ts                                │
│  ├── [Import] AdminContentRecommendationPanel.tsx (Line 23)                │
│  └── [Call]   AdminContentRecommendationPanel.tsx (Line 477)               │
│                                                                             │
│  searchExternalContentAction                                                │
│  ├── [Import] WebSearchPanel.tsx (Line 5)                                  │
│  └── [Call]   WebSearchPanel.tsx (Line 30)                                 │
│                                                                             │
│  enhancedRecommendContentWithAI                                             │
│  └── [Export] lib/domains/plan/llm/index.ts (실제 사용처 없음)              │
│                                                                             │
│  WebSearchContentService / getWebSearchContentService                       │
│  ├── [Export] lib/domains/plan/llm/services/index.ts                       │
│  ├── [Use]    recommendContent.ts (Line 21, 523)                           │
│  └── [Use]    generatePlan.ts (Line 36, 245)                               │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 9.2 영향 범위

#### 개선 작업 시 영향 받는 파일

| 파일 | 영향 유형 | 설명 |
|------|----------|------|
| `recommendContent.ts` | 🔧 리팩토링 필요 | 중복 함수 제거, 저장 로직 개선 |
| `enhancedRecommendContent.ts` | 🔧 리팩토링 필요 | 중복 함수 제거 |
| `searchContent.ts` | ✏️ 수정 필요 | DB 저장 옵션 추가 |
| `webSearchContentService.ts` | ✏️ 수정 필요 | 구조 정보 저장 지원 |
| `generateHybridPlanComplete.ts` | ✅ 이미 대응 | total_pages 저장 (Line 189) |
| `AdminContentRecommendationPanel.tsx` | ⚠️ 주의 | recommendContentWithAI 시그니처 변경 시 |
| `WebSearchPanel.tsx` | ⚠️ 주의 | searchExternalContentAction 시그니처 변경 시 |

#### total_pages 사용처 (플랜 생성 의존)

```
lib/domains/plan/
├── llm/transformers/requestBuilder.ts        # 콘텐츠 정보 변환
├── llm/actions/streamPlan.ts                 # 스트림 플랜 생성
├── llm/services/prerequisiteService.ts       # 선수 학습 서비스
├── llm/services/personalizedMatchingService.ts # 개인화 매칭
├── llm/services/contentDifficultyService.ts  # 난이도 서비스
├── actions/content-calendar.ts               # 콘텐츠 캘린더
├── actions/linkContent.ts                    # 콘텐츠 연결
└── actions/plan-groups/queries.ts            # 플랜 그룹 쿼리
```

---

## 10. 집중화/중앙화 점검

### 10.1 중복 로직 발견

#### 완전히 동일한 함수 (리팩토링 완료 ✅)

> ✅ **리팩토링 완료** (2026-01-18)

| 함수명 | 공통 모듈 위치 | 상태 |
|--------|---------------|------|
| `loadStudentProfile` | `loaders/studentLoader.ts` | ✅ 추출 완료 |
| `loadScoreInfo` | `loaders/studentLoader.ts` | ✅ 추출 완료 |
| `loadLearningPattern` | `loaders/patternLoader.ts` | ✅ 추출 완료 |
| `loadOwnedContents` | `loaders/contentLoader.ts` | ✅ 추출 완료 |
| `loadCandidateContents` | `loaders/contentLoader.ts` | ✅ 추출 완료 |

#### 구현된 구조

```
lib/domains/plan/llm/
├── loaders/                        # ✅ 신규: 공통 데이터 로더
│   ├── types.ts                    # SupabaseClient 타입 정의
│   ├── studentLoader.ts            # loadStudentProfile, loadScoreInfo
│   ├── patternLoader.ts            # loadLearningPattern
│   ├── contentLoader.ts            # loadOwnedContents, loadCandidateContents
│   └── index.ts                    # Barrel export
├── actions/
│   ├── recommendContent.ts         # ✅ 공통 로더 import (~275줄 감소)
│   └── enhancedRecommendContent.ts # ✅ 공통 로더 import (~255줄 감소)
```

**효과:**
- 순 코드 감소: ~210줄
- 중복 제거: 5개 함수
- 유지보수성 향상: 로더 수정 시 한 곳만 변경

### 10.2 분산된 웹 검색 저장 로직

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        웹 검색 저장 로직 분산 현황                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  recommendContent.ts (Line 523)                                             │
│  └── getWebSearchContentService().saveToDatabase()                         │
│      └── 저장: title, source_url, subject, snippet                         │
│      └── 누락: total_pages, toc, page_analysis ❌                          │
│                                                                             │
│  searchContent.ts                                                           │
│  └── searchExternalContentAction()                                         │
│      └── 파싱: totalRange, chapters (구조 정보) ✅                         │
│      └── 저장: 없음 ❌                                                     │
│                                                                             │
│  generateHybridPlanComplete.ts (Line 189)                                   │
│  └── 직접 저장 시도: total_pages: item.totalRange ✅                       │
│                                                                             │
│  webSearchContentService.ts                                                 │
│  └── saveToDatabase()                                                      │
│      └── total_pages 필드 없음 ❌                                          │
│      └── page_analysis 필드 없음 ❌                                        │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 10.3 중앙화 필요 영역

| 영역 | 현재 상태 | 권장 중앙화 방안 |
|------|----------|-----------------|
| 학생 데이터 로딩 | 2개 파일에 분산 | `loaders/` 디렉토리로 추출 |
| 웹 검색 저장 | 3개 파일에서 각자 처리 | `webSearchContentService` 확장 |
| 콘텐츠 타입 추론 | webSearchContentService 내부 | 공통 유틸리티로 분리 |
| 구조 정보 파싱 | searchContent.ts에서만 | webSearchContentService에 통합 |

---

## 11. 개선 우선순위 (업데이트)

### Phase 0: 리팩토링 (선행 작업) ✅ 완료 (2026-01-18)

| 순위 | 작업 | 설명 | 영향 파일 | 상태 |
|------|------|------|----------|------|
| **0-1** | 공통 로더 추출 | 중복 함수를 `loaders/`로 분리 | 2개 | ✅ 완료 |
| **0-2** | WebSearchContentService 확장 | 구조 정보 저장 지원 추가 | 1개 | 진행 예정 |

### Phase 1: 기능 개선 (본작업)

| 순위 | 작업 | 설명 | 의존성 |
|------|------|------|--------|
| **1** | findExistingWebContent 개선 | 다중 조건 필터 지원 | 0-2 |
| **2** | searchExternalContentAction 저장 연동 | 구조 정보 DB 저장 | 0-2 |
| **3** | recommendContentColdStart 신규 | 콜드 스타트 전용 Action | 1, 2 |
| **4** | 저장 시 자동 정규화 | 사용자 선택 기반 태깅 | 3 |
| **5** | 단계별 선택 UI | 교과→과목→난이도→타입 | 3, 4 |
| **6** | 플랜 생성 연동 | 구조 정보 활용 | 2, 3 |

---

## 12. 변경 사항 체크리스트

### 안전한 변경 (사이드 이펙트 낮음)

- [x] 공통 로더 추출 후 기존 함수를 wrapper로 유지 ✅ (2026-01-18)
- [ ] WebSearchContentService에 새 메서드 추가 (기존 메서드 유지)
- [ ] searchExternalContentAction에 optional 저장 파라미터 추가

### 주의 필요 변경 (사이드 이펙트 있음)

- [ ] recommendContentWithAI 시그니처 변경 → AdminContentRecommendationPanel 수정 필요
- [ ] searchExternalContentAction 반환값 변경 → WebSearchPanel 수정 필요
- [ ] master_books/master_lectures 테이블에 새 필드 추가 → 마이그레이션 필요

### 테스트 필요 항목

- [ ] 기존 recommendContentWithAI 호출이 정상 동작하는지
- [ ] 웹 검색 결과 저장이 정상적으로 이루어지는지
- [ ] 플랜 생성 시 total_pages/page_analysis 활용이 되는지
- [ ] 중복 저장 방지 로직이 작동하는지

---

## 13. 콜드 스타트 MVP 구현 가이드

> 🎯 **목표**: UI/DB 없이 기능만 먼저 테스트하며 단계별로 개발

### 13.1 전체 흐름 (5단계)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                        콜드 스타트 추천 파이프라인                            │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   [Task 1]           [Task 2]           [Task 3]           [Task 4]          │
│   사용자 입력   →   검색 쿼리 생성  →   웹 검색 실행  →   결과 파싱          │
│   (교과/과목)       (검색어 문자열)     (Gemini API)      (JSON → 객체)      │
│                                                                              │
│                                              ↓                               │
│                                                                              │
│                                         [Task 5]                             │
│                                         결과 정렬                            │
│                                         (추천 리스트)                        │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 13.2 Task 1: 사용자 입력 처리

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Task 1: 사용자 입력 처리                                                   │
│  ──────────────────────                                                     │
│  "사용자가 선택한 교과/과목/난이도/타입을 받아서 검증하는 함수"             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  📥 INPUT (사용자가 넣는 값)                                                │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ {                                                                    │   │
│  │   subjectCategory: "수학",      // 필수: 교과 (국어, 수학, 영어...)  │   │
│  │   subject: "미적분",            // 선택: 과목                        │   │
│  │   difficulty: "개념",           // 선택: 난이도 (개념, 기본, 심화)   │   │
│  │   contentType: "book"           // 선택: 타입 (book, lecture)        │   │
│  │ }                                                                    │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  📤 OUTPUT (함수가 반환하는 값)                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ {                                                                    │   │
│  │   success: true,                                                     │   │
│  │   validatedInput: {              // 검증된 입력값                    │   │
│  │     subjectCategory: "수학",                                         │   │
│  │     subject: "미적분",                                               │   │
│  │     difficulty: "개념",                                              │   │
│  │     contentType: "book"                                              │   │
│  │   }                                                                  │   │
│  │ }                                                                    │   │
│  │ 또는                                                                 │   │
│  │ {                                                                    │   │
│  │   success: false,                                                    │   │
│  │   error: "교과를 선택해주세요"   // 에러 메시지                      │   │
│  │ }                                                                    │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**테스트 방법:**
```typescript
// 파일: lib/domains/plan/llm/actions/coldStart/validateInput.test.ts

// ✅ 성공 케이스
const result1 = validateColdStartInput({
  subjectCategory: "수학",
  subject: "미적분",
});
console.log(result1);
// { success: true, validatedInput: { subjectCategory: "수학", subject: "미적분", ... } }

// ❌ 실패 케이스: 교과 누락
const result2 = validateColdStartInput({});
console.log(result2);
// { success: false, error: "교과를 선택해주세요" }

// ❌ 실패 케이스: 잘못된 교과
const result3 = validateColdStartInput({ subjectCategory: "체육" });
console.log(result3);
// { success: false, error: "지원하지 않는 교과입니다: 체육" }
```

---

### 13.3 Task 2: 검색 쿼리 생성

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Task 2: 검색 쿼리 생성                                                     │
│  ─────────────────────                                                      │
│  "검증된 입력값을 받아서 웹 검색에 사용할 검색어를 만드는 함수"             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  📥 INPUT (Task 1의 결과)                                                   │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ {                                                                    │   │
│  │   subjectCategory: "수학",                                           │   │
│  │   subject: "미적분",                                                 │   │
│  │   difficulty: "개념",                                                │   │
│  │   contentType: "book"                                                │   │
│  │ }                                                                    │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  📤 OUTPUT (검색에 사용할 문자열)                                           │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ {                                                                    │   │
│  │   query: "고등학교 수학 미적분 개념 교재 추천 목차",                  │   │
│  │   context: "미적분 개념서"  // AI에게 전달할 맥락 정보               │   │
│  │ }                                                                    │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  🔄 변환 규칙                                                               │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ contentType = "book"    → "교재 추천 목차"                           │   │
│  │ contentType = "lecture" → "인강 추천 강의 목록"                      │   │
│  │ difficulty = "개념"     → "개념서" 또는 "개념강의"                   │   │
│  │ difficulty = "심화"     → "심화서" 또는 "심화강의"                   │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**테스트 방법:**
```typescript
// 파일: lib/domains/plan/llm/actions/coldStart/buildQuery.test.ts

// 교재 검색
const query1 = buildSearchQuery({
  subjectCategory: "수학",
  subject: "미적분",
  difficulty: "개념",
  contentType: "book"
});
console.log(query1);
// { query: "고등학교 수학 미적분 개념 교재 추천 목차", context: "미적분 개념서" }

// 강의 검색
const query2 = buildSearchQuery({
  subjectCategory: "영어",
  difficulty: "심화",
  contentType: "lecture"
});
console.log(query2);
// { query: "고등학교 영어 심화 인강 추천 강의 목록", context: "영어 심화강의" }
```

---

### 13.4 Task 3: 웹 검색 실행

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Task 3: 웹 검색 실행                                                       │
│  ───────────────────                                                        │
│  "검색어를 받아서 Gemini API로 웹 검색을 수행하는 함수"                     │
│  (이미 searchExternalContentAction으로 구현되어 있음)                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  📥 INPUT (Task 2의 결과)                                                   │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ {                                                                    │   │
│  │   query: "고등학교 수학 미적분 개념 교재 추천 목차",                  │   │
│  │   context: "미적분 개념서"                                           │   │
│  │ }                                                                    │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  📤 OUTPUT (웹 검색 결과 - 아직 파싱 전)                                    │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ {                                                                    │   │
│  │   success: true,                                                     │   │
│  │   rawContent: "... AI가 반환한 JSON 문자열 ..."                      │   │
│  │ }                                                                    │   │
│  │ 또는                                                                 │   │
│  │ {                                                                    │   │
│  │   success: false,                                                    │   │
│  │   error: "API 호출 실패: 429 Rate Limit"                             │   │
│  │ }                                                                    │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ⚠️ 주의사항                                                                │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ - Gemini API는 무료 티어에서 분당 호출 제한이 있음                   │   │
│  │ - 네트워크 오류 시 재시도 로직 필요                                  │   │
│  │ - API 키가 환경변수에 설정되어 있어야 함                             │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**테스트 방법:**
```typescript
// 파일: lib/domains/plan/llm/actions/coldStart/executeSearch.test.ts

// 실제 API 호출 테스트 (환경변수 필요)
const result = await executeWebSearch({
  query: "고등학교 수학 미적분 개념 교재 추천 목차",
  context: "미적분 개념서"
});

if (result.success) {
  console.log("✅ 검색 성공");
  console.log("원본 응답:", result.rawContent.slice(0, 200) + "...");
} else {
  console.log("❌ 검색 실패:", result.error);
}
```

---

### 13.5 Task 4: 결과 파싱

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Task 4: 결과 파싱                                                          │
│  ───────────────                                                            │
│  "AI가 반환한 텍스트를 구조화된 객체로 변환하는 함수"                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  📥 INPUT (Task 3의 결과)                                                   │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ {                                                                    │   │
│  │   rawContent: "```json\n{\"results\": [{...}, {...}]}\n```"          │   │
│  │ }                                                                    │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  📤 OUTPUT (파싱된 콘텐츠 목록)                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ {                                                                    │   │
│  │   success: true,                                                     │   │
│  │   items: [                                                           │   │
│  │     {                                                                │   │
│  │       title: "개념원리 미적분",       // 교재/강의 제목              │   │
│  │       author: "이홍섭",               // 저자/강사                   │   │
│  │       publisher: "개념원리",          // 출판사/플랫폼               │   │
│  │       contentType: "book",            // book 또는 lecture           │   │
│  │       totalRange: 320,                // 총 페이지 또는 강의 수      │   │
│  │       chapters: [                     // 목차 (챕터별 범위)          │   │
│  │         { title: "1. 수열의 극한", startRange: 1, endRange: 45 },    │   │
│  │         { title: "2. 미분법", startRange: 46, endRange: 150 },       │   │
│  │         { title: "3. 적분법", startRange: 151, endRange: 320 }       │   │
│  │       ],                                                             │   │
│  │       description: "개념 설명이 자세한 기본서"                       │   │
│  │     },                                                               │   │
│  │     { ... 다른 교재들 ... }                                          │   │
│  │   ]                                                                  │   │
│  │ }                                                                    │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  🔄 파싱 규칙                                                               │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ 1. "```json" 과 "```" 마커 제거                                      │   │
│  │ 2. JSON.parse()로 파싱                                               │   │
│  │ 3. results 배열에서 VirtualContentItem[] 형태로 변환                 │   │
│  │ 4. 필수 필드(title, totalRange) 없으면 해당 항목 제외                │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**테스트 방법:**
```typescript
// 파일: lib/domains/plan/llm/actions/coldStart/parseResults.test.ts

// 정상 케이스
const mockResponse = `\`\`\`json
{
  "results": [
    {
      "title": "개념원리 미적분",
      "author": "이홍섭",
      "contentType": "book",
      "totalRange": 320,
      "chapters": [
        { "title": "수열의 극한", "startRange": 1, "endRange": 45 }
      ]
    }
  ]
}
\`\`\``;

const parsed = parseSearchResults(mockResponse);
console.log(parsed);
// { success: true, items: [{ title: "개념원리 미적분", ... }] }

// 실패 케이스: 잘못된 JSON
const badResponse = "이것은 JSON이 아닙니다";
const failed = parseSearchResults(badResponse);
console.log(failed);
// { success: false, error: "JSON 파싱 실패" }
```

---

### 13.6 Task 5: 결과 정렬 및 필터링

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Task 5: 결과 정렬 및 필터링                                                │
│  ────────────────────────                                                   │
│  "파싱된 결과를 사용자 조건에 맞게 정렬하고 상위 N개를 반환하는 함수"       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  📥 INPUT                                                                   │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ {                                                                    │   │
│  │   items: VirtualContentItem[],      // Task 4에서 파싱된 결과        │   │
│  │   userPreferences: {                                                 │   │
│  │     contentType: "book",            // 필터: 교재만                  │   │
│  │     maxResults: 5                   // 최대 5개까지                  │   │
│  │   }                                                                  │   │
│  │ }                                                                    │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  📤 OUTPUT (최종 추천 결과)                                                 │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ {                                                                    │   │
│  │   success: true,                                                     │   │
│  │   recommendations: [                                                 │   │
│  │     {                                                                │   │
│  │       rank: 1,                       // 추천 순위                    │   │
│  │       title: "개념원리 미적분",                                      │   │
│  │       contentType: "book",                                           │   │
│  │       totalRange: 320,               // 총 페이지                    │   │
│  │       chapters: [...],               // 목차                         │   │
│  │       matchScore: 95,                // 일치도 (0-100)               │   │
│  │       reason: "개념 학습에 적합한 기본서"  // 추천 이유              │   │
│  │     },                                                               │   │
│  │     { rank: 2, ... },                                                │   │
│  │     { rank: 3, ... }                                                 │   │
│  │   ],                                                                 │   │
│  │   totalFound: 8,                     // 검색된 전체 개수             │   │
│  │   filtered: 3                        // 필터 후 반환 개수            │   │
│  │ }                                                                    │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  🔄 정렬 기준                                                               │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ 1순위: 콘텐츠 타입 일치 (book/lecture)                               │   │
│  │ 2순위: 목차 정보 완성도 (chapters 배열 유무)                         │   │
│  │ 3순위: totalRange 존재 여부                                          │   │
│  │ 4순위: 제목 키워드 매칭                                              │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**테스트 방법:**
```typescript
// 파일: lib/domains/plan/llm/actions/coldStart/rankResults.test.ts

const items = [
  { title: "A 교재", contentType: "book", totalRange: 300, chapters: [...] },
  { title: "B 강의", contentType: "lecture", totalRange: 50, chapters: [] },
  { title: "C 교재", contentType: "book", totalRange: 200, chapters: [...] },
];

const ranked = rankAndFilterResults({
  items,
  userPreferences: { contentType: "book", maxResults: 2 }
});

console.log(ranked);
// {
//   success: true,
//   recommendations: [
//     { rank: 1, title: "A 교재", matchScore: 95, ... },
//     { rank: 2, title: "C 교재", matchScore: 90, ... }
//   ],
//   totalFound: 3,
//   filtered: 2
// }
```

---

### 13.7 통합 파이프라인 테스트

```typescript
// 파일: lib/domains/plan/llm/actions/coldStart/pipeline.test.ts

/**
 * 콜드 스타트 전체 파이프라인 테스트
 *
 * 각 단계를 순서대로 실행하여 전체 흐름이 동작하는지 확인합니다.
 * UI나 DB 없이 콘솔에서 바로 테스트할 수 있습니다.
 */
async function testColdStartPipeline() {
  console.log("=== 콜드 스타트 파이프라인 테스트 ===\n");

  // Task 1: 입력 검증
  console.log("📋 Task 1: 입력 검증");
  const inputResult = validateColdStartInput({
    subjectCategory: "수학",
    subject: "미적분",
    difficulty: "개념",
    contentType: "book"
  });

  if (!inputResult.success) {
    console.log("❌ 입력 검증 실패:", inputResult.error);
    return;
  }
  console.log("✅ 입력 검증 성공:", inputResult.validatedInput);

  // Task 2: 검색 쿼리 생성
  console.log("\n📋 Task 2: 검색 쿼리 생성");
  const queryResult = buildSearchQuery(inputResult.validatedInput);
  console.log("✅ 생성된 쿼리:", queryResult.query);

  // Task 3: 웹 검색 실행
  console.log("\n📋 Task 3: 웹 검색 실행");
  const searchResult = await executeWebSearch(queryResult);

  if (!searchResult.success) {
    console.log("❌ 검색 실패:", searchResult.error);
    return;
  }
  console.log("✅ 검색 성공, 응답 길이:", searchResult.rawContent.length);

  // Task 4: 결과 파싱
  console.log("\n📋 Task 4: 결과 파싱");
  const parseResult = parseSearchResults(searchResult.rawContent);

  if (!parseResult.success) {
    console.log("❌ 파싱 실패:", parseResult.error);
    return;
  }
  console.log("✅ 파싱 성공, 항목 수:", parseResult.items.length);

  // Task 5: 결과 정렬
  console.log("\n📋 Task 5: 결과 정렬");
  const finalResult = rankAndFilterResults({
    items: parseResult.items,
    userPreferences: {
      contentType: inputResult.validatedInput.contentType,
      maxResults: 3
    }
  });

  console.log("✅ 최종 추천 결과:");
  finalResult.recommendations.forEach((rec, i) => {
    console.log(`  ${i + 1}. ${rec.title} (${rec.totalRange}페이지)`);
  });

  console.log("\n=== 테스트 완료 ===");
}

// 실행
testColdStartPipeline();
```

---

### 13.8 파일 구조 (구현 시)

```
lib/domains/plan/llm/actions/coldStart/
├── index.ts                    # 통합 export
├── types.ts                    # 타입 정의 (Input/Output)
├── validateInput.ts            # Task 1: 입력 검증
├── buildQuery.ts               # Task 2: 쿼리 생성
├── executeSearch.ts            # Task 3: 웹 검색 (기존 코드 활용)
├── parseResults.ts             # Task 4: 결과 파싱
├── rankResults.ts              # Task 5: 정렬/필터
├── pipeline.ts                 # 전체 파이프라인 통합
└── __tests__/                  # 테스트 파일들
    ├── validateInput.test.ts
    ├── buildQuery.test.ts
    ├── parseResults.test.ts
    ├── rankResults.test.ts
    └── pipeline.test.ts
```

---

### 13.9 구현 순서 체크리스트

> 🕐 마지막 업데이트: 2026-01-18
> ✅ **MVP + DB 저장 구현 완료** - 172개 테스트 통과

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        구현 순서 (의존성 고려)                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Phase A: 기반 작업 ✅ 완료 (2026-01-17)                                    │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │ [✅] types.ts 작성 - 모든 Input/Output 타입 정의                     │ │
│  │ [✅] validateInput.ts 작성 - 입력 검증 로직                          │ │
│  │ [✅] buildQuery.ts 작성 - 쿼리 생성 로직                             │ │
│  │ [✅] 테스트: 30개 통과 (validateInput 17개 + buildQuery 13개)        │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
│                         ↓                                                   │
│  Phase B: 검색/파싱 ✅ 완료 (2026-01-17)                                    │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │ [✅] executeSearch.ts - Gemini API 웹 검색 + Mock 함수               │ │
│  │ [✅] parseResults.ts - JSON 파싱 및 ParsedContentItem 변환           │ │
│  │ [✅] 테스트: 31개 통과 (executeSearch 6개 + parseResults 25개)       │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
│                         ↓                                                   │
│  Phase C: 정렬/통합 ✅ 완료 (2026-01-18)                                    │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │ [✅] rankResults.ts - 정렬 및 필터링 로직 (19개 테스트)              │ │
│  │ [✅] pipeline.ts - 전체 파이프라인 통합 (20개 테스트)                │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
│                         ↓                                                   │
│  Phase D: 테스트 및 검증 ✅ 완료 (2026-01-18)                               │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │ [✅] 통합 파이프라인 테스트 실행 - 105개 테스트 통과                 │ │
│  │ [✅] Mock 기반 테스트 완료                                           │ │
│  │ [✅] 엣지 케이스 확인 (빈 결과, 잘린 JSON 복구 등)                   │ │
│  │ [ ] 실제 API 호출 테스트 (GOOGLE_API_KEY 필요)                       │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
│                         ↓                                                   │
│  Phase E: DB 저장 연동 ✅ 완료 (2026-01-18)                                 │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │ [✅] persistence/ 모듈 테스트 - 50개 테스트 통과                     │ │
│  │ [✅] pipeline에 saveToDb 옵션 추가                                   │ │
│  │ [✅] 파이프라인 + 저장 통합 테스트 - 17개 테스트 통과                │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 13.10 현재 파일 구조

```
lib/domains/plan/llm/actions/coldStart/
├── index.ts                    # 통합 export ✅
├── types.ts                    # 타입 정의 (PersistenceStats 추가) ✅
├── validateInput.ts            # Task 1: 입력 검증 ✅
├── buildQuery.ts               # Task 2: 쿼리 생성 ✅
├── executeSearch.ts            # Task 3: 웹 검색 ✅
├── parseResults.ts             # Task 4: 결과 파싱 ✅
├── rankResults.ts              # Task 5: 정렬/필터 ✅
├── pipeline.ts                 # 전체 파이프라인 (saveToDb 지원) ✅
├── persistence/                # DB 저장 모듈 ✅
│   ├── index.ts                # 모듈 export
│   ├── types.ts                # 저장 관련 타입
│   ├── mappers.ts              # RecommendationItem → DB 변환
│   ├── duplicateCheck.ts       # 중복 검사
│   └── saveRecommendations.ts  # 저장 함수
└── __tests__/
    ├── validateInput.test.ts   # 17개 테스트 ✅
    ├── buildQuery.test.ts      # 13개 테스트 ✅
    ├── executeSearch.test.ts   # 6개 테스트 ✅
    ├── parseResults.test.ts    # 25개 테스트 ✅
    ├── rankResults.test.ts     # 19개 테스트 ✅
    ├── pipeline.test.ts        # 20개 테스트 ✅
    ├── pipeline-persistence.test.ts  # 17개 테스트 ✅
    ├── integration.test.ts     # 5개 테스트 ✅ (API 키 필요)
    └── persistence/            # DB 저장 테스트 ✅
        ├── mappers.test.ts     # 23개 테스트
        ├── duplicateCheck.test.ts  # 14개 테스트
        └── saveRecommendations.test.ts  # 13개 테스트
```

### 13.11 테스트 현황

| Phase | 파일 | 테스트 수 | 상태 |
|-------|------|----------|------|
| A | validateInput.test.ts | 17 | ✅ 통과 |
| A | buildQuery.test.ts | 13 | ✅ 통과 |
| B | executeSearch.test.ts | 6 | ✅ 통과 |
| B | parseResults.test.ts | 25 | ✅ 통과 |
| C | rankResults.test.ts | 19 | ✅ 통과 |
| C | pipeline.test.ts | 20 | ✅ 통과 |
| D | integration.test.ts | 5 | ✅ 통과 (API 키 필요) |
| E | persistence/mappers.test.ts | 23 | ✅ 통과 |
| E | persistence/duplicateCheck.test.ts | 14 | ✅ 통과 |
| E | persistence/saveRecommendations.test.ts | 13 | ✅ 통과 |
| E | pipeline-persistence.test.ts | 17 | ✅ 통과 |
| **합계** | | **172** | **✅ 전체 통과** |

---

## 14. 이후 단계 (DB 저장 연동 완료)

> ✅ **콜드 스타트 + DB 저장 구현 완료** (2026-01-18)
> - 5단계 파이프라인 + DB 저장 구현 완료
> - 172개 테스트 통과
> - Mock 모드 및 실제 API 호출 모두 지원
> - master_books / master_lectures에 자동 저장

### 14.1 남은 작업

1. [x] **[리팩토링]** 공통 로더 추출 (`loaders/studentLoader.ts`, `loaders/contentLoader.ts`) ✅ (2026-01-18)
2. [ ] **[개선]** `WebSearchContentService.saveToDatabase()` 구조 정보 저장 지원
3. [x] **[개선]** `findExistingWebContent` 다중 조건 필터 추가 ✅ (2026-01-18)
4. [x] **[연동]** DB 저장 기능 추가 - 웹 검색 결과를 master_books/master_lectures에 저장 ✅ (2026-01-18)
5. [x] **[테스트]** Persistence 모듈 테스트 50개 추가 ✅ (2026-01-18)
6. [x] **[연동]** 파이프라인에 saveToDb 옵션 통합 ✅ (2026-01-18)
7. [ ] **[UI]** 단계별 선택 UI 컴포넌트 개발 (`ContentRecommendationWizard`)
8. [ ] **[연동]** 플랜 생성 시 구조 정보 활용 연동

### 14.2 사용 방법

```typescript
import { runColdStartPipeline } from "@/lib/domains/plan/llm/actions/coldStart";

// 기본 사용 (DB 저장 없음)
const result = await runColdStartPipeline(
  {
    subjectCategory: "수학",
    subject: "미적분",
    difficulty: "개념",
    contentType: "book",
  },
  {
    useMock: false,  // 실제 API 호출 (GOOGLE_API_KEY 필요)
    preferences: { maxResults: 5 },
  }
);

if (result.success) {
  result.recommendations.forEach((rec) => {
    console.log(`${rec.rank}. ${rec.title}`);
    console.log(`   점수: ${rec.matchScore}, 이유: ${rec.reason}`);
    console.log(`   총 범위: ${rec.totalRange}, 챕터: ${rec.chapters.length}개`);
  });
} else {
  console.error(`${result.failedAt}에서 실패: ${result.error}`);
}

// DB 저장 모드
const resultWithSave = await runColdStartPipeline(
  {
    subjectCategory: "수학",
    subject: "미적분",
    difficulty: "개념",
    contentType: "book",
  },
  {
    useMock: false,
    saveToDb: true,      // DB 저장 활성화
    tenantId: null,      // 공유 카탈로그 (또는 특정 테넌트 ID)
  }
);

if (resultWithSave.success && resultWithSave.persistence) {
  console.log(`새로 저장: ${resultWithSave.persistence.newlySaved}개`);
  console.log(`중복 스킵: ${resultWithSave.persistence.duplicatesSkipped}개`);
  console.log(`저장된 ID: ${resultWithSave.persistence.savedIds.join(', ')}`);
}
```

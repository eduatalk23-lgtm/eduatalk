# 관리자 영역 AI 플랜 생성 기능 - 웹 검색을 통한 콘텐츠 가져오기 조사

**작성일**: 2025-01-15  
**작성자**: AI Assistant  
**목적**: 관리자 영역의 AI 활용 플랜 생성 기능에서 플랜 대상 콘텐츠를 웹 검색을 통해 가져올 수 있는지에 대한 조사 및 문서화

---

## 📋 목차

1. [현재 구현 상태](#현재-구현-상태)
2. [웹 검색 통합 가능성 분석](#웹-검색-통합-가능성-분석)
3. [구현 방안](#구현-방안)
4. [기술적 고려사항](#기술적-고려사항)
5. [결론 및 권장사항](#결론-및-권장사항)

---

## 🔍 현재 구현 상태

### 1. AI 플랜 생성 기능 개요

관리자 영역에서 AI를 활용한 플랜 생성 기능은 다음과 같은 방식으로 동작합니다:

**주요 파일**:

- `lib/domains/plan/llm/actions/generatePlan.ts` - AI 플랜 생성 서버 액션
- `lib/domains/admin-plan/actions/batchAIPlanGeneration.ts` - 배치 AI 플랜 생성
- `app/(admin)/admin/students/[id]/plans/_components/AdminAIPlanModal.tsx` - 관리자 AI 플랜 모달

### 2. 현재 콘텐츠 가져오기 방식

#### 2.1 데이터베이스 기반 콘텐츠 조회

현재 시스템은 **데이터베이스에 저장된 콘텐츠만** 사용합니다:

```114:130:lib/domains/plan/llm/actions/generatePlan.ts
async function loadContents(supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>, contentIds: string[]) {
  const { data: contents } = await supabase
    .from("content_masters")
    .select(`
      id,
      title,
      subject,
      subject_category,
      content_type,
      total_pages,
      total_lectures,
      estimated_hours
    `)
    .in("id", contentIds);

  return contents || [];
}
```

**콘텐츠 소스**:

1. **`content_masters` 테이블**: 마스터 콘텐츠 정보
2. **`student_books` 테이블**: 학생이 보유한 교재
3. **`student_lectures` 테이블**: 학생이 보유한 강의

#### 2.2 콘텐츠 선택 프로세스

```138:174:lib/domains/admin-plan/actions/studentContents.ts
  // 2. 콘텐츠 정보 조회 (books + lectures)
  const [booksResult, lecturesResult] = await Promise.all([
    supabase
      .from('student_books')
      .select(`
        id,
        book:books(
          id,
          title,
          subject,
          subject_category,
          total_pages,
          difficulty
        )
      `)
      .eq('student_id', studentId)
      .eq('tenant_id', tenantId)
      .in('book_id', contentIds),
    supabase
      .from('student_lectures')
      .select(`
        id,
        lecture:lectures(
          id,
          title,
          subject,
          subject_category,
          total_episodes,
          average_duration,
          difficulty
        )
      `)
      .eq('student_id', studentId)
      .eq('tenant_id', tenantId)
      .in('lecture_id', contentIds),
  ]);
```

**특징**:

- ✅ 데이터베이스에 이미 등록된 콘텐츠만 사용
- ✅ 학생별 보유 콘텐츠 기반
- ❌ 웹 검색을 통한 외부 콘텐츠 가져오기 없음
- ❌ 실시간 콘텐츠 검색 기능 없음

### 3. LLM Provider 현황

**현재 사용 중인 Provider**: Google Gemini

```23:45:lib/domains/plan/llm/providers/gemini.ts
const GEMINI_MODEL_CONFIGS: Record<ModelTier, ModelConfig> = {
  fast: {
    tier: "fast",
    modelId: "gemini-1.5-flash",
    maxTokens: 4096,
    temperature: 0.3,
    provider: "gemini",
  },
  standard: {
    tier: "standard",
    modelId: "gemini-1.5-pro",
    maxTokens: 8192,
    temperature: 0.5,
    provider: "gemini",
  },
  advanced: {
    tier: "advanced",
    modelId: "gemini-1.5-pro",
    maxTokens: 16384,
    temperature: 0.7,
    provider: "gemini",
  },
};
```

**현재 구현 상태**:

- ✅ Gemini API를 통한 플랜 생성
- ❌ Gemini의 Grounding 기능 미사용
- ❌ 웹 검색 기능 미통합

---

## 🔎 웹 검색 통합 가능성 분석

### 1. Google Gemini Grounding 기능

Google Gemini API는 **Grounding** 기능을 제공하여 실시간 웹 검색을 지원할 수 있습니다.

#### 1.1 Grounding 기능 개요

- **Grounding with Google Search**: Gemini API가 Google Search를 통해 최신 정보를 검색하고 응답에 포함
- **실시간 정보 접근**: LLM의 학습 데이터 커트오프 이후의 정보도 검색 가능
- **자동 검색**: 프롬프트에 따라 자동으로 관련 웹 검색 수행

#### 1.2 현재 코드에서의 Grounding 사용 여부

**조사 결과**: 현재 코드에서는 Grounding 기능을 사용하지 않습니다.

```206:244:lib/domains/plan/llm/providers/gemini.ts
  async createMessage(options: CreateMessageOptions): Promise<CreateMessageResult> {
    const config = this.getModelConfig(options.modelTier || "standard");
    const model = this.getModel(config);

    const formattedMessages = this.formatMessages(options.system, options.messages);

    // 마지막 메시지 추출 (generateContent에 전달)
    const lastMessage = formattedMessages[formattedMessages.length - 1];
    const history = formattedMessages.slice(0, -1);

    // Chat 세션 시작
    const chat = model.startChat({
      history,
      generationConfig: {
        maxOutputTokens: options.maxTokens || config.maxTokens,
        temperature: options.temperature ?? config.temperature,
      },
    });

    const result = await chat.sendMessage(lastMessage.parts);
    const response = result.response;
    const content = response.text();
```

**분석**:

- `model.startChat()` 호출 시 `groundingConfig` 옵션이 없음
- 웹 검색 기능이 활성화되지 않음

### 2. 외부 웹 검색 API 통합 가능성

#### 2.1 Google Custom Search API

**장점**:

- ✅ Google의 강력한 검색 엔진 활용
- ✅ 검색 결과의 신뢰성 높음
- ✅ 한국어 검색 지원 우수

**단점**:

- ❌ 별도 API 키 필요
- ❌ 일일 검색 쿼리 제한 (무료: 100회/일)
- ❌ 비용 발생 가능

#### 2.2 Tavily Search API

**장점**:

- ✅ AI 최적화된 검색 API
- ✅ 구조화된 검색 결과
- ✅ 콘텐츠 추출 기능 내장

**단점**:

- ❌ 별도 서비스 구독 필요
- ❌ 비용 발생

**참고**: 프로젝트의 `SuperClaude_Framework`에 Tavily 관련 문서가 있으나, 실제 프로젝트 코드에는 통합되어 있지 않습니다.

#### 2.3 Bing Search API

**장점**:

- ✅ Microsoft의 검색 엔진
- ✅ 무료 티어 제공

**단점**:

- ❌ 별도 API 키 필요
- ❌ 한국어 검색 품질이 Google 대비 낮을 수 있음

### 3. 웹 검색을 통한 콘텐츠 가져오기 시나리오

#### 3.1 시나리오 1: 학습 자료 검색

**사용 사례**:

- 관리자가 "2024 수능 수학 기출 문제집" 검색
- 웹에서 최신 교재 정보 검색
- 검색 결과를 기반으로 플랜 생성

**구현 복잡도**: 높음

- 웹 검색 결과를 콘텐츠로 변환하는 로직 필요
- 검색 결과의 신뢰성 검증 필요
- 중복 콘텐츠 방지 로직 필요

#### 3.2 시나리오 2: 학습 주제 기반 콘텐츠 추천

**사용 사례**:

- 학생의 취약 과목이 "미적분"인 경우
- 웹에서 "미적분 학습 자료" 검색
- 검색 결과를 바탕으로 콘텐츠 추천

**구현 복잡도**: 중간

- LLM이 검색 쿼리 생성
- 검색 결과를 분석하여 콘텐츠 추천

#### 3.3 시나리오 3: 실시간 학습 트렌드 반영

**사용 사례**:

- 최신 입시 트렌드 반영
- 최근 출제 경향 분석
- 웹 검색을 통한 최신 정보 수집

**구현 복잡도**: 높음

- 검색 결과의 신뢰성 검증
- 정보의 시의성 관리

---

## 🛠 구현 방안

### 방안 1: Gemini Grounding 기능 활용 (권장)

#### 1.1 구현 방법

**Gemini API의 Grounding 기능 활성화**:

```typescript
// lib/domains/plan/llm/providers/gemini.ts 수정 예시
const chat = model.startChat({
  history,
  generationConfig: {
    maxOutputTokens: options.maxTokens || config.maxTokens,
    temperature: options.temperature ?? config.temperature,
  },
  // Grounding 기능 추가
  tools: [
    {
      googleSearchRetrieval: {
        // Google Search를 통한 웹 검색 활성화
        dynamicRetrievalConfig: {
          mode: "MODE_DYNAMIC",
          dynamicThreshold: 0.3, // 검색 임계값
        },
      },
    },
  ],
});
```

**장점**:

- ✅ Gemini API에 내장된 기능으로 추가 비용 최소화
- ✅ 검색과 생성이 통합되어 자연스러운 플로우
- ✅ Google Search의 강력한 검색 능력 활용

**단점**:

- ❌ 검색 결과를 직접 제어하기 어려움
- ❌ 검색된 콘텐츠를 데이터베이스에 저장하기 어려움
- ❌ 검색 쿼리를 명시적으로 지정하기 어려움

#### 1.2 프롬프트 수정

플랜 생성 프롬프트에 웹 검색을 활용하도록 지시 추가:

```typescript
// lib/domains/plan/llm/prompts/planGeneration.ts 수정 예시
export const SYSTEM_PROMPT = `당신은 한국의 대학 입시를 준비하는 학생들을 위한 전문 학습 플래너입니다.
학생의 성적, 학습 이력, 콘텐츠 정보를 분석하여 최적화된 학습 계획을 생성합니다.

## 웹 검색 활용
필요한 경우 최신 학습 자료, 교재 정보, 입시 트렌드를 웹에서 검색하여 활용할 수 있습니다.
검색된 정보는 학생의 학습 계획에 반영하되, 신뢰할 수 있는 출처의 정보를 우선적으로 사용하세요.

// ... 기존 프롬프트 ...
`;
```

### 방안 2: 별도 웹 검색 API 통합

#### 2.1 Google Custom Search API 통합

**구현 구조**:

```
lib/
├── domains/
│   └── plan/
│       └── llm/
│           ├── services/
│           │   └── webSearchService.ts  # 웹 검색 서비스
│           └── actions/
│               └── generatePlanWithWebSearch.ts  # 웹 검색 통합 플랜 생성
```

**웹 검색 서비스 예시**:

```typescript
// lib/domains/plan/llm/services/webSearchService.ts
export class WebSearchService {
  async searchContent(
    query: string,
    options?: {
      subject?: string;
      grade?: string;
      limit?: number;
    }
  ): Promise<SearchResult[]> {
    // Google Custom Search API 호출
    const response = await fetch(
      `https://www.googleapis.com/customsearch/v1?key=${GOOGLE_SEARCH_API_KEY}&cx=${SEARCH_ENGINE_ID}&q=${encodeURIComponent(query)}`
    );

    const data = await response.json();

    // 검색 결과를 콘텐츠 형식으로 변환
    return this.transformSearchResults(data.items);
  }

  private transformSearchResults(items: any[]): SearchResult[] {
    return items.map((item) => ({
      title: item.title,
      url: item.link,
      snippet: item.snippet,
      // 콘텐츠 메타데이터 추출
      metadata: this.extractMetadata(item),
    }));
  }
}
```

**플랜 생성 통합**:

```typescript
// lib/domains/plan/llm/actions/generatePlanWithWebSearch.ts
export async function generatePlanWithWebSearch(
  input: GeneratePlanInput & { enableWebSearch?: boolean }
): Promise<GeneratePlanResult> {
  const webSearchService = new WebSearchService();

  // 1. 기존 콘텐츠 로드
  const contents = await loadContents(supabase, input.contentIds);

  // 2. 웹 검색 활성화 시 추가 콘텐츠 검색
  let webSearchResults: SearchResult[] = [];
  if (input.enableWebSearch) {
    // 학생 정보 기반 검색 쿼리 생성
    const searchQuery = buildSearchQuery(student, input);
    webSearchResults = await webSearchService.searchContent(searchQuery);
  }

  // 3. 웹 검색 결과를 프롬프트에 포함
  const llmRequest = buildLLMRequest({
    ...input,
    contents,
    webSearchResults, // 추가
  });

  // 4. LLM 호출
  const result = await createMessage({
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: buildUserPrompt(llmRequest) }],
    modelTier: input.modelTier,
  });

  // ...
}
```

**장점**:

- ✅ 검색 쿼리를 명시적으로 제어 가능
- ✅ 검색 결과를 데이터베이스에 저장 가능
- ✅ 검색 결과 필터링 및 검증 가능

**단점**:

- ❌ 별도 API 키 및 비용 필요
- ❌ 검색 결과를 콘텐츠로 변환하는 로직 복잡
- ❌ 구현 및 유지보수 비용 증가

### 방안 3: 하이브리드 접근법

#### 3.1 구현 전략

1. **기본**: 데이터베이스 콘텐츠 사용
2. **보조**: 웹 검색을 통한 콘텐츠 추천
3. **통합**: 검색된 콘텐츠를 데이터베이스에 저장 후 사용

**플로우**:

```
1. 관리자가 플랜 생성 요청
   ↓
2. 데이터베이스에서 기존 콘텐츠 로드
   ↓
3. (옵션) 웹 검색 활성화 시
   - 학생 정보 기반 검색 쿼리 생성
   - 웹 검색 수행
   - 검색 결과를 임시 콘텐츠로 변환
   ↓
4. LLM에 기존 콘텐츠 + 웹 검색 결과 전달
   ↓
5. LLM이 플랜 생성
   ↓
6. (선택) 검색된 콘텐츠를 데이터베이스에 저장
```

---

## ⚙️ 기술적 고려사항

### 1. 성능 고려사항

#### 1.1 응답 시간

**현재**: 데이터베이스 조회만 수행 (빠름)
**웹 검색 추가 시**:

- Google Custom Search API: ~500ms - 2초
- Gemini Grounding: LLM 응답 시간에 포함 (추가 지연 최소)

**권장사항**:

- 웹 검색을 비동기로 수행
- 캐싱 전략 적용 (동일한 검색 쿼리 재사용)

#### 1.2 비용

**현재 비용**:

- Gemini API 호출 비용만 발생

**웹 검색 추가 시**:

- Google Custom Search API: 무료 100회/일, 이후 $5/1000회
- Gemini Grounding: 추가 비용 없음 (API 호출 비용에 포함)

### 2. 데이터 품질 관리

#### 2.1 검색 결과 검증

**필요한 검증**:

- 출처 신뢰성 확인
- 콘텐츠 중복 방지
- 메타데이터 추출 정확도

**구현 방안**:

```typescript
interface SearchResultValidation {
  isValid: boolean;
  confidence: number; // 0-1
  source: string;
  metadata: {
    title: string;
    author?: string;
    publisher?: string;
    publicationDate?: string;
  };
}
```

#### 2.2 콘텐츠 변환

웹 검색 결과를 시스템의 콘텐츠 형식으로 변환:

```typescript
interface ContentFromWebSearch {
  id: string; // 임시 ID 생성
  title: string;
  url: string;
  subject?: string;
  subjectCategory?: string;
  contentType: "web" | "book" | "lecture";
  metadata: {
    source: string;
    searchQuery: string;
    searchDate: string;
  };
}
```

### 3. 보안 및 개인정보

#### 3.1 검색 쿼리 보안

- 학생 개인정보가 검색 쿼리에 포함되지 않도록 주의
- 검색 쿼리 로깅 시 민감 정보 제거

#### 3.2 외부 링크 관리

- 웹 검색 결과의 URL을 직접 저장하지 않음
- 콘텐츠 메타데이터만 저장
- 필요 시 링크 검증 및 안전성 확인

### 4. 사용자 경험

#### 4.1 UI/UX 고려사항

**현재**: 콘텐츠 선택 UI가 데이터베이스 기반

**웹 검색 추가 시**:

- 검색 옵션 토글 추가
- 검색 결과 미리보기 제공
- 검색된 콘텐츠와 기존 콘텐츠 구분 표시

**UI 컴포넌트 예시**:

```tsx
// app/(admin)/admin/plan-creation/_components/content-selection/WebSearchContentPanel.tsx
export function WebSearchContentPanel({
  onSelectContent,
}: {
  onSelectContent: (content: ContentFromWebSearch) => void;
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);

  const handleSearch = async () => {
    const results = await searchWebContent(searchQuery);
    setSearchResults(results);
  };

  return (
    <div>
      <input
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        placeholder="학습 자료 검색..."
      />
      <button onClick={handleSearch}>검색</button>

      <div>
        {searchResults.map((result) => (
          <ContentCard
            key={result.id}
            content={result}
            onSelect={() => onSelectContent(result)}
          />
        ))}
      </div>
    </div>
  );
}
```

---

## 📊 비교 분석

### 방안별 비교

| 항목            | 방안 1: Gemini Grounding | 방안 2: 별도 API | 방안 3: 하이브리드 |
| --------------- | ------------------------ | ---------------- | ------------------ |
| **구현 복잡도** | 낮음                     | 중간             | 높음               |
| **추가 비용**   | 없음                     | 있음             | 있음               |
| **검색 제어**   | 낮음                     | 높음             | 중간               |
| **결과 저장**   | 어려움                   | 쉬움             | 쉬움               |
| **응답 시간**   | 약간 증가                | 증가             | 증가               |
| **유지보수**    | 쉬움                     | 중간             | 복잡               |

### 권장 방안

**단기 (1-2개월)**: 방안 1 (Gemini Grounding)

- 빠른 구현 가능
- 추가 비용 없음
- 기본적인 웹 검색 기능 제공

**중기 (3-6개월)**: 방안 3 (하이브리드)

- 검색 결과를 데이터베이스에 저장
- 재사용성 향상
- 더 정교한 검색 제어

---

## ✅ 결론 및 권장사항

### 결론

1. **현재 상태**: 웹 검색을 통한 콘텐츠 가져오기 기능은 **구현되어 있지 않음**
2. **구현 가능성**: **가능함** - 여러 방안으로 구현 가능
3. **권장 방안**: **Gemini Grounding 기능 활용** (방안 1)

### 권장사항

#### 단계별 구현 계획

**Phase 1: 기본 웹 검색 기능 (1-2주)**

- [ ] Gemini Grounding 기능 활성화
- [ ] 프롬프트에 웹 검색 활용 지시 추가
- [ ] 테스트 및 검증

**Phase 2: 검색 결과 관리 (2-3주)**

- [ ] 검색 결과를 임시 콘텐츠로 변환
- [ ] 검색 결과 UI 표시
- [ ] 검색 결과 필터링

**Phase 3: 고급 기능 (3-4주)**

- [ ] 검색 결과를 데이터베이스에 저장
- [ ] 검색 쿼리 최적화
- [ ] 캐싱 전략 적용

#### 주의사항

1. **비용 관리**
   - 웹 검색 사용량 모니터링
   - 무료 티어 한도 관리
   - 필요 시 유료 플랜 전환 검토

2. **데이터 품질**
   - 검색 결과의 신뢰성 검증
   - 중복 콘텐츠 방지
   - 메타데이터 추출 정확도 향상

3. **사용자 경험**
   - 웹 검색 옵션을 선택적으로 제공
   - 검색 결과의 출처 명시
   - 검색 실패 시 기존 방식으로 폴백

### 다음 단계

1. **기술 검증**: Gemini Grounding 기능 테스트
2. **프로토타입 개발**: 기본 웹 검색 기능 구현
3. **사용자 피드백**: 관리자 대상 테스트 및 피드백 수집
4. **점진적 개선**: 피드백 기반 기능 개선

---

## 📚 참고 자료

### 관련 문서

- `docs/2026-01-06_llm-provider-change-to-gemini.md` - LLM Provider 변경 문서
- `docs/2025-02-02-admin-plan-creation-flow-analysis-and-improvements.md` - 관리자 플랜 생성 플로우 분석

### 관련 코드

- `lib/domains/plan/llm/actions/generatePlan.ts` - AI 플랜 생성 액션
- `lib/domains/plan/llm/providers/gemini.ts` - Gemini Provider 구현
- `lib/domains/admin-plan/actions/studentContents.ts` - 학생 콘텐츠 조회

### 외부 참고

- [Google Gemini API 문서](https://ai.google.dev/docs)
- [Google Custom Search API](https://developers.google.com/custom-search/v1/overview)
- [Tavily Search API](https://tavily.com/)

---

**문서 작성 완료일**: 2025-01-15
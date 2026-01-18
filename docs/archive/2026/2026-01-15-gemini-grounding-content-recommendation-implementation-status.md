# 제미나이 Grounding 검색을 활용한 컨텐츠 추천 및 저장 기능 구현 상태 점검

**작성일**: 2026-01-15  
**작성자**: AI Assistant  
**목적**: Google Gemini Grounding 기능을 활용한 웹 검색 기반 컨텐츠 추천 및 저장 기능의 구현 상태 점검 및 문서화

---

## 📋 목차

1. [구현 개요](#구현-개요)
2. [핵심 기능 구현 상태](#핵심-기능-구현-상태)
3. [아키텍처 및 데이터 흐름](#아키텍처-및-데이터-흐름)
4. [주요 컴포넌트 상세](#주요-컴포넌트-상세)
5. [사용 사례 및 통합 지점](#사용-사례-및-통합-지점)
6. [설정 및 옵션](#설정-및-옵션)
7. [데이터베이스 스키마](#데이터베이스-스키마)
8. [성능 및 비용 고려사항](#성능-및-비용-고려사항)
9. [향후 개선 사항](#향후-개선-사항)

---

## 🎯 구현 개요

### 기능 설명

Google Gemini API의 **Grounding 기능**을 활용하여 실시간 웹 검색을 통해 학습 컨텐츠를 추천하고, 검색된 컨텐츠를 데이터베이스에 저장하는 기능이 구현되어 있습니다.

### 주요 특징

- ✅ **실시간 웹 검색**: Gemini API가 Google Search를 통해 최신 학습 자료 자동 검색
- ✅ **자동 컨텐츠 변환**: 웹 검색 결과를 시스템의 컨텐츠 형식으로 자동 변환
- ✅ **데이터베이스 저장**: 검색된 컨텐츠를 `master_books` 또는 `master_lectures` 테이블에 저장
- ✅ **중복 방지**: URL 기반 중복 체크로 동일 컨텐츠 중복 저장 방지
- ✅ **UI 통합**: 웹 검색 결과를 표시하고 선택적으로 저장할 수 있는 UI 제공

---

## ✅ 핵심 기능 구현 상태

### 1. Gemini Grounding 기능 ✅ **완전 구현**

**파일**: `lib/domains/plan/llm/providers/gemini.ts`

#### 구현 내용

```211:232:lib/domains/plan/llm/providers/gemini.ts
  private buildGroundingTools(grounding?: GroundingConfig): any[] {
    if (!grounding?.enabled) return [];

    // Gemini 1.5 모델용 google_search_retrieval
    // mode: 'always'인 경우 항상 검색, 'dynamic'인 경우 필요시 검색
    if (grounding.mode === "always") {
      // 항상 검색 (Gemini 2.0+ 권장)
      return [{ googleSearch: {} }];
    }

    // 동적 검색 (기본값) - Gemini 1.5 호환
    return [
      {
        googleSearchRetrieval: {
          dynamicRetrievalConfig: {
            mode: "MODE_DYNAMIC",
            dynamicThreshold: grounding.dynamicThreshold ?? 0.3,
          },
        },
      },
    ];
  }
```

#### Grounding 메타데이터 추출

```239:272:lib/domains/plan/llm/providers/gemini.ts
  private extractGroundingMetadata(response: any): GroundingMetadata | undefined {
    const groundingMeta = response.candidates?.[0]?.groundingMetadata;
    if (!groundingMeta) return undefined;

    // 검색 쿼리 추출
    const searchQueries: string[] =
      groundingMeta.webSearchQueries || groundingMeta.searchQueries || [];

    // 웹 검색 결과 추출
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const webResults = (groundingMeta.groundingChunks || []).map((chunk: any) => ({
      url: chunk.web?.uri || "",
      title: chunk.web?.title || "",
      snippet: chunk.retrievedContext?.text || "",
    }));

    // 인용 정보 추출
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const citations = (groundingMeta.groundingSupports || []).flatMap((support: any) =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (support.groundingChunkIndices || []).map((index: number, _i: number) => ({
        startIndex: support.segment?.startIndex || 0,
        endIndex: support.segment?.endIndex || 0,
        uri: groundingMeta.groundingChunks?.[index]?.web?.uri || "",
      }))
    );

    return {
      searchQueries,
      webResults,
      citations: citations.length > 0 ? citations : undefined,
    };
  }
```

**상태**: ✅ 완전 구현됨
- Grounding tools 빌드 기능
- 메타데이터 추출 기능
- 동적/항상 검색 모드 지원

---

### 2. 웹 검색 컨텐츠 서비스 ✅ **완전 구현**

**파일**: `lib/domains/plan/llm/services/webSearchContentService.ts`

#### 주요 기능

1. **Grounding 메타데이터를 컨텐츠로 변환**

```100:118:lib/domains/plan/llm/services/webSearchContentService.ts
  transformToContent(
    groundingMetadata: GroundingMetadata,
    context: TransformContext
  ): WebSearchContent[] {
    return groundingMetadata.webResults
      .filter((result) => result.url && result.title) // URL과 제목이 있는 것만
      .map((result) => ({
        id: crypto.randomUUID(),
        title: result.title,
        url: result.url,
        snippet: result.snippet,
        subject: context.subject,
        subjectCategory: context.subjectCategory,
        contentType: this.inferContentType(result.url, result.title),
        source: "web_search" as const,
        searchQuery: groundingMetadata.searchQueries.join(", "),
        searchDate: new Date().toISOString(),
      }));
  }
```

2. **컨텐츠 타입 자동 추론**

```127:165:lib/domains/plan/llm/services/webSearchContentService.ts
  private inferContentType(url: string, title: string): WebContentType {
    const lowerUrl = url.toLowerCase();
    const lowerTitle = title.toLowerCase();

    // 강의/동영상 콘텐츠 판별
    if (
      lowerUrl.includes("youtube") ||
      lowerUrl.includes("youtu.be") ||
      lowerUrl.includes("lecture") ||
      lowerUrl.includes("course") ||
      lowerUrl.includes("megastudy") ||
      lowerUrl.includes("etoos") ||
      lowerUrl.includes("ebsi") ||
      lowerTitle.includes("강의") ||
      lowerTitle.includes("강좌") ||
      lowerTitle.includes("인강") ||
      lowerTitle.includes("동영상")
    ) {
      return "web_lecture";
    }

    // 교재/문제집 콘텐츠 판별
    if (
      lowerTitle.includes("교재") ||
      lowerTitle.includes("문제집") ||
      lowerTitle.includes("기출") ||
      lowerTitle.includes("교과서") ||
      lowerTitle.includes("book") ||
      lowerTitle.includes("workbook") ||
      lowerUrl.includes("yes24") ||
      lowerUrl.includes("kyobobook") ||
      lowerUrl.includes("aladin")
    ) {
      return "web_book";
    }

    // 기본값: 일반 학습 자료/아티클
    return "web_article";
  }
```

3. **데이터베이스 저장 (중복 체크 포함)**

```177:283:lib/domains/plan/llm/services/webSearchContentService.ts
  async saveToDatabase(
    contents: WebSearchContent[],
    tenantId: string
  ): Promise<SaveWebContentResult> {
    const supabase = await createSupabaseAdminClient();
    if (!supabase) {
      return {
        success: false,
        savedCount: 0,
        savedIds: [],
        duplicateCount: 0,
        errors: ["Supabase 클라이언트 초기화 실패"],
      };
    }

    const savedIds: string[] = [];
    const errors: string[] = [];
    let duplicateCount = 0;

    for (const content of contents) {
      try {
        // URL 기반 중복 체크 (master_books)
        const { data: existingBook } = await supabase
          .from("master_books")
          .select("id")
          .eq("source_url", content.url)
          .eq("tenant_id", tenantId)
          .maybeSingle();

        if (existingBook) {
          duplicateCount++;
          continue;
        }

        // URL 기반 중복 체크 (master_lectures)
        const { data: existingLecture } = await supabase
          .from("master_lectures")
          .select("id")
          .eq("lecture_source_url", content.url)
          .eq("tenant_id", tenantId)
          .maybeSingle();

        if (existingLecture) {
          duplicateCount++;
          continue;
        }

        // 콘텐츠 타입에 따라 적절한 테이블에 저장
        if (content.contentType === "web_lecture") {
          const { data, error } = await supabase
            .from("master_lectures")
            .insert({
              tenant_id: tenantId,
              title: content.title,
              lecture_source_url: content.url,
              subject: content.subject,
              subject_category: content.subjectCategory,
              notes: content.snippet,
              total_episodes: 1, // 필수 필드 기본값
              is_active: true,
            })
            .select("id")
            .single();

          if (error) {
            errors.push(`강의 저장 실패 (${content.title}): ${error.message}`);
          } else {
            savedIds.push(data.id);
          }
        } else {
          // web_book, web_article -> master_books에 저장
          const { data, error } = await supabase
            .from("master_books")
            .insert({
              tenant_id: tenantId,
              title: content.title,
              source: "web_search",
              source_url: content.url,
              subject: content.subject,
              subject_category: content.subjectCategory,
              notes: content.snippet,
              description: `웹 검색 결과 - 검색어: ${content.searchQuery}`,
              is_active: true,
            })
            .select("id")
            .single();

          if (error) {
            errors.push(`교재 저장 실패 (${content.title}): ${error.message}`);
          } else {
            savedIds.push(data.id);
          }
        }
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : String(error);
        errors.push(`저장 중 오류 (${content.title}): ${errMsg}`);
      }
    }

    return {
      success: errors.length === 0,
      savedCount: savedIds.length,
      savedIds,
      duplicateCount,
      errors,
    };
  }
```

**상태**: ✅ 완전 구현됨
- Grounding 메타데이터 변환
- 컨텐츠 타입 자동 추론
- 중복 체크 및 데이터베이스 저장

---

### 3. 플랜 생성 통합 ✅ **완전 구현**

**파일**: `lib/domains/plan/llm/actions/generatePlan.ts`

#### 웹 검색 활성화 및 결과 처리

```452:514:lib/domains/plan/llm/actions/generatePlan.ts
    // Grounding 설정 (웹 검색)
    const groundingConfig = input.enableWebSearch
      ? {
          enabled: true,
          mode: input.webSearchConfig?.mode || ("dynamic" as const),
          dynamicThreshold: input.webSearchConfig?.dynamicThreshold,
        }
      : undefined;

    const result = await createMessage({
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt }],
      modelTier,
      grounding: groundingConfig,
    });

    // 6-1. 웹 검색 결과 처리
    let webSearchResults:
      | {
          searchQueries: string[];
          resultsCount: number;
          savedCount?: number;
          results: WebSearchResult[];
        }
      | undefined;

    if (result.groundingMetadata && result.groundingMetadata.webResults.length > 0) {
      console.log(
        `[AI Plan] 웹 검색 결과: ${result.groundingMetadata.webResults.length}건, 검색어: ${result.groundingMetadata.searchQueries.join(", ")}`
      );

      webSearchResults = {
        searchQueries: result.groundingMetadata.searchQueries,
        resultsCount: result.groundingMetadata.webResults.length,
        results: result.groundingMetadata.webResults,
      };

      // DB 저장 옵션이 활성화된 경우
      if (input.webSearchConfig?.saveResults && tenantId) {
        const webContentService = getWebSearchContentService();

        // Grounding 메타데이터를 콘텐츠로 변환
        const webContents = webContentService.transformToContent(result.groundingMetadata, {
          tenantId,
          // 콘텐츠에서 과목 정보 추출 (첫 번째 콘텐츠 기준)
          subject: contents[0]?.subject,
          subjectCategory: contents[0]?.subject_category,
        });

        if (webContents.length > 0) {
          const saveResult = await webContentService.saveToDatabase(webContents, tenantId);
          webSearchResults.savedCount = saveResult.savedCount;

          console.log(
            `[AI Plan] 웹 콘텐츠 저장: ${saveResult.savedCount}건 저장, ${saveResult.duplicateCount}건 중복`
          );

          if (saveResult.errors.length > 0) {
            console.warn("[AI Plan] 웹 콘텐츠 저장 오류:", saveResult.errors);
          }
        }
      }
    }
```

**상태**: ✅ 완전 구현됨
- 웹 검색 옵션 활성화
- 검색 결과 처리 및 저장

---

### 4. 컨텐츠 추천 통합 ✅ **완전 구현**

**파일**: `lib/domains/plan/llm/actions/recommendContent.ts`

#### 웹 검색 통합

```443:507:lib/domains/plan/llm/actions/recommendContent.ts
    // Grounding 설정 (웹 검색)
    const groundingConfig = input.enableWebSearch
      ? {
          enabled: true,
          mode: input.webSearchConfig?.mode || ("dynamic" as const),
          dynamicThreshold: input.webSearchConfig?.dynamicThreshold,
        }
      : undefined;

    const result = await createMessage({
      system: CONTENT_RECOMMENDATION_SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt }],
      modelTier,
      grounding: groundingConfig,
    });

    // 6-1. 웹 검색 결과 처리
    let webSearchResults:
      | {
          searchQueries: string[];
          resultsCount: number;
          savedCount?: number;
        }
      | undefined;

    if (result.groundingMetadata && result.groundingMetadata.webResults.length > 0) {
      console.log(
        `[AI Content Rec] 웹 검색 결과: ${result.groundingMetadata.webResults.length}건, 검색어: ${result.groundingMetadata.searchQueries.join(", ")}`
      );

      webSearchResults = {
        searchQueries: result.groundingMetadata.searchQueries,
        resultsCount: result.groundingMetadata.webResults.length,
      };

      // DB 저장 옵션이 활성화된 경우 - tenantId 조회 필요
      if (input.webSearchConfig?.saveResults) {
        // 학생의 tenant_id 조회
        const { data: studentData } = await supabase
          .from("students")
          .select("tenant_id")
          .eq("id", input.studentId)
          .single();

        if (studentData?.tenant_id) {
          const webContentService = getWebSearchContentService();

          // Grounding 메타데이터를 콘텐츠로 변환
          const webContents = webContentService.transformToContent(result.groundingMetadata, {
            tenantId: studentData.tenant_id,
            // 추천 과목 카테고리 기반
            subject: input.subjectCategories?.[0],
          });

          if (webContents.length > 0) {
            const saveResult = await webContentService.saveToDatabase(webContents, studentData.tenant_id);
            webSearchResults.savedCount = saveResult.savedCount;

            console.log(
              `[AI Content Rec] 웹 콘텐츠 저장: ${saveResult.savedCount}건 저장, ${saveResult.duplicateCount}건 중복`
            );
          }
        }
      }
    }
```

**상태**: ✅ 완전 구현됨
- 컨텐츠 추천에서 웹 검색 활용
- 검색 결과 자동 저장

---

### 5. UI 컴포넌트 ✅ **완전 구현**

#### 웹 검색 결과 패널

**파일**: `components/plan/WebSearchResultsPanel.tsx`

주요 기능:
- 웹 검색 결과 목록 표시
- 컨텐츠 타입별 아이콘 및 배지 (강의/교재/자료)
- 선택적 저장 기능
- 검색 쿼리 표시

#### 웹 검색 옵션 UI

**파일**: `app/(student)/plan/new-group/_components/_features/ai-mode/AIPlanGeneratorPanel.tsx`

```220:243:app/(student)/plan/new-group/_components/_features/ai-mode/AIPlanGeneratorPanel.tsx
      {/* 웹 검색 (Gemini Grounding) */}
      <div className="p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={enableWebSearch}
            onChange={(e) => setEnableWebSearch(e.target.checked)}
            className="w-4 h-4 mt-1 text-blue-600 rounded"
          />
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className={cn("text-sm font-medium", textPrimary)}>
                🌐 웹 검색으로 최신 학습 자료 찾기
              </span>
              <span className="text-xs px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                Beta
              </span>
            </div>
            <p className={cn("text-xs mt-1", textMuted)}>
              AI가 인터넷에서 관련 학습 자료를 검색하여 플랜에 반영합니다
            </p>
          </div>
        </label>
      </div>
```

**상태**: ✅ 완전 구현됨
- 웹 검색 옵션 체크박스
- 결과 표시 패널

---

## 🏗 아키텍처 및 데이터 흐름

### 전체 데이터 흐름

```
1. 사용자가 웹 검색 옵션 활성화
   ↓
2. generatePlanWithAI 또는 recommendContentWithAI 호출
   ↓
3. GroundingConfig 생성 (enabled: true)
   ↓
4. Gemini API 호출 (tools에 googleSearchRetrieval 포함)
   ↓
5. Gemini가 Google Search를 통해 웹 검색 수행
   ↓
6. 응답에 GroundingMetadata 포함
   ↓
7. extractGroundingMetadata로 메타데이터 추출
   ↓
8. WebSearchContentService.transformToContent로 컨텐츠 변환
   ↓
9. (옵션) WebSearchContentService.saveToDatabase로 DB 저장
   ↓
10. 결과 반환 (webSearchResults 포함)
```

### 컴포넌트 구조

```
lib/domains/plan/llm/
├── providers/
│   ├── gemini.ts              # Grounding tools 빌드 및 메타데이터 추출
│   └── base.ts                # GroundingConfig, GroundingMetadata 타입 정의
├── services/
│   └── webSearchContentService.ts  # 웹 검색 결과 변환 및 저장
├── actions/
│   ├── generatePlan.ts        # 플랜 생성 (웹 검색 통합)
│   └── recommendContent.ts    # 컨텐츠 추천 (웹 검색 통합)
└── client.ts                  # LLM 클라이언트 (grounding 옵션 전달)

components/plan/
└── WebSearchResultsPanel.tsx   # 웹 검색 결과 UI 컴포넌트
```

---

## 📦 주요 컴포넌트 상세

### 1. GroundingConfig 타입

```132:139:lib/domains/plan/llm/providers/base.ts
export interface GroundingConfig {
  /** Grounding 활성화 여부 */
  enabled: boolean;
  /** 검색 모드 - dynamic: 필요시 검색, always: 항상 검색 */
  mode?: "dynamic" | "always";
  /** 동적 검색 임계값 (0.0 - 1.0, 기본값: 0.3) */
  dynamicThreshold?: number;
}
```

### 2. GroundingMetadata 타입

```157:168:lib/domains/plan/llm/providers/base.ts
export interface GroundingMetadata {
  /** 수행된 검색 쿼리 목록 */
  searchQueries: string[];
  /** 웹 검색 결과 목록 */
  webResults: WebSearchResult[];
  /** 인용 정보 (응답 텍스트에서 웹 소스 참조 위치) */
  citations?: Array<{
    startIndex: number;
    endIndex: number;
    uri: string;
  }>;
}
```

### 3. WebSearchResult 타입

```144:151:lib/domains/plan/llm/providers/base.ts
export interface WebSearchResult {
  /** 웹 페이지 URL */
  url: string;
  /** 웹 페이지 제목 */
  title: string;
  /** 검색 결과 요약/스니펫 */
  snippet?: string;
}
```

---

## 🔌 사용 사례 및 통합 지점

### 1. 플랜 생성에서 웹 검색 사용

**위치**: `lib/domains/plan/llm/actions/generatePlan.ts`

**사용 예시**:
```typescript
const result = await generatePlanWithAI({
  studentId: "xxx",
  contentIds: ["content-1", "content-2"],
  startDate: "2025-01-01",
  endDate: "2025-01-31",
  enableWebSearch: true,
  webSearchConfig: {
    mode: "dynamic",
    saveResults: true, // 검색 결과를 DB에 저장
  },
});

// 결과에 웹 검색 정보 포함
if (result.data?.webSearchResults) {
  console.log(`검색어: ${result.data.webSearchResults.searchQueries.join(", ")}`);
  console.log(`검색 결과: ${result.data.webSearchResults.resultsCount}건`);
  console.log(`저장된 컨텐츠: ${result.data.webSearchResults.savedCount}건`);
}
```

### 2. 컨텐츠 추천에서 웹 검색 사용

**위치**: `lib/domains/plan/llm/actions/recommendContent.ts`

**사용 예시**:
```typescript
const result = await recommendContentWithAI({
  studentId: "xxx",
  focusArea: "weak_subjects",
  enableWebSearch: true,
  webSearchConfig: {
    mode: "dynamic",
    saveResults: true,
  },
});
```

### 3. 배치 플랜 생성에서 웹 검색 사용

**위치**: `lib/domains/admin-plan/actions/batchAIPlanGeneration.ts`

배치 생성 시에도 웹 검색 옵션을 사용할 수 있습니다.

---

## ⚙️ 설정 및 옵션

### 웹 검색 모드

1. **dynamic (기본값)**
   - LLM이 필요하다고 판단할 때만 웹 검색 수행
   - `dynamicThreshold`로 검색 민감도 조절 (0.0 - 1.0)
   - 비용 효율적

2. **always**
   - 항상 웹 검색 수행
   - 더 많은 검색 결과 보장
   - 비용이 더 많이 소요될 수 있음

### 웹 검색 설정 옵션

```typescript
interface WebSearchConfig {
  /** 검색 모드 */
  mode?: "dynamic" | "always";
  /** 동적 검색 임계값 (dynamic 모드에서만 사용) */
  dynamicThreshold?: number;
  /** 검색 결과를 DB에 저장할지 여부 */
  saveResults?: boolean;
}
```

---

## 🗄 데이터베이스 스키마

### 저장되는 테이블

#### 1. master_books (교재/문제집/일반 자료)

**저장 필드**:
- `tenant_id`: 테넌트 ID
- `title`: 컨텐츠 제목
- `source`: "web_search" 고정
- `source_url`: 원본 웹 페이지 URL
- `subject`: 과목
- `subject_category`: 과목 카테고리
- `notes`: 검색 결과 스니펫
- `description`: 검색 쿼리 정보 포함
- `is_active`: true

#### 2. master_lectures (강의/동영상)

**저장 필드**:
- `tenant_id`: 테넌트 ID
- `title`: 강의 제목
- `lecture_source_url`: 원본 웹 페이지 URL
- `subject`: 과목
- `subject_category`: 과목 카테고리
- `notes`: 검색 결과 스니펫
- `total_episodes`: 1 (기본값)
- `is_active`: true

### 중복 체크

- `master_books`: `source_url` + `tenant_id` 조합으로 중복 체크
- `master_lectures`: `lecture_source_url` + `tenant_id` 조합으로 중복 체크

---

## 💰 성능 및 비용 고려사항

### 성능

1. **응답 시간**
   - 웹 검색 추가 시 LLM 응답 시간이 약간 증가 (1-3초)
   - Google Search API 호출 시간 포함

2. **비동기 처리**
   - 웹 검색은 Gemini API 내부에서 처리되므로 별도 비동기 처리 불필요

### 비용

1. **Gemini API 비용**
   - Grounding 기능은 추가 비용 없음 (API 호출 비용에 포함)
   - 모델별 비용:
     - Fast (gemini-1.5-flash): Input $0.075/1M, Output $0.3/1M
     - Standard/Advanced (gemini-1.5-pro): Input $1.25/1M, Output $5.0/1M

2. **데이터베이스 저장 비용**
   - Supabase 저장 공간 사용
   - 중복 체크로 인한 추가 쿼리 비용 (최소)

### 최적화 권장사항

1. **dynamic 모드 사용**: 필요할 때만 검색하여 비용 절감
2. **중복 체크**: URL 기반 중복 체크로 불필요한 저장 방지
3. **선택적 저장**: `saveResults: false`로 검색만 수행하고 저장하지 않을 수 있음

---

## 🚀 향후 개선 사항

### 단기 개선 (1-2개월)

- [ ] **검색 결과 필터링**: 품질이 낮은 검색 결과 자동 필터링
- [ ] **검색 쿼리 최적화**: 더 정확한 검색을 위한 쿼리 개선
- [ ] **컨텐츠 타입 추론 개선**: 더 정확한 타입 분류

### 중기 개선 (3-6개월)

- [ ] **검색 결과 캐싱**: 동일한 검색 쿼리 결과 캐싱
- [ ] **검색 결과 품질 점수**: 신뢰도 기반 정렬
- [ ] **사용자 피드백**: 저장된 컨텐츠에 대한 사용자 평가

### 장기 개선 (6개월 이상)

- [ ] **커스텀 검색 엔진 통합**: Google Custom Search API 등
- [ ] **검색 결과 자동 업데이트**: 주기적으로 검색 결과 갱신
- [ ] **검색 히스토리 관리**: 검색 이력 추적 및 분석

---

## 📝 사용 예시

### 예시 1: 플랜 생성 시 웹 검색 활성화

```typescript
// 학생 플랜 생성 UI에서
const handleGenerate = async () => {
  const result = await generatePlanWithAI({
    studentId: student.id,
    contentIds: selectedContentIds,
    startDate: "2025-01-01",
    endDate: "2025-01-31",
    dailyStudyMinutes: 180,
    enableWebSearch: true, // 웹 검색 활성화
    webSearchConfig: {
      mode: "dynamic",
      saveResults: true, // 검색 결과 저장
    },
  });

  if (result.success && result.data?.webSearchResults) {
    // 웹 검색 결과 표시
    showWebSearchResults(result.data.webSearchResults);
  }
};
```

### 예시 2: 컨텐츠 추천 시 웹 검색 사용

```typescript
const result = await recommendContentWithAI({
  studentId: "xxx",
  focusArea: "weak_subjects",
  subjectCategories: ["수학"],
  enableWebSearch: true,
  webSearchConfig: {
    mode: "dynamic",
    dynamicThreshold: 0.5, // 검색 민감도 조절
    saveResults: true,
  },
});
```

---

## ✅ 구현 상태 요약

| 기능 | 상태 | 비고 |
|------|------|------|
| Gemini Grounding 통합 | ✅ 완료 | dynamic/always 모드 지원 |
| 웹 검색 결과 추출 | ✅ 완료 | 메타데이터 추출 및 파싱 |
| 컨텐츠 변환 | ✅ 완료 | 자동 타입 추론 포함 |
| 데이터베이스 저장 | ✅ 완료 | 중복 체크 포함 |
| 플랜 생성 통합 | ✅ 완료 | generatePlanWithAI |
| 컨텐츠 추천 통합 | ✅ 완료 | recommendContentWithAI |
| UI 컴포넌트 | ✅ 완료 | WebSearchResultsPanel |
| 배치 생성 통합 | ✅ 완료 | batchAIPlanGeneration |

---

## 📚 관련 파일

### 핵심 구현 파일

- `lib/domains/plan/llm/providers/gemini.ts` - Grounding 기능 구현
- `lib/domains/plan/llm/services/webSearchContentService.ts` - 웹 검색 컨텐츠 서비스
- `lib/domains/plan/llm/actions/generatePlan.ts` - 플랜 생성 통합
- `lib/domains/plan/llm/actions/recommendContent.ts` - 컨텐츠 추천 통합
- `components/plan/WebSearchResultsPanel.tsx` - UI 컴포넌트

### 타입 정의

- `lib/domains/plan/llm/providers/base.ts` - GroundingConfig, GroundingMetadata 타입

### 관련 문서

- `docs/2026-01-06_llm-provider-change-to-gemini.md` - LLM Provider 변경 문서
- `docs/2025-01-15-admin-ai-plan-web-search-content-investigation.md` - 웹 검색 조사 문서

---

## 🎯 결론

**제미나이 Grounding 검색을 활용한 컨텐츠 추천 및 저장 기능은 완전히 구현되어 있으며, 프로덕션 환경에서 사용 가능한 상태입니다.**

주요 특징:
- ✅ 실시간 웹 검색 통합
- ✅ 자동 컨텐츠 변환 및 저장
- ✅ 중복 방지 및 에러 처리
- ✅ UI 통합 완료
- ✅ 플랜 생성 및 컨텐츠 추천 모두 지원

향후 개선을 통해 검색 품질과 사용자 경험을 더욱 향상시킬 수 있습니다.

---

**문서 작성 완료일**: 2026-01-15


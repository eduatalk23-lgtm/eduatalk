# 콜드 스타트 및 콘텐츠 추천 통합 설계

> 작성일: 2026-01-18
> 최종 업데이트: 2026-01-18
> 상태: ✅ 구현 완료 (269개 테스트 통과)

## 1. 현재 시스템 아키텍처

### 1.1 플랜 생성 흐름 개요

```
┌─────────────────────────────────────────────────────────────┐
│                      플랜 생성 진입점                         │
├─────────────────────────────────────────────────────────────┤
│  학생용 (7 Step Wizard)      │  관리자용 (Admin Wizard)       │
│  /plan/new-group             │  /admin/students/[id]/plans   │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                    콘텐츠 선택/추천 단계                       │
├─────────────────────────────────────────────────────────────┤
│  1. 보유 콘텐츠 선택 (수동)                                   │
│  2. 마스터 콘텐츠 검색 (수동)                                  │
│  3. AI 추천 콘텐츠 (recommendContent) ← 현재 사용 중           │
│  4. 콜드 스타트 추천 (coldStart) ← 연결 필요                   │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                      플랜 생성 실행                           │
├─────────────────────────────────────────────────────────────┤
│  createPlanGroupAtomic() → generatePlansWithServices()      │
│  → student_plan 테이블에 개별 플랜 저장                        │
└─────────────────────────────────────────────────────────────┘
```

### 1.2 기존 콘텐츠 추천 시스템

| 시스템 | 용도 | 웹 검색 | DB 저장 | 상태 |
|--------|------|---------|---------|------|
| `recommendContent` | 학생 데이터 기반 추천 | ✅ Gemini Grounding | ✅ master_books/lectures | 연결됨 |
| `enhancedRecommendContent` | 향상된 추천 (시너지, 난이도) | ❌ | ❌ | 연결됨 |
| `coldStart Pipeline` | 신규 학생/데이터 없을 때 | ✅ Tavily/Gemini | ✅ persistence 모듈 | ✅ **연결됨** |
| `WebSearchContentService` | 웹 검색 결과 관리 | - | ✅ | 부분 연결 |

### 1.3 콜드 스타트 파이프라인 현황

```
lib/domains/plan/llm/actions/coldStart/
├── index.ts                 # 모듈 export
├── pipeline.ts              # 메인 파이프라인 (6단계)
├── types.ts                 # 타입 정의
├── validateInput.ts         # Task 1: 입력 검증
├── buildQuery.ts            # Task 2: 검색 쿼리 생성
├── executeSearch.ts         # Task 3: 웹 검색 실행
├── parseResults.ts          # Task 4: 결과 파싱
├── rankResults.ts           # Task 5: 정렬/필터링
└── persistence/             # Task 6: DB 저장
    ├── index.ts
    ├── types.ts
    ├── mappers.ts           # 공유 유틸리티 사용
    ├── duplicateCheck.ts
    └── saveRecommendations.ts
```

**현재 상태:** ✅ 구현 완료
- ✅ 파이프라인 구현 완료 (269개 테스트 통과)
- ✅ DB 저장 기능 완료 (persistence 모듈)
- ✅ UI 연동 완료 (WebSearchPanel)
- ✅ Server Action 완료 (getUnifiedContentRecommendation)
- ✅ 시나리오 테스트 완료 (scenarios.test.ts)

---

## 2. 통합 설계

### 2.1 목표

1. **콜드 스타트 통합**: 신규 학생 또는 콘텐츠 데이터 부족 시 자동으로 콜드 스타트 파이프라인 활용
2. **콘텐츠 추천 API**: 구조 정보(chapters, totalRange) 포함한 웹 검색 콘텐츠 추천 엔드포인트 제공
3. **데이터 누적**: 추천 결과를 DB에 저장하여 점진적으로 콘텐츠 카탈로그 확장

### 2.2 통합 아키텍처

```
┌─────────────────────────────────────────────────────────────┐
│                    콘텐츠 추천 통합 레이어                     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────┐    ┌─────────────────┐                │
│  │ Server Action   │    │ API Route       │                │
│  │ (내부 호출용)    │    │ (외부 호출용)    │                │
│  └────────┬────────┘    └────────┬────────┘                │
│           │                      │                          │
│           └──────────┬───────────┘                          │
│                      ↓                                      │
│  ┌─────────────────────────────────────────────────────┐   │
│  │           ContentRecommendationService               │   │
│  │  (통합 추천 서비스 - 신규 생성)                        │   │
│  ├─────────────────────────────────────────────────────┤   │
│  │  - 학생 데이터 확인                                    │   │
│  │  - 조건에 따라 적절한 추천 전략 선택                    │   │
│  │  - 결과 통합 및 반환                                   │   │
│  └─────────────────────────────────────────────────────┘   │
│                      ↓                                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ recommend    │  │ coldStart    │  │ findExisting │      │
│  │ Content      │  │ Pipeline     │  │ WebContent   │      │
│  │ (데이터 有)   │  │ (데이터 無)   │  │ (캐시 활용)   │      │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘      │
│         │                 │                 │               │
│         └────────┬────────┴────────┬────────┘               │
│                  ↓                 ↓                        │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              WebSearchContentService                 │   │
│  │  - transformToContent()                              │   │
│  │  - saveToDatabase()                                  │   │
│  │  - findExistingWebContent()                          │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 2.3 추천 전략 선택 로직

```typescript
async function selectRecommendationStrategy(input: RecommendInput): Promise<Strategy> {
  // 1. 기존 저장된 콘텐츠 확인
  const existingContent = await findExistingWebContent(tenantId, {
    subjectCategory: input.subjectCategory,
    subject: input.subject,
    hasStructure: true,
    limit: input.maxResults,
  });

  if (existingContent.length >= input.maxResults) {
    return { type: "cache", data: existingContent };
  }

  // 2. 학생 데이터 확인
  const hasStudentData = await checkStudentDataAvailability(input.studentId);

  if (hasStudentData.hasScores && hasStudentData.hasLearningHistory) {
    // 충분한 데이터 → 기존 추천 시스템
    return { type: "recommend", useWebSearch: true };
  }

  // 3. 데이터 부족 → 콜드 스타트
  return { type: "coldStart", saveToDb: true };
}
```

---

## 3. 구현 계획

### 3.1 Phase 1: Server Action 생성

**파일**: `lib/domains/plan/llm/actions/unifiedContentRecommendation.ts`

```typescript
"use server";

export interface UnifiedRecommendInput {
  // 필수
  studentId?: string;           // 선택적 (콜드 스타트 시 불필요)
  tenantId: string;

  // 교과/과목 정보
  subjectCategory: string;      // "수학", "영어" 등
  subject?: string;             // "미적분", "영어독해" 등
  difficultyLevel?: string;     // "개념", "기본", "심화"

  // 콘텐츠 타입
  contentType?: "book" | "lecture" | "all";

  // 옵션
  maxResults?: number;          // 기본값: 5
  useCache?: boolean;           // 기본값: true (기존 저장된 콘텐츠 우선)
  forceColdStart?: boolean;     // 강제 콜드 스타트
  saveResults?: boolean;        // 결과 DB 저장 (기본값: true)
}

export interface UnifiedRecommendResult {
  success: boolean;
  strategy: "cache" | "recommend" | "coldStart";
  recommendations: RecommendedContent[];
  stats: {
    fromCache: number;
    fromWebSearch: number;
    newlySaved: number;
  };
  error?: string;
}

export async function getUnifiedContentRecommendation(
  input: UnifiedRecommendInput
): Promise<UnifiedRecommendResult> {
  // 구현...
}
```

### 3.2 Phase 2: API Route 생성

**파일**: `app/api/plan/content-recommendation/route.ts`

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getUnifiedContentRecommendation } from "@/lib/domains/plan/llm/actions/unifiedContentRecommendation";

export async function POST(request: NextRequest) {
  const body = await request.json();

  // 인증 확인
  const { user, error: authError } = await validateAuth(request);
  if (authError) {
    return NextResponse.json({ error: authError }, { status: 401 });
  }

  // 입력 검증
  const validationResult = validateInput(body);
  if (!validationResult.success) {
    return NextResponse.json({ error: validationResult.error }, { status: 400 });
  }

  // 추천 실행
  const result = await getUnifiedContentRecommendation({
    ...body,
    tenantId: user.tenantId,
  });

  return NextResponse.json(result);
}
```

**API 스펙**:

```
POST /api/plan/content-recommendation

Request Body:
{
  "studentId": "uuid (optional)",
  "subjectCategory": "수학",
  "subject": "미적분 (optional)",
  "difficultyLevel": "기본 (optional)",
  "contentType": "book | lecture | all",
  "maxResults": 5,
  "useCache": true,
  "forceColdStart": false,
  "saveResults": true
}

Response:
{
  "success": true,
  "strategy": "coldStart",
  "recommendations": [
    {
      "id": "uuid",
      "title": "개념원리 미적분",
      "contentType": "book",
      "totalRange": 320,
      "chapters": [
        { "title": "1장 수열의 극한", "startRange": 1, "endRange": 45 },
        ...
      ],
      "author": "이홍섭",
      "publisher": "개념원리",
      "difficultyLevel": "기본",
      "matchScore": 92,
      "reason": "미적분 기본 개념 학습에 적합한 교재",
      "source": "cold_start"
    }
  ],
  "stats": {
    "fromCache": 0,
    "fromWebSearch": 5,
    "newlySaved": 5
  }
}
```

### 3.3 Phase 3: UI 연동

**위치**: 관리자 플랜 위자드 Step 4 (콘텐츠 선택)

```typescript
// app/(admin)/admin/students/[id]/plans/_components/admin-wizard/steps/Step4ContentSelection.tsx

// 새로운 "AI 콘텐츠 검색" 버튼 추가
<Button onClick={handleColdStartSearch}>
  AI 콘텐츠 검색
</Button>

// 콜드 스타트 검색 핸들러
async function handleColdStartSearch() {
  const result = await getUnifiedContentRecommendation({
    tenantId,
    subjectCategory: selectedSubject,
    contentType: selectedContentType,
    maxResults: 10,
  });

  if (result.success) {
    setRecommendedContents(result.recommendations);
  }
}
```

---

## 4. 데이터 흐름

### 4.1 콜드 스타트 → 플랜 생성 연결

```
1. 사용자가 "AI 콘텐츠 검색" 클릭
   ↓
2. getUnifiedContentRecommendation() 호출
   ↓
3. 콜드 스타트 파이프라인 실행
   - 웹 검색 (Tavily/Gemini)
   - 결과 파싱 (챕터, 페이지 수 추출)
   - 정렬/필터링
   ↓
4. DB 저장 (saveRecommendationsToMasterContent)
   - master_books / master_lectures에 저장
   - 중복 검사 (제목+교과)
   ↓
5. 저장된 contentId 반환
   ↓
6. UI에서 추천 콘텐츠 표시
   ↓
7. 사용자가 콘텐츠 선택
   ↓
8. 플랜 생성 (createPlanGroupAtomic)
   - 선택된 contentId 사용
   - 범위 설정 (startRange, endRange)
   ↓
9. 개별 플랜 생성 (generatePlansWithServices)
```

### 4.2 캐시 활용 흐름

```
1. 추천 요청 수신
   ↓
2. findExistingWebContent() 호출
   - 동일 교과/과목/난이도로 검색
   - source = 'cold_start' OR 'web_search'
   - hasStructure = true (구조 정보 있는 것만)
   ↓
3. 충분한 결과 있으면 → 캐시에서 반환
   부족하면 → 웹 검색 실행 후 병합
```

---

## 5. 파일 변경 목록

### 5.1 신규 생성 파일

| 파일 | 설명 |
|------|------|
| `lib/domains/plan/llm/actions/unifiedContentRecommendation.ts` | 통합 추천 Server Action |
| `app/api/plan/content-recommendation/route.ts` | API Route |

### 5.2 수정 파일

| 파일 | 변경 내용 |
|------|----------|
| `lib/domains/plan/llm/actions/coldStart/index.ts` | 새 export 추가 (필요시) |
| `app/(admin)/.../Step4ContentSelection.tsx` | AI 검색 버튼 추가 |
| `app/(student)/.../Step3ContentSelection.tsx` | AI 검색 버튼 추가 (선택적) |

### 5.3 의존성

```
unifiedContentRecommendation.ts
├── coldStart/pipeline.ts (runColdStartPipeline)
├── recommendContent.ts (recommendContentWithAI) - 선택적
├── services/webSearchContentService.ts (findExistingWebContent)
└── coldStart/persistence/ (saveRecommendationsToMasterContent)
```

---

## 6. 테스트 계획

### 6.1 단위 테스트

```typescript
// __tests__/lib/domains/plan/llm/actions/unifiedContentRecommendation.test.ts

describe("getUnifiedContentRecommendation", () => {
  it("캐시에 충분한 콘텐츠가 있으면 캐시에서 반환", async () => {});
  it("학생 데이터가 있으면 recommendContent 사용", async () => {});
  it("데이터 부족 시 콜드 스타트 파이프라인 실행", async () => {});
  it("forceColdStart=true면 항상 콜드 스타트 사용", async () => {});
  it("saveResults=true면 DB에 저장", async () => {});
});
```

### 6.2 통합 테스트

```typescript
// __tests__/integration/contentRecommendation.test.ts

describe("콘텐츠 추천 통합 테스트", () => {
  it("콜드 스타트 → DB 저장 → 캐시 활용 전체 흐름", async () => {});
  it("API Route 호출 → 인증 → 추천 → 응답", async () => {});
});
```

---

## 7. 마이그레이션 고려사항

### 7.1 하위 호환성

- 기존 `recommendContent` API 변경 없음
- 새 API는 추가 엔드포인트로 제공
- 점진적 UI 마이그레이션 가능

### 7.2 성능 고려

- 캐시 우선 정책으로 API 호출 최소화
- 웹 검색 결과 DB 저장으로 재사용
- 중복 검사로 데이터 정규화

### 7.3 모니터링

- 추천 전략별 사용 통계 (cache/recommend/coldStart)
- 웹 검색 호출 횟수
- DB 저장 성공/실패율

---

## 8. 플래너/플랜 관리 시스템 통합 고려사항

### 8.1 플래너 시스템 구조

플래너는 **마스터 템플릿** 역할을 하며, 플랜 그룹이 이를 상속받습니다.

```
┌─────────────────────────────────────────┐
│              플래너 (Planner)            │
├─────────────────────────────────────────┤
│  - study_hours, self_study_hours        │
│  - block_set_id                         │
│  - default_scheduler_type/options       │
│  - non_study_time_blocks                │
│  - planner_exclusions (제외일)           │
│  - planner_academy_schedules (학원일정)  │
└───────────────┬─────────────────────────┘
                │ 상속 (inheritPlannerConfig)
                ↓
┌─────────────────────────────────────────┐
│           플랜 그룹 (Plan Group)         │
├─────────────────────────────────────────┤
│  - planner_id (FK)                      │
│  - 상속된 시간/스케줄러 설정              │
│  - plan_contents (콘텐츠 목록)           │
│  - plan_exclusions (상속 + 추가)         │
│  - academy_schedules (상속 + 추가)       │
└─────────────────────────────────────────┘
```

**통합 시 고려사항:**
- 콜드 스타트 콘텐츠 선택 시 **현재 선택된 플래너**의 컨텍스트 필요
- 플래너가 없으면 플랜 그룹 생성 불가 → UI에서 플래너 선택 강제

### 8.2 콘텐츠-플랜 연결 필수 조건

콜드 스타트로 생성된 콘텐츠가 플랜에 연결되려면 다음 정보가 **필수**입니다:

| 필드 | 필수 | 타입 | 설명 |
|------|------|------|------|
| `content_id` | ✅ | UUID | master_books/lectures ID |
| `content_type` | ✅ | Enum | 'book' \| 'lecture' |
| `start_range` | ✅ | INT | 시작 페이지/에피소드 (≥1) |
| `end_range` | ✅ | INT | 종료 페이지/에피소드 (≥start_range) |
| `total_pages/episodes` | ✅ | INT | 총 범위 (마스터 테이블에 저장) |
| `master_content_id` | ⚠️ | UUID | 콜드 스타트 콘텐츠면 자기 자신 |

**ContentResolutionService 검증 흐름:**

```
1. content_id로 master_books/lectures 조회
   ↓
2. 학생 콘텐츠 존재 여부 확인 (books/lectures)
   ↓
3. 없으면 자동 복사 (copyMasterBookToStudent)
   - master_content_id 참조 저장
   - student_book_details 복사
   ↓
4. contentIdMap 생성 (master_id → student_id)
   ↓
5. 메타데이터/소요시간/챕터 정보 로드
```

**주의사항:**
- `totalRange = 0`이면 저장 시 `NULL` 또는 `1`로 변환됨 → 범위 계산 오류 가능
- `chapters` 정보가 있어야 `page_analysis`/`episode_analysis` 저장됨
- Detail ID 없으면 `start_range/end_range`로 fallback 매칭

### 8.3 테넌트 콘텐츠 관리

**테넌트 격리 정책:**

| tenant_id | 의미 | 접근 권한 |
|-----------|------|---------|
| `NULL` | 공유 카탈로그 | 모든 테넌트 접근 가능 |
| `'uuid'` | 테넌트 전용 | 해당 테넌트만 접근 |

**콜드 스타트 저장 시 결정:**

```typescript
// 공유 카탈로그에 저장 (권장)
await runColdStartPipeline(input, {
  saveToDb: true,
  tenantId: null,  // 모든 테넌트가 활용 가능
});

// 특정 테넌트 전용으로 저장
await runColdStartPipeline(input, {
  saveToDb: true,
  tenantId: currentTenantId,  // 해당 테넌트만 접근
});
```

**검색 시 필터링:**

```sql
-- 테넌트 A 학생의 콘텐츠 검색
WHERE is_active = true
  AND (tenant_id IS NULL OR tenant_id = 'tenant-A')
-- 결과: 공유 + 테넌트A 전용 콘텐츠
```

**권장 정책:**
1. 콜드 스타트 콘텐츠는 **공유 카탈로그**에 저장 (`tenantId: null`)
2. 중복 검사는 **테넌트 범위 내**에서 수행
3. 활용률 높은 콘텐츠만 점진적으로 축적

### 8.4 학생 콘텐츠 복사 프로세스

콜드 스타트로 생성된 마스터 콘텐츠는 플랜 생성 시 자동으로 학생 콘텐츠로 복사됩니다:

```
master_books (콜드 스타트 저장)
    │
    │ copyMasterBookToStudent()
    │ - 중복 체크 (master_content_id 기준)
    │ - 학생 테넌트로 복사
    │ - book_details도 함께 복사
    ↓
books (학생 콘텐츠)
    │
    │ student_plan 생성 시
    ↓
student_plan.content_id = books.id
```

**중요:** `master_content_id` 필드로 원본 마스터 콘텐츠를 추적합니다.

### 8.5 UI 통합 시 체크리스트

관리자 위자드 Step 4 (콘텐츠 선택) 수정 시:

```typescript
// ✅ 필수 체크
const canUseColdStart = () => {
  // 1. 플래너 선택 확인
  if (!selectedPlannerId) {
    return { allowed: false, reason: "플래너를 먼저 선택해주세요" };
  }

  // 2. 테넌트 ID 확인
  if (!tenantId) {
    return { allowed: false, reason: "테넌트 정보가 없습니다" };
  }

  // 3. 교과 선택 확인
  if (!selectedSubjectCategory) {
    return { allowed: false, reason: "교과를 선택해주세요" };
  }

  return { allowed: true };
};

// ✅ 추천 결과를 plan_contents 형식으로 변환
function convertToPlayContent(recommendation: RecommendedContent): PlanContent {
  return {
    content_id: recommendation.id,
    content_type: recommendation.contentType,
    master_content_id: recommendation.id,  // 콜드 스타트 콘텐츠
    start_range: 1,
    end_range: recommendation.totalRange || 1,
    is_auto_recommended: true,
    recommendation_source: "cold_start",
    recommendation_reason: recommendation.reason,
    recommendation_metadata: {
      matchScore: recommendation.matchScore,
      chapters: recommendation.chapters,
    },
  };
}
```

### 8.6 에러 처리 시나리오

| 시나리오 | 원인 | 해결 |
|----------|------|------|
| 콘텐츠 복사 실패 | master_content_id 누락 | 콜드 스타트 저장 시 ID 반환 확인 |
| 범위 검증 실패 | start_range > end_range | UI에서 기본값 설정 (1 ~ totalRange) |
| 테넌트 접근 거부 | tenant_id 불일치 | 공유 카탈로그 사용 권장 |
| Detail ID 매핑 실패 | book_details 미생성 | start_range로 fallback |
| 스케줄러 오류 | total_pages = 0 | 최소값 1 강제 |

---

## 9. 구현 우선순위

| 순서 | 작업 | 예상 복잡도 | 비고 |
|------|------|------------|------|
| 1 | `unifiedContentRecommendation.ts` Server Action | 중 | 핵심 통합 레이어 |
| 2 | API Route 생성 | 하 | 외부 호출용 |
| 3 | 관리자 UI 연동 (Step 4) | 중 | 플래너 컨텍스트 필요 |
| 4 | 학생 UI 연동 (선택적) | 하 | Step 3 |
| 5 | ContentResolutionService 호환성 테스트 | 중 | 복사 프로세스 검증 |
| 6 | 테스트 작성 | 중 | 단위 + 통합 |

---

## 10. 참고 문서

- `docs/2026-01-18-cold-start-db-persistence-implementation.md` - 콜드 스타트 저장 구현
- `lib/domains/plan/llm/actions/coldStart/` - 콜드 스타트 파이프라인
- `lib/domains/plan/llm/services/webSearchContentService.ts` - 웹 검색 콘텐츠 서비스
- `lib/domains/plan/llm/actions/recommendContent.ts` - 기존 추천 액션
- `lib/plan/shared/ContentResolutionService.ts` - 콘텐츠 해석 서비스
- `lib/data/contentMasters/copy.ts` - 마스터 → 학생 콘텐츠 복사
- `lib/utils/contentFilters.ts` - 테넌트 필터링 로직

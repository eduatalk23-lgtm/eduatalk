# 콜드 스타트 DB 저장 기능 구현

> 작성일: 2026-01-18
> 최종 업데이트: 2026-01-18
> 상태: ✅ 완료 (전체 269개 테스트 통과, persistence 모듈 67개)

## 개요

콜드 스타트 추천 파이프라인 결과(`RecommendationItem[]`)를 `master_books` / `master_lectures` 테이블에 저장하여 데이터 축적 및 재활용 가능하게 함.

## 설계 원칙

1. **파이프라인 분리**: 기존 파이프라인은 순수 함수로 유지, DB 저장은 별도 모듈로 분리
2. **파이프라인 통합 옵션**: `saveToDb` 옵션으로 저장 기능 활성화 가능
3. **중복 방지**: 동일 제목+교과 조합 중복 체크 (대소문자 무시)
4. **점진적 축적**: 저장된 데이터는 향후 웹 검색 없이 재활용 가능

---

## 구현 내역

### 생성된 파일 (5개 + 테스트 4개)

```
lib/domains/plan/llm/actions/coldStart/persistence/
├── types.ts              # 타입 정의
├── mappers.ts            # RecommendationItem → DB 레코드 변환
├── duplicateCheck.ts     # 중복 검사
├── saveRecommendations.ts # 메인 저장 함수
└── index.ts              # 모듈 export

lib/domains/plan/llm/actions/coldStart/__tests__/
├── persistence/
│   ├── mappers.test.ts           # 23개 테스트
│   ├── duplicateCheck.test.ts    # 14개 테스트
│   └── saveRecommendations.test.ts  # 13개 테스트
└── pipeline-persistence.test.ts  # 17개 테스트
```

### 수정된 파일 (3개)

- `lib/domains/plan/llm/actions/coldStart/index.ts` - persistence 모듈 export 추가
- `lib/domains/plan/llm/actions/coldStart/types.ts` - `PersistenceStats` 타입 추가
- `lib/domains/plan/llm/actions/coldStart/pipeline.ts` - `saveToDb`, `tenantId` 옵션 추가

---

## 파일별 상세

### 1. types.ts

주요 타입 정의:

```typescript
// DB 저장 옵션
interface SaveRecommendationOptions {
  tenantId?: string | null;    // null = 공유 카탈로그
  subjectCategory?: string;
  subject?: string;
  difficultyLevel?: string;
}

// 저장된 항목 정보
interface SavedContentItem {
  id: string;
  title: string;
  contentType: 'book' | 'lecture';
  isNew: boolean;  // true: 새로 생성, false: 기존 중복
}

// 저장 결과
interface SaveRecommendationsResult {
  success: boolean;
  savedItems: SavedContentItem[];
  skippedDuplicates: number;
  errors: Array<{ title: string; error: string }>;
}
```

### 2. mappers.ts

`RecommendationItem` → DB Insert 형식 변환:

| RecommendationItem | master_books | master_lectures |
|-------------------|--------------|-----------------|
| `title` | `title` | `title` |
| `totalRange` | `total_pages` | `total_episodes` |
| `chapters[]` | `page_analysis` (JSON) | `episode_analysis` (JSON) |
| `author` | `author` | `instructor_name` |
| `publisher` | `publisher_name` | `platform_name` |
| `reason + matchScore` | `notes` | `notes` |
| - | `source: 'cold_start'` | - |

### 3. duplicateCheck.ts

- `checkBookDuplicate(title, subjectCategory, tenantId)` → `{ isDuplicate, existingId }`
- `checkLectureDuplicate(title, subjectCategory, tenantId)` → `{ isDuplicate, existingId }`
- 대소문자 무시 (`ilike`)
- `tenant_id`가 null이면 공유 카탈로그에서만 검색

### 4. saveRecommendations.ts

메인 저장 함수:

```typescript
async function saveRecommendationsToMasterContent(
  recommendations: RecommendationItem[],
  options: SaveRecommendationOptions = {}
): Promise<SaveRecommendationsResult>
```

**처리 흐름:**
1. 각 추천 항목 순회
2. 중복 검사 (`checkBookDuplicate` / `checkLectureDuplicate`)
3. 중복이면 기존 ID 반환 + `isNew: false`
4. 새 항목이면 `insert` + `isNew: true`
5. 에러 수집 (개별 항목 실패가 전체를 중단하지 않음)

---

## 사용 예시

### 방법 1: 파이프라인 통합 (권장)

```typescript
import { runColdStartPipeline } from '@/lib/domains/plan/llm/actions/coldStart';

// saveToDb 옵션으로 저장까지 한 번에 처리
const result = await runColdStartPipeline(
  {
    subjectCategory: '수학',
    subject: '미적분',
    difficulty: '개념',
    contentType: 'book',
  },
  {
    saveToDb: true,      // DB 저장 활성화
    tenantId: null,      // 공유 카탈로그 (또는 특정 테넌트 ID)
  }
);

if (result.success) {
  console.log(`추천: ${result.recommendations.length}개`);

  if (result.persistence) {
    console.log(`새로 저장: ${result.persistence.newlySaved}개`);
    console.log(`중복 스킵: ${result.persistence.duplicatesSkipped}개`);
    console.log(`저장된 ID: ${result.persistence.savedIds.join(', ')}`);
  }
}
```

### 방법 2: 분리 호출

```typescript
import {
  runColdStartPipeline,
  saveRecommendationsToMasterContent
} from '@/lib/domains/plan/llm/actions/coldStart';

// 1. 파이프라인 실행
const result = await runColdStartPipeline({
  subjectCategory: '수학',
  subject: '미적분',
  contentType: 'book',
});

// 2. 결과 저장 (선택적)
if (result.success) {
  const saveResult = await saveRecommendationsToMasterContent(
    result.recommendations,
    {
      tenantId: null,  // 공유 카탈로그
      subjectCategory: '수학',
      subject: '미적분',
      difficultyLevel: '개념',
    }
  );

  console.log(`새로 저장: ${saveResult.savedItems.filter(i => i.isNew).length}개`);
  console.log(`중복 스킵: ${saveResult.skippedDuplicates}개`);
}
```

---

## Export 구조

```typescript
// lib/domains/plan/llm/actions/coldStart/index.ts에서 export

// 메인 저장 함수
export { saveRecommendationsToMasterContent } from "./persistence";

// 타입
export type {
  SaveRecommendationOptions,
  SavedContentItem,
  SaveRecommendationsResult,
  DuplicateCheckResult,
} from "./persistence";

// 고급 사용자용
export {
  mapToBookInsert,
  mapToLectureInsert,
  checkBookDuplicate,
  checkLectureDuplicate,
} from "./persistence";
```

---

## 검증 결과

- ✅ ESLint 통과
- ✅ TypeScript 빌드 성공 (`pnpm build`)
- ✅ 테스트 67개 통과

### 테스트 커버리지

| 파일 | 테스트 수 | 설명 |
|------|----------|------|
| `persistence/mappers.test.ts` | 23 | `mapToBookInsert`, `mapToLectureInsert` 변환 |
| `persistence/duplicateCheck.test.ts` | 14 | 중복 검사 로직 (Supabase Mock) |
| `persistence/saveRecommendations.test.ts` | 13 | 전체 저장 로직 |
| `pipeline-persistence.test.ts` | 17 | 파이프라인 + 저장 통합 |

### 테스트 실행 방법

```bash
# persistence 모듈만 테스트
pnpm test lib/domains/plan/llm/actions/coldStart/__tests__/persistence/

# 파이프라인 저장 통합 테스트
pnpm test lib/domains/plan/llm/actions/coldStart/__tests__/pipeline-persistence.test.ts

# 전체 coldStart 테스트 (172개)
pnpm test lib/domains/plan/llm/actions/coldStart/
```

---

## 파이프라인 통합 타입

### PersistenceStats (types.ts에 추가)

```typescript
interface PersistenceStats {
  newlySaved: number;          // 새로 저장된 콘텐츠 수
  duplicatesSkipped: number;   // 중복으로 스킵된 수
  savedIds: string[];          // 저장된 콘텐츠 ID 목록
  errors: Array<{ title: string; error: string }>;
}
```

### ColdStartPipelineResult (확장)

```typescript
type ColdStartPipelineResult =
  | {
      success: true;
      recommendations: RecommendationItem[];
      stats: { ... };
      persistence?: PersistenceStats;  // saveToDb 옵션 사용 시
    }
  | {
      success: false;
      error: string;
      failedAt: "validation" | "query" | "search" | "parse" | "rank" | "persistence";
    };
```

### ColdStartPipelineOptions (확장)

```typescript
interface ColdStartPipelineOptions {
  preferences?: UserPreferences;
  useMock?: boolean;
  saveToDb?: boolean;      // DB 저장 여부 (기본: false)
  tenantId?: string | null; // 테넌트 ID (null = 공유 카탈로그)
}
```

---

## 향후 확장 가능성

1. **배치 저장**: 현재 개별 insert → bulk insert 최적화
2. **캐시 레이어**: 저장된 데이터 기반 추천 캐시
3. **통계 수집**: 콜드 스타트 추천 성공률/활용률 추적
4. **UI 연동**: `ContentRecommendationWizard` 컴포넌트에서 saveToDb 옵션 사용

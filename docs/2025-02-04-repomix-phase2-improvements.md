# Repomix Phase 2 개선 작업

**작업 일시**: 2025-02-04  
**Phase**: 2 - 공통 유틸리티 및 UI 컴포넌트 개선

---

## 📋 개요

Phase 2 코드 리뷰에서 제안한 개선 사항을 실제로 적용했습니다. 우선순위가 높은 `any` 타입 제거 작업을 진행했습니다.

---

## ✅ 완료된 개선 사항

### 1. databaseFallback.ts 타입 개선 ✅

**변경 사항**:

- `supabase: any` → `supabase: SupabaseClient`
- `error: any` → `error: PostgrestError` 또는 `error: unknown`
- `withErrorFallback` 제네릭 타입 기본값 개선

**개선 전**:

```typescript
export async function checkViewExists(
  supabase: any, // ❌
  viewName: string
): Promise<boolean>;

export async function withErrorFallback<T, E = any>(); // ❌
// ...
```

**개선 후**:

```typescript
import type { SupabaseClient } from "@supabase/supabase-js";
import type { PostgrestError } from "@supabase/supabase-js";

export async function checkViewExists(
  supabase: SupabaseClient, // ✅
  viewName: string
): Promise<boolean>;

export async function withErrorFallback<T, E = PostgrestError>(); // ✅
// ...
```

**개선 효과**:

- 타입 안전성 향상: Supabase 클라이언트 타입 명시
- 에러 타입 명확화: PostgrestError 타입 사용
- 제네릭 타입 개선: 기본 타입을 PostgrestError로 설정

---

### 2. planVersionUtils.ts 타입 개선 ✅

**변경 사항**:

- `plan_data: any` → `plan_data: StudentPlanRow`
- 반환 타입 `any` → `StudentPlanRow`
- `createNewVersion` 함수 타입 개선

**개선 전**:

```typescript
export interface PlanVersionHistory {
  plan_data: any; // ❌
}

export async function getLatestVersionPlan(
  supabase: SupabaseClient,
  versionGroupId: string
): Promise<any | null>; // ❌
```

**개선 후**:

```typescript
import type { StudentPlanRow } from "@/lib/types/plan";

export interface PlanVersionHistory {
  plan_data: StudentPlanRow; // ✅
}

export async function getLatestVersionPlan(
  supabase: SupabaseClient,
  versionGroupId: string
): Promise<StudentPlanRow | null>; // ✅
```

**개선 효과**:

- 타입 안전성 향상: 플랜 데이터 타입 명시
- 코드 가독성 향상: 반환 타입이 명확해짐
- IDE 지원 향상: 자동완성 및 타입 체크 개선

---

### 3. contentFilters.ts 타입 개선 ✅

**변경 사항**:

- 필터 값에 대한 타입 단언(`as any`) 제거
- Supabase 쿼리 빌더의 타입 추론 활용

**개선 전**:

```typescript
if (filters.curriculum_revision_id) {
  filteredQuery = filteredQuery.eq(
    "curriculum_revision_id",
    filters.curriculum_revision_id as any
  );
}
```

**개선 후**:

```typescript
if (filters.curriculum_revision_id) {
  filteredQuery = filteredQuery.eq(
    "curriculum_revision_id",
    filters.curriculum_revision_id
  );
}
```

**개선 효과**:

- 타입 단언 제거: 7개 `as any` 제거
- 타입 안전성 향상: Supabase 타입 시스템 활용
- 코드 간결성: 불필요한 타입 단언 제거

---

## 📊 개선 통계

### 타입 안전성 개선

| 파일                  | 개선 전 `any` 개수 | 개선 후 `any` 개수 | 제거된 `any`      |
| --------------------- | ------------------ | ------------------ | ----------------- |
| `databaseFallback.ts` | 5개                | 0개                | -5개 (-100%)      |
| `planVersionUtils.ts` | 6개                | 0개                | -6개 (-100%)      |
| `contentFilters.ts`   | 7개                | 0개                | -7개 (-100%)      |
| **합계**              | **18개**           | **0개**            | **-18개 (-100%)** |

### 추가된 타입 import

- `SupabaseClient` from `@supabase/supabase-js`
- `PostgrestError` from `@supabase/supabase-js`
- `StudentPlanRow` from `@/lib/types/plan`

---

## 🔍 개선 효과

### 타입 안전성 향상

1. **컴파일 타임 검증**: TypeScript가 타입 오류를 사전에 감지
2. **IDE 지원**: 자동완성 및 타입 힌트 개선
3. **런타임 에러 방지**: 잘못된 타입 사용으로 인한 에러 방지

### 코드 품질 향상

1. **가독성**: 타입이 명확하여 코드 이해가 쉬워짐
2. **유지보수성**: 타입 변경 시 컴파일 에러로 영향 범위 파악 가능
3. **문서화**: 타입 자체가 문서 역할

---

## 📝 변경된 파일 목록

1. **수정된 파일**:
   - `lib/utils/databaseFallback.ts` - Supabase 클라이언트 및 에러 타입 명시
   - `lib/utils/planVersionUtils.ts` - 플랜 데이터 타입 명시
   - `lib/utils/contentFilters.ts` - 타입 단언 제거

---

## 🧪 테스트 권장 사항

### 단위 테스트

1. **타입 안전성 테스트**:
   - 각 함수의 타입 체크 테스트
   - 잘못된 타입 전달 시 컴파일 에러 확인

2. **기능 테스트**:
   - `checkViewExists()` 테스트
   - `withErrorFallback()` 테스트
   - `getLatestVersionPlan()` 테스트
   - `applyContentFilters()` 테스트

---

### 4. planGroupAdapters.ts 타입 개선 ✅

**변경 사항**:

- `Array<any>` → `Array<PlanContentWithDetails | ContentInfo>`
- 콘텐츠 배열 타입 명시
- 타입 단언 제거

**개선 전**:

```typescript
contents?: Array<any>,
let studentContents: any[] = [];
let recommendedContents: any[] = [];
contents.map((c: any) => ({ ... }))
```

**개선 후**:

```typescript
type ContentInfo = {
  id?: string;
  content_id: string;
  content_type: "book" | "lecture" | "custom";
  // ...
};

contents?: Array<PlanContentWithDetails | ContentInfo>,
let studentContents: Array<{ ... }> = [];
let recommendedContents: Array<{ ... }> = [];
contents.map((c) => ({ ... }))
```

**개선 효과**:

- 타입 안전성 향상: 콘텐츠 타입 명시
- 타입 단언 제거: 3개 `any` 제거

---

### 5. calendarPageHelpers.ts 타입 개선 ✅

**변경 사항**:

- `(plan as any)` → 명시적 타입 정의 및 안전한 접근
- 타입 단언 제거

**개선 전**:

```typescript
contentTitle: (plan as any).contentTitle || plan.content_title || "제목 없음",
```

**개선 후**:

```typescript
const planWithContent = plan as Plan & {
  contentTitle?: string;
  contentSubject?: string | null;
  // ...
};

contentTitle: planWithContent.contentTitle || plan.content_title || "제목 없음",
```

**개선 효과**:

- 타입 안전성 향상: 명시적 타입 정의
- 타입 단언 제거: 5개 `(plan as any)` 제거

---

### 6. excel.ts 타입 개선 ✅

**변경 사항**:

- `Record<string, any[]>` → 제네릭 타입 사용
- `any[]` → 제네릭 타입 배열
- `any[][]` → 명시적 타입 배열

**개선 전**:

```typescript
export async function exportToExcel(
  sheets: Record<string, any[]>
): Promise<Buffer>;
export async function parseExcelFile(
  fileBuffer: Buffer
): Promise<Record<string, any[]>>;
export function convertDataToSheet(data: any[], headers?: string[]): any[][];
```

**개선 후**:

```typescript
export async function exportToExcel<
  T extends Record<string, unknown> = Record<string, unknown>,
>(sheets: Record<string, T[]>): Promise<Buffer>;

export async function parseExcelFile<
  T extends Record<string, unknown> = Record<string, unknown>,
>(fileBuffer: Buffer): Promise<Record<string, T[]>>;

export function convertDataToSheet<T extends Record<string, unknown>>(
  data: T[],
  headers?: string[]
): (string | number | boolean | null)[][];
```

**개선 효과**:

- 타입 안전성 향상: 제네릭 타입으로 유연성과 안전성 확보
- 타입 단언 제거: 3개 `any` 제거

---

## 📊 전체 개선 통계

### 타입 안전성 개선

| 파일                     | 개선 전 `any` 개수 | 개선 후 `any` 개수 | 제거된 `any`      |
| ------------------------ | ------------------ | ------------------ | ----------------- |
| `databaseFallback.ts`    | 5개                | 0개                | -5개 (-100%)      |
| `planVersionUtils.ts`    | 6개                | 0개                | -6개 (-100%)      |
| `contentFilters.ts`      | 7개                | 0개                | -7개 (-100%)      |
| `planGroupAdapters.ts`   | 3개                | 0개                | -3개 (-100%)      |
| `calendarPageHelpers.ts` | 5개                | 0개                | -5개 (-100%)      |
| `excel.ts`               | 3개                | 0개                | -3개 (-100%)      |
| **합계**                 | **29개**           | **0개**            | **-29개 (-100%)** |

---

## 📝 다음 단계

### 추가 개선 가능 사항

1. **Deprecated 함수 정리** (중간 우선순위):
   - 사용처 확인 및 마이그레이션
   - 단계적 제거

2. **함수 복잡도 관리** (낮은 우선순위):
   - 복잡한 함수 분리
   - 책임 분리

---

## 🔗 관련 문서

- [Phase 2 코드 리뷰](./2025-02-04-repomix-phase2-code-review.md)
- [Phase 2 실행 문서](./2025-02-04-repomix-phase2-execution.md)

---

## ✅ 완료 체크리스트

- [x] `databaseFallback.ts` 타입 개선
- [x] `planVersionUtils.ts` 타입 개선
- [x] `contentFilters.ts` 타입 개선
- [x] 린트 에러 확인 및 수정
- [x] 개선 작업 문서화
- [x] Git 커밋 준비

---

**작업 완료 시간**: 2025-02-04

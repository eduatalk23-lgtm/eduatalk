# getWeakSubjects.test.ts 수정 진행 상황

**작업 일시**: 2025-02-05  
**상태**: 🔄 진행 중

---

## 📋 문제 상황

`getWeakSubjects.test.ts`에서 6개의 테스트가 실패하고 있습니다.

### 실패하는 테스트들

1. ✅ "플랜 ID를 통해 콘텐츠 정보를 올바르게 매핑해야 함" - **통과**
2. ❌ "직접 세션의 content_type/content_id를 통해 과목을 매핑해야 함"
3. ❌ "같은 과목의 여러 세션을 합산해야 함"
4. ❌ "risk_score >= 50인 과목만 취약 과목으로 분류해야 함"
5. ❌ "constants.ts의 RISK_SCORE_THRESHOLD 값을 사용해야 함"
6. ❌ "취약 과목 학습시간 비율을 올바르게 계산해야 함"
7. ❌ "세션에 duration_seconds가 없으면 무시해야 함"

---

## 🔍 원인 분석

### 1. `Promise.all` 병렬 실행과 모킹 순서 불일치

실제 구현에서는 `Promise.all`로 books, lectures, custom을 병렬 조회하지만, 모킹에서는 순차적으로 처리됩니다.

```typescript
// 실제 구현 (lib/metrics/getWeakSubjects.ts)
const [booksResult, lecturesResult, customResult] = await Promise.all([
  bookIds.length > 0 ? safeQueryArray(...) : Promise.resolve([]),
  lectureIds.length > 0 ? safeQueryArray(...) : Promise.resolve([]),
  customIds.length > 0 ? safeQueryArray(...) : Promise.resolve([]),
]);
```

### 2. `planIds.size === 0`일 때 plans query 미호출

`planIds.size === 0`일 때는 plans query가 호출되지 않으므로, 모킹 순서가 달라집니다.

```typescript
// 실제 구현
if (planIds.size > 0) {
  const plans = await safeQueryArray(...); // 호출됨
}
// planIds.size === 0이면 호출되지 않음
```

### 3. 모킹 순서 문제

현재 모킹 순서:
1. plans query (planIds.size > 0일 때만)
2. books query (Promise.all 첫 번째)
3. lectures query (Promise.all 두 번째)
4. custom query (Promise.all 세 번째)
5. analysis query (항상)

하지만 `Promise.all`은 병렬로 실행되므로, 실제 호출 순서가 다를 수 있습니다.

---

## 🔧 수정 사항

### 1. `safeQueryArray` import 수정

```typescript
// 수정 전
const { safeQueryArray } = await import("@/lib/supabase/safeQuery");

// 수정 후
import { safeQueryArray } from "@/lib/supabase/safeQuery";
```

### 2. 모킹 순서 주석 추가

각 테스트 케이스에 모킹 순서에 대한 주석을 추가했습니다.

---

## 📊 현재 테스트 결과

- **전체 테스트**: 135개
- **통과**: 126개
- **실패**: 9개
- **통과율**: 93.3%

---

## 🎯 다음 단계

1. `Promise.all`의 병렬 실행을 고려한 모킹 전략 재검토
2. 실제 호출 순서를 추적하여 모킹 순서 정확히 맞추기
3. `mockImplementation`을 사용하여 동적 모킹 구현 고려

---

**작업 완료 시간**: 2025-02-05 19:18


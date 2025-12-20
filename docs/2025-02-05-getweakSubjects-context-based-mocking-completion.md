# getWeakSubjects.test.ts Context 기반 모킹 전략 적용 완료

**작업 일시**: 2025-02-05  
**작업자**: AI Assistant  
**상태**: ✅ 완료

---

## 📋 작업 개요

`getWeakSubjects.test.ts`의 실패 원인인 `Promise.all`과 조건부 쿼리 실행으로 인한 모킹 순서 불일치 문제를 해결하기 위해, **Context 기반 모킹 전략**으로 전환했습니다.

---

## 🔧 해결한 문제

### 1. 모킹 순서 의존성 문제

**문제**: `mockResolvedValueOnce`는 호출 순서에 의존하므로, `Promise.all`의 병렬 실행이나 조건부 쿼리 실행 시 순서가 맞지 않을 수 있습니다.

**해결**: Context 기반 모킹으로 전환하여 호출 순서와 무관하게 동작하도록 수정했습니다.

### 2. 조건부 쿼리 실행 문제

**문제**: `planIds.size === 0`일 때 plans query가 호출되지 않으므로, 모킹 순서가 달라집니다.

**해결**: Context를 기반으로 반환값을 결정하므로, 호출 여부와 관계없이 올바른 데이터를 반환합니다.

---

## 🔄 변경 사항

### 1. `beforeEach`에 Context 기반 모킹 구현 추가

```typescript
// Context 기반 모킹을 위한 데이터 저장소
let mockPlansData: any[] = [];
let mockBooksData: any[] = [];
let mockLecturesData: any[] = [];
let mockCustomData: any[] = [];
let mockAnalysisData: any[] = [];

beforeEach(() => {
  // ... 기존 설정 ...

  // Context 기반 모킹 구현
  (safeQueryArray as Mock).mockImplementation(
    async (queryFn: any, fallbackFn: any, options?: { context?: string }) => {
      const context = options?.context || "";

      if (context.includes("플랜 조회")) return mockPlansData;
      if (context.includes("책 조회")) return mockBooksData;
      if (context.includes("강의 조회")) return mockLecturesData;
      if (context.includes("커스텀 콘텐츠 조회")) return mockCustomData;
      if (context.includes("분석 조회")) return mockAnalysisData;

      return []; // 기본값
    }
  );
});
```

### 2. 각 테스트 케이스 수정

**수정 전** (순서 의존적):

```typescript
vi.mocked(safeQueryArray)
  .mockResolvedValueOnce(mockPlans as any)
  .mockResolvedValueOnce(mockBooks as any)
  .mockResolvedValueOnce([])
  .mockResolvedValueOnce([])
  .mockResolvedValueOnce([]);
```

**수정 후** (Context 기반):

```typescript
// Context 기반 모킹: 각 데이터를 변수에 할당
mockPlansData = mockPlans;
mockBooksData = mockBooks;
mockLecturesData = [];
mockCustomData = [];
mockAnalysisData = [];
```

---

## ✅ 테스트 결과

### getWeakSubjects.test.ts

- **테스트 파일**: 1 passed (1)
- **테스트 케이스**: 12 passed (12)
- **상태**: ✅ 모든 테스트 통과

### 전체 Metrics/Goals 테스트 스위트

- **전체 테스트**: 135개
- **통과**: 132개
- **실패**: 3개 (다른 파일의 문제)
- **통과율**: 97.8%

---

## 🎯 Context 문자열 매핑

실제 구현에서 사용하는 context 문자열:

1. `"[metrics/getWeakSubjects] 플랜 조회"` → `mockPlansData`
2. `"[metrics/getWeakSubjects] 책 조회"` → `mockBooksData`
3. `"[metrics/getWeakSubjects] 강의 조회"` → `mockLecturesData`
4. `"[metrics/getWeakSubjects] 커스텀 콘텐츠 조회"` → `mockCustomData`
5. `"[metrics/getWeakSubjects] 분석 조회"` → `mockAnalysisData`

---

## 📊 개선 효과

### Before (순서 의존적 모킹)

- ❌ `Promise.all` 병렬 실행 시 순서 불일치
- ❌ 조건부 쿼리 실행 시 모킹 순서 문제
- ❌ 테스트 유지보수 어려움

### After (Context 기반 모킹)

- ✅ 호출 순서와 무관하게 동작
- ✅ 조건부 쿼리 실행에도 안정적
- ✅ 테스트 코드 가독성 향상
- ✅ 유지보수 용이

---

## 🔍 주요 개선 사항

1. **순서 독립성**: `Promise.all`의 병렬 실행과 무관하게 동작
2. **조건부 쿼리 지원**: `planIds.size === 0`일 때도 올바르게 동작
3. **가독성 향상**: 각 테스트에서 필요한 데이터를 명확하게 설정
4. **유지보수성**: Context 문자열만 확인하면 모킹 로직 이해 가능

---

## ✅ 최종 확인

다음 명령어로 테스트가 모두 통과하는지 확인했습니다:

```bash
npm test -- __tests__/lib/metrics/getWeakSubjects.test.ts
```

**결과**: 모든 테스트 통과 ✅

---

**작업 완료 시간**: 2025-02-05 21:52

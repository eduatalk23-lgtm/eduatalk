# TypeScript 에러 수정: PlanGroupDetailView

**작성 일자**: 2025-02-01  
**작업 유형**: 버그 수정

---

## 🔍 문제 상황

`PlanGroupDetailView.tsx` 파일의 `React.memo` 비교 함수에서 TypeScript 타입 에러가 발생했습니다.

### 에러 내용

```
error TS18048: 'prevProps.blockSets' is possibly 'undefined'.
error TS18048: 'nextProps.blockSets' is possibly 'undefined'.
error TS18048: 'prevProps.templateBlocks' is possibly 'undefined'.
error TS18048: 'nextProps.templateBlocks' is possibly 'undefined'.
```

### 발생 위치

```415:416:app/(student)/plan/group/[id]/_components/PlanGroupDetailView.tsx
prevProps.blockSets.length === nextProps.blockSets.length &&
prevProps.templateBlocks.length === nextProps.templateBlocks.length &&
```

---

## ✅ 해결 방법

`blockSets`와 `templateBlocks`가 `undefined`일 수 있으므로, nullish coalescing operator (`??`)를 사용하여 기본값을 제공하도록 수정했습니다.

### 수정 전

```typescript
prevProps.blockSets.length === nextProps.blockSets.length &&
prevProps.templateBlocks.length === nextProps.templateBlocks.length &&
```

### 수정 후

```typescript
(prevProps.blockSets ?? []).length === (nextProps.blockSets ?? []).length &&
(prevProps.templateBlocks ?? []).length === (nextProps.templateBlocks ?? []).length &&
```

---

## 📝 변경 사항

- **파일**: `app/(student)/plan/group/[id]/_components/PlanGroupDetailView.tsx`
- **라인**: 415-416
- **변경 내용**: Optional chaining과 nullish coalescing을 사용하여 타입 안전성 확보

---

## ✅ 검증

- TypeScript 컴파일 에러 해결 확인
- ESLint 에러 없음 확인
- 타입 안전성 보장

---

## 🎯 관련 이슈

- TypeScript strict mode 준수
- React.memo 비교 함수의 타입 안전성 개선


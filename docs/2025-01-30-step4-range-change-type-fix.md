# Step4RecommendedContents 타입 에러 수정

## 작업 일시
2025-01-30

## 문제 상황
`Step4RecommendedContents.tsx` 파일의 418번째 줄에서 TypeScript 타입 에러가 발생했습니다.

### 에러 내용
```
Type 'Dispatch<SetStateAction<{ start: string; end: string; } | null>>' is not assignable to type '(start: string, end: string) => void'.
```

### 원인
- `AddedContentsList` 컴포넌트의 `onRangeChange` prop은 `(start: string, end: string) => void` 타입을 기대
- 하지만 `setEditingRange`를 직접 전달하여 타입 불일치 발생
- `setEditingRange`는 `Dispatch<SetStateAction<{ start: string; end: string; } | null>>` 타입

## 해결 방법
`setEditingRange`를 직접 전달하는 대신, 래퍼 함수를 만들어서 전달하도록 수정했습니다.

### 수정 전
```typescript
onRangeChange={setEditingRange}
```

### 수정 후
```typescript
onRangeChange={(start, end) => setEditingRange({ start, end })}
```

## 수정 파일
- `app/(student)/plan/new-group/_components/Step4RecommendedContents.tsx`

## 검증
- TypeScript 타입 에러 해결 확인
- 린터 에러 없음 확인


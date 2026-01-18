# ExclusionsPanel 파싱 오류 수정

## 날짜
2025-02-02

## 문제
`ExclusionsPanel.tsx` 파일에서 ECMAScript 파싱 오류가 발생했습니다.

### 에러 메시지
```
Parsing ecmascript source code failed
Expected '</', got ';'
```

### 원인
461번째 줄에 잘못된 구문 `})()}`가 있었습니다. `map` 함수의 결과는 배열이므로 `()()`로 호출할 수 없습니다.

### 문제 코드
```tsx
{generateDateRange(periodStart, periodEnd).map((date) => {
  // ...
  return (
    <button>...</button>
  );
});
})()}  // ❌ 잘못된 구문
```

## 해결 방법
`map` 함수의 올바른 닫는 구문으로 수정했습니다.

### 변경 전
```tsx
{generateDateRange(periodStart, periodEnd).map((date) => {
  // ...
  return (
    <button>...</button>
  );
});
})()}  // ❌ 잘못된 구문
```

### 변경 후
```tsx
{generateDateRange(periodStart, periodEnd).map((date) => {
  // ...
  return (
    <button>...</button>
  );
})}  // ✅ 올바른 구문
```

## 수정된 파일
- `app/(student)/plan/new-group/_components/_features/scheduling/components/ExclusionsPanel.tsx`

## 결과
- ✅ 파싱 오류 해결
- ✅ 빌드 성공 (해당 파일 기준)
- ✅ 린터 오류 없음


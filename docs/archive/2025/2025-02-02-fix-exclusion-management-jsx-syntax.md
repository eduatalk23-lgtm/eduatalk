# ExclusionManagement JSX 구문 오류 수정

## 날짜
2025-02-02

## 문제
빌드 시 JSX 구문 파싱 에러 발생:
- 파일: `app/(student)/blocks/_components/ExclusionManagement.tsx`
- 라인: 416
- 에러: "Unexpected token. Did you mean `{'}'}` or `&rbrace;`?"

## 원인
347-369 라인에서 중복된 JSX 구조:
- 348라인: `<div className="flex flex-col gap-1">` 열림
- 349-351: label 태그
- 352라인: 또 다른 `<div className="flex flex-col gap-1">` 중복 열림
- 353-355: 또 다른 label 태그 중복
- 첫 번째 div가 닫히지 않아 JSX 구문 오류 발생

## 수정 내용
중복된 div와 label 구조를 제거하고 올바른 구조로 수정:

```tsx
// 수정 전 (348-369 라인)
<div className="flex flex-col gap-1">
  <label>유형 *</label>
<div className="flex flex-col gap-1">  // 중복!
  <label>유형 *</label>  // 중복!
  <select>...</select>
</div>

// 수정 후
<div className="flex flex-col gap-1">
  <label>유형 *</label>
  <select>...</select>
</div>
```

## 결과
- JSX 구문 오류 해결
- 빌드 성공
- 린터 에러 없음


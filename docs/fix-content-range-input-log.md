# ContentRangeInput 상세정보 없음 로그 수정

## 문제 상황

`ContentRangeInput` 컴포넌트에서 "상세정보 없음 (정상)" 로그가 콘솔에 나타나는 문제가 발생했습니다.

### 증상
```
[ContentRangeInput] 상세정보 없음 (정상): Object
```

## 원인 분석

1. **불필요한 로그 출력**
   - `console.warn`으로 정상적인 상황을 로깅
   - 프로덕션 환경에서도 로그가 출력되어 콘솔이 지저분해짐
   - 사용자에게 혼란을 줄 수 있음

2. **일관성 부족**
   - 여러 컴포넌트에서 동일한 로그를 `console.warn`으로 출력
   - 로그 레벨이 적절하지 않음

## 수정 내용

### 1. ContentRangeInput 로그 레벨 변경

개발 환경에서만 `console.debug`로 출력하도록 변경:

```typescript
if (details.length === 0) {
  // 상세정보가 없는 경우 로깅 (개발 환경에서만)
  if (process.env.NODE_ENV === "development") {
    console.debug("[ContentRangeInput] 상세정보 없음 (정상):", {
      // ...
    });
  }
  // ...
}
```

### 2. 다른 컴포넌트도 일관성 있게 수정

- `RangeSettingModal`: `console.warn` → 개발 환경에서만 `console.debug`
- `useRangeEditor`: `console.warn` → 개발 환경에서만 `console.debug`
- `AddedContentsList`: `console.warn` → 개발 환경에서만 `console.debug`

## 변경 사항

- 프로덕션 환경에서 로그가 출력되지 않음
- 개발 환경에서만 디버깅을 위한 로그 출력
- 로그 레벨을 `warn`에서 `debug`로 변경하여 중요도 낮춤
- 일관된 로그 처리 방식 적용

## 테스트 방법

1. 개발 환경에서 콘솔 확인
   - 개발 모드에서 "상세정보 없음" 로그가 `console.debug`로 출력되는지 확인
2. 프로덕션 빌드 확인
   - 프로덕션 빌드에서 로그가 출력되지 않는지 확인

## 예상 결과

- 프로덕션 환경에서 불필요한 로그가 출력되지 않음
- 개발 환경에서만 디버깅 정보 확인 가능
- 콘솔이 깔끔해짐

## 관련 파일

- `app/(student)/plan/new-group/_components/_shared/ContentRangeInput.tsx`
- `app/(student)/plan/new-group/_components/_shared/RangeSettingModal.tsx`
- `app/(student)/plan/new-group/_components/Step4RecommendedContents/hooks/useRangeEditor.ts`
- `app/(student)/plan/new-group/_components/Step4RecommendedContents/components/AddedContentsList.tsx`


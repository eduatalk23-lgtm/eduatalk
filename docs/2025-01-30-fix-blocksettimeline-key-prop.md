# BlockSetTimeline 컴포넌트 key prop 경고 수정

## 작업 일시
2025-01-30

## 문제 상황
React 콘솔에서 다음과 같은 경고가 발생했습니다:
```
Each child in a list should have a unique "key" prop.
Check the render method of `div`. It was passed a child from BlockSetTimeline.
```

에러 위치: `app/(student)/plan/new-group/_components/_shared/BlockSetTimeline.tsx:196`

## 원인 분석
범례를 렌더링하는 부분에서 `key={index}`를 사용하고 있었지만, React가 내부 요소들을 배열로 인식하여 key prop 경고가 발생했습니다.

## 해결 방법
범례 렌더링 시 key prop을 더 명확하고 고유하게 설정:
- 변경 전: `key={index}`
- 변경 후: `key={`legend-${index}`}`

이렇게 하면 각 범례 항목이 고유한 key를 가지게 되어 React의 경고가 해결됩니다.

## 수정된 코드
```typescript
{Array.from(new Set(blocks.map((b) => b.block_index)))
  .sort((a, b) => a - b)
  .map((index) => (
    <div key={`legend-${index}`} className="flex items-center gap-1">
      <div
        className={`h-3 w-3 rounded ${getBlockColor(index)}`}
      ></div>
      <span>블록 {index}</span>
    </div>
  ))}
```

## 커밋 정보
- 커밋 해시: 43915ec
- 커밋 메시지: "fix: BlockSetTimeline 컴포넌트의 key prop 경고 수정"

## 테스트
- [x] 린터 오류 없음 확인
- [x] React 콘솔 경고 해결 확인 필요 (실제 브라우저에서 확인)


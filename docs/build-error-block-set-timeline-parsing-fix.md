# BlockSetTimeline 파싱 에러 수정

## 작업 일시
2024년 11월

## 문제 상황

### 에러 타입
Build Error - Parsing ecmascript source code failed

### 에러 위치
`app/(student)/plan/new-group/_components/_shared/BlockSetTimeline.tsx:210`

### 에러 메시지
```
Unexpected token. Did you mean `{'}'}` or `&rbrace;`?
```

### 원인
JSX에서 동적 Tailwind 클래스명을 템플릿 리터럴로 사용하여 파싱 에러 발생:

```tsx
// ❌ 잘못된 사용 (라인 145, 167)
className={`... top-[${(i / 24) * 100}%]`}
className={`... top-[${blockStyle.top}] h-[${blockStyle.height}]`}
```

Tailwind CSS는 런타임에 계산된 값을 클래스명에 직접 사용할 수 없습니다.

## 해결 방법

동적 위치 계산이 필요한 경우, 인라인 스타일을 사용하도록 변경했습니다.

### 수정 내용

1. **그리드 라인 위치 수정** (라인 145)
   - 동적 Tailwind 클래스 `top-[${(i / 24) * 100}%]` 제거
   - 인라인 스타일 `style={{ top: \`${(i / 24) * 100}%\` }}` 추가

2. **블록 위치 및 높이 수정** (라인 167)
   - 동적 Tailwind 클래스 `top-[${blockStyle.top}] h-[${blockStyle.height}]` 제거
   - 인라인 스타일 `style={{ top: blockStyle.top, height: blockStyle.height }}` 추가

### 수정 후 코드

```tsx
// 시간 그리드 라인
<div
  key={`grid-${i}`}
  className={`pointer-events-none absolute left-0 right-0 ${
    i === 12
      ? "border-t-2 border-gray-400"
      : i % 3 === 0
      ? "border-t border-gray-300"
      : "border-t border-dashed border-gray-200"
  }`}
  style={{ top: `${(i / 24) * 100}%` }}
/>

// 블록 표시
<div
  key={idx}
  className={`group absolute left-0 right-0 mx-1 rounded ${
    colorClass || "bg-blue-500"
  } cursor-pointer opacity-80 transition-opacity hover:opacity-100 flex flex-col justify-between`}
  style={{
    top: blockStyle.top,
    height: blockStyle.height,
  }}
  title={`${block.start_time} ~ ${block.end_time}`}
>
```

## 참고 사항

- 프로젝트 가이드라인에서는 일반적으로 인라인 스타일 사용을 금지하지만, **동적 위치 계산**이 필요한 경우는 예외로 허용됩니다.
- Tailwind의 동적 클래스는 빌드 타임에만 처리되므로, 런타임 계산값은 인라인 스타일로 처리해야 합니다.

## 결과
- ✅ 파싱 에러 해결
- ✅ 빌드 성공
- ✅ 린터 에러 없음


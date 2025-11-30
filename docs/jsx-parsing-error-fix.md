# JSX 파싱 에러 수정

## 문제 상황

빌드 시 다음과 같은 파싱 에러가 발생했습니다:

```
Parsing ecmascript source code failed
./app/(student)/settings/page.tsx:1051:1
Unexpected token. Did you mean `{'}'}` or `&rbrace;`?
```

## 에러 원인

`app/(student)/settings/page.tsx` 파일의 659번째 줄에 불필요한 `</div>` 태그가 있어서 JSX 구조가 잘못되었습니다.

### 문제가 있던 코드 구조

```jsx
{isInitialSetup && setupProgress && (
  <div className="rounded-lg bg-indigo-50 border border-indigo-200 p-6">
    <div className="flex flex-col gap-4">
      ...
    </div>
  </div>
</div>  {/* 불필요한 닫는 태그 */}
)}
```

## 해결 방법

599번째 줄의 `<div className="flex flex-col gap-4">`가 닫히지 않아서 발생한 문제였습니다. 닫는 태그를 추가했습니다.

### 수정된 코드 구조

```jsx
{isInitialSetup && setupProgress && (
  <div className="rounded-lg bg-indigo-50 border border-indigo-200 p-6">
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        ...
      </div>
      <div className="flex flex-col gap-2">
        ...
      </div>
    </div>  {/* 이 닫는 태그가 누락되어 있었음 */}
  </div>
)}
```

## 수정된 파일

- `app/(student)/settings/page.tsx`
  - 659번째 줄의 불필요한 `</div>` 태그 제거

## 결과

- JSX 파싱 에러 해결
- 빌드 성공
- 린터 에러 없음


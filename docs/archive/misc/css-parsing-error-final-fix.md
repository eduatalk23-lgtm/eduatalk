# CSS 파싱 에러 최종 수정 가이드

## 문제

Tailwind CSS가 문서 파일(`docs/`)을 스캔하면서 와일드카드 예시를 CSS 클래스로 해석하려고 시도하여 파싱 에러가 발생합니다.

## 해결 방법

### 1. tailwind.config.js 설정 (완료)

`tailwind.config.js` 파일을 생성하여 `docs/` 폴더를 스캔에서 제외했습니다:

```javascript
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./lib/**/*.{js,ts,jsx,tsx}",
    // docs 폴더는 제외
  ],
};
```

### 2. 문서 파일 수정 (진행 중)

문서 파일에서 와일드카드를 다음과 같이 처리:

#### 방법 A: 코드 블록으로 감싸기
```markdown
예시: `border-[rgb(var(--color-secondary-200))]`
```

#### 방법 B: 실제 값으로 변경
```markdown
예시: `border-[rgb(var(--color-secondary-200))]` 또는 `border-[rgb(var(--color-secondary-300))]`
```

#### 방법 C: 와일드카드 사용 (작동하지 않음)
```markdown
예시: 와일드카드(별표)를 사용한 패턴은 Tailwind CSS에서 파싱 에러를 발생시킵니다.
실제 색상 값(100, 200, 300 등)을 명시적으로 사용해야 합니다.
```

### 3. 문제가 되는 파일들

다음 파일들에서 와일드카드를 제거하거나 코드 블록으로 감싸야 합니다:

- `docs/css-parsing-error-fix.md`
- `docs/css-parsing-error-fix-complete.md`
- `docs/design-system-ui-improvement-phase4.md`

## 참고

Tailwind CSS 4에서는 `tailwind.config.js`가 제대로 작동하지 않을 수 있습니다. 
이 경우 문서 파일에서 와일드카드를 완전히 제거하는 것이 가장 확실한 방법입니다.


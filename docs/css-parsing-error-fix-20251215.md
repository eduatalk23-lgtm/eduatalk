# CSS 파싱 에러 수정 (2025-12-15)

## 문제 상황

Next.js 개발 서버 실행 중 CSS 파싱 에러 발생:

```
⨯ ./app/globals.css:1633:45
Parsing CSS source code failed
  .border-\[rgb\(var\(--color-secondary-\&\#42\;\)\)\] {
>   border-color: rgb(var(--color-secondary-&#42;));
Unexpected token Delim('&')
```

## 원인 분석

1. **Tailwind CSS 빌드 캐시 문제**: `.next` 폴더에 잘못된 CSS가 캐시되어 있었음
2. **문서 파일의 HTML 엔티티**: `docs/css-parsing-error-final-fix.md` 파일에 `&#42;` (별표의 HTML 엔티티)가 포함되어 있어 Tailwind가 이를 CSS 클래스로 해석하려고 시도

## 해결 방법

### 1. 빌드 캐시 삭제
```bash
rm -rf .next
```

### 2. 문서 파일 수정
`docs/css-parsing-error-final-fix.md` 파일에서:
- `&#42;` → `*`로 변경 (HTML 엔티티 제거)
- 와일드카드 패턴을 완전히 제거하고 설명으로 대체

### 3. Tailwind CSS 4 @source 지시어 추가 (최종 해결)
`app/globals.css` 파일에 `@source` 지시어를 추가하여 스캔 경로를 명시적으로 지정:

```css
@import "tailwindcss";

/* Tailwind CSS 4 Content Paths - docs 폴더 제외 */
@source "../app/**/*.{js,ts,jsx,tsx,mdx}";
@source "../components/**/*.{js,ts,jsx,tsx}";
@source "../lib/**/*.{js,ts,jsx,tsx}";
```

이렇게 하면 Tailwind CSS 4가 `docs` 폴더를 스캔하지 않습니다.

## 결과

- `.next` 캐시 삭제로 빌드 산출물 초기화
- 문서 파일의 와일드카드 패턴 제거
- `@source` 지시어로 스캔 경로 명시적 지정 (docs 폴더 제외)

## 다음 단계

개발 서버를 재시작하면 정상 작동합니다:
```bash
pnpm dev
```

## 참고

- **Tailwind CSS 4의 차이점**: 
  - `tailwind.config.js`의 `content` 설정이 제대로 작동하지 않을 수 있음
  - CSS 파일에서 `@source` 지시어를 사용하여 스캔 경로를 명시적으로 지정해야 함
- **문서 파일 주의사항**: 
  - CSS 클래스 예시를 포함할 때는 코드 블록으로 감싸거나 실제 값으로 변경
  - 와일드카드(`*`) 패턴은 Tailwind가 CSS 클래스로 해석하려고 시도하므로 사용 금지


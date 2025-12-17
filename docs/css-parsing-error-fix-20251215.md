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

## 결과

- `.next` 캐시 삭제로 빌드 산출물 초기화
- 문서 파일의 HTML 엔티티 제거로 Tailwind 스캔 오류 방지

## 다음 단계

개발 서버를 재시작하면 정상 작동합니다:
```bash
pnpm dev
```

## 참고

- Tailwind CSS 4에서는 `tailwind.config.js`의 `content` 설정이 제대로 작동하지 않을 수 있음
- 문서 파일에 CSS 클래스 예시를 포함할 때는 코드 블록으로 감싸거나 실제 값으로 변경하는 것이 안전함


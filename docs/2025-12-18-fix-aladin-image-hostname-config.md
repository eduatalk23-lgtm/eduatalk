# 알라딘 이미지 호스트네임 설정 추가

## 작업 일시
2025-12-18

## 문제 상황
Next.js Image 컴포넌트에서 `image.aladin.co.kr` 도메인의 이미지를 사용할 때 다음 에러가 발생했습니다:

```
Invalid src prop (https://image.aladin.co.kr/product/18705/1/cover500/k532635872_2.jpg) on `next/image`, hostname "image.aladin.co.kr" is not configured under images in your `next.config.js`
```

## 에러 발생 위치
- `app/(student)/contents/_components/ContentHeader.tsx:51`
- `app/(admin)/admin/master-books/[id]/page.tsx:35`

## 해결 방법
`next.config.ts`의 `images.remotePatterns`에 `image.aladin.co.kr` 도메인을 추가했습니다.

## 변경 사항

### `next.config.ts`
```typescript
remotePatterns: [
  // ... 기존 도메인들 ...
  {
    protocol: "https",
    hostname: "image.aladin.co.kr",
  },
]
```

## 결과
- 알라딘 도서 표지 이미지가 정상적으로 표시됩니다.
- Next.js Image 컴포넌트의 최적화 기능을 활용할 수 있습니다.

## 참고
- Next.js Image 컴포넌트는 보안을 위해 외부 이미지 도메인을 명시적으로 허용해야 합니다.
- `remotePatterns`를 사용하면 프로토콜과 호스트네임을 세밀하게 제어할 수 있습니다.


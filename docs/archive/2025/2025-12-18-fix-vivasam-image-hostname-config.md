# Next.js Image 호스트명 설정 수정 - e.vivasam.com 추가

## 작업 개요

Next.js Image 컴포넌트에서 `e.vivasam.com` 도메인의 이미지를 사용할 때 발생하는 호스트명 미설정 에러를 해결했습니다.

## 에러 내용

### 에러 메시지
```
Invalid src prop (https://e.vivasam.com/vivasamfiledir/exhibition/textbook/DH1151.png) on `next/image`, hostname "e.vivasam.com" is not configured under images in your `next.config.js`
```

### 발생 위치
- `app/(student)/contents/_components/ContentHeader.tsx:51:13`
- `app/(admin)/admin/master-books/[id]/page.tsx:35:9`

## 해결 방법

`next.config.ts`의 `images.remotePatterns`에 `e.vivasam.com` 도메인을 추가했습니다.

### 변경 내용

```typescript
remotePatterns: [
  // ... 기존 도메인들
  {
    protocol: "https",
    hostname: "www.mirae-n.com",
  },
  {
    protocol: "https",
    hostname: "e.vivasam.com", // 추가
  },
],
```

## 영향 범위

- 교재 표지 이미지가 `e.vivasam.com` 도메인에서 제공되는 경우 정상적으로 표시됩니다.
- `ContentHeader` 컴포넌트를 사용하는 모든 페이지에서 해당 도메인의 이미지 사용이 가능합니다.

## 테스트 확인 사항

1. 교재 상세 페이지에서 `e.vivasam.com` 도메인의 이미지가 정상적으로 표시되는지 확인
2. 콘텐츠 헤더에서 외부 이미지가 정상적으로 로드되는지 확인
3. 개발 서버 재시작 후 에러가 발생하지 않는지 확인

## 참고

- Next.js 16.0.10 (Turbopack) 환경에서 테스트됨
- 기존에 설정된 다른 외부 이미지 도메인들과 동일한 방식으로 추가됨
- 보안을 위해 특정 호스트명만 허용하는 방식 유지

## 변경 파일

- `next.config.ts` - `e.vivasam.com` 도메인 추가


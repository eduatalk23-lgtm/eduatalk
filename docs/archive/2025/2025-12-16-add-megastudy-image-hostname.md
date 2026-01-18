# Next.js 이미지 호스트네임 추가: img.megastudy.net

## 작업 개요

Next.js Image 컴포넌트에서 `img.megastudy.net` 도메인의 이미지를 사용할 수 있도록 `next.config.ts`에 호스트네임을 추가했습니다.

## 문제 상황

Next.js Image 컴포넌트에서 외부 이미지 URL을 사용할 때 다음과 같은 에러가 발생했습니다:

```
Invalid src prop (http://img.megastudy.net/book/bookimg_23677_kmc.jpg) on `next/image`,
hostname "img.megastudy.net" is not configured under images in your `next.config.js`
```

## 해결 방법

`next.config.ts`의 `images.remotePatterns` 배열에 `img.megastudy.net` 호스트네임을 추가했습니다.

### 변경 내용

```typescript
remotePatterns: [
  {
    protocol: "https",
    hostname: "contents.kyobobook.co.kr",
  },
  {
    protocol: "https",
    hostname: "img.megastudy.net", // 추가됨
  },
  {
    protocol: "http",
    hostname: "img.megastudy.net", // http 프로토콜도 추가됨
  },
],
```

## 적용 사항

- ✅ `img.megastudy.net` 도메인에서 이미지 로드 가능 (http, https 모두 지원)
- ✅ Next.js Image 컴포넌트의 최적화 기능 활용 가능
- ✅ 보안 정책 준수 (명시적 도메인 허용)

## 참고 사항

- Next.js는 빌드/시작 시에만 이미지 설정을 읽으므로, 변경 후 개발 서버를 재시작해야 합니다.
- 프로덕션 환경에서도 동일하게 적용됩니다.
- 여러 megastudy 서브도메인을 사용하는 경우, 와일드카드 패턴(`**.megastudy.net`)을 사용할 수 있습니다.

## 커밋 정보

- 커밋 해시: `54bb48cb`
- 커밋 메시지: `feat: Add img.megastudy.net to Next.js image remotePatterns`
- 커밋 해시: `faff6cbb`
- 커밋 메시지: `fix: Add http protocol support for img.megastudy.net images`

## 추가 수정 사항

실제 이미지 URL이 `http://` 프로토콜을 사용하는 경우가 있어, `http` 프로토콜도 추가로 허용하도록 설정을 업데이트했습니다.

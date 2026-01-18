# PWA 구현 가이드

## 📋 개요

TimeLevelUp 프로젝트에 PWA(Progressive Web App) 기능을 추가했습니다. 사용자는 앱을 홈 화면에 추가하여 네이티브 앱처럼 사용할 수 있습니다.

## 🚀 구현된 기능

### 1. 기본 PWA 기능
- ✅ Service Worker 자동 설정
- ✅ Web App Manifest
- ✅ 오프라인 지원
- ✅ 캐싱 전략 (NetworkFirst)
- ✅ iOS Safari 호환

### 2. 설치 UI
- ✅ 자동 설치 배너 (`InstallPrompt`)
- ✅ 수동 설치 버튼 (`InstallButton`)
- ✅ iOS/Android 자동 감지
- ✅ 설치 완료 후 배너 자동 숨김

### 3. 오프라인 지원
- ✅ 오프라인 페이지 (`/offline`)
- ✅ 네트워크 상태 감지
- ✅ 자동 재연결 알림

## 📁 파일 구조

```
project/
├── next.config.ts              # PWA 설정
├── public/
│   ├── manifest.json           # Web App Manifest
│   └── icons/                  # PWA 아이콘 (생성 필요)
│       ├── icon-192x192.png
│       ├── icon-512x512.png
│       └── apple-touch-icon.png
├── app/
│   ├── layout.tsx              # PWA 메타태그 포함
│   └── offline/
│       └── page.tsx            # 오프라인 페이지
├── components/
│   └── ui/
│       ├── InstallPrompt.tsx  # 자동 설치 배너
│       └── InstallButton.tsx   # 수동 설치 버튼
└── lib/
    └── hooks/
        └── useInstallPrompt.ts # 설치 로직 훅
```

## ⚙️ 설정

### next.config.ts

```typescript
import withPWA from "next-pwa";

const pwaConfig = withPWA({
  dest: "public",
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === "development", // 개발 환경 비활성화
  buildExcludes: [/app-build-manifest\.json$/],
  runtimeCaching: [
    {
      urlPattern: /^https?.*/,
      handler: "NetworkFirst",
      options: {
        cacheName: "offlineCache",
        expiration: {
          maxEntries: 200,
        },
      },
    },
  ],
});
```

### 주요 설정 옵션

- `dest: "public"`: Service Worker 파일이 생성될 디렉토리
- `register: true`: 자동으로 Service Worker 등록
- `skipWaiting: true`: 새 버전 즉시 활성화
- `disable`: 개발 환경에서 비활성화 (핫 리로드 방지)
- `runtimeCaching`: 오프라인 캐싱 전략

## 🎨 컴포넌트 사용법

### InstallPrompt (자동 배너)

자동으로 표시되는 설치 배너입니다. `app/layout.tsx`에 이미 포함되어 있습니다.

```tsx
// app/layout.tsx에 이미 포함됨
<InstallPrompt />
```

**특징:**
- 설치 가능 시 자동 표시
- 한 번 닫으면 로컬 스토리지에 저장하여 다시 표시하지 않음
- iOS Safari는 공유 버튼 안내 메시지 표시

### InstallButton (수동 버튼)

원하는 위치에 수동으로 설치 버튼을 추가할 수 있습니다.

```tsx
import InstallButton from "@/components/ui/InstallButton";

export default function SettingsPage() {
  return (
    <div>
      <h1>설정</h1>
      <InstallButton variant="outline" size="md" />
    </div>
  );
}
```

**Props:**
- `variant`: "default" | "outline" | "ghost"
- `size`: "sm" | "md" | "lg"
- `className`: 추가 CSS 클래스
- `showIcon`: 아이콘 표시 여부 (기본: true)

### useInstallPrompt 훅

직접 설치 로직을 제어하고 싶을 때 사용합니다.

```tsx
import { useInstallPrompt } from "@/lib/hooks/useInstallPrompt";

export default function CustomInstallComponent() {
  const { isInstallable, isInstalled, isIOS, install } = useInstallPrompt();

  if (isInstalled) {
    return <p>이미 설치되었습니다!</p>;
  }

  return (
    <button onClick={install} disabled={!isInstallable}>
      {isIOS ? "iOS 설치 안내" : "앱 설치하기"}
    </button>
  );
}
```

**반환값:**
- `isInstallable`: 설치 가능 여부
- `isInstalled`: 이미 설치되었는지 여부
- `isIOS`: iOS 기기인지 여부
- `isStandalone`: Standalone 모드로 실행 중인지 여부
- `prompt`: 설치 프롬프트 함수 (null 가능)
- `install`: 설치 실행 함수

## 📱 iOS Safari 대응

iOS Safari는 `beforeinstallprompt` 이벤트를 지원하지 않습니다. 대신 공유 버튼을 통해 "홈 화면에 추가"를 사용해야 합니다.

### 자동 감지 및 안내

`InstallPrompt`와 `InstallButton`은 자동으로 iOS를 감지하고 적절한 안내 메시지를 표시합니다.

### 수동 설정 (필요 시)

`app/layout.tsx`의 메타태그에 이미 포함되어 있습니다:

```typescript
export const metadata: Metadata = {
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "TimeLevelUp",
  },
  icons: {
    apple: [
      { url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
};
```

## 🎯 아이콘 생성

### 필수 아이콘

다음 크기의 아이콘을 `public/icons/` 디렉토리에 생성해야 합니다:

- `icon-192x192.png` (필수)
- `icon-512x512.png` (필수)
- `apple-touch-icon.png` (iOS용, 180x180px)

전체 목록은 `public/icons/README.md`를 참고하세요.

### 생성 방법

1. **온라인 도구**: [PWA Asset Generator](https://www.pwabuilder.com/imageGenerator)
2. **Figma/Photoshop**: 512x512px 원본에서 각 크기로 export
3. **ImageMagick**: CLI로 일괄 생성

```bash
# 예시 (ImageMagick 사용)
convert icon-source.png -resize 192x192 public/icons/icon-192x192.png
convert icon-source.png -resize 512x512 public/icons/icon-512x512.png
convert icon-source.png -resize 180x180 public/icons/apple-touch-icon.png
```

## 🧪 테스트

### 개발 환경

개발 환경에서는 Service Worker가 비활성화됩니다 (`disable: true`). 프로덕션 빌드로 테스트해야 합니다.

```bash
# 프로덕션 빌드
npm run build
npm start

# 또는 Vercel 등에 배포하여 테스트
```

### 테스트 체크리스트

- [ ] `manifest.json`이 올바르게 로드되는가?
- [ ] Service Worker가 등록되는가? (Chrome DevTools > Application > Service Workers)
- [ ] 설치 배너가 표시되는가? (Android Chrome)
- [ ] iOS Safari에서 공유 버튼 안내가 표시되는가?
- [ ] 오프라인 모드에서 작동하는가?
- [ ] 아이콘이 올바르게 표시되는가?

### Chrome DevTools

1. **Application 탭**:
   - Manifest: `manifest.json` 확인
   - Service Workers: 등록 상태 확인
   - Cache Storage: 캐시된 리소스 확인

2. **Network 탭**:
   - "Offline" 체크박스로 오프라인 테스트
   - Service Worker가 요청을 가로채는지 확인

3. **Lighthouse**:
   - PWA 감사 실행
   - 설치 가능성, 오프라인 지원 등 확인

## 🐛 문제 해결

### Service Worker가 등록되지 않음

1. HTTPS 또는 localhost에서만 작동합니다
2. 개발 환경에서는 비활성화되어 있습니다 (`disable: true`)
3. 프로덕션 빌드로 테스트하세요

### 설치 배너가 표시되지 않음

1. PWA 설치 조건 확인:
   - HTTPS 또는 localhost
   - 유효한 `manifest.json`
   - 등록된 Service Worker
   - 최소 192x192, 512x512 아이콘

2. 이미 설치된 경우 배너가 표시되지 않습니다
3. 브라우저 호환성 확인 (Chrome, Edge, Samsung Internet 등)

### iOS에서 작동하지 않음

1. `apple-touch-icon.png`가 존재하는지 확인
2. `manifest.json`의 `display: "standalone"` 확인
3. Safari에서 공유 버튼을 통해 수동으로 추가해야 합니다

### 오프라인 페이지가 표시되지 않음

1. Service Worker가 등록되었는지 확인
2. 네트워크를 완전히 차단했는지 확인 (Chrome DevTools > Network > Offline)
3. `app/offline/page.tsx`가 올바르게 빌드되었는지 확인

## 📚 참고 자료

- [next-pwa 문서](https://github.com/shadowwalker/next-pwa)
- [Web App Manifest](https://web.dev/add-manifest/)
- [PWA 가이드](https://web.dev/progressive-web-apps/)
- [iOS Safari PWA](https://developer.apple.com/library/archive/documentation/AppleApplications/Reference/SafariWebContent/ConfiguringWebApplications/ConfiguringWebApplications.html)

## 🔄 업데이트

### 새 버전 배포 시

Service Worker는 `skipWaiting: true`로 설정되어 있어 새 버전이 즉시 활성화됩니다. 사용자는 다음 방문 시 자동으로 새 버전을 받게 됩니다.

### 수동 업데이트 강제 (선택사항)

사용자에게 업데이트를 알리고 싶다면:

```tsx
// Service Worker 업데이트 감지 예시
useEffect(() => {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      // 새 버전 사용 가능 알림
      alert("새 버전이 사용 가능합니다. 새로고침해주세요.");
      window.location.reload();
    });
  }
}, []);
```

## ✅ 완료 체크리스트

- [x] next-pwa 설치 및 설정
- [x] manifest.json 생성
- [x] Service Worker 설정
- [x] InstallPrompt 컴포넌트
- [x] InstallButton 컴포넌트
- [x] useInstallPrompt 훅
- [x] 오프라인 페이지
- [x] layout.tsx 메타태그 추가
- [ ] 아이콘 생성 (필수)
- [ ] 프로덕션 빌드 테스트
- [ ] iOS Safari 테스트
- [ ] 오프라인 기능 테스트

---

**마지막 업데이트**: 2025년 1월


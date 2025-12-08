# PWA 설치 프롬프트 문제 해결

## 📋 문제 상황

PWA 스플래시 이미지를 추가했지만 "앱 설치" 메뉴가 나타나지 않는 문제가 발생했습니다.

## 🔍 원인 분석

### 1. 아이콘 파일 누락 (가장 큰 문제)
- `manifest.json`에서 참조하는 아이콘 파일들이 실제로 존재하지 않았습니다
- PWA 설치 프롬프트는 유효한 manifest.json과 아이콘이 있어야만 나타납니다
- 필수 아이콘: 192x192, 512x512, apple-touch-icon (180x180)

### 2. manifest.json 설정 문제
- `splash_pages: null` 필드가 있어서 유효하지 않은 manifest가 될 수 있었습니다
- `id` 필드가 없어서 PWA 설치 시 문제가 발생할 수 있었습니다

### 3. 개발 환경에서 PWA 비활성화
- `next.config.ts`에서 개발 환경에서는 Service Worker가 비활성화되어 있었습니다
- 프로덕션 빌드에서만 PWA가 작동합니다

## ✅ 해결 방법

### 1. 아이콘 파일 생성

스플래시 이미지(`public/splash/eduatalk.png`)를 기반으로 모든 필수 아이콘 크기를 생성했습니다.

**생성된 아이콘:**
- `icon-72x72.png`
- `icon-96x96.png`
- `icon-128x128.png`
- `icon-144x144.png`
- `icon-152x152.png`
- `icon-192x192.png` (필수)
- `icon-384x384.png`
- `icon-512x512.png` (필수)
- `apple-touch-icon.png` (180x180, iOS 필수)

**아이콘 생성 스크립트:**
```bash
npm run generate:icons
```

스크립트 위치: `scripts/generate-pwa-icons.ts`

### 2. manifest.json 수정

**변경 사항:**
- `id: "/"` 필드 추가 (PWA 설치를 위해 권장)
- `splash_pages: null` 필드 제거 (유효하지 않은 필드)

```json
{
  "id": "/",
  "name": "TimeLevelUp - 학습 관리 시스템",
  "short_name": "TimeLevelUp",
  // ... 나머지 설정
}
```

### 3. next.config.ts 개선

**변경 사항:**
- `publicExcludes` 추가로 Service Worker 파일 제외 설정 명확화
- 캐시 만료 시간 및 네트워크 타임아웃 설정 추가

```typescript
const pwaConfig = withPWA({
  dest: "public",
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === "development",
  publicExcludes: ["!sw.js", "!workbox-*.js", "!fallback-*.js"],
  runtimeCaching: [
    {
      urlPattern: /^https?.*/,
      handler: "NetworkFirst",
      options: {
        cacheName: "offlineCache",
        expiration: {
          maxEntries: 200,
          maxAgeSeconds: 86400, // 24시간
        },
        networkTimeoutSeconds: 10,
      },
    },
  ],
});
```

## 🧪 테스트 방법

### 1. 프로덕션 빌드

PWA는 프로덕션 빌드에서만 작동합니다:

```bash
npm run build
npm start
```

### 2. 브라우저에서 확인

#### Chrome/Edge (Android/Desktop)
1. 프로덕션 서버 실행 (`npm start`)
2. 브라우저에서 접속
3. 주소창에 설치 아이콘(📱)이 나타나거나
4. 자동으로 설치 프롬프트 배너가 나타납니다

#### iOS Safari
1. iOS Safari에서 접속
2. 공유 버튼 → "홈 화면에 추가" 선택
3. 앱이 설치되고 스플래시 화면이 표시됩니다

### 3. 개발자 도구로 확인

**Chrome DevTools:**
1. F12 → Application 탭
2. Manifest 섹션에서 manifest.json 확인
   - 아이콘이 모두 로드되는지 확인
   - 에러가 없는지 확인
3. Service Workers 섹션에서 Service Worker 등록 확인

**확인 사항:**
- ✅ Manifest가 유효한지 (에러 없음)
- ✅ 모든 아이콘이 로드되는지
- ✅ Service Worker가 등록되었는지
- ✅ `beforeinstallprompt` 이벤트가 발생하는지 (Console에서 확인)

## 📝 PWA 설치 프롬프트가 나타나지 않는 경우

### 체크리스트

1. **아이콘 파일 확인**
   ```bash
   ls -la public/icons/*.png
   ```
   - 모든 필수 아이콘이 존재하는지 확인

2. **manifest.json 유효성 확인**
   - Chrome DevTools → Application → Manifest
   - 에러가 없는지 확인

3. **HTTPS 또는 localhost 확인**
   - PWA는 HTTPS 또는 localhost에서만 작동합니다
   - 프로덕션 빌드에서 테스트하세요

4. **Service Worker 등록 확인**
   - Chrome DevTools → Application → Service Workers
   - Service Worker가 등록되어 있는지 확인

5. **이미 설치된 경우**
   - 브라우저는 이미 설치된 PWA에 대해 프롬프트를 표시하지 않습니다
   - 브라우저 설정에서 PWA 제거 후 다시 시도

6. **브라우저 호환성**
   - Chrome/Edge: 완전 지원
   - Safari (iOS): 수동 설치 (공유 버튼 사용)
   - Firefox: 제한적 지원

## 🎯 다음 단계

1. ✅ 아이콘 파일 생성 완료
2. ✅ manifest.json 수정 완료
3. ✅ next.config.ts 개선 완료
4. ⏳ 프로덕션 빌드 테스트 필요
5. ⏳ 실제 디바이스에서 테스트 필요

## 📚 참고 자료

- [Web App Manifest](https://web.dev/add-manifest/)
- [PWA 설치 프롬프트 가이드](https://web.dev/customize-install/)
- [next-pwa 문서](https://github.com/shadowwalker/next-pwa)
- [iOS Safari PWA 가이드](https://developer.apple.com/library/archive/documentation/AppleApplications/Reference/SafariWebContent/ConfiguringWebApplications/ConfiguringWebApplications.html)

## 🔧 유지보수

### 아이콘 업데이트

아이콘을 업데이트하려면:

1. `public/splash/eduatalk.png` 파일을 새 이미지로 교체
2. 아이콘 재생성:
   ```bash
   npm run generate:icons
   ```
3. 프로덕션 빌드 재실행

### 문제 해결

PWA 설치 프롬프트가 여전히 나타나지 않으면:

1. 브라우저 캐시 삭제
2. Service Worker 제거 (DevTools → Application → Service Workers → Unregister)
3. 프로덕션 빌드 재실행
4. 브라우저 재시작

---

**작성일**: 2025-01-08  
**작성자**: AI Assistant  
**상태**: ✅ 완료


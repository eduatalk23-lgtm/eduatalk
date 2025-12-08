# 스플래시 이미지 가이드

이 디렉토리에는 PWA 앱 실행 시 표시되는 스플래시 스크린 이미지를 저장합니다.

## 📱 스플래시 이미지란?

스플래시 이미지는 PWA 앱이 시작될 때 앱이 로드되는 동안 표시되는 화면입니다. iOS Safari와 Android Chrome에서 각각 다른 방식으로 처리됩니다.

## 📋 필수 스플래시 이미지 목록

### iOS (Apple) 스플래시 이미지

다음 크기의 스플래시 이미지가 필요합니다:

| 디바이스 | 크기 | 파일명 |
|---------|------|--------|
| iPhone SE (2nd gen), iPhone 8/7/6s/6 | 750x1334 | `apple-splash-750-1334.png` |
| iPhone 8 Plus/7 Plus/6s Plus/6 Plus | 1242x2208 | `apple-splash-1242-2208.png` |
| iPhone X/XS, iPhone 11 Pro, iPhone 12/13 mini | 1125x2436 | `apple-splash-1125-2436.png` |
| iPhone XR, iPhone 11 | 828x1792 | `apple-splash-828-1792.png` |
| iPhone XS Max, iPhone 11 Pro Max | 1242x2688 | `apple-splash-1242-2688.png` |
| iPhone 12/12 Pro, iPhone 13/13 Pro, iPhone 14 | 1170x2532 | `apple-splash-1170-2532.png` |
| iPhone 12 Pro Max, iPhone 13 Pro Max, iPhone 14 Plus | 1284x2778 | `apple-splash-1284-2778.png` |
| iPhone 14 Pro | 1179x2556 | `apple-splash-1179-2556.png` |
| iPhone 14 Pro Max | 1290x2796 | `apple-splash-1290-2796.png` |
| iPad | 768x1024 | `apple-splash-768-1024.png` |
| iPad Pro 10.5" | 1112x1394 | `apple-splash-1112-1394.png` |
| iPad Pro 11" | 1194x1668 | `apple-splash-1194-1668.png` |
| iPad Pro 12.9" | 2048x2732 | `apple-splash-2048-2732.png` |

### Android/Chrome 스플래시 이미지

다음 크기의 스플래시 이미지가 필요합니다:

| 화면 크기 | 크기 | 파일명 | Form Factor |
|----------|------|--------|-------------|
| 작은 화면 | 640x1136 | `android-splash-640-1136.png` | narrow |
| 중간 화면 | 750x1334 | `android-splash-750-1334.png` | narrow |
| 큰 화면 | 828x1792 | `android-splash-828-1792.png` | narrow |
| XL 화면 | 1125x2436 | `android-splash-1125-2436.png` | narrow |
| XXL 화면 | 1170x2532 | `android-splash-1170-2532.png` | narrow |
| XXXL 화면 | 1284x2778 | `android-splash-1284-2778.png` | narrow |
| 태블릿 (작은) | 768x1024 | `android-splash-768-1024.png` | wide |
| 태블릿 (큰) | 1536x2048 | `android-splash-1536-2048.png` | wide |

## 🎨 스플래시 이미지 디자인 가이드라인

### 디자인 원칙

1. **배경색**: `manifest.json`의 `background_color`와 일치해야 합니다 (현재: `#ffffff`)
2. **중앙 정렬**: 로고나 앱 이름을 화면 중앙에 배치
3. **심플함**: 복잡한 디자인보다는 단순하고 깔끔한 디자인 권장
4. **브랜드 일관성**: 앱 아이콘과 일관된 디자인 사용

### 권장 디자인 패턴

```
┌─────────────────────┐
│                     │
│                     │
│      [로고/아이콘]    │
│                     │
│    TimeLevelUp      │
│                     │
│                     │
└─────────────────────┘
```

### 색상 가이드

- **배경색**: `#ffffff` (흰색) - `manifest.json`의 `background_color`와 일치
- **텍스트/로고 색상**: `#000000` (검은색) - `manifest.json`의 `theme_color`와 일치
- 또는 브랜드 컬러 사용 가능

## 🛠 스플래시 이미지 생성 방법

### 방법 1: PWA Asset Generator 사용 (권장)

1. [PWA Asset Generator](https://www.pwabuilder.com/imageGenerator) 방문
2. 원본 이미지(최소 2048x2732px) 업로드
3. "Generate Splash Screens" 옵션 선택
4. 모든 크기 자동 생성 및 다운로드
5. 생성된 파일을 `public/splash/` 디렉토리에 복사

### 방법 2: Figma/Photoshop 사용

1. 각 크기의 캔버스 생성
2. 배경색을 `#ffffff`로 설정
3. 로고/아이콘을 중앙에 배치
4. 각 크기로 PNG 형식으로 export
5. 파일명 규칙에 맞게 저장

### 방법 3: ImageMagick 사용 (CLI)

```bash
# 원본 이미지가 splash-source.png인 경우
# iOS 스플래시 이미지 생성
convert splash-source.png -resize 750x1334 -gravity center -extent 750x1334 -background white public/splash/apple-splash-750-1334.png
convert splash-source.png -resize 1242x2208 -gravity center -extent 1242x2208 -background white public/splash/apple-splash-1242-2208.png
convert splash-source.png -resize 1125x2436 -gravity center -extent 1125x2436 -background white public/splash/apple-splash-1125-2436.png
# ... 나머지 크기도 동일하게 생성

# Android 스플래시 이미지 생성
convert splash-source.png -resize 640x1136 -gravity center -extent 640x1136 -background white public/splash/android-splash-640-1136.png
convert splash-source.png -resize 750x1334 -gravity center -extent 750x1334 -background white public/splash/android-splash-750-1334.png
# ... 나머지 크기도 동일하게 생성
```

### 방법 4: 온라인 도구 사용

- [RealFaviconGenerator](https://realfavicongenerator.net/) - 스플래시 이미지 생성 지원
- [App Icon Generator](https://www.appicon.co/) - 다양한 크기 자동 생성

## 📝 임시 스플래시 이미지 생성 (개발용)

개발 중에는 다음 명령어로 간단한 플레이스홀더 스플래시 이미지를 생성할 수 있습니다:

```bash
# ImageMagick이 설치되어 있는 경우
# iOS 스플래시 이미지
sizes_ios=(
  "750x1334"
  "1242x2208"
  "1125x2436"
  "828x1792"
  "1242x2688"
  "1170x2532"
  "1284x2778"
  "1179x2556"
  "1290x2796"
  "768x1024"
  "1112x1394"
  "1194x1668"
  "2048x2732"
)

for size in "${sizes_ios[@]}"; do
  IFS='x' read -r width height <<< "$size"
  convert -size ${width}x${height} xc:white \
    -gravity center \
    -pointsize $((width/10)) \
    -fill black \
    -annotate +0+0 "TimeLevelUp" \
    public/splash/apple-splash-${size}.png
done

# Android 스플래시 이미지
sizes_android=(
  "640x1136"
  "750x1334"
  "828x1792"
  "1125x2436"
  "1170x2532"
  "1284x2778"
  "768x1024"
  "1536x2048"
)

for size in "${sizes_android[@]}"; do
  IFS='x' read -r width height <<< "$size"
  convert -size ${width}x${height} xc:white \
    -gravity center \
    -pointsize $((width/10)) \
    -fill black \
    -annotate +0+0 "TimeLevelUp" \
    public/splash/android-splash-${size}.png
done
```

## ✅ 확인 사항

스플래시 이미지를 추가한 후 다음을 확인하세요:

### iOS 확인
- [ ] 모든 iOS 스플래시 이미지 파일이 존재하는가?
- [ ] `app/layout.tsx`의 `appleWebApp.startupImage` 설정이 올바른가?
- [ ] iOS Safari에서 PWA 설치 후 앱 실행 시 스플래시 화면이 표시되는가?

### Android 확인
- [ ] 모든 Android 스플래시 이미지 파일이 존재하는가?
- [ ] `manifest.json`의 `splash_screens` 설정이 올바른가?
- [ ] Android Chrome에서 PWA 설치 후 앱 실행 시 스플래시 화면이 표시되는가?

### 공통 확인
- [ ] 스플래시 이미지의 배경색이 `manifest.json`의 `background_color`와 일치하는가?
- [ ] 파일명이 설정 파일의 경로와 일치하는가?
- [ ] 이미지 파일이 올바른 형식(PNG)인가?

## 🔍 테스트 방법

### iOS 테스트
1. iOS Safari에서 웹사이트 방문
2. 공유 버튼 → "홈 화면에 추가" 선택
3. 앱 실행 시 스플래시 화면 확인

### Android 테스트
1. Android Chrome에서 웹사이트 방문
2. 메뉴 → "홈 화면에 추가" 선택
3. 앱 실행 시 스플래시 화면 확인

### 개발자 도구 확인
- Chrome DevTools → Application → Manifest에서 스플래시 이미지 설정 확인
- Network 탭에서 스플래시 이미지 파일이 로드되는지 확인

## 📚 참고 자료

- [Next.js Metadata API - Apple Web App](https://nextjs.org/docs/app/api-reference/functions/generate-metadata#applewebapp)
- [Web App Manifest - Splash Screens](https://developer.mozilla.org/en-US/docs/Web/Manifest/splash_screens)
- [Apple Human Interface Guidelines - Launch Screens](https://developer.apple.com/design/human-interface-guidelines/ios/visual-design/launch-screen/)
- [PWA Builder - Splash Screen Generator](https://www.pwabuilder.com/imageGenerator)

## 🚨 주의사항

1. **파일 크기**: 스플래시 이미지는 앱 시작 속도에 영향을 줄 수 있으므로 최적화된 이미지를 사용하세요.
2. **배경색 일치**: 스플래시 이미지의 배경색은 반드시 `manifest.json`의 `background_color`와 일치해야 합니다.
3. **파일명 규칙**: 파일명은 설정 파일에서 참조하는 경로와 정확히 일치해야 합니다.
4. **이미지 형식**: PNG 형식만 지원됩니다.


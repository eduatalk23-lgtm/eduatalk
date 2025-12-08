# PWA 아이콘 가이드

이 디렉토리에는 PWA에 필요한 모든 아이콘을 저장합니다.

## 필수 아이콘 목록

다음 크기의 아이콘을 생성해야 합니다:

### 기본 아이콘
- `icon-72x72.png` - 72x72px
- `icon-96x96.png` - 96x96px
- `icon-128x128.png` - 128x128px
- `icon-144x144.png` - 144x144px
- `icon-152x152.png` - 152x152px
- `icon-192x192.png` - 192x192px (필수)
- `icon-384x384.png` - 384x384px
- `icon-512x512.png` - 512x512px (필수)

### iOS 전용
- `apple-touch-icon.png` - 180x180px (iOS Safari용)

## 아이콘 생성 방법

### 방법 1: 온라인 도구 사용
1. [PWA Asset Generator](https://www.pwabuilder.com/imageGenerator) 사용
2. 원본 이미지(최소 512x512px) 업로드
3. 모든 크기 자동 생성 및 다운로드

### 방법 2: Figma/Photoshop 사용
1. 512x512px 정사각형 디자인 생성
2. 각 크기로 export
3. PNG 형식으로 저장

### 방법 3: ImageMagick 사용 (CLI)
```bash
# 원본 이미지가 icon-source.png인 경우
convert icon-source.png -resize 192x192 public/icons/icon-192x192.png
convert icon-source.png -resize 512x512 public/icons/icon-512x512.png
convert icon-source.png -resize 180x180 public/icons/apple-touch-icon.png
# ... 나머지 크기도 동일하게 생성
```

## 아이콘 디자인 가이드라인

1. **배경**: 투명 또는 단색 배경
2. **안전 영역**: 가장자리에서 10% 여백 유지 (maskable icon)
3. **해상도**: 고해상도 원본 사용 (최소 512x512px)
4. **형식**: PNG (투명도 지원)
5. **색상**: 브랜드 컬러 사용

## 임시 아이콘 생성 (개발용)

개발 중에는 다음 명령어로 간단한 플레이스홀더 아이콘을 생성할 수 있습니다:

```bash
# ImageMagick이 설치되어 있는 경우
for size in 72 96 128 144 152 192 384 512; do
  convert -size ${size}x${size} xc:blue \
    -gravity center \
    -pointsize $((size/3)) \
    -fill white \
    -annotate +0+0 "TLU" \
    public/icons/icon-${size}x${size}.png
done

# Apple Touch Icon
convert -size 180x180 xc:blue \
  -gravity center \
  -pointsize 60 \
  -fill white \
  -annotate +0+0 "TLU" \
  public/icons/apple-touch-icon.png
```

## 확인 사항

아이콘을 추가한 후 다음을 확인하세요:

- [ ] 모든 필수 크기의 아이콘이 존재하는가?
- [ ] `manifest.json`의 경로가 올바른가?
- [ ] `app/layout.tsx`의 메타태그가 올바른가?
- [ ] 브라우저에서 `manifest.json`이 로드되는가?
- [ ] PWA 설치 시 아이콘이 표시되는가?

## 참고 자료

- [Web App Manifest](https://web.dev/add-manifest/)
- [PWA 아이콘 가이드](https://web.dev/add-to-home-screen/)
- [iOS Safari PWA 가이드](https://developer.apple.com/library/archive/documentation/AppleApplications/Reference/SafariWebContent/ConfiguringWebApplications/ConfiguringWebApplications.html)


# 스플래시 이미지 설정 추가

## 📅 작업 일자
2025-01-08

## 🎯 작업 목표
PWA 앱 실행 시 표시되는 스플래시 스크린 이미지 설정을 프로젝트에 추가

## 📋 작업 내용

### 1. iOS 스플래시 이미지 설정 (`app/layout.tsx`)

Next.js 16.0.3의 `Metadata` API를 사용하여 iOS용 스플래시 이미지를 설정했습니다.

**변경 사항:**
- `appleWebApp.startupImage` 필드 추가
- 주요 iOS 디바이스(iPhone, iPad)에 대한 스플래시 이미지 경로 설정
- 각 디바이스 크기에 맞는 미디어 쿼리 설정

**지원 디바이스:**
- iPhone SE (2nd generation), iPhone 8/7/6s/6
- iPhone 8 Plus/7 Plus/6s Plus/6 Plus
- iPhone X/XS, iPhone 11 Pro, iPhone 12/13 mini
- iPhone XR, iPhone 11
- iPhone XS Max, iPhone 11 Pro Max
- iPhone 12/12 Pro, iPhone 13/13 Pro, iPhone 14
- iPhone 12 Pro Max, iPhone 13 Pro Max, iPhone 14 Plus
- iPhone 14 Pro, iPhone 14 Pro Max
- iPad, iPad Pro (10.5", 11", 12.9")

### 2. Android/Chrome 스플래시 이미지 설정 (`public/manifest.json`)

Web App Manifest 표준에 따라 Android/Chrome용 스플래시 이미지를 설정했습니다.

**변경 사항:**
- `splash_screens` 필드 추가
- 다양한 화면 크기와 밀도에 맞는 스플래시 이미지 설정
- `form_factor` (narrow/wide) 및 `orientation` (portrait) 설정

**지원 화면 크기:**
- 작은 화면: 640x1136
- 중간 화면: 750x1334
- 큰 화면: 828x1792
- XL 화면: 1125x2436
- XXL 화면: 1170x2532
- XXXL 화면: 1284x2778
- 태블릿 (작은): 768x1024
- 태블릿 (큰): 1536x2048

### 3. 스플래시 이미지 생성 가이드 작성 (`public/splash/README.md`)

스플래시 이미지 생성 및 관리 가이드 문서를 작성했습니다.

**포함 내용:**
- 스플래시 이미지 개요
- 필수 스플래시 이미지 목록 (iOS/Android)
- 디자인 가이드라인
- 이미지 생성 방법 (4가지 방법)
- 임시 이미지 생성 스크립트
- 확인 사항 및 테스트 방법
- 참고 자료

## 🔧 기술 스택

- **Next.js**: 16.0.3
- **Metadata API**: Next.js App Router의 메타데이터 설정
- **Web App Manifest**: PWA 표준 스펙

## 📁 변경된 파일

1. `app/layout.tsx`
   - `appleWebApp.startupImage` 필드 추가
   - iOS 디바이스별 스플래시 이미지 경로 및 미디어 쿼리 설정

2. `public/manifest.json`
   - `splash_screens` 필드 추가
   - Android/Chrome용 스플래시 이미지 설정

3. `public/splash/README.md` (신규)
   - 스플래시 이미지 생성 및 관리 가이드

## 🎨 디자인 가이드라인

### 배경색
- `#ffffff` (흰색) - `manifest.json`의 `background_color`와 일치

### 디자인 원칙
1. 배경색은 `manifest.json`의 `background_color`와 일치
2. 로고/아이콘을 화면 중앙에 배치
3. 심플하고 깔끔한 디자인
4. 앱 아이콘과 일관된 디자인

## 📝 다음 단계

1. **스플래시 이미지 생성**
   - 디자인 팀 또는 디자이너와 협의하여 스플래시 이미지 디자인
   - `public/splash/README.md`의 가이드를 참고하여 이미지 생성
   - 모든 필수 크기의 이미지 생성

2. **이미지 파일 배치**
   - 생성된 이미지를 `public/splash/` 디렉토리에 배치
   - 파일명이 설정 파일의 경로와 일치하는지 확인

3. **테스트**
   - iOS Safari에서 PWA 설치 및 스플래시 화면 테스트
   - Android Chrome에서 PWA 설치 및 스플래시 화면 테스트
   - 다양한 디바이스 크기에서 테스트

## 🔍 참고 자료

### Context7 MCP를 통해 확인한 정보
- Next.js 16.0.3 Metadata API 문서
- `appleWebApp.startupImage` 설정 방법
- Web App Manifest `splash_screens` 필드

### 공식 문서
- [Next.js Metadata API - Apple Web App](https://nextjs.org/docs/app/api-reference/functions/generate-metadata#applewebapp)
- [Web App Manifest - Splash Screens](https://developer.mozilla.org/en-US/docs/Web/Manifest/splash_screens)
- [Apple Human Interface Guidelines - Launch Screens](https://developer.apple.com/design/human-interface-guidelines/ios/visual-design/launch-screen/)

## ✅ 체크리스트

- [x] iOS 스플래시 이미지 설정 추가 (`app/layout.tsx`)
- [x] Android/Chrome 스플래시 이미지 설정 추가 (`public/manifest.json`)
- [x] 스플래시 이미지 생성 가이드 작성 (`public/splash/README.md`)
- [x] 린터 에러 확인 및 수정
- [ ] 스플래시 이미지 디자인 완료 (디자인 팀 작업 필요)
- [ ] 스플래시 이미지 파일 생성 및 배치
- [ ] iOS/Android 테스트 완료

## 🚨 주의사항

1. **파일 크기**: 스플래시 이미지는 앱 시작 속도에 영향을 줄 수 있으므로 최적화된 이미지를 사용해야 합니다.
2. **배경색 일치**: 스플래시 이미지의 배경색은 반드시 `manifest.json`의 `background_color` (`#ffffff`)와 일치해야 합니다.
3. **파일명 규칙**: 파일명은 설정 파일에서 참조하는 경로와 정확히 일치해야 합니다.
4. **이미지 형식**: PNG 형식만 지원됩니다.

## 📊 영향 범위

- **사용자 경험**: PWA 앱 실행 시 더 나은 첫 인상 제공
- **브랜드 일관성**: 앱 아이콘과 일관된 디자인으로 브랜드 인지도 향상
- **플랫폼 지원**: iOS와 Android 모두에서 스플래시 화면 지원


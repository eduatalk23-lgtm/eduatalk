#!/usr/bin/env tsx
/**
 * PWA 아이콘 생성 스크립트
 * 스플래시 이미지를 기반으로 모든 필수 아이콘 크기를 생성합니다.
 * 
 * 사용법:
 *   npm run generate:icons
 *   또는
 *   tsx scripts/generate-pwa-icons.ts
 */

import { existsSync, mkdirSync } from "fs";
import { join } from "path";

const sharp = require("sharp");

const ICON_SIZES = [
  72, 96, 128, 144, 152, 192, 384, 512,
];

const APPLE_TOUCH_ICON_SIZE = 180;

const SOURCE_IMAGE = join(process.cwd(), "public/splash/eduatalk.png");
const OUTPUT_DIR = join(process.cwd(), "public/icons");

async function generateIcons() {
  console.log("🎨 PWA 아이콘 생성 시작...\n");

  // 소스 이미지 확인
  if (!existsSync(SOURCE_IMAGE)) {
    console.error(`❌ 소스 이미지를 찾을 수 없습니다: ${SOURCE_IMAGE}`);
    console.error("💡 public/splash/eduatalk.png 파일이 존재하는지 확인하세요.");
    process.exit(1);
  }

  // 출력 디렉토리 생성
  if (!existsSync(OUTPUT_DIR)) {
    mkdirSync(OUTPUT_DIR, { recursive: true });
    console.log(`📁 디렉토리 생성: ${OUTPUT_DIR}`);
  }

  try {
    // 기본 아이콘 생성
    console.log("📱 기본 아이콘 생성 중...");
    for (const size of ICON_SIZES) {
      const outputPath = join(OUTPUT_DIR, `icon-${size}x${size}.png`);
      await sharp(SOURCE_IMAGE)
        .resize(size, size, {
          fit: "contain",
          background: { r: 255, g: 255, b: 255, alpha: 1 },
        })
        .png()
        .toFile(outputPath);
      console.log(`  ✅ icon-${size}x${size}.png 생성 완료`);
    }

    // Apple Touch Icon 생성
    console.log("\n🍎 Apple Touch Icon 생성 중...");
    const appleIconPath = join(OUTPUT_DIR, "apple-touch-icon.png");
    await sharp(SOURCE_IMAGE)
      .resize(APPLE_TOUCH_ICON_SIZE, APPLE_TOUCH_ICON_SIZE, {
        fit: "contain",
        background: { r: 255, g: 255, b: 255, alpha: 1 },
      })
      .png()
      .toFile(appleIconPath);
    console.log(`  ✅ apple-touch-icon.png 생성 완료`);

    console.log("\n✨ 모든 아이콘 생성 완료!");
    console.log(`📂 출력 위치: ${OUTPUT_DIR}`);
    console.log("\n💡 다음 단계:");
    console.log("   1. 생성된 아이콘을 확인하세요");
    console.log("   2. 프로덕션 빌드를 실행하세요: npm run build");
    console.log("   3. 빌드 후 PWA 설치 프롬프트가 나타나는지 확인하세요");
  } catch (error) {
    console.error("❌ 아이콘 생성 중 오류 발생:", error);
    process.exit(1);
  }
}

// 스크립트 실행
generateIcons().catch((error) => {
  console.error("❌ 예상치 못한 오류:", error);
  process.exit(1);
});


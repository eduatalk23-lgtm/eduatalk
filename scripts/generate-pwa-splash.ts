#!/usr/bin/env tsx
/**
 * PWA 스플래시 스크린 생성 스크립트
 * 소스 로고 이미지를 기반으로 iOS/Android용 스플래시 이미지를 라이트/다크 모드별로 생성합니다.
 *
 * 사용법:
 *   pnpm generate:splash
 *   또는
 *   tsx scripts/generate-pwa-splash.ts
 */

import { existsSync, mkdirSync } from "fs";
import { join } from "path";

const sharp = require("sharp");

// --- 설정 ---
const LIGHT_BG = { r: 255, g: 255, b: 255, alpha: 1 }; // #ffffff
const DARK_BG = { r: 10, g: 10, b: 10, alpha: 1 }; // #0a0a0a
const LOGO_SCALE = 0.15; // 화면 너비 대비 로고 크기 비율

const SOURCE_IMAGE = join(process.cwd(), "public/splash/eduatalk.png");
const OUTPUT_DIR = join(process.cwd(), "public/splash");

// iOS 디바이스별 스플래시 사이즈
const IOS_SIZES = [
  { w: 750, h: 1334, name: "iPhone SE/8/7/6s/6" },
  { w: 1242, h: 2208, name: "iPhone 8 Plus/7 Plus/6s Plus" },
  { w: 1125, h: 2436, name: "iPhone X/XS/11 Pro/12 mini" },
  { w: 828, h: 1792, name: "iPhone XR/11" },
  { w: 1242, h: 2688, name: "iPhone XS Max/11 Pro Max" },
  { w: 1170, h: 2532, name: "iPhone 12/13/14" },
  { w: 1284, h: 2778, name: "iPhone 12/13 Pro Max/14 Plus" },
  { w: 1179, h: 2556, name: "iPhone 14 Pro" },
  { w: 1290, h: 2796, name: "iPhone 14 Pro Max" },
  { w: 768, h: 1024, name: "iPad" },
  { w: 1112, h: 1394, name: "iPad Pro 10.5" },
  { w: 1194, h: 1668, name: "iPad Pro 11" },
  { w: 2048, h: 2732, name: "iPad Pro 12.9" },
];

// Android manifest용 스플래시 사이즈
const ANDROID_SIZES = [
  { w: 640, h: 1136, formFactor: "narrow" },
  { w: 750, h: 1334, formFactor: "narrow" },
  { w: 828, h: 1792, formFactor: "narrow" },
  { w: 1125, h: 2436, formFactor: "narrow" },
  { w: 1170, h: 2532, formFactor: "narrow" },
  { w: 1284, h: 2778, formFactor: "narrow" },
  { w: 768, h: 1024, formFactor: "wide" },
  { w: 1536, h: 2048, formFactor: "wide" },
];

interface BgColor {
  r: number;
  g: number;
  b: number;
  alpha: number;
}

async function generateSplash(
  width: number,
  height: number,
  bg: BgColor,
  outputPath: string,
  logoBuffer: Buffer,
  logoMeta: { width: number; height: number },
) {
  const logoSize = Math.round(width * LOGO_SCALE);
  const resizedLogo = await sharp(logoBuffer)
    .resize(logoSize, logoSize, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();

  await sharp({
    create: {
      width,
      height,
      channels: 4,
      background: bg,
    },
  })
    .composite([
      {
        input: resizedLogo,
        gravity: "centre",
      },
    ])
    .png()
    .toFile(outputPath);
}

async function main() {
  console.log("PWA 스플래시 스크린 생성 시작...\n");

  if (!existsSync(SOURCE_IMAGE)) {
    console.error(`소스 이미지를 찾을 수 없습니다: ${SOURCE_IMAGE}`);
    process.exit(1);
  }

  if (!existsSync(OUTPUT_DIR)) {
    mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const logoBuffer = await sharp(SOURCE_IMAGE).toBuffer();
  const logoMeta = await sharp(SOURCE_IMAGE).metadata();

  let count = 0;

  // iOS 스플래시 (라이트 + 다크)
  console.log("[iOS 스플래시 - 라이트 모드]");
  for (const size of IOS_SIZES) {
    const path = join(OUTPUT_DIR, `apple-splash-${size.w}-${size.h}.png`);
    await generateSplash(size.w, size.h, LIGHT_BG, path, logoBuffer, logoMeta);
    console.log(`  apple-splash-${size.w}-${size.h}.png (${size.name})`);
    count++;
  }

  console.log("\n[iOS 스플래시 - 다크 모드]");
  for (const size of IOS_SIZES) {
    const path = join(OUTPUT_DIR, `apple-splash-dark-${size.w}-${size.h}.png`);
    await generateSplash(size.w, size.h, DARK_BG, path, logoBuffer, logoMeta);
    console.log(`  apple-splash-dark-${size.w}-${size.h}.png (${size.name})`);
    count++;
  }

  // Android 스플래시 (라이트만 — manifest는 다크모드 미지원)
  console.log("\n[Android 스플래시]");
  for (const size of ANDROID_SIZES) {
    const path = join(OUTPUT_DIR, `android-splash-${size.w}-${size.h}.png`);
    await generateSplash(size.w, size.h, LIGHT_BG, path, logoBuffer, logoMeta);
    console.log(`  android-splash-${size.w}-${size.h}.png (${size.formFactor})`);
    count++;
  }

  console.log(`\n총 ${count}장 생성 완료!`);
  console.log(`출력 위치: ${OUTPUT_DIR}`);
}

main().catch((error) => {
  console.error("오류 발생:", error);
  process.exit(1);
});

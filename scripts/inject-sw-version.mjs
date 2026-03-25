/**
 * 빌드 시 public/sw.js의 CACHE_NAME에 git SHA를 주입하여
 * 배포마다 서비스 워커 캐시가 무효화되도록 합니다.
 *
 * Vercel: VERCEL_GIT_COMMIT_SHA 환경변수 사용
 * 로컬: git rev-parse --short HEAD 사용
 * 폴백: 타임스탬프
 */
import { readFileSync, writeFileSync } from "fs";
import { execSync } from "child_process";

function getVersion() {
  // Vercel 빌드 환경
  if (process.env.VERCEL_GIT_COMMIT_SHA) {
    return process.env.VERCEL_GIT_COMMIT_SHA.slice(0, 8);
  }
  // 로컬 git
  try {
    return execSync("git rev-parse --short HEAD").toString().trim();
  } catch {
    // git 없는 환경 폴백
    return Date.now().toString(36);
  }
}

const version = getVersion();
const swPath = "public/sw.js";

let content = readFileSync(swPath, "utf-8");
content = content.replace(
  /const CACHE_NAME = "timelevelup-v\d+"/,
  `const CACHE_NAME = "timelevelup-${version}"`
);
writeFileSync(swPath, content);

console.log(`[inject-sw-version] CACHE_NAME → timelevelup-${version}`);

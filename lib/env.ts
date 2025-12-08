/**
 * 환경 변수 검증 및 타입 안전한 접근
 */

import { z } from "zod";

const envSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url("올바른 Supabase URL이 아닙니다."),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z
    .string()
    .min(1, "Supabase Anon Key가 설정되지 않았습니다."),
  // 필요시 추가 환경 변수
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  // 뿌리오 SMS API 설정 (선택사항)
  PPURIO_USER_ID: z.string().optional(),
  PPURIO_API_KEY: z.string().optional(),
  PPURIO_SENDER_NUMBER: z.string().optional(),
  PPURIO_API_ENDPOINT: z.string().url().optional(),
});

/**
 * 검증된 환경 변수
 * 앱 시작 시 자동으로 검증됩니다.
 *
 * 빌드 시점에는 환경 변수가 없을 수 있으므로, 런타임에 실제 사용 시점에 검증합니다.
 */
export const env = (() => {
  try {
    const envValues = {
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      NODE_ENV: process.env.NODE_ENV || "development",
      PPURIO_USER_ID: process.env.PPURIO_USER_ID,
      PPURIO_API_KEY: process.env.PPURIO_API_KEY,
      PPURIO_SENDER_NUMBER: process.env.PPURIO_SENDER_NUMBER,
      PPURIO_API_ENDPOINT: process.env.PPURIO_API_ENDPOINT,
    };

    // 빌드 시점 체크 (Next.js 빌드 프로세스 감지)
    const isBuildTime =
      process.env.NEXT_PHASE === "phase-production-build" ||
      process.env.NEXT_PHASE === "phase-development-server" ||
      !process.env.VERCEL_ENV; // Vercel이 아닌 환경에서 빌드 시

    // 디버깅: 개발 환경에서만 환경 변수 값 확인
    if (process.env.NODE_ENV === "development" && !isBuildTime) {
      console.log("[env.ts] 환경 변수 확인:");
      console.log(
        "  NEXT_PUBLIC_SUPABASE_URL:",
        envValues.NEXT_PUBLIC_SUPABASE_URL ? "✓ 설정됨" : "✗ 없음"
      );
      console.log(
        "  NEXT_PUBLIC_SUPABASE_ANON_KEY:",
        envValues.NEXT_PUBLIC_SUPABASE_ANON_KEY ? "✓ 설정됨" : "✗ 없음"
      );
    }

    // 빌드 시점에는 환경 변수가 없어도 빌드는 진행 (런타임에 검증)
    if (
      isBuildTime &&
      (!envValues.NEXT_PUBLIC_SUPABASE_URL ||
        !envValues.NEXT_PUBLIC_SUPABASE_ANON_KEY)
    ) {
      console.warn(
        "[env.ts] 빌드 시점: 환경 변수가 설정되지 않았습니다. 런타임에 검증됩니다."
      );
      // 빌드 시점에는 기본값 반환 (런타임에 실제 사용 시 오류 발생)
      return {
        NEXT_PUBLIC_SUPABASE_URL: envValues.NEXT_PUBLIC_SUPABASE_URL || "",
        NEXT_PUBLIC_SUPABASE_ANON_KEY:
          envValues.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
        NODE_ENV: envValues.NODE_ENV as "development" | "production" | "test",
        PPURIO_USER_ID: envValues.PPURIO_USER_ID,
        PPURIO_API_KEY: envValues.PPURIO_API_KEY,
        PPURIO_SENDER_NUMBER: envValues.PPURIO_SENDER_NUMBER,
        PPURIO_API_ENDPOINT: envValues.PPURIO_API_ENDPOINT,
      };
    }

    return envSchema.parse(envValues);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const issues = error.issues
        .map((issue) => {
          const path = issue.path.join(".");
          const message = issue.message;
          return `  - ${path}: ${message}`;
        })
        .join("\n");

      const isCI = process.env.CI === "true" || process.env.VERCEL === "1";
      const isVercel = process.env.VERCEL === "1";

      let solutionGuide = "";
      if (isVercel) {
        solutionGuide =
          "Vercel 배포 환경 변수 설정:\n" +
          "1. Vercel 대시보드 → 프로젝트 → Settings → Environment Variables\n" +
          "2. 다음 환경 변수를 추가:\n" +
          "   - NEXT_PUBLIC_SUPABASE_URL\n" +
          "   - NEXT_PUBLIC_SUPABASE_ANON_KEY\n" +
          "3. Production, Preview, Development 환경 모두 선택\n" +
          "4. Save 후 배포 재시도\n\n" +
          "Supabase 키 확인: Supabase 대시보드 → Settings → API\n";
      } else if (isCI) {
        solutionGuide =
          "CI/CD 환경 변수 설정:\n" +
          "1. 배포 플랫폼의 환경 변수 설정에서 다음 변수를 추가:\n" +
          "   - NEXT_PUBLIC_SUPABASE_URL\n" +
          "   - NEXT_PUBLIC_SUPABASE_ANON_KEY\n" +
          "2. 배포 재시도\n";
      } else {
        solutionGuide =
          "로컬 개발 환경 해결 방법:\n" +
          "1. .env.local 파일이 프로젝트 루트(eduatalk/)에 있는지 확인\n" +
          "2. 환경 변수 이름이 정확한지 확인 (대소문자 구분)\n" +
          "3. 값에 따옴표가 없는지 확인\n" +
          "4. 개발 서버를 재시작 (pnpm dev)\n" +
          "5. .next 폴더 삭제 후 재시작: rm -rf .next && pnpm dev\n";
      }

      throw new Error(`환경 변수 검증 실패:\n${issues}\n\n${solutionGuide}`);
    }
    throw error;
  }
})();

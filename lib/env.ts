/**
 * 환경 변수 검증 및 타입 안전한 접근
 */

import { z } from "zod";

const envSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url("올바른 Supabase URL이 아닙니다."),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1, "Supabase Anon Key가 설정되지 않았습니다."),
  // 필요시 추가 환경 변수
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
});

/**
 * 검증된 환경 변수
 * 앱 시작 시 자동으로 검증됩니다.
 */
export const env = (() => {
  try {
    const envValues = {
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      NODE_ENV: process.env.NODE_ENV,
    };

    // 디버깅: 개발 환경에서만 환경 변수 값 확인
    if (process.env.NODE_ENV === "development") {
      console.log("[env.ts] 환경 변수 확인:");
      console.log("  NEXT_PUBLIC_SUPABASE_URL:", envValues.NEXT_PUBLIC_SUPABASE_URL ? "✓ 설정됨" : "✗ 없음");
      console.log("  NEXT_PUBLIC_SUPABASE_ANON_KEY:", envValues.NEXT_PUBLIC_SUPABASE_ANON_KEY ? "✓ 설정됨" : "✗ 없음");
    }

    return envSchema.parse(envValues);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const issues = error.issues.map((issue) => {
        const path = issue.path.join(".");
        const message = issue.message;
        return `  - ${path}: ${message}`;
      }).join("\n");
      
      throw new Error(
        `환경 변수 검증 실패:\n${issues}\n\n` +
        "해결 방법:\n" +
        "1. .env.local 파일이 프로젝트 루트(eduatalk/)에 있는지 확인\n" +
        "2. 환경 변수 이름이 정확한지 확인 (대소문자 구분)\n" +
        "3. 값에 따옴표가 없는지 확인\n" +
        "4. 개발 서버를 재시작 (pnpm dev)\n" +
        "5. .next 폴더 삭제 후 재시작: rm -rf .next && pnpm dev"
      );
    }
    throw error;
  }
})();


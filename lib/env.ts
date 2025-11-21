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
    return envSchema.parse({
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      NODE_ENV: process.env.NODE_ENV,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      const missingVars = error.issues.map((e) => e.path.join(".")).join(", ");
      throw new Error(
        `환경 변수 검증 실패: ${missingVars}\n` +
        "필수 환경 변수가 설정되지 않았습니다. .env.local 파일을 확인해주세요."
      );
    }
    throw error;
  }
})();


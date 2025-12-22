/**
 * Auth 도메인 Types
 */

import { z } from "zod";

// ============================================
// Schemas
// ============================================

export const signInSchema = z.object({
  email: z.string().email("올바른 이메일 형식이 아닙니다.").min(1, "이메일을 입력해주세요."),
  password: z.string().min(1, "비밀번호를 입력해주세요."),
});

export const signUpSchema = z.object({
  email: z.string().email("올바른 이메일 형식이 아닙니다.").min(1, "이메일을 입력해주세요."),
  password: z.string().min(8, "비밀번호는 최소 8자 이상이어야 합니다."),
  displayName: z.string().min(1, "이름을 입력해주세요.").max(100, "이름은 100자 이하여야 합니다."),
  tenantId: z.string().min(1, "기관을 선택해주세요.").optional(),
  role: z.enum(["student", "parent"]).optional(),
});

// ============================================
// Types
// ============================================

export type SignInInput = z.infer<typeof signInSchema>;
export type SignUpInput = z.infer<typeof signUpSchema>;

export type SignupRole = "student" | "parent";

export interface SignInResult {
  error?: string;
  needsEmailVerification?: boolean;
  email?: string;
}

export interface AuthResult {
  success: boolean;
  error?: string;
}

export interface UserConsentsInput {
  terms: boolean;
  privacy: boolean;
  marketing: boolean;
}

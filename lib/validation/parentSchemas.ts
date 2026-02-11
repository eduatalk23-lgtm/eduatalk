/**
 * 학부모 관련 Zod 스키마
 */

import { z } from "zod";
import { phoneSchema } from "./phoneSchema";

/**
 * 학부모 기본 정보 스키마
 */
export const parentBasicSchema = z.object({
  name: z.string().min(1, "이름을 입력해주세요").max(50, "이름은 50자 이내여야 합니다"),
  phone: phoneSchema,
  email: z
    .string()
    .optional()
    .nullable()
    .transform((val) => (!val || val.trim() === "" ? null : val.trim()))
    .refine((val) => val === null || z.string().email().safeParse(val).success, {
      message: "올바른 이메일 형식을 입력해주세요",
    }),
});

export type ParentBasicFormData = z.infer<typeof parentBasicSchema>;

/**
 * 학부모 정보 수정 스키마 (partial)
 */
export const updateParentSchema = parentBasicSchema.partial();

export type UpdateParentFormData = z.infer<typeof updateParentSchema>;

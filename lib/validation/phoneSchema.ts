/**
 * 전화번호 Zod 스키마
 * 
 * 전화번호 검증 및 정규화를 위한 커스텀 Zod 타입
 */

import { z } from "zod";
import { validatePhoneNumber, normalizePhoneNumber } from "@/lib/utils/phone";

/**
 * 전화번호 Zod 커스텀 타입
 * - 010으로 시작하는 10~11자리만 허용
 * - 빈 값은 null로 변환 (선택사항)
 * - 유효한 경우 자동 정규화 (010-1234-5678 형식)
 */
export const phoneSchema = z
  .string()
  .optional()
  .nullable()
  .transform((val) => {
    // 빈 값은 null 반환
    if (!val || val.trim() === "") {
      return null;
    }
    // 정규화 시도
    const normalized = normalizePhoneNumber(val);
    return normalized;
  })
  .refine(
    (val) => {
      // null은 유효 (선택사항)
      if (val === null) {
        return true;
      }
      // 정규화된 값 검증
      const validation = validatePhoneNumber(val);
      return validation.valid;
    },
    {
      message: "010으로 시작하는 휴대폰 번호만 입력 가능합니다 (10~11자리)",
    }
  );

/**
 * 필수 전화번호 스키마 (빈 값 허용 안 함)
 */
export const requiredPhoneSchema = z
  .string()
  .min(1, "전화번호를 입력해주세요")
  .transform((val) => {
    const normalized = normalizePhoneNumber(val);
    if (!normalized) {
      throw new z.ZodError([
        {
          code: "custom",
          path: [],
          message: "010으로 시작하는 휴대폰 번호만 입력 가능합니다 (10~11자리)",
        },
      ]);
    }
    return normalized;
  })
  .refine(
    (val) => {
      const validation = validatePhoneNumber(val);
      return validation.valid;
    },
    {
      message: "010으로 시작하는 휴대폰 번호만 입력 가능합니다 (10~11자리)",
    }
  );

/**
 * 전화번호 Zod 타입 생성 함수
 * 
 * @param required - 필수 여부 (기본값: false)
 * @returns 전화번호 스키마
 * 
 * @example
 * ```typescript
 * const schema = z.object({
 *   phone: phone(),
 *   mother_phone: phone().optional(),
 *   required_phone: phone(true),
 * });
 * ```
 */
export function phone(required = false) {
  return required ? requiredPhoneSchema : phoneSchema;
}


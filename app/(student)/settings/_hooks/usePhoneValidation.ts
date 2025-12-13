/**
 * 전화번호 검증 및 포맷팅 훅
 */

import { useCallback } from "react";
import {
  formatPhoneNumber,
  validatePhoneNumber,
  type ValidationErrors,
} from "@/lib/utils/studentFormUtils";

type PhoneField = "phone" | "mother_phone" | "father_phone";

type UpdateFormDataFn = (updates: (prev: import("../types").StudentFormData) => import("../types").StudentFormData) => void;

export function usePhoneValidation(
  updateFormData: (updates: Partial<import("../types").StudentFormData>) => void,
  setErrors: (
    errors: ValidationErrors | ((prev: ValidationErrors) => ValidationErrors)
  ) => void
) {
  const handlePhoneChange = useCallback(
    (field: PhoneField) => (e: React.ChangeEvent<HTMLInputElement>) => {
      const formatted = formatPhoneNumber(e.target.value);
      updateFormData({ [field]: formatted } as Partial<import("../types").StudentFormData>);

      // 실시간 검증 (입력 중일 때는 에러 표시하지 않음)
      if (formatted) {
        const validation = validatePhoneNumber(formatted);
        if (!validation.valid) {
          // 입력 중이 아닐 때만 에러 표시 (11자리 이상이거나 010으로 시작하지 않을 때)
          const digits = formatted.replace(/\D/g, "");
          if (digits.length >= 10 || !digits.startsWith("010")) {
            setErrors((prev) => ({ ...prev, [field]: validation.error }));
          } else {
            // 입력 중이면 에러 제거
            setErrors((prev) => {
              const newErrors = { ...prev };
              delete newErrors[field];
              return newErrors;
            });
          }
        } else {
          // 유효하면 에러 제거
          setErrors((prev) => {
            const newErrors = { ...prev };
            delete newErrors[field];
            return newErrors;
          });
        }
      } else {
        // 빈 값이면 에러 제거
        setErrors((prev) => {
          const newErrors = { ...prev };
          delete newErrors[field];
          return newErrors;
        });
      }
    },
    [updateFormData, setErrors]
  );

  return { handlePhoneChange };
}


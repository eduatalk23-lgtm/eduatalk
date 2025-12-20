/**
 * 신규 학생 등록 폼 타입 정의
 * Zod 스키마에서 추론한 타입을 사용하여 타입 안전성 보장
 */

import type { CreateStudentFormSchema } from "@/lib/validation/createStudentFormSchema";

/**
 * @deprecated CreateStudentFormSchema를 직접 사용하세요.
 * 하위 호환성을 위해 유지되지만, Zod 스키마에서 추론한 타입을 사용하는 것이 권장됩니다.
 */
export type CreateStudentFormData = CreateStudentFormSchema;


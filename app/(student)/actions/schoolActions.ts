/**
 * schoolActions.ts - 학교 관련 Server Actions
 *
 * 이 파일은 lib/domains/school의 Server Actions를 re-export합니다.
 * 하위 호환성을 위해 유지됩니다.
 *
 * @deprecated lib/domains/school에서 직접 import 사용을 권장합니다.
 */

export type { StudentSchool as School } from "@/lib/domains/school";

export {
  getSchoolById,
  getSchoolByName,
  searchSchools,
  autoRegisterSchool,
} from "@/lib/domains/school";

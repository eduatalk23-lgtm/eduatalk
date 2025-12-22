/**
 * _utils.ts - 학부모 유틸리티 함수
 *
 * 이 파일은 lib/domains/parent의 유틸리티를 re-export합니다.
 * 하위 호환성을 위해 유지됩니다.
 *
 * @deprecated lib/domains/parent에서 직접 import 사용을 권장합니다.
 */

export type { LinkedStudent } from "@/lib/domains/parent";

export { getLinkedStudents, canAccessStudent } from "@/lib/domains/parent";

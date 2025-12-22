/**
 * parentSettingsActions.ts - 학부모 설정 관련 Server Actions
 *
 * 이 파일은 lib/domains/parent의 Server Actions를 re-export합니다.
 * 하위 호환성을 위해 유지됩니다.
 *
 * @deprecated lib/domains/parent에서 직접 import 사용을 권장합니다.
 */

export type { StudentAttendanceNotificationSettings } from "@/lib/domains/parent";

export {
  getStudentAttendanceNotificationSettings,
  updateStudentAttendanceNotificationSettings,
} from "@/lib/domains/parent";

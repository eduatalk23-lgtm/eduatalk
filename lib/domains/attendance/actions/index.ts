/**
 * Attendance Domain Actions
 *
 * Admin-facing Server Actions for attendance management.
 */

// Attendance CRUD
export {
  recordAttendanceAction,
  getAttendanceRecordsAction,
  getAttendanceByStudentAction,
  getAttendanceStatisticsAction,
  deleteAttendanceRecordAction,
  updateAttendanceRecord,
  getAttendanceRecordHistory,
} from "./attendance";

// QR Code
export {
  generateQRCodeAction,
  getActiveQRCodeAction,
  deactivateQRCodeAction,
  getQRCodeHistoryAction,
} from "./qrCode";

// Settings
export {
  type LocationSettingsInput,
  updateLocationSettings,
  getLocationSettings,
  getAttendanceSMSSettings,
  updateAttendanceSMSSettings,
  updateStudentAttendanceSettings,
} from "./settings";

// SMS Logs
export {
  type SMSLogFilter,
  type SMSLog,
  getAttendanceSMSLogs,
} from "./smsLogs";

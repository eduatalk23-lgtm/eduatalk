/**
 * Attendance Domain Actions
 *
 * Server Actions for attendance management.
 */

// Admin Attendance CRUD
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

// Student Actions
export {
  checkInWithQRCode,
  checkInWithLocation,
  checkOutWithQRCode,
  checkOutWithLocation,
  checkOut,
  getTodayAttendance,
  getTodayAttendanceSMSStatus,
} from "./student";

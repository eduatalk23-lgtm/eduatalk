/**
 * @deprecated This module has been renamed to calendarPermission.ts
 * Re-exports everything for backward compatibility.
 */
export {
  type ViewMode,
  getCalendarPermission,
  getCalendarSettingsPermission,
  canEditCalendarSettings,
  canEditPlannerSettings,
  canEditCalendarSettingsSettings,
  isOwnCalendar,
  isOwnCalendarSettings,
  getAllowedActions,
} from "./calendarPermission";

// OAuth
export { generateAuthUrl, exchangeCodeForTokens, parseOAuthState } from "./oauth";

// Token
export {
  getTokenByAdminUser,
  getTokensByTenant,
  saveToken,
  deleteToken,
  updateCalendarId,
  refreshTokenIfNeeded,
} from "./tokenService";

// Sync
export {
  createGoogleEvent,
  updateGoogleEvent,
  cancelGoogleEvent,
  listCalendars,
} from "./syncService";

// Enqueue (fire-and-forget)
export { enqueueGoogleCalendarSync } from "./enqueue";

// Settings
export { getConnectionStatus, getSyncQueueStats } from "./settingsService";

// Types
export type {
  GoogleOAuthToken,
  SyncAction,
  SyncTarget,
  SyncQueueItem,
  GoogleCalendarEventData,
  OAuthStatePayload,
} from "./types";
export type { GoogleCalendarConnectionStatus } from "./settingsService";

export {
  SESSION_TYPE_GOOGLE_COLOR,
  MAX_RETRY_COUNT,
  GOOGLE_CALENDAR_SCOPES,
} from "./types";

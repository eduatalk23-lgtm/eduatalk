import webpush from "web-push";

let initialized = false;
let configured = false;

/**
 * VAPID 자격 증명을 설정합니다.
 * 모듈 내에서 1회만 실행됩니다.
 *
 * @returns true if VAPID is properly configured
 */
export function ensureVapidConfigured(): boolean {
  if (initialized) return configured;

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;

  initialized = true; // 1회만 시도 (반복 경고 방지)

  if (!publicKey || !privateKey) {
    console.error("[VAPID] Keys not configured. Push sending disabled.", {
      hasPublic: !!publicKey,
      hasPrivate: !!privateKey,
    });
    return false;
  }

  try {
    webpush.setVapidDetails(
      "mailto:admin@timelevelup.com",
      publicKey,
      privateKey
    );
    configured = true;
    return true;
  } catch (err) {
    console.error("[VAPID] Failed to set details:", err);
    return false;
  }
}

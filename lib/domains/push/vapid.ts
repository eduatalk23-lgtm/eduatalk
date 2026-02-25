import webpush from "web-push";

let initialized = false;

/**
 * VAPID 자격 증명을 설정합니다.
 * 모듈 내에서 1회만 실행됩니다.
 */
export function ensureVapidConfigured(): void {
  if (initialized) return;

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;

  if (!publicKey || !privateKey) {
    console.warn("[VAPID] Keys not configured. Push sending disabled.");
    return;
  }

  webpush.setVapidDetails(
    "mailto:admin@timelevelup.com",
    publicKey,
    privateKey
  );
  initialized = true;
}

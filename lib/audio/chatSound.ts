/**
 * 채팅 알림음 & 진동 유틸리티
 *
 * Web Audio API로 짧은 알림음을 합성하고,
 * Vibration API로 모바일 진동을 트리거합니다.
 */

let audioContext: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!audioContext) {
    try {
      audioContext = new AudioContext();
    } catch {
      return null;
    }
  }
  // 사용자 제스처 후 resume 필요 (브라우저 자동재생 정책)
  if (audioContext.state === "suspended") {
    audioContext.resume().catch(() => {});
  }
  return audioContext;
}

/**
 * 짧은 알림음을 합성하여 재생 (카카오톡 스타일 "띵")
 * 외부 오디오 파일 없이 Web Audio API만 사용
 */
export function playChatNotificationSound(): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;

    // 메인 톤 (880Hz, A5)
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(880, now);
    osc.frequency.exponentialRampToValueAtTime(660, now + 0.08);

    // 볼륨 엔벨로프 (빠른 attack, 짧은 decay)
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.3, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.15);
  } catch {
    // 오디오 재생 실패는 무시 (사용자 경험에 치명적이지 않음)
  }
}

/**
 * 짧은 진동 피드백 (모바일)
 * Vibration API 미지원 환경에서는 무시
 */
export function vibrateChatNotification(): void {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    try {
      navigator.vibrate(50);
    } catch {
      // 진동 실패 무시
    }
  }
}

/**
 * 채팅 알림 피드백 (소리 + 진동)
 */
export function playChatFeedback(options: {
  sound: boolean;
  vibrate: boolean;
}): void {
  if (options.sound) {
    playChatNotificationSound();
  }
  if (options.vibrate) {
    vibrateChatNotification();
  }
}

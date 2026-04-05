/**
 * Realtime Connection Manager
 *
 * 채널별 연결 상태를 관리하고 자동 재연결을 처리합니다.
 * - 지수 백오프로 재연결 시도
 * - 동기화 타임스탬프 추적으로 점진적 동기화 지원
 * - 네트워크 상태 연동
 */

import {
  isOnline,
  addNetworkStatusListener,
} from "@/lib/offline/networkStatus";
import { supabase } from "@/lib/supabase/client";
import { logActionDebug } from "@/lib/logging/actionLogger";

/** 연결 상태 */
export type ConnectionStatus = "connected" | "disconnected" | "reconnecting";

/** 채널 상태 정보 */
interface ChannelState {
  status: ConnectionStatus;
  lastSyncTimestamp: string | null;
  retryCount: number;
  lastAttemptAt: number | null;
}

/** 연결 상태 변경 리스너 */
type ConnectionStateListener = (
  channelName: string,
  status: ConnectionStatus
) => void;

/** 재연결 콜백 (채널별로 등록) */
type ReconnectCallback = () => Promise<void>;

/**
 * Realtime Connection Manager
 *
 * 싱글톤 패턴으로 전역에서 접근 가능하며,
 * 채널별 연결 상태와 동기화 타임스탬프를 관리합니다.
 */
class RealtimeConnectionManager {
  /** 채널별 상태 */
  private channels = new Map<string, ChannelState>();

  /** 상태 변경 리스너 */
  private listeners = new Set<ConnectionStateListener>();

  /** 채널별 재연결 콜백 */
  private reconnectCallbacks = new Map<string, ReconnectCallback>();

  /** 진행 중인 재연결 타이머 */
  private reconnectTimers = new Map<string, ReturnType<typeof setTimeout>>();

  /** 네트워크 상태 리스너 해제 함수 */
  private networkUnsubscribe: (() => void) | null = null;

  /** 재시도 상수 (기존 queue.ts 패턴 따름) */
  readonly BASE_RETRY_DELAY_MS = 1000;
  readonly MAX_RETRY_DELAY_MS = 30000;
  readonly MAX_RETRY_COUNT = 5;

  // ============================================
  // 채널 등록/해제
  // ============================================

  /**
   * 채널 등록
   */
  registerChannel(channelName: string): void {
    if (!this.channels.has(channelName)) {
      this.channels.set(channelName, {
        status: "disconnected",
        lastSyncTimestamp: null,
        retryCount: 0,
        lastAttemptAt: null,
      });
    }
  }

  /**
   * 채널 해제
   */
  unregisterChannel(channelName: string): void {
    this.channels.delete(channelName);
  }

  // ============================================
  // 연결 상태 관리
  // ============================================

  /**
   * 채널 연결 상태 설정
   */
  setChannelState(channelName: string, status: ConnectionStatus): void {
    const state = this.channels.get(channelName);
    if (!state) {
      this.registerChannel(channelName);
    }

    const currentState = this.channels.get(channelName)!;

    // 연결 성공 시 재시도 카운트 리셋
    if (status === "connected") {
      currentState.retryCount = 0;
      currentState.lastAttemptAt = null;
    }

    currentState.status = status;

    // 리스너에 알림
    this.notifyListeners(channelName, status);
  }

  /**
   * 채널 연결 상태 조회
   */
  getChannelState(channelName: string): ConnectionStatus {
    return this.channels.get(channelName)?.status ?? "disconnected";
  }

  /**
   * 연결 끊김 처리 + 자동 재연결 예약
   */
  handleDisconnect(channelName: string): void {
    const state = this.channels.get(channelName);
    if (!state) return;

    state.status = "disconnected";
    this.notifyListeners(channelName, "disconnected");

    logActionDebug({ domain: "realtime", action: "handleDisconnect" }, `Channel ${channelName} disconnected`);

    // 이미 재연결 타이머가 예약되어 있으면 중복 예약 방지
    if (this.reconnectTimers.has(channelName)) {
      return;
    }

    // 자동 재연결 예약 (콜백이 등록되어 있고, 네트워크 온라인이고, 최대 재시도 미만)
    if (
      this.reconnectCallbacks.has(channelName) &&
      this.isNetworkOnline() &&
      state.retryCount < this.MAX_RETRY_COUNT
    ) {
      const delay = this.calculateRetryDelay(state.retryCount);
      logActionDebug({ domain: "realtime", action: "handleDisconnect" }, `Auto-reconnect scheduled for ${channelName} in ${Math.round(delay / 1000)}s (attempt ${state.retryCount + 1}/${this.MAX_RETRY_COUNT})`);

      // 기존 타이머 정리
      const existingTimer = this.reconnectTimers.get(channelName);
      if (existingTimer) {
        clearTimeout(existingTimer);
      }

      const timer = setTimeout(() => {
        this.reconnectTimers.delete(channelName);
        this.attemptReconnect(channelName);
      }, delay);

      this.reconnectTimers.set(channelName, timer);
    }
  }

  // ============================================
  // 재연결 로직
  // ============================================

  /**
   * 지수 백오프 딜레이 계산
   */
  private calculateRetryDelay(retryCount: number): number {
    const delay = Math.min(
      this.BASE_RETRY_DELAY_MS * Math.pow(2, retryCount),
      this.MAX_RETRY_DELAY_MS
    );
    // 지터 추가 (0-50% 랜덤)
    return delay + Math.random() * delay * 0.5;
  }

  /**
   * 재연결 필요 여부 확인
   */
  shouldReconnect(channelName: string): boolean {
    const state = this.channels.get(channelName);
    if (!state) return false;

    // 이미 연결 중이거나 연결됨
    if (state.status === "connected" || state.status === "reconnecting") {
      return false;
    }

    // 최대 재시도 횟수 초과
    if (state.retryCount >= this.MAX_RETRY_COUNT) {
      console.warn(`[ConnectionManager] Max retry count reached for ${channelName}`);
      return false;
    }

    // 딜레이 확인
    if (state.lastAttemptAt) {
      const timeSinceLastAttempt = Date.now() - state.lastAttemptAt;
      const requiredDelay = this.calculateRetryDelay(state.retryCount);

      if (timeSinceLastAttempt < requiredDelay) {
        return false;
      }
    }

    return true;
  }

  /**
   * 재연결 시도 시작
   */
  startReconnect(channelName: string): void {
    const state = this.channels.get(channelName);
    if (!state) return;

    state.status = "reconnecting";
    state.retryCount++;
    state.lastAttemptAt = Date.now();

    this.notifyListeners(channelName, "reconnecting");

    logActionDebug({ domain: "realtime", action: "startReconnect" }, `Reconnecting ${channelName} (attempt ${state.retryCount})`);
  }

  /**
   * 재시도 카운트 리셋 (성공 시)
   */
  resetRetryCount(channelName: string): void {
    const state = this.channels.get(channelName);
    if (state) {
      state.retryCount = 0;
      state.lastAttemptAt = null;
    }
  }

  /**
   * 재연결 콜백 등록
   */
  registerReconnectCallback(channelName: string, callback: ReconnectCallback): void {
    this.reconnectCallbacks.set(channelName, callback);
  }

  /**
   * 재연결 콜백 해제
   */
  unregisterReconnectCallback(channelName: string): void {
    this.reconnectCallbacks.delete(channelName);

    // 진행 중인 타이머 정리
    const timer = this.reconnectTimers.get(channelName);
    if (timer) {
      clearTimeout(timer);
      this.reconnectTimers.delete(channelName);
    }
  }

  /**
   * 수동 재연결 시도 (버튼 클릭 시)
   */
  async attemptManualReconnect(channelName: string): Promise<boolean> {
    const state = this.channels.get(channelName);
    if (!state) return false;

    // 이미 연결 중이면 무시
    if (state.status === "connected" || state.status === "reconnecting") {
      return false;
    }

    // 네트워크가 오프라인이면 실패
    if (!this.isNetworkOnline()) {
      console.warn("[ConnectionManager] Cannot reconnect: network offline");
      return false;
    }

    // 재시도 카운트 리셋 (수동 재연결은 새로운 시도)
    this.resetRetryCount(channelName);

    // 재연결 시도
    return this.attemptReconnect(channelName);
  }

  /**
   * Auth 세션이 유효한지 확인 (재연결 전 호출)
   * 최대 AUTH_WAIT_TIMEOUT_MS 동안 대기 후 실패 처리
   */
  private readonly AUTH_WAIT_TIMEOUT_MS = 5000;
  private readonly AUTH_POLL_INTERVAL_MS = 500;

  private async waitForAuth(): Promise<boolean> {
    const deadline = Date.now() + this.AUTH_WAIT_TIMEOUT_MS;

    while (Date.now() < deadline) {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.access_token) {
          return true;
        }
      } catch {
        // 세션 조회 실패 시 재시도
      }
      await new Promise((resolve) => setTimeout(resolve, this.AUTH_POLL_INTERVAL_MS));
    }

    console.warn("[ConnectionManager] Auth session not ready after timeout");
    return false;
  }

  /**
   * 재연결 시도 (내부용)
   */
  async attemptReconnect(channelName: string): Promise<boolean> {
    const state = this.channels.get(channelName);
    if (!state) return false;

    const callback = this.reconnectCallbacks.get(channelName);
    if (!callback) {
      console.warn(`[ConnectionManager] No reconnect callback for ${channelName}`);
      return false;
    }

    // Auth 세션 유효성 확인 (토큰 갱신 대기)
    const authReady = await this.waitForAuth();
    if (!authReady) {
      console.warn(`[ConnectionManager] Skipping reconnect for ${channelName}: auth not ready`);
      // disconnected 상태 유지, 다음 네트워크 이벤트나 수동 재연결에서 재시도
      this.setChannelState(channelName, "disconnected");
      return false;
    }

    // 재연결 시작
    this.startReconnect(channelName);

    try {
      await callback();

      // 콜백은 재구독을 트리거할 뿐, 실제 연결 성공은 subscribe() 콜백에서 판단.
      // setChannelState("connected")는 useChatRealtime의 SUBSCRIBED 핸들러가 호출.
      // 여기서는 reconnecting 상태를 유지하고 retryCount를 보존한다.
      logActionDebug({ domain: "realtime", action: "attemptReconnect" }, `Reconnect triggered for ${channelName}, awaiting SUBSCRIBED`);
      return true;
    } catch (error) {
      console.error(`[ConnectionManager] Reconnect failed for ${channelName}:`, error);

      // 실패 - 최대 횟수 미만이면 자동 재시도 예약
      if (state.retryCount < this.MAX_RETRY_COUNT && this.isNetworkOnline()) {
        const delay = this.calculateRetryDelay(state.retryCount);
        logActionDebug({ domain: "realtime", action: "attemptReconnect" }, `Will retry in ${Math.round(delay / 1000)}s`);

        // 기존 타이머 정리
        const existingTimer = this.reconnectTimers.get(channelName);
        if (existingTimer) {
          clearTimeout(existingTimer);
        }

        // 새 타이머 설정
        const timer = setTimeout(() => {
          this.reconnectTimers.delete(channelName);
          this.attemptReconnect(channelName);
        }, delay);

        this.reconnectTimers.set(channelName, timer);
      } else {
        // 최대 횟수 초과 - disconnected 상태로 유지
        this.setChannelState(channelName, "disconnected");
      }

      return false;
    }
  }

  /**
   * 채널의 다음 재시도까지 남은 시간 (밀리초)
   */
  getNextRetryIn(channelName: string): number | null {
    const state = this.channels.get(channelName);
    if (!state || !state.lastAttemptAt) return null;

    const delay = this.calculateRetryDelay(state.retryCount - 1);
    const elapsed = Date.now() - state.lastAttemptAt;
    const remaining = delay - elapsed;

    return remaining > 0 ? remaining : null;
  }

  /**
   * 채널의 현재 재시도 횟수
   */
  getRetryCount(channelName: string): number {
    return this.channels.get(channelName)?.retryCount ?? 0;
  }

  // ============================================
  // 동기화 타임스탬프 관리
  // ============================================

  /**
   * 동기화 타임스탬프 업데이트
   * 메시지 수신 시 호출하여 마지막 동기화 시점 기록
   */
  updateSyncTimestamp(channelName: string, timestamp: string): void {
    const state = this.channels.get(channelName);
    if (state) {
      state.lastSyncTimestamp = timestamp;
    }
  }

  /**
   * 마지막 동기화 타임스탬프 조회
   * 재연결 시 이 시점 이후의 메시지만 조회
   */
  getLastSyncTimestamp(channelName: string): string | null {
    return this.channels.get(channelName)?.lastSyncTimestamp ?? null;
  }

  // ============================================
  // 리스너 관리
  // ============================================

  /**
   * 상태 변경 리스너 등록
   */
  addStateListener(listener: ConnectionStateListener): () => void {
    this.listeners.add(listener);

    // 현재 상태 전달
    for (const [channelName, state] of this.channels) {
      listener(channelName, state.status);
    }

    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * 리스너에 알림
   */
  private notifyListeners(channelName: string, status: ConnectionStatus): void {
    this.listeners.forEach((listener) => {
      listener(channelName, status);
    });
  }

  // ============================================
  // 네트워크 상태 연동
  // ============================================

  /** Jitter 범위 (Thundering Herd 방지) */
  private readonly NETWORK_RECONNECT_MIN_JITTER_MS = 100;
  private readonly NETWORK_RECONNECT_MAX_JITTER_MS = 3000;

  /**
   * 네트워크 상태 연동 초기화
   */
  initNetworkIntegration(): void {
    if (this.networkUnsubscribe) {
      return; // 이미 초기화됨
    }

    this.networkUnsubscribe = addNetworkStatusListener((online) => {
      if (online) {
        // 온라인 복귀 시 모든 disconnected 채널에 대해:
        // 1) retry count 리셋 (5회 소진 후에도 재연결 가능)
        // 2) Jitter 적용 후 재연결 시도 (Thundering Herd 방지)
        logActionDebug({ domain: "realtime", action: "networkStatusChange" }, "Network online. Reconnecting disconnected channels with jitter...");
        for (const [channelName, state] of this.channels) {
          if (state.status === "disconnected" && this.reconnectCallbacks.has(channelName)) {
            // retry count 리셋 — 네트워크 복구는 새로운 시도
            this.resetRetryCount(channelName);
            this.setChannelState(channelName, "reconnecting");

            // 기존 예약된 타이머 정리
            const existingTimer = this.reconnectTimers.get(channelName);
            if (existingTimer) {
              clearTimeout(existingTimer);
            }

            // 100ms ~ 3000ms 랜덤 jitter → 대규모 동시 재접속 방지
            const jitter = this.NETWORK_RECONNECT_MIN_JITTER_MS +
              Math.random() * (this.NETWORK_RECONNECT_MAX_JITTER_MS - this.NETWORK_RECONNECT_MIN_JITTER_MS);

            logActionDebug({ domain: "realtime", action: "networkStatusChange" }, `Scheduling reconnect for ${channelName} in ${Math.round(jitter)}ms (jitter)`);

            const timer = setTimeout(() => {
              this.reconnectTimers.delete(channelName);
              // 여전히 온라인이고 reconnecting 상태일 때만 시도
              if (this.isNetworkOnline() && this.getChannelState(channelName) === "reconnecting") {
                this.attemptReconnect(channelName);
              }
            }, jitter);

            this.reconnectTimers.set(channelName, timer);
          } else if (state.status === "disconnected") {
            // 콜백 미등록 채널은 상태만 전환
            this.setChannelState(channelName, "reconnecting");
          }
        }
      } else {
        // 오프라인 시 모든 채널 disconnected로 전환 + 진행 중인 타이머 정리
        logActionDebug({ domain: "realtime", action: "networkStatusChange" }, "Network offline. Marking channels disconnected.");
        for (const [channelName] of this.channels) {
          // 진행 중인 재연결 타이머 정리 (오프라인인데 재연결 시도 방지)
          const existingTimer = this.reconnectTimers.get(channelName);
          if (existingTimer) {
            clearTimeout(existingTimer);
            this.reconnectTimers.delete(channelName);
          }
          this.setChannelState(channelName, "disconnected");
        }
      }
    });
  }

  /**
   * 네트워크 상태 연동 해제
   */
  cleanupNetworkIntegration(): void {
    if (this.networkUnsubscribe) {
      this.networkUnsubscribe();
      this.networkUnsubscribe = null;
    }
  }

  // ============================================
  // 유틸리티
  // ============================================

  /**
   * 현재 온라인 상태
   */
  isNetworkOnline(): boolean {
    return isOnline();
  }

  /**
   * 모든 채널 상태 조회
   */
  getAllChannelStates(): Map<string, ConnectionStatus> {
    const result = new Map<string, ConnectionStatus>();
    for (const [channelName, state] of this.channels) {
      result.set(channelName, state.status);
    }
    return result;
  }

  /**
   * 특정 채널의 대기 메시지 수 조회용 키
   */
  getChannelKey(roomId: string): string {
    return `chat-room-${roomId}`;
  }
}

// 싱글톤 인스턴스
export const connectionManager = new RealtimeConnectionManager();

// 타입 export
export type { ChannelState, ConnectionStateListener };

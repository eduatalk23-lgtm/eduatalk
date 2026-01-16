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
   * 연결 끊김 처리
   */
  handleDisconnect(channelName: string): void {
    const state = this.channels.get(channelName);
    if (!state) return;

    state.status = "disconnected";
    this.notifyListeners(channelName, "disconnected");

    console.log(`[ConnectionManager] Channel ${channelName} disconnected`);
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

    console.log(`[ConnectionManager] Reconnecting ${channelName} (attempt ${state.retryCount})`);
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

    // 재연결 시작
    this.startReconnect(channelName);

    try {
      await callback();

      // 성공
      this.setChannelState(channelName, "connected");
      this.resetRetryCount(channelName);
      console.log(`[ConnectionManager] Reconnected ${channelName} successfully`);
      return true;
    } catch (error) {
      console.error(`[ConnectionManager] Reconnect failed for ${channelName}:`, error);

      // 실패 - 최대 횟수 미만이면 자동 재시도 예약
      if (state.retryCount < this.MAX_RETRY_COUNT && this.isNetworkOnline()) {
        const delay = this.calculateRetryDelay(state.retryCount);
        console.log(`[ConnectionManager] Will retry in ${Math.round(delay / 1000)}s`);

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

  /**
   * 네트워크 상태 연동 초기화
   */
  initNetworkIntegration(): void {
    if (this.networkUnsubscribe) {
      return; // 이미 초기화됨
    }

    this.networkUnsubscribe = addNetworkStatusListener((online) => {
      if (online) {
        // 온라인 복귀 시 모든 disconnected 채널 재연결 상태로 전환
        console.log("[ConnectionManager] Network online. Checking channels...");
        for (const [channelName, state] of this.channels) {
          if (state.status === "disconnected") {
            this.setChannelState(channelName, "reconnecting");
          }
        }
      } else {
        // 오프라인 시 모든 채널 disconnected로 전환
        console.log("[ConnectionManager] Network offline. Marking channels disconnected.");
        for (const [channelName] of this.channels) {
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

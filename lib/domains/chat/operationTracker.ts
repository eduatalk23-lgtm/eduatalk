/**
 * Chat Operation Tracker
 *
 * 낙관적 업데이트와 Realtime 이벤트 간의 Race Condition을 방지합니다.
 * - 메시지 전송: tempId → realId 매핑 관리
 * - 리액션: pending 상태 추적으로 중복 카운트 방지
 * - 편집/삭제: 진행 중인 작업 추적
 */

/** 대기 중인 작업 타입 */
type PendingOperationType = "send" | "reaction" | "edit" | "delete";

/** 대기 중인 작업 정보 */
interface PendingOperation {
  type: PendingOperationType;
  startedAt: number;
  /** 작업이 속한 채팅방 ID */
  roomId?: string;
  /** 메시지 전송 시: content */
  content?: string;
  /** 리액션 시: emoji, isAdd */
  emoji?: string;
  isAdd?: boolean;
}

/** 리액션 키 생성 (messageId + emoji) */
function getReactionKey(messageId: string, emoji: string): string {
  return `${messageId}:${emoji}`;
}

/**
 * Operation Tracker
 *
 * 싱글톤 패턴으로 전역에서 접근 가능하며,
 * 진행 중인 작업을 추적하여 Realtime 이벤트에서 중복 처리를 방지합니다.
 */
class OperationTracker {
  /** 대기 중인 작업들 (key: operationId) */
  private pending = new Map<string, PendingOperation>();

  /** tempId → realId 매핑 (메시지 전송 완료 후) */
  private tempToReal = new Map<string, string>();

  /** realId → tempId 역매핑 (빠른 조회용) */
  private realToTemp = new Map<string, string>();

  /** 이미 처리된 Realtime 이벤트 ID (중복 방지) */
  private processedRealtimeIds = new Set<string>();

  /** 작업 타임아웃 (30초) */
  private readonly OPERATION_TIMEOUT_MS = 30000;

  /** Realtime ID 캐시 최대 크기 */
  private readonly MAX_REALTIME_IDS = 500;

  // ============================================
  // 메시지 전송
  // ============================================

  /**
   * 메시지 전송 시작
   * @param tempId 낙관적 업데이트용 임시 ID
   * @param content 메시지 내용 (중복 판단용)
   * @param roomId 채팅방 ID (clearForRoom 필터링용)
   */
  startSend(tempId: string, content: string, roomId?: string): void {
    this.pending.set(tempId, {
      type: "send",
      startedAt: Date.now(),
      content,
      roomId,
    });
  }

  /**
   * 메시지 전송 완료
   * @param tempId 임시 ID
   * @param realId 서버에서 반환된 실제 ID
   */
  completeSend(tempId: string, realId: string): void {
    // 매핑 저장
    this.tempToReal.set(tempId, realId);
    this.realToTemp.set(realId, tempId);

    // pending에서 제거
    this.pending.delete(tempId);

    // 10초 후 매핑 정리 (Realtime 이벤트가 충분히 처리된 후)
    setTimeout(() => {
      this.tempToReal.delete(tempId);
      this.realToTemp.delete(realId);
    }, 10000);
  }

  /**
   * 메시지 전송 실패
   * @param tempId 임시 ID
   */
  failSend(tempId: string): void {
    this.pending.delete(tempId);
  }

  /**
   * 메시지가 현재 전송 중인지 확인 (realId 기준)
   * Realtime INSERT 이벤트에서 사용
   */
  isMessageBeingSent(realId: string): boolean {
    // realId에 해당하는 tempId가 있고, 해당 작업이 아직 pending 상태인 경우
    const tempId = this.realToTemp.get(realId);
    if (!tempId) return false;

    const operation = this.pending.get(tempId);
    return !!operation && operation.type === "send";
  }

  /**
   * realId에 해당하는 tempId 조회
   * Realtime에서 tempId 메시지를 실제 메시지로 교체할 때 사용
   */
  getTempIdForRealId(realId: string): string | undefined {
    return this.realToTemp.get(realId);
  }

  /**
   * content와 sender로 매칭되는 pending 메시지 찾기
   * (전송 완료 전에 Realtime이 먼저 도착하는 경우 대비)
   */
  findPendingSendByContent(content: string): string | undefined {
    for (const [tempId, operation] of this.pending) {
      if (operation.type === "send" && operation.content === content) {
        return tempId;
      }
    }
    return undefined;
  }

  // ============================================
  // 리액션
  // ============================================

  /**
   * 리액션 토글 시작
   */
  startReaction(messageId: string, emoji: string, isAdd: boolean, roomId?: string): void {
    const key = getReactionKey(messageId, emoji);
    this.pending.set(key, {
      type: "reaction",
      startedAt: Date.now(),
      emoji,
      isAdd,
      roomId,
    });
  }

  /**
   * 리액션 토글 완료
   */
  completeReaction(messageId: string, emoji: string): void {
    const key = getReactionKey(messageId, emoji);
    this.pending.delete(key);
  }

  /**
   * 리액션이 pending 상태인지 확인
   * @returns { isPending: boolean, isAdd?: boolean } isAdd가 true면 추가 중, false면 제거 중
   */
  isReactionPending(
    messageId: string,
    emoji: string
  ): { isPending: boolean; isAdd?: boolean } {
    const key = getReactionKey(messageId, emoji);
    const operation = this.pending.get(key);

    if (!operation || operation.type !== "reaction") {
      return { isPending: false };
    }

    return { isPending: true, isAdd: operation.isAdd };
  }

  // ============================================
  // 편집/삭제
  // ============================================

  /**
   * 메시지 편집 시작
   */
  startEdit(messageId: string, roomId?: string): void {
    this.pending.set(`edit:${messageId}`, {
      type: "edit",
      startedAt: Date.now(),
      roomId,
    });
  }

  /**
   * 메시지 편집 완료
   */
  completeEdit(messageId: string): void {
    this.pending.delete(`edit:${messageId}`);
  }

  /**
   * 메시지 편집 중인지 확인
   */
  isEditPending(messageId: string): boolean {
    return this.pending.has(`edit:${messageId}`);
  }

  /**
   * 메시지 삭제 시작
   */
  startDelete(messageId: string, roomId?: string): void {
    this.pending.set(`delete:${messageId}`, {
      type: "delete",
      startedAt: Date.now(),
      roomId,
    });
  }

  /**
   * 메시지 삭제 완료
   */
  completeDelete(messageId: string): void {
    this.pending.delete(`delete:${messageId}`);
  }

  /**
   * 메시지 삭제 중인지 확인
   */
  isDeletePending(messageId: string): boolean {
    return this.pending.has(`delete:${messageId}`);
  }

  // ============================================
  // Realtime 중복 방지
  // ============================================

  /**
   * Realtime 이벤트를 처리됨으로 표시
   * @param eventId 이벤트 고유 ID (예: `insert:${messageId}`)
   */
  markRealtimeProcessed(eventId: string): void {
    this.processedRealtimeIds.add(eventId);

    // 캐시 크기 제한
    if (this.processedRealtimeIds.size > this.MAX_REALTIME_IDS) {
      // 오래된 항목 제거 (Set은 삽입 순서 유지)
      const iterator = this.processedRealtimeIds.values();
      const toDelete = Math.floor(this.MAX_REALTIME_IDS / 4);
      for (let i = 0; i < toDelete; i++) {
        const value = iterator.next().value;
        if (value) this.processedRealtimeIds.delete(value);
      }
    }
  }

  /**
   * Realtime 이벤트가 이미 처리되었는지 확인
   */
  isRealtimeProcessed(eventId: string): boolean {
    return this.processedRealtimeIds.has(eventId);
  }

  // ============================================
  // 정리
  // ============================================

  /**
   * 타임아웃된 작업들 정리
   */
  cleanup(): void {
    const now = Date.now();

    for (const [key, operation] of this.pending) {
      if (now - operation.startedAt > this.OPERATION_TIMEOUT_MS) {
        this.pending.delete(key);
      }
    }
  }

  /**
   * 특정 채팅방 관련 데이터 모두 정리
   * (채팅방 나갈 때 호출)
   */
  clearForRoom(roomId: string): void {
    // roomId가 있는 pending 작업만 정리 (다른 방의 작업은 유지)
    for (const [key, operation] of this.pending) {
      if (operation.roomId === roomId) {
        // send 타입이면 매핑도 정리
        if (operation.type === "send") {
          const realId = this.tempToReal.get(key);
          if (realId) {
            this.realToTemp.delete(realId);
            this.tempToReal.delete(key);
          }
        }
        this.pending.delete(key);
      }
    }
  }
}

// 싱글톤 인스턴스
export const operationTracker = new OperationTracker();

// 타입 export
export type { PendingOperation, PendingOperationType };

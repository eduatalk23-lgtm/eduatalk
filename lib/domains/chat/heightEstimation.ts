/**
 * 결정론적 메시지 높이 추정 (Deterministic Height Estimation)
 *
 * 메시지 메타데이터만으로 렌더링 전 높이를 추정하여
 * Virtuoso의 defaultItemHeight 정확도를 극대화.
 *
 * 사용처:
 * - Virtuoso defaultItemHeight 계산 (첫 50개 메시지의 가중 평균)
 * - prepend 시 스크롤 보상 오차 최소화
 */

import type { MessageGroupingInfo } from "./types";

// ============================================
// 기본 높이 상수 (실제 렌더링 결과 기반 측정값)
// ============================================

/** 메시지 본문 타입별 기본 높이 (px) */
const BASE_HEIGHTS = {
  /** 텍스트 1줄 (≤40자) */
  text_short: 52,
  /** 텍스트 2~3줄 (41~120자) */
  text_medium: 72,
  /** 텍스트 4줄+ (121자+) */
  text_long: 120,
  /** 다중 이미지 그리드 */
  image_grid: 180,
  /** 파일 카드 */
  file: 64,
  /** 비디오 플레이어 */
  video: 200,
  /** 오디오 플레이어 */
  audio: 80,
  /** 시스템 메시지 */
  system: 40,
  /** 삭제된 메시지 */
  deleted: 52,
} as const;

/** 부가 요소 높이 (px) */
const ADDON_HEIGHTS = {
  /** 발신자 이름 (showName=true) */
  senderName: 24,
  /** 날짜 구분선 */
  dateDivider: 44,
  /** "여기까지 읽었습니다" 구분선 */
  unreadDivider: 36,
  /** 답장 미리보기 */
  replyPreview: 40,
  /** 리액션 바 */
  reactions: 32,
  /** 링크 미리보기 카드 */
  linkPreview: 80,
  /** 그룹 메시지 간격 (py-0.5) */
  groupedPadding: 4,
  /** 비그룹 메시지 간격 (py-1.5) */
  ungroupedPadding: 12,
  /** 메시지 버블 내부 패딩 */
  bubblePadding: 16,
} as const;

// 이미지 렌더링 제약
const IMAGE_MAX_WIDTH = 280;
const IMAGE_MAX_HEIGHT = 320;

// ============================================
// 높이 추정 함수
// ============================================

interface MessageForEstimation {
  content: string;
  message_type: string;
  is_deleted: boolean;
  reply_to_id?: string | null;
  attachments?: Array<{
    width: number | null;
    height: number | null;
    attachment_type: string;
  }>;
  reactions?: Array<unknown>;
  replyTarget?: unknown | null;
  linkPreviews?: Array<unknown>;
}

/**
 * 메시지의 렌더링 높이를 메타데이터만으로 추정
 *
 * @param message 메시지 데이터 (content, message_type, attachments 등)
 * @param grouping 그룹핑 정보 (showName, showDateDivider 등)
 * @returns 추정 높이 (px)
 */
export function estimateMessageHeight(
  message: MessageForEstimation,
  grouping: Pick<MessageGroupingInfo, "showName" | "showDateDivider" | "showUnreadDivider" | "isGrouped">
): number {
  let height = 0;

  // ── 구분선 ──
  if (grouping.showDateDivider) height += ADDON_HEIGHTS.dateDivider;
  if (grouping.showUnreadDivider) height += ADDON_HEIGHTS.unreadDivider;

  // ── 발신자 이름 ──
  if (grouping.showName && !message.is_deleted && message.message_type !== "system") {
    height += ADDON_HEIGHTS.senderName;
  }

  // ── 메시지 본문 ──
  if (message.is_deleted) {
    height += BASE_HEIGHTS.deleted;
  } else if (message.message_type === "system") {
    height += BASE_HEIGHTS.system;
  } else if (message.message_type === "image" || message.message_type === "mixed") {
    height += estimateImageHeight(message);
  } else if (message.message_type === "video") {
    height += BASE_HEIGHTS.video;
  } else if (message.message_type === "audio") {
    height += BASE_HEIGHTS.audio;
  } else if (message.message_type === "file") {
    height += BASE_HEIGHTS.file;
  } else {
    // 텍스트 메시지
    height += estimateTextHeight(message.content);
  }

  // ── mixed 타입: 텍스트 + 미디어 ──
  if (message.message_type === "mixed" && message.content) {
    height += estimateTextHeight(message.content);
  }

  // ── 부가 요소 ──
  if (message.replyTarget) height += ADDON_HEIGHTS.replyPreview;
  if (message.reactions && message.reactions.length > 0) height += ADDON_HEIGHTS.reactions;
  if (message.linkPreviews && message.linkPreviews.length > 0) height += ADDON_HEIGHTS.linkPreview;

  // ── 간격 ──
  height += grouping.isGrouped ? ADDON_HEIGHTS.groupedPadding : ADDON_HEIGHTS.ungroupedPadding;

  // ── 버블 패딩 ──
  if (message.message_type !== "system") {
    height += ADDON_HEIGHTS.bubblePadding;
  }

  return height;
}

/**
 * 텍스트 길이 기반 높이 추정
 */
function estimateTextHeight(content: string | null | undefined): number {
  const len = content?.length ?? 0;
  const newlines = content?.match(/\n/g)?.length ?? 0;

  // 줄바꿈이 많은 경우 줄 수 기반 계산
  if (newlines > 3) {
    const lines = Math.min(newlines + 1, 12); // 최대 12줄 (접힘 있으므로)
    return 20 + lines * 20; // 기본 패딩 + 줄당 20px
  }

  if (len <= 40) return BASE_HEIGHTS.text_short;
  if (len <= 120) return BASE_HEIGHTS.text_medium;
  return BASE_HEIGHTS.text_long;
}

/**
 * 이미지 첨부 높이 추정 (DB 치수 활용)
 */
function estimateImageHeight(message: MessageForEstimation): number {
  const attachments = message.attachments?.filter(
    (a) => a.attachment_type === "image"
  );
  if (!attachments || attachments.length === 0) return BASE_HEIGHTS.image_grid;

  // 단일 이미지: DB 치수로 정확한 aspect-ratio 계산
  if (attachments.length === 1) {
    const att = attachments[0];
    if (att.width && att.height && att.width > 0 && att.height > 0) {
      const aspect = att.width / att.height;
      const renderedWidth = Math.min(IMAGE_MAX_WIDTH, att.width);
      const renderedHeight = renderedWidth / aspect;
      return Math.min(IMAGE_MAX_HEIGHT, renderedHeight);
    }
    // 치수 없음: 4:3 fallback
    return IMAGE_MAX_WIDTH * 0.75;
  }

  // 다중 이미지: 균일 그리드
  return BASE_HEIGHTS.image_grid;
}

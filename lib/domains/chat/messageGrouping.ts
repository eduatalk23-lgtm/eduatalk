/**
 * 메시지 그룹핑 유틸리티
 *
 * 연속된 메시지를 그룹핑하고 날짜 구분선을 처리합니다.
 */

import { isSameDay, differenceInSeconds, format, isValid } from "date-fns";
import { ko } from "date-fns/locale";
import type {
  ChatMessageWithSender,
  ChatMessageWithGrouping,
  MessageGroupingInfo,
} from "./types";

/** 그룹핑 시간 임계값 (초) - 1분 */
const GROUPING_THRESHOLD_SECONDS = 60;

/**
 * 안전한 날짜 파싱 (broadcast payload의 비정상 날짜 방어)
 * @returns 유효한 Date 객체 또는 null
 */
function safeParseDate(dateStr: string | null | undefined): Date | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  return isValid(d) ? d : null;
}

/**
 * 두 메시지가 같은 날인지 확인
 */
export function isSameMessageDay(date1: string, date2: string): boolean {
  const d1 = safeParseDate(date1);
  const d2 = safeParseDate(date2);
  if (!d1 || !d2) return false;
  return isSameDay(d1, d2);
}

/**
 * 두 메시지가 그룹핑 시간 임계값 내에 있는지 확인
 */
export function isWithinGroupingThreshold(
  date1: string,
  date2: string
): boolean {
  const d1 = safeParseDate(date1);
  const d2 = safeParseDate(date2);
  if (!d1 || !d2) return false;
  const diff = Math.abs(differenceInSeconds(d1, d2));
  return diff <= GROUPING_THRESHOLD_SECONDS;
}

/**
 * 날짜 구분선용 포맷 (예: "2024년 1월 15일 월요일")
 */
export function formatDateDivider(dateStr: string): string {
  const d = safeParseDate(dateStr);
  if (!d) return "";
  return format(d, "yyyy년 M월 d일 EEEE", { locale: ko });
}

/**
 * 메시지 시간 포맷 (예: "오후 3:45")
 */
export function formatMessageTime(dateStr: string): string {
  const d = safeParseDate(dateStr);
  if (!d) return "";
  return format(d, "a h:mm", { locale: ko });
}

/**
 * 메시지 배열에 그룹핑 정보를 추가
 *
 * 그룹핑 규칙:
 * - 같은 발신자 + 1분 이내 = 그룹핑
 * - 시스템 메시지 = 그룹핑 중단
 * - 답장 메시지 = 그룹핑 중단
 * - 날짜 변경 = 그룹핑 중단 + 날짜 구분선
 *
 * @param messages 메시지 배열 (시간순 정렬됨)
 * @returns 그룹핑 정보가 포함된 메시지 배열
 */
export function processMessagesWithGrouping(
  messages: ChatMessageWithSender[]
): ChatMessageWithGrouping[] {
  if (messages.length === 0) return [];

  const result: ChatMessageWithGrouping[] = [];

  for (let i = 0; i < messages.length; i++) {
    const current = messages[i];
    const prev = i > 0 ? messages[i - 1] : null;
    const next = i < messages.length - 1 ? messages[i + 1] : null;

    // 이전 메시지와 날짜가 다른지 확인
    const showDateDivider =
      !prev || !isSameMessageDay(prev.created_at, current.created_at);
    const dateDividerText = showDateDivider
      ? formatDateDivider(current.created_at)
      : undefined;

    // 현재 메시지가 이전 메시지와 그룹핑될 수 있는지 확인
    const canGroupWithPrev =
      prev &&
      !showDateDivider && // 날짜 변경 시 그룹핑 안 함
      current.message_type !== "system" &&
      prev.message_type !== "system" &&
      current.sender_id === prev.sender_id &&
      isWithinGroupingThreshold(prev.created_at, current.created_at) &&
      !current.reply_to_id; // 답장 메시지는 그룹핑 안 함

    // 다음 메시지가 현재 메시지와 그룹핑될 수 있는지 확인
    const nextIsGrouped =
      next &&
      isSameMessageDay(current.created_at, next.created_at) &&
      next.message_type !== "system" &&
      current.message_type !== "system" &&
      current.sender_id === next.sender_id &&
      isWithinGroupingThreshold(current.created_at, next.created_at) &&
      !next.reply_to_id;

    const grouping: MessageGroupingInfo = {
      // 그룹 첫 메시지에만 이름 표시 (이전과 그룹핑 안 됨)
      showName: !canGroupWithPrev,
      // 그룹 마지막 메시지에만 시간 표시 (다음과 그룹핑 안 됨)
      showTime: !nextIsGrouped,
      // 이전 메시지와 그룹핑됨 (간격 축소용)
      isGrouped: !!canGroupWithPrev,
      showDateDivider,
      dateDividerText,
    };

    result.push({
      ...current,
      grouping,
    });
  }

  return result;
}

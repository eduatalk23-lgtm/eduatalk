/**
 * 콘텐츠 타입별 아이콘/이모지 상수
 */

export const CONTENT_TYPE_EMOJIS = {
  book: "📚",
  lecture: "🎧",
  custom: "📝",
} as const;

export type ContentType = keyof typeof CONTENT_TYPE_EMOJIS;


/**
 * Content Type Utilities
 * 
 * Shared content type icons, labels, and helper functions
 * used across the plan directory components.
 */

import { Book, Headphones, FileText, type LucideIcon } from "lucide-react";

export const CONTENT_TYPE_ICONS: Record<string, LucideIcon> = {
  book: Book,
  lecture: Headphones,
  custom: FileText,
};

export const CONTENT_TYPE_LABELS = {
  book: "교재",
  lecture: "강의",
  custom: "커스텀",
} as const;

export type ContentType = keyof typeof CONTENT_TYPE_LABELS;

/**
 * Get the icon component for a content type (lucide-react)
 */
export function getContentTypeIcon(type: string): LucideIcon {
  return CONTENT_TYPE_ICONS[type] || FileText;
}

/**
 * Get the label for a content type
 */
export function getContentTypeLabel(type: string): string {
  return CONTENT_TYPE_LABELS[type as ContentType] || type;
}

/**
 * Format content range display string
 */
export function formatContentRange(
  contentType: string,
  startRange: number | null,
  endRange: number | null
): string {
  if (startRange === null || endRange === null) {
    return "";
  }

  if (contentType === "book") {
    return `${startRange}-${endRange}페이지`;
  } else if (contentType === "lecture") {
    if (startRange === endRange) {
      return `${startRange}강`;
    }
    return `${startRange}-${endRange}강`;
  }
  
  return `${startRange}-${endRange}`;
}

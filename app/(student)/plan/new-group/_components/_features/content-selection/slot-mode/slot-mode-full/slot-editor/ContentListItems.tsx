"use client";

import { cn } from "@/lib/cn";
import {
  BookOpen,
  Video,
  FileText,
  Check,
  Sparkles,
  Package,
} from "lucide-react";
import type {
  ContentListItemProps,
  RecommendedContentListItemProps,
  MasterContentListItemProps,
} from "./types";

/**
 * 학생 콘텐츠 리스트 아이템
 */
export function ContentListItem({
  content,
  isLinked,
  onSelect,
  disabled,
}: ContentListItemProps) {
  const TypeIcon =
    content.content_type === "book"
      ? BookOpen
      : content.content_type === "lecture"
        ? Video
        : FileText;

  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled || isLinked}
      className={cn(
        "w-full rounded-lg border p-3 text-left transition-all",
        isLinked
          ? "border-green-300 bg-green-50"
          : "border-gray-200 bg-white hover:border-blue-300 hover:bg-blue-50",
        disabled && "cursor-not-allowed opacity-60"
      )}
    >
      <div className="flex items-center gap-2">
        <TypeIcon className="h-4 w-4 flex-shrink-0 text-gray-400" />
        <div className="flex-1 truncate text-sm font-medium text-gray-800">
          {content.title}
        </div>
        {isLinked && <Check className="h-4 w-4 text-green-600" />}
      </div>
      {content.subtitle && (
        <div className="mt-1 truncate pl-6 text-xs text-gray-500">
          {content.subtitle}
        </div>
      )}
    </button>
  );
}

/**
 * 추천 콘텐츠 리스트 아이템
 */
export function RecommendedContentListItem({
  content,
  onSelect,
  disabled,
}: RecommendedContentListItemProps) {
  const TypeIcon = content.content_type === "book" ? BookOpen : Video;

  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      className={cn(
        "w-full rounded-lg border border-amber-200 bg-amber-50/50 p-3 text-left transition-all hover:border-amber-400 hover:bg-amber-100",
        disabled && "cursor-not-allowed opacity-60"
      )}
    >
      <div className="flex items-center gap-2">
        <TypeIcon className="h-4 w-4 flex-shrink-0 text-amber-600" />
        <div className="flex-1 truncate text-sm font-medium text-gray-800">
          {content.title}
        </div>
      </div>
      {content.recommendationReason && (
        <div className="mt-1 flex items-center gap-1 pl-6 text-xs text-amber-600">
          <Sparkles className="h-3 w-3" />
          <span>{content.recommendationReason}</span>
        </div>
      )}
    </button>
  );
}

/**
 * 마스터 콘텐츠 리스트 아이템
 */
export function MasterContentListItem({
  content,
  onSelect,
  disabled,
}: MasterContentListItemProps) {
  const TypeIcon = content.content_type === "book" ? BookOpen : Video;

  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      className={cn(
        "w-full rounded-lg border border-indigo-200 bg-indigo-50/50 p-3 text-left transition-all hover:border-indigo-400 hover:bg-indigo-100",
        disabled && "cursor-not-allowed opacity-60"
      )}
    >
      <div className="flex items-center gap-2">
        <TypeIcon className="h-4 w-4 flex-shrink-0 text-indigo-600" />
        <div className="flex-1 truncate text-sm font-medium text-gray-800">
          {content.title}
        </div>
        <Package className="h-4 w-4 flex-shrink-0 text-indigo-400" />
      </div>
      <div className="mt-1 flex items-center gap-1.5 pl-6 text-xs text-gray-500">
        {content.subject && <span>{content.subject}</span>}
        {content.publisher_or_academy && (
          <>
            <span>·</span>
            <span>{content.publisher_or_academy}</span>
          </>
        )}
      </div>
    </button>
  );
}

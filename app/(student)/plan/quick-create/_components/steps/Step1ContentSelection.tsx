"use client";

import { useState, useEffect, useCallback } from "react";
import { BookOpen, Sparkles, History, Search, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { getRecentFreeLearningItems } from "@/lib/domains/content/actions/freeItems";
import {
  type ContentSourceType,
  type SelectedContent,
  type FreeLearningType,
  FREE_LEARNING_OPTIONS,
  DURATION_OPTIONS,
} from "../types";

interface Step1ContentSelectionProps {
  studentId: string;
  tenantId: string | null;
  contentSource: ContentSourceType;
  content: SelectedContent | null;
  onContentSourceChange: (source: ContentSourceType) => void;
  onContentChange: (content: SelectedContent | null) => void;
}

interface RecentItem {
  id: string;
  title: string;
  itemType: FreeLearningType;
  estimatedMinutes?: number | null;
}

const SOURCE_TABS = [
  { id: "free" as const, label: "자유 학습", icon: Sparkles },
  { id: "recent" as const, label: "최근 항목", icon: History },
  { id: "existing" as const, label: "기존 콘텐츠", icon: BookOpen },
];

export function Step1ContentSelection({
  studentId,
  tenantId,
  contentSource,
  content,
  onContentSourceChange,
  onContentChange,
}: Step1ContentSelectionProps) {
  // 자유 학습 상태
  const [freeTitle, setFreeTitle] = useState(content?.title || "");
  const [freeLearningType, setFreeLearningType] = useState<FreeLearningType>(
    content?.freeLearningType || "free"
  );
  const [estimatedMinutes, setEstimatedMinutes] = useState(
    content?.estimatedMinutes || 30
  );

  // 최근 항목
  const [recentItems, setRecentItems] = useState<RecentItem[]>([]);
  const [isLoadingRecent, setIsLoadingRecent] = useState(false);

  // 기존 콘텐츠 검색
  const [searchQuery, setSearchQuery] = useState("");

  // 최근 항목 로드
  useEffect(() => {
    if (contentSource === "recent" && studentId) {
      setIsLoadingRecent(true);
      getRecentFreeLearningItems(studentId, 10)
        .then((result) => {
          if (result.success && result.data) {
            setRecentItems(
              result.data.map((item) => ({
                id: item.id,
                title: item.title,
                itemType: item.itemType as FreeLearningType,
                estimatedMinutes: item.estimatedMinutes,
              }))
            );
          }
        })
        .finally(() => setIsLoadingRecent(false));
    }
  }, [contentSource, studentId]);

  // 자유 학습 내용 변경 시 content 업데이트
  useEffect(() => {
    if (contentSource === "free" && freeTitle.trim()) {
      onContentChange({
        title: freeTitle.trim(),
        isFreeLearning: true,
        freeLearningType,
        estimatedMinutes,
      });
    } else if (contentSource === "free" && !freeTitle.trim()) {
      onContentChange(null);
    }
  }, [contentSource, freeTitle, freeLearningType, estimatedMinutes, onContentChange]);

  // 최근 항목 선택
  const handleRecentItemClick = useCallback(
    (item: RecentItem) => {
      onContentChange({
        title: item.title,
        isFreeLearning: true,
        freeLearningType: item.itemType,
        estimatedMinutes: item.estimatedMinutes || 30,
      });
    },
    [onContentChange]
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
          무엇을 학습할까요?
        </h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          학습할 콘텐츠를 선택하거나 직접 입력하세요
        </p>
      </div>

      {/* Source Tabs */}
      <div className="flex gap-2 rounded-lg bg-gray-100 p-1 dark:bg-gray-800">
        {SOURCE_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => onContentSourceChange(tab.id)}
            className={cn(
              "flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              contentSource === tab.id
                ? "bg-white text-gray-900 shadow dark:bg-gray-700 dark:text-gray-100"
                : "text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200"
            )}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Free Learning Form */}
      {contentSource === "free" && (
        <div className="space-y-4">
          {/* Title Input */}
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
              제목 *
            </label>
            <input
              type="text"
              value={freeTitle}
              onChange={(e) => setFreeTitle(e.target.value)}
              placeholder="예: 수학 50-60쪽 복습"
              className={cn(
                "w-full rounded-lg border px-4 py-3 text-sm",
                "border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20",
                "dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
              )}
            />
          </div>

          {/* Learning Type */}
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
              학습 유형
            </label>
            <div className="grid grid-cols-3 gap-2">
              {FREE_LEARNING_OPTIONS.map((option) => (
                <button
                  key={option.type}
                  type="button"
                  onClick={() => setFreeLearningType(option.type)}
                  className={cn(
                    "flex flex-col items-center gap-1 rounded-lg border-2 p-3 transition-all",
                    freeLearningType === option.type
                      ? "border-blue-500 bg-blue-50 dark:bg-blue-900/30"
                      : "border-gray-200 hover:border-gray-300 dark:border-gray-700"
                  )}
                >
                  <span className="text-2xl">{option.icon}</span>
                  <span className="text-xs font-medium">{option.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Duration */}
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
              예상 시간
            </label>
            <div className="flex flex-wrap gap-2">
              {DURATION_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setEstimatedMinutes(option.value)}
                  className={cn(
                    "rounded-full border px-4 py-2 text-sm font-medium transition-all",
                    estimatedMinutes === option.value
                      ? "border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                      : "border-gray-200 text-gray-600 hover:border-gray-300 dark:border-gray-700 dark:text-gray-400"
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Recent Items */}
      {contentSource === "recent" && (
        <div className="space-y-3">
          {isLoadingRecent ? (
            <div className="flex items-center justify-center py-8">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
            </div>
          ) : recentItems.length === 0 ? (
            <div className="rounded-lg border-2 border-dashed border-gray-200 p-8 text-center dark:border-gray-700">
              <History className="mx-auto h-8 w-8 text-gray-400" />
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                최근 사용한 항목이 없습니다
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {recentItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleRecentItemClick(item)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-lg border-2 p-3 text-left transition-all",
                    content?.title === item.title
                      ? "border-blue-500 bg-blue-50 dark:bg-blue-900/30"
                      : "border-gray-200 hover:border-gray-300 dark:border-gray-700"
                  )}
                >
                  <span className="text-xl">
                    {FREE_LEARNING_OPTIONS.find((o) => o.type === item.itemType)
                      ?.icon || "📚"}
                  </span>
                  <div className="flex-1">
                    <div className="font-medium text-gray-900 dark:text-gray-100">
                      {item.title}
                    </div>
                    {item.estimatedMinutes && (
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {item.estimatedMinutes}분
                      </div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Existing Content Search */}
      {contentSource === "existing" && (
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="콘텐츠 검색..."
              className={cn(
                "w-full rounded-lg border py-3 pl-10 pr-4 text-sm",
                "border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20",
                "dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
              )}
            />
          </div>
          <div className="rounded-lg border-2 border-dashed border-gray-200 p-8 text-center dark:border-gray-700">
            <BookOpen className="mx-auto h-8 w-8 text-gray-400" />
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              기존 콘텐츠 검색 기능은 준비 중입니다
            </p>
            <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
              자유 학습 탭을 사용해주세요
            </p>
          </div>
        </div>
      )}

      {/* Selected Content Preview */}
      {content && (
        <div className="rounded-lg bg-green-50 p-4 dark:bg-green-900/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-xl">
                {content.isFreeLearning
                  ? FREE_LEARNING_OPTIONS.find(
                      (o) => o.type === content.freeLearningType
                    )?.icon || "📚"
                  : "📖"}
              </span>
              <div>
                <div className="font-medium text-green-800 dark:text-green-300">
                  {content.title}
                </div>
                <div className="text-xs text-green-600 dark:text-green-400">
                  {content.estimatedMinutes}분 예상
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                onContentChange(null);
                setFreeTitle("");
              }}
              className="rounded p-1 text-green-600 hover:bg-green-100 dark:text-green-400 dark:hover:bg-green-900/30"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

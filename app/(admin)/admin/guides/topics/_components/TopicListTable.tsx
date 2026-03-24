"use client";

import { useState } from "react";
import { Trash2, Sparkles } from "lucide-react";
import { cn } from "@/lib/cn";
import type { SuggestedTopic } from "@/lib/domains/guide/types";
import { GUIDE_TYPE_LABELS } from "@/lib/domains/guide/types";

const TYPE_COLORS: Record<string, string> = {
  reading:
    "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  topic_exploration:
    "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  subject_performance:
    "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  experiment:
    "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
  program:
    "bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300",
};

interface Props {
  topics: SuggestedTopic[];
  isLoading: boolean;
  onDelete: (topicId: string) => Promise<void>;
  onGenerateGuide: (topic: SuggestedTopic) => void;
}

export function TopicListTable({ topics, isLoading, onDelete, onGenerateGuide }: Props) {
  const [deletingId, setDeletingId] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="h-16 rounded-lg bg-secondary-100 dark:bg-secondary-800 animate-pulse"
          />
        ))}
      </div>
    );
  }

  if (topics.length === 0) {
    return (
      <div className="flex items-center justify-center py-16 text-sm text-[var(--text-secondary)] border-2 border-dashed border-secondary-200 dark:border-secondary-700 rounded-lg">
        검색 결과가 없습니다.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-secondary-200 dark:border-secondary-700">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-secondary-50 dark:bg-secondary-800/50 text-left whitespace-nowrap">
            <th className="px-4 py-3 font-medium text-[var(--text-secondary)]">
              제목
            </th>
            <th className="px-3 py-3 font-medium text-[var(--text-secondary)] w-20">
              유형
            </th>
            <th className="px-3 py-3 font-medium text-[var(--text-secondary)] w-20 hidden md:table-cell">
              과목
            </th>
            <th className="px-3 py-3 font-medium text-[var(--text-secondary)] w-20 hidden md:table-cell">
              계열
            </th>
            <th className="px-3 py-3 font-medium text-[var(--text-secondary)] w-14 text-center">
              사용
            </th>
            <th className="px-3 py-3 font-medium text-[var(--text-secondary)] w-14 text-center">
              가이드
            </th>
            <th className="px-3 py-3 font-medium text-[var(--text-secondary)] w-28 hidden lg:table-cell">
              AI 모델
            </th>
            <th className="px-3 py-3 font-medium text-[var(--text-secondary)] w-20 hidden lg:table-cell">
              생성일
            </th>
            <th className="px-2 py-3 w-24 text-center font-medium text-[var(--text-secondary)]">
              액션
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-secondary-100 dark:divide-secondary-800">
          {topics.map((topic) => (
            <tr
              key={topic.id}
              className="hover:bg-secondary-50 dark:hover:bg-secondary-800/30 transition-colors"
            >
              {/* 제목 + 교육과정 체계 + 추천이유 */}
              <td className="px-4 py-3">
                <p className="font-medium text-[var(--text-heading)] line-clamp-1">
                  {topic.title}
                </p>
                {(topic.subject_group || topic.major_unit) && (
                  <p className="text-xs text-primary-600 dark:text-primary-400 mt-0.5 line-clamp-1">
                    {[
                      topic.subject_group,
                      topic.subject_name,
                      topic.major_unit,
                      topic.minor_unit,
                    ]
                      .filter(Boolean)
                      .join(" > ")}
                  </p>
                )}
                {topic.reason && (
                  <p className="text-xs text-[var(--text-secondary)] mt-0.5 line-clamp-1">
                    {topic.reason}
                  </p>
                )}
              </td>

              {/* 유형 */}
              <td className="px-3 py-3">
                <span
                  className={cn(
                    "inline-block px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap",
                    TYPE_COLORS[topic.guide_type] ?? "",
                  )}
                >
                  {GUIDE_TYPE_LABELS[topic.guide_type as keyof typeof GUIDE_TYPE_LABELS] ??
                    topic.guide_type}
                </span>
              </td>

              {/* 과목 */}
              <td className="px-3 py-3 hidden md:table-cell text-xs text-[var(--text-secondary)] whitespace-nowrap">
                {topic.subject_name ?? "—"}
              </td>

              {/* 계열 */}
              <td className="px-3 py-3 hidden md:table-cell text-xs text-[var(--text-secondary)] whitespace-nowrap">
                {topic.career_field ?? "—"}
              </td>

              {/* 사용 횟수 */}
              <td className="px-3 py-3 text-center text-xs whitespace-nowrap">
                {topic.used_count > 0 ? (
                  <span className="font-medium text-[var(--text-primary)]">
                    {topic.used_count}회
                  </span>
                ) : (
                  <span className="text-[var(--text-secondary)]">—</span>
                )}
              </td>

              {/* 가이드 생성 수 */}
              <td className="px-3 py-3 text-center text-xs whitespace-nowrap">
                {topic.guide_created_count > 0 ? (
                  <span className="font-medium text-green-600 dark:text-green-400">
                    {topic.guide_created_count}건
                  </span>
                ) : (
                  <span className="text-[var(--text-secondary)]">—</span>
                )}
              </td>

              {/* AI 모델 */}
              <td className="px-3 py-3 hidden lg:table-cell whitespace-nowrap">
                {topic.ai_model_version ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300">
                    AI
                    <span className="text-[10px] opacity-70">
                      {topic.ai_model_version}
                    </span>
                  </span>
                ) : (
                  <span className="text-xs text-[var(--text-secondary)]">—</span>
                )}
              </td>

              {/* 생성일 */}
              <td className="px-3 py-3 hidden lg:table-cell text-xs text-[var(--text-secondary)] whitespace-nowrap">
                {new Date(topic.created_at).toLocaleDateString("ko-KR")}
              </td>

              {/* 액션 */}
              <td className="px-2 py-3">
                <div className="flex items-center justify-center gap-1">
                  <button
                    onClick={() => onGenerateGuide(topic)}
                    title="이 주제로 가이드 생성"
                    className="p-1.5 rounded-md text-secondary-400 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={async (e) => {
                      e.stopPropagation();
                      if (!confirm("이 주제를 삭제하시겠습니까?")) return;
                      setDeletingId(topic.id);
                      await onDelete(topic.id);
                      setDeletingId(null);
                    }}
                    disabled={deletingId === topic.id}
                    title="삭제"
                    className="p-1.5 rounded-md text-secondary-400 hover:text-error-500 hover:bg-error-50 dark:hover:bg-error-900/20 transition-colors disabled:opacity-40"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

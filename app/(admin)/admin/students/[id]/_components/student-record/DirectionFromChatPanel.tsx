"use client";

// ============================================
// 방향 설정 패널 — 논의에서 도출된 방향을 direction 레이어에 전달
// ============================================

import { useState, useCallback } from "react";
import { Compass, Send, Loader2, Check, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { useStudentRecordContext } from "./StudentRecordContext";

interface DirectionFromChatPanelProps {
  subjectId: string;
  subjectName: string;
  onClose?: () => void;
}

export function DirectionFromChatPanel({
  subjectId,
  subjectName,
  onClose,
}: DirectionFromChatPanelProps) {
  const { studentId } = useStudentRecordContext();
  const [direction, setDirection] = useState("");
  const [keywords, setKeywords] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = useCallback(async () => {
    if (!direction.trim()) return;
    setIsSubmitting(true);

    try {
      const { saveSetekDirectionAction } = await import("@/lib/domains/student-record/actions/record");
      const schoolYear = new Date().getFullYear();
      const keywordList = keywords
        .split(",")
        .map((k) => k.trim())
        .filter(Boolean);

      const result = await saveSetekDirectionAction({
        studentId,
        subjectId,
        schoolYear,
        direction: direction.trim(),
        keywords: keywordList,
      });

      if (result.success) {
        setSubmitted(true);
      }
    } catch {
      // 서버 에러 시 UI에서 별도 표시하지 않음 (submitted 유지 안됨으로 재시도 가능)
    } finally {
      setIsSubmitting(false);
    }
  }, [direction, keywords, studentId, subjectId]);

  if (submitted) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50/50 p-3 dark:border-emerald-800 dark:bg-emerald-950/20">
        <Check className="h-4 w-4 text-emerald-600" />
        <span className="text-xs font-medium text-emerald-700 dark:text-emerald-300">
          "{subjectName}" 방향이 설정되었습니다
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-violet-200 bg-violet-50/50 p-3 dark:border-violet-800 dark:bg-violet-950/20">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Compass className="h-3.5 w-3.5 text-violet-500" />
          <span className="text-xs font-semibold text-violet-700 dark:text-violet-300">방향 설정</span>
          <span className="text-[10px] text-violet-400">· {subjectName}</span>
        </div>
        {onClose && (
          <button type="button" onClick={onClose} className="p-0.5 rounded hover:bg-violet-100 dark:hover:bg-violet-900/30">
            <X className="h-3 w-3 text-violet-400" />
          </button>
        )}
      </div>

      <textarea
        value={direction}
        onChange={(e) => setDirection(e.target.value)}
        placeholder="세특 방향을 입력하세요... (예: 유전자 편집 기술의 윤리적 측면을 탐구하고 생명공학 전공 적합성을 드러내는 방향)"
        rows={3}
        className="w-full rounded border border-violet-200 bg-white px-2 py-1.5 text-xs text-[var(--color-text-primary)] placeholder:text-violet-300 resize-none focus:outline-none focus:ring-1 focus:ring-violet-400 dark:border-violet-700 dark:bg-violet-950/30"
      />

      <input
        type="text"
        value={keywords}
        onChange={(e) => setKeywords(e.target.value)}
        placeholder="핵심 키워드 (쉼표 구분: 유전자편집, CRISPR, 생명윤리)"
        className="w-full rounded border border-violet-200 bg-white px-2 py-1 text-xs text-[var(--color-text-primary)] placeholder:text-violet-300 focus:outline-none focus:ring-1 focus:ring-violet-400 dark:border-violet-700 dark:bg-violet-950/30"
      />

      <div className="flex justify-end">
        <button
          type="button"
          disabled={!direction.trim() || isSubmitting}
          onClick={handleSubmit}
          className={cn(
            "inline-flex items-center gap-1 rounded px-3 py-1 text-[11px] font-medium transition-colors",
            direction.trim() && !isSubmitting
              ? "bg-violet-600 text-white hover:bg-violet-700"
              : "bg-violet-200 text-violet-400 cursor-not-allowed",
          )}
        >
          {isSubmitting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
          방향 설정
        </button>
      </div>
    </div>
  );
}

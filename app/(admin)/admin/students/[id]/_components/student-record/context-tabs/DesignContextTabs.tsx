"use client";

// ============================================
// context-tabs/DesignContextTabs — 설계/전략 탭
// SummaryTab, StorylineTab, RoadmapTab, InterviewTab
// ============================================

import { useState, useEffect } from "react";
import type { StorylineTabData } from "@/lib/domains/student-record/types";
import { EmptyMessage, LoadingMessage, ErrorMessage } from "./shared";

// ── 로컬 타입 ──

interface SummaryData {
  id: string;
  summary_title: string;
  summary_text: string;
  status: string;
  created_at: string;
}

interface InterviewRow {
  question: string;
  question_type: string;
  difficulty: string | null;
  suggested_answer: string | null;
}

const Q_TYPE_LABELS: Record<string, string> = {
  factual: "사실", reasoning: "추론", application: "적용",
  value: "가치", controversial: "논쟁",
};

// ── 5. 활동 요약 탭 (lazy fetch) ──

export function SummaryTab({ studentId }: { studentId: string }) {
  const [data, setData] = useState<SummaryData[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { fetchActivitySummaries } = await import("@/lib/domains/student-record/actions/activitySummary");
        const result = await fetchActivitySummaries(studentId);
        if (!cancelled) {
          if (result.success && result.data) {
            setData(result.data);
          } else if (!result.success) {
            setError(result.error ?? "조회 실패");
          }
        }
      } catch {
        if (!cancelled) setError("요약서를 불러올 수 없습니다.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [studentId]);

  if (loading) return <LoadingMessage />;
  if (error) return <ErrorMessage>{error}</ErrorMessage>;
  if (!data || data.length === 0) return <EmptyMessage>활동 요약서가 없습니다.</EmptyMessage>;

  const latest = data[0];

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-[10px] text-[var(--text-tertiary)]">
        <span className="font-medium text-[var(--text-secondary)]">{latest.summary_title}</span>
        <span>{new Date(latest.created_at).toLocaleDateString("ko-KR")} · {latest.status}</span>
      </div>
      <div className="max-h-[300px] overflow-y-auto rounded border border-[var(--border-secondary)] p-2">
        <p className="whitespace-pre-wrap text-xs leading-relaxed text-[var(--text-primary)]">
          {latest.summary_text}
        </p>
      </div>
      {data.length > 1 && (
        <p className="text-[10px] text-[var(--text-tertiary)]">이전 버전 {data.length - 1}건</p>
      )}
    </div>
  );
}

// ── 6. 스토리라인 탭 ──

export function StorylineTab({ data }: { data?: StorylineTabData | null }) {
  if (!data) return <EmptyMessage>스토리라인 데이터를 불러오는 중입니다.</EmptyMessage>;
  const { storylines } = data;
  if (storylines.length === 0) return <EmptyMessage>등록된 스토리라인이 없습니다.</EmptyMessage>;

  return (
    <div className="space-y-2">
      <p className="text-[10px] text-[var(--text-tertiary)]">{storylines.length}개 스토리라인</p>
      {storylines.map((s) => (
        <div key={s.id} className="rounded border border-[var(--border-secondary)] p-2">
          <div className="mb-1 flex items-center justify-between">
            <span className="text-xs font-medium text-[var(--text-primary)]">{s.title}</span>
            {s.career_field && (
              <span className="rounded-full bg-teal-100 px-1.5 py-0.5 text-[10px] text-teal-700 dark:bg-teal-900/30 dark:text-teal-300">
                {s.career_field}
              </span>
            )}
          </div>
          {s.keywords.length > 0 && (
            <div className="mb-1 flex flex-wrap gap-1">
              {s.keywords.map((kw) => (
                <span key={kw} className="rounded bg-[var(--surface-hover)] px-1 py-0.5 text-[10px] text-[var(--text-tertiary)]">
                  {kw}
                </span>
              ))}
            </div>
          )}
          <div className="flex gap-3 text-[10px] text-[var(--text-tertiary)]">
            {s.grade_1_theme && <span>1학년: {s.grade_1_theme}</span>}
            {s.grade_2_theme && <span>2학년: {s.grade_2_theme}</span>}
            {s.grade_3_theme && <span>3학년: {s.grade_3_theme}</span>}
          </div>
          {s.strength && (
            <p className="mt-1 text-[10px] text-[var(--text-secondary)]">{s.strength}</p>
          )}
        </div>
      ))}
    </div>
  );
}

// ── 12. 로드맵 탭 ──

export function RoadmapTab({ data }: { data?: StorylineTabData | null }) {
  if (!data) return <EmptyMessage>로드맵 데이터를 불러오는 중입니다.</EmptyMessage>;
  const { roadmapItems } = data;
  if (roadmapItems.length === 0) return <EmptyMessage>등록된 로드맵이 없습니다.</EmptyMessage>;

  const byGrade = new Map<number, typeof roadmapItems>();
  for (const item of roadmapItems) {
    const arr = byGrade.get(item.grade) ?? [];
    arr.push(item);
    byGrade.set(item.grade, arr);
  }

  const executed = roadmapItems.filter((r) => r.executed_at).length;
  const rate = Math.round((executed / roadmapItems.length) * 100);

  return (
    <div className="space-y-3">
      {/* 실행률 */}
      <div>
        <div className="mb-1 flex items-center justify-between text-xs">
          <span className="text-[var(--text-secondary)]">실행률</span>
          <span className="font-medium text-[var(--text-primary)]">{rate}% ({executed}/{roadmapItems.length})</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-[var(--surface-hover)]">
          <div className="h-full rounded-full bg-teal-500 transition-all" style={{ width: `${rate}%` }} />
        </div>
      </div>

      {/* 학년별 아이템 */}
      {[...byGrade.entries()].sort((a, b) => a[0] - b[0]).map(([grade, items]) => (
        <div key={grade}>
          <p className="mb-1 text-[10px] font-medium text-[var(--text-secondary)]">{grade}학년</p>
          <div className="space-y-1">
            {items.map((item) => (
              <div key={item.id} className="flex items-center justify-between rounded border border-[var(--border-secondary)] px-2 py-1">
                <div className="min-w-0 flex-1">
                  <span className="truncate text-xs text-[var(--text-primary)]">{item.plan_content}</span>
                  {item.plan_keywords && item.plan_keywords.length > 0 && (
                    <div className="mt-0.5 flex gap-1">
                      {item.plan_keywords.slice(0, 3).map((kw) => (
                        <span key={kw} className="text-[9px] text-[var(--text-tertiary)]">#{kw}</span>
                      ))}
                    </div>
                  )}
                </div>
                <span className={
                  item.executed_at
                    ? "ml-2 shrink-0 rounded px-1 py-0.5 text-[10px] bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300"
                    : "ml-2 shrink-0 rounded px-1 py-0.5 text-[10px] bg-[var(--surface-hover)] text-[var(--text-tertiary)]"
                }>
                  {item.executed_at ? "완료" : "예정"}
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── 13. 면접 탭 (lazy fetch) ──

export function InterviewTab({ studentId }: { studentId: string }) {
  const [questions, setQuestions] = useState<InterviewRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { fetchInterviewQuestions } = await import("@/lib/domains/student-record/actions/diagnosis");
        const result = await fetchInterviewQuestions(studentId);
        if (!cancelled) setQuestions(result);
      } catch {
        if (!cancelled) setError("면접 질문을 불러올 수 없습니다.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [studentId]);

  if (loading) return <LoadingMessage />;
  if (error) return <ErrorMessage>{error}</ErrorMessage>;
  if (!questions || questions.length === 0) return <EmptyMessage>면접 예상 질문이 없습니다.</EmptyMessage>;

  return (
    <div className="space-y-2">
      <p className="text-[10px] text-[var(--text-tertiary)]">{questions.length}개 질문</p>
      {questions.map((q, i) => (
        <div key={i} className="rounded border border-[var(--border-secondary)] p-2">
          <div className="mb-1 flex items-center gap-2">
            <span className="rounded-full bg-indigo-100 px-1.5 py-0.5 text-[10px] text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300">
              {Q_TYPE_LABELS[q.question_type] ?? q.question_type}
            </span>
            {q.difficulty && (
              <span className="text-[10px] text-[var(--text-tertiary)]">{q.difficulty}</span>
            )}
          </div>
          <p className="text-xs leading-relaxed text-[var(--text-primary)]">{q.question}</p>
          {q.suggested_answer && (
            <p className="mt-1 text-[10px] leading-relaxed text-[var(--text-tertiary)]">
              A: {q.suggested_answer.length > 150 ? q.suggested_answer.slice(0, 150) + "..." : q.suggested_answer}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

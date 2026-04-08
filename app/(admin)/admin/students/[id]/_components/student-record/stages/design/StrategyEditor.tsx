"use client";

// ============================================
// 보완전략 에디터 + AI 제안 패널
// Phase 7 — 영역별 전략 CRUD + Gemini Grounding AI 제안
// ============================================

import { useState, useTransition, useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/cn";
import { Plus, Trash2, Sparkles, ExternalLink, ChevronDown, ChevronUp, Check, X } from "lucide-react";
import {
  addStrategyAction,
  updateStrategyAction,
  deleteStrategyAction,
} from "@/lib/domains/student-record/actions/record-strategy";
import { suggestStrategies } from "@/lib/domains/student-record/llm/actions/suggestStrategies";
import { COMPETENCY_ITEMS } from "@/lib/domains/student-record";
import { studentRecordKeys } from "@/lib/query-options/studentRecord";
import type { Strategy, StrategyTargetArea, StrategyPriority, StrategyStatus, CompetencyScore, Diagnosis, CompetencyItemCode, CompetencyGrade } from "@/lib/domains/student-record/types";
import type { StrategySuggestion } from "@/lib/domains/student-record/llm/types";
import { StrategyMatrix } from "../../shared/StrategyMatrix";
import { ConfirmDialog } from "@/components/ui/Dialog";

// ─── 상수 ────────────────────────────────────────────

const TARGET_AREA_LABELS: Record<StrategyTargetArea, string> = {
  autonomy: "자율활동",
  club: "동아리",
  career: "진로활동",
  setek: "교과 세특",
  personal_setek: "개인 세특",
  reading: "독서활동",
  haengteuk: "행특",
  score: "성적",
  general: "종합",
};

const PRIORITY_CONFIG: Record<StrategyPriority, { label: string; className: string; order: number }> = {
  critical: { label: "긴급", className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400", order: 0 },
  high: { label: "높음", className: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400", order: 1 },
  medium: { label: "보통", className: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400", order: 2 },
  low: { label: "낮음", className: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400", order: 3 },
};

const STATUS_CONFIG: Record<StrategyStatus, { label: string; className: string; next: StrategyStatus | null }> = {
  planned: { label: "계획", className: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400", next: "in_progress" },
  in_progress: { label: "진행중", className: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400", next: "done" },
  done: { label: "완료", className: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400", next: null },
};

const ALL_TARGET_AREAS = Object.keys(TARGET_AREA_LABELS) as StrategyTargetArea[];

// ─── 타입 ────────────────────────────────────────────

type Props = {
  strategies: Strategy[];
  studentId: string;
  tenantId: string;
  schoolYear: number;
  grade: number;
  /** 진단 데이터 (AI 제안에 필요) */
  aiScores?: CompetencyScore[];
  aiDiagnosis?: Diagnosis | null;
  targetMajor?: string | null;
  /** 미이수 추천 과목 (교과이수적합도) */
  notTakenSubjects?: string[];
};

// ─── 메인 컴포넌트 ──────────────────────────────────

export function StrategyEditor({
  strategies,
  studentId,
  tenantId,
  schoolYear,
  grade,
  aiScores,
  aiDiagnosis,
  targetMajor,
  notTakenSubjects,
}: Props) {
  const queryClient = useQueryClient();
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // AI 제안 상태
  const [aiSuggestions, setAiSuggestions] = useState<StrategySuggestion[]>([]);
  const [aiSummary, setAiSummary] = useState("");
  const [aiExpanded, setAiExpanded] = useState(true);

  const invalidate = () => {
    queryClient.invalidateQueries({
      queryKey: studentRecordKeys.diagnosisTab(studentId, schoolYear),
    });
  };

  // 전략 정렬: priority → target_area
  const sortedStrategies = useMemo(
    () =>
      [...strategies].sort((a, b) => {
        const pa = PRIORITY_CONFIG[a.priority as StrategyPriority]?.order ?? 9;
        const pb = PRIORITY_CONFIG[b.priority as StrategyPriority]?.order ?? 9;
        if (pa !== pb) return pa - pb;
        return (a.target_area ?? "").localeCompare(b.target_area ?? "");
      }),
    [strategies],
  );

  // ─── AI 제안 mutation ────────────────────────────

  const aiMutation = useMutation({
    mutationFn: async () => {
      const weaknesses = aiDiagnosis?.weaknesses as string[] ?? [];
      const weakCompetencies = (aiScores ?? [])
        .filter((s) => s.source === "ai" && (s.grade_value === "B" || s.grade_value === "B-" || s.grade_value === "C"))
        .map((s) => ({
          item: s.competency_item as CompetencyItemCode,
          grade: s.grade_value as CompetencyGrade,
          label: COMPETENCY_ITEMS.find((i) => i.code === s.competency_item)?.label ?? s.competency_item,
        }));

      const existingStrategies = strategies
        .filter((s) => s.strategy_content)
        .map((s) => `[${TARGET_AREA_LABELS[s.target_area as StrategyTargetArea] ?? s.target_area}] ${s.strategy_content.slice(0, 60)}`);

      const result = await suggestStrategies({
        weaknesses,
        weakCompetencies,
        grade,
        targetMajor: targetMajor ?? undefined,
        existingStrategies,
        notTakenSubjects: notTakenSubjects ?? undefined,
      });

      if (!result.success) throw new Error(result.error);
      return result.data;
    },
    onSuccess: (data) => {
      setAiSuggestions(data.suggestions);
      setAiSummary(data.summary);
      setAiExpanded(true);
    },
  });

  // ─── AI 제안 채택 ────────────────────────────────

  const [acceptPending, startAcceptTransition] = useTransition();

  const handleAccept = (suggestion: StrategySuggestion) => {
    startAcceptTransition(async () => {
      const result = await addStrategyAction({
        student_id: studentId,
        tenant_id: tenantId,
        school_year: schoolYear,
        grade,
        target_area: suggestion.targetArea,
        strategy_content: suggestion.strategyContent,
        priority: suggestion.priority,
        status: "planned",
      });
      if (result.success) {
        setAiSuggestions((prev) => prev.filter((s) => s !== suggestion));
        invalidate();
      }
    });
  };

  const handleDismiss = (suggestion: StrategySuggestion) => {
    setAiSuggestions((prev) => prev.filter((s) => s !== suggestion));
  };

  // ─── 수동 추가/수정/삭제 ─────────────────────────

  const addMutation = useMutation({
    mutationFn: (input: { target_area: StrategyTargetArea; strategy_content: string; priority: StrategyPriority }) =>
      addStrategyAction({
        student_id: studentId,
        tenant_id: tenantId,
        school_year: schoolYear,
        grade,
        target_area: input.target_area,
        strategy_content: input.strategy_content,
        priority: input.priority,
        status: "planned",
      }),
    onSuccess: (result) => {
      if (result.success) {
        setShowAddForm(false);
        invalidate();
      }
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<Strategy> }) =>
      updateStrategyAction(id, updates),
    onSuccess: (result) => {
      if (result.success) {
        setEditingId(null);
        invalidate();
      }
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteStrategyAction(id),
    onSuccess: (result) => {
      if (result.success) invalidate();
    },
  });

  // AI 제안 가능 여부
  const canSuggest = (aiDiagnosis?.weaknesses as string[] ?? []).length > 0
    || (aiScores ?? []).some((s) => s.source === "ai" && (s.grade_value === "B" || s.grade_value === "B-" || s.grade_value === "C"));

  return (
    <div className="flex flex-col gap-4">
      {/* W-3: 전략 매트릭스 */}
      {strategies.length > 0 && (
        <StrategyMatrix strategies={strategies} />
      )}

      {/* ─── 헤더 + 버튼 ──────────────────────── */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-500 dark:text-gray-400">
          {strategies.length}개 전략 ({strategies.filter((s) => s.status === "done").length}개 완료)
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => aiMutation.mutate()}
            disabled={aiMutation.isPending || !canSuggest}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
              canSuggest
                ? "bg-violet-50 text-violet-700 hover:bg-violet-100 dark:bg-violet-900/20 dark:text-violet-400 dark:hover:bg-violet-900/30"
                : "cursor-not-allowed bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-600",
            )}
          >
            <Sparkles className="h-4 w-4" />
            {aiMutation.isPending ? "분석 중..." : "AI 전략 제안"}
          </button>
          <button
            type="button"
            onClick={() => setShowAddForm(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-50 px-3 py-1.5 text-sm font-medium text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-900/20 dark:text-indigo-400 dark:hover:bg-indigo-900/30"
          >
            <Plus className="h-4 w-4" />
            전략 추가
          </button>
        </div>
      </div>

      {/* ─── AI 제안 에러 ──────────────────────── */}
      {aiMutation.isError && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
          {aiMutation.error.message}
          <button type="button" onClick={() => aiMutation.mutate()} className="ml-2 underline">
            재시도
          </button>
        </div>
      )}

      {/* ─── AI 진단 없음 안내 ─────────────────── */}
      {!canSuggest && strategies.length === 0 && (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-center text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-800/50 dark:text-gray-400">
          진단 탭에서 종합 진단을 먼저 실행해주세요. AI가 약점 기반으로 보완전략을 제안합니다.
        </div>
      )}

      {/* ─── AI 제안 목록 ──────────────────────── */}
      {aiSuggestions.length > 0 && (
        <div className="rounded-lg border border-violet-200 bg-violet-50/50 dark:border-violet-800 dark:bg-violet-900/10">
          <button
            type="button"
            onClick={() => setAiExpanded(!aiExpanded)}
            className="flex w-full items-center justify-between px-4 py-3 text-left"
          >
            <div className="flex items-center gap-2 text-sm font-medium text-violet-700 dark:text-violet-400">
              <Sparkles className="h-4 w-4" />
              AI 보완전략 제안 ({aiSuggestions.length}건)
            </div>
            {aiExpanded ? <ChevronUp className="h-4 w-4 text-violet-500" /> : <ChevronDown className="h-4 w-4 text-violet-500" />}
          </button>

          {aiExpanded && (
            <div className="flex flex-col gap-2 px-4 pb-4">
              {aiSummary && (
                <p className="text-xs text-violet-600 dark:text-violet-400">{aiSummary}</p>
              )}
              {aiSuggestions.map((suggestion, idx) => (
                <AiSuggestionCard
                  key={idx}
                  suggestion={suggestion}
                  onAccept={() => handleAccept(suggestion)}
                  onDismiss={() => handleDismiss(suggestion)}
                  accepting={acceptPending}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ─── 수동 추가 폼 ──────────────────────── */}
      {showAddForm && (
        <AddStrategyForm
          onSubmit={(data) => addMutation.mutate(data)}
          onCancel={() => setShowAddForm(false)}
          isPending={addMutation.isPending}
        />
      )}

      {/* ─── 기존 전략 목록 ─────────────────────── */}
      {sortedStrategies.length > 0 && (
        <div className="flex flex-col gap-2">
          {sortedStrategies.map((strategy) => (
            <StrategyCard
              key={strategy.id}
              strategy={strategy}
              isEditing={editingId === strategy.id}
              onEdit={() => setEditingId(strategy.id)}
              onCancelEdit={() => setEditingId(null)}
              onUpdate={(updates) => updateMutation.mutate({ id: strategy.id, updates })}
              onDelete={() => setConfirmDeleteId(strategy.id)}
              onStatusChange={(status) => updateMutation.mutate({ id: strategy.id, updates: { status } })}
              isPending={updateMutation.isPending || deleteMutation.isPending}
            />
          ))}
        </div>
      )}

      {/* U-5: 삭제 확인 다이얼로그 */}
      <ConfirmDialog
        open={!!confirmDeleteId}
        onOpenChange={(open) => { if (!open) setConfirmDeleteId(null); }}
        title="보완전략 삭제"
        description="이 전략을 삭제하시겠습니까? 되돌릴 수 없습니다."
        onConfirm={() => {
          if (confirmDeleteId) {
            deleteMutation.mutate(confirmDeleteId);
            setConfirmDeleteId(null);
          }
        }}
        variant="destructive"
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
}

// ─── AI 제안 카드 ────────────────────────────────

function AiSuggestionCard({
  suggestion,
  onAccept,
  onDismiss,
  accepting,
}: {
  suggestion: StrategySuggestion;
  onAccept: () => void;
  onDismiss: () => void;
  accepting: boolean;
}) {
  const priorityCfg = PRIORITY_CONFIG[suggestion.priority];

  return (
    <div className="rounded-lg border border-violet-200 bg-white p-3 dark:border-violet-700/50 dark:bg-gray-900">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          <div className="mb-1 flex items-center gap-2">
            <span className="rounded bg-violet-100 px-1.5 py-0.5 text-xs font-medium text-violet-700 dark:bg-violet-900/30 dark:text-violet-400">
              {TARGET_AREA_LABELS[suggestion.targetArea]}
            </span>
            <span className={cn("rounded px-1.5 py-0.5 text-xs font-medium", priorityCfg.className)}>
              {priorityCfg.label}
            </span>
          </div>
          <p className="text-sm text-gray-900 dark:text-gray-100">{suggestion.strategyContent}</p>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{suggestion.reasoning}</p>
          {suggestion.sourceUrls && suggestion.sourceUrls.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1">
              {suggestion.sourceUrls.slice(0, 3).map((url, i) => (
                <a
                  key={i}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-0.5 text-xs text-violet-600 hover:underline dark:text-violet-400"
                >
                  <ExternalLink className="h-3 w-3" />
                  출처 {i + 1}
                </a>
              ))}
            </div>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={onAccept}
            disabled={accepting}
            className="rounded-md bg-green-50 p-1.5 text-green-600 hover:bg-green-100 dark:bg-green-900/20 dark:text-green-400 dark:hover:bg-green-900/30"
            title="채택"
          >
            <Check className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onDismiss}
            className="rounded-md bg-gray-50 p-1.5 text-gray-400 hover:bg-gray-100 dark:bg-gray-800 dark:text-gray-500 dark:hover:bg-gray-700"
            title="거절"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── 전략 카드 ──────────────────────────────────

function StrategyCard({
  strategy,
  isEditing,
  onEdit,
  onCancelEdit,
  onUpdate,
  onDelete,
  onStatusChange,
  isPending,
}: {
  strategy: Strategy;
  isEditing: boolean;
  onEdit: () => void;
  onCancelEdit: () => void;
  onUpdate: (updates: Partial<Strategy>) => void;
  onDelete: () => void;
  onStatusChange: (status: StrategyStatus) => void;
  isPending: boolean;
}) {
  const [editContent, setEditContent] = useState(strategy.strategy_content);
  const [editPriority, setEditPriority] = useState(strategy.priority as StrategyPriority);

  const area = strategy.target_area as StrategyTargetArea;
  const priorityCfg = PRIORITY_CONFIG[strategy.priority as StrategyPriority] ?? PRIORITY_CONFIG.medium;
  const statusCfg = STATUS_CONFIG[strategy.status as StrategyStatus] ?? STATUS_CONFIG.planned;

  if (isEditing) {
    return (
      <div className="rounded-lg border border-indigo-200 bg-indigo-50/50 p-3 dark:border-indigo-800 dark:bg-indigo-900/10">
        <div className="mb-2 flex items-center gap-2">
          <span className="text-xs font-medium text-gray-500">{TARGET_AREA_LABELS[area]}</span>
          <select
            value={editPriority}
            onChange={(e) => setEditPriority(e.target.value as StrategyPriority)}
            className="rounded border border-gray-300 bg-white px-2 py-0.5 text-xs dark:border-gray-600 dark:bg-gray-800"
          >
            {(["critical", "high", "medium", "low"] as StrategyPriority[]).map((p) => (
              <option key={p} value={p}>{PRIORITY_CONFIG[p].label}</option>
            ))}
          </select>
        </div>
        <textarea
          value={editContent}
          onChange={(e) => setEditContent(e.target.value)}
          rows={3}
          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800"
        />
        <div className="mt-2 flex items-center gap-2">
          <button
            type="button"
            onClick={() => onUpdate({ strategy_content: editContent, priority: editPriority })}
            disabled={isPending || !editContent.trim()}
            className="rounded-lg bg-indigo-600 px-3 py-1 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            저장
          </button>
          <button type="button" onClick={onCancelEdit} className="text-xs text-gray-500 hover:text-gray-700">
            취소
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="group rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-900">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          <div className="mb-1 flex items-center gap-2">
            <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-400">
              {TARGET_AREA_LABELS[area]}
            </span>
            <span className={cn("rounded px-1.5 py-0.5 text-xs font-medium", priorityCfg.className)}>
              {priorityCfg.label}
            </span>
            <button
              type="button"
              onClick={() => statusCfg.next && onStatusChange(statusCfg.next)}
              disabled={!statusCfg.next || isPending}
              className={cn(
                "rounded px-1.5 py-0.5 text-xs font-medium transition-colors",
                statusCfg.className,
                statusCfg.next && "cursor-pointer hover:opacity-80",
              )}
              title={statusCfg.next ? `클릭하여 "${STATUS_CONFIG[statusCfg.next].label}"로 변경` : "완료됨"}
            >
              {statusCfg.label}
            </button>
          </div>
          <p className="text-sm text-gray-900 dark:text-gray-100">{strategy.strategy_content}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          <button
            type="button"
            onClick={onEdit}
            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300"
            title="수정"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
          </button>
          <button
            type="button"
            onClick={onDelete}
            disabled={isPending}
            className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 dark:hover:text-red-400"
            title="삭제"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── 추가 폼 ────────────────────────────────────

function AddStrategyForm({
  onSubmit,
  onCancel,
  isPending,
}: {
  onSubmit: (data: { target_area: StrategyTargetArea; strategy_content: string; priority: StrategyPriority }) => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  const [targetArea, setTargetArea] = useState<StrategyTargetArea>("setek");
  const [content, setContent] = useState("");
  const [priority, setPriority] = useState<StrategyPriority>("medium");

  return (
    <div className="rounded-lg border border-indigo-200 bg-indigo-50/50 p-4 dark:border-indigo-800 dark:bg-indigo-900/10">
      <div className="mb-3 text-sm font-medium text-gray-700 dark:text-gray-300">보완전략 추가</div>
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <label className="w-16 shrink-0 text-xs text-gray-500">영역</label>
          <select
            value={targetArea}
            onChange={(e) => setTargetArea(e.target.value as StrategyTargetArea)}
            className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-800"
          >
            {ALL_TARGET_AREAS.map((area) => (
              <option key={area} value={area}>{TARGET_AREA_LABELS[area]}</option>
            ))}
          </select>
          <label className="w-16 shrink-0 text-xs text-gray-500">우선순위</label>
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value as StrategyPriority)}
            className="w-24 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-800"
          >
            {(["critical", "high", "medium", "low"] as StrategyPriority[]).map((p) => (
              <option key={p} value={p}>{PRIORITY_CONFIG[p].label}</option>
            ))}
          </select>
        </div>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="구체적인 보완전략을 입력하세요 (예: 2학년 수학 세특에서 CT촬영 원리 탐구 보고서 작성)"
          rows={3}
          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800"
        />
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onSubmit({ target_area: targetArea, strategy_content: content, priority })}
            disabled={isPending || !content.trim()}
            className="rounded-lg bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {isPending ? "추가 중..." : "추가"}
          </button>
          <button type="button" onClick={onCancel} className="text-sm text-gray-500 hover:text-gray-700">
            취소
          </button>
        </div>
      </div>
    </div>
  );
}

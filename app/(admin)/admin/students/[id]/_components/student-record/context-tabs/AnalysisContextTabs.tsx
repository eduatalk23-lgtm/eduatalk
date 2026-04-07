"use client";

// ============================================
// context-tabs/AnalysisContextTabs — 진단/분석 탭
// DiagnosisTab, DiagnosisCard, EdgesTab, GrowthTab, CareerFitTab, CourseFitTab
// ============================================

import { useState, useEffect } from "react";
import { cn } from "@/lib/cn";
import type { DiagnosisTabData } from "@/lib/domains/student-record/types";
import { EmptyMessage, LoadingMessage, ErrorMessage } from "./shared";

// ── EDGE_LABELS ──

const EDGE_LABELS: Record<string, { label: string; color: string }> = {
  COMPETENCY_SHARED: { label: "역량 공유", color: "bg-blue-400" },
  CONTENT_REFERENCE: { label: "내용 연결", color: "bg-purple-400" },
  TEMPORAL_GROWTH: { label: "성장 경로", color: "bg-teal-400" },
  COURSE_SUPPORTS: { label: "교과 뒷받침", color: "bg-amber-400" },
  READING_ENRICHES: { label: "독서 보강", color: "bg-rose-400" },
  THEME_CONVERGENCE: { label: "주제 수렴", color: "bg-cyan-400" },
  TEACHER_VALIDATION: { label: "교사 검증", color: "bg-green-400" },
};

// ── 로컬 타입 ──

interface EdgeRow {
  edge_type: string;
  source_label: string;
  target_label: string;
  reason: string;
  confidence: number;
  is_stale: boolean;
}

// ── 7. 진단 탭 ──

export function DiagnosisTab({ data }: { data?: DiagnosisTabData | null }) {
  if (!data) return <EmptyMessage>진단 데이터를 불러오는 중입니다.</EmptyMessage>;

  const { aiDiagnosis, consultantDiagnosis, strategies } = data;
  if (!aiDiagnosis && !consultantDiagnosis) return <EmptyMessage>생성된 진단이 없습니다.</EmptyMessage>;

  return (
    <div className="space-y-3">
      {aiDiagnosis && (
        <DiagnosisCard label="AI 진단" source="ai" diagnosis={aiDiagnosis} />
      )}
      {consultantDiagnosis && (
        <DiagnosisCard label="컨설턴트 진단" source="consultant" diagnosis={consultantDiagnosis} />
      )}
      {strategies.length > 0 && (
        <div>
          <p className="mb-1 text-[10px] font-medium text-[var(--text-secondary)]">보완 전략 ({strategies.length}건)</p>
          <div className="space-y-1">
            {strategies.slice(0, 5).map((s) => (
              <div key={s.id} className="flex items-center justify-between rounded bg-[var(--surface-hover)] px-2 py-1 text-xs">
                <span className="truncate text-[var(--text-primary)]">{s.target_area}: {s.strategy_content}</span>
                <span className={cn(
                  "shrink-0 rounded px-1 py-0.5 text-[10px]",
                  s.priority === "critical" ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300" :
                  s.priority === "high" ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300" :
                  "bg-[var(--surface-hover)] text-[var(--text-tertiary)]",
                )}>
                  {s.priority}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function DiagnosisCard({ label, source, diagnosis }: {
  label: string;
  source: string;
  diagnosis: {
    overall_grade?: string | null;
    record_direction?: string | null;
    direction_strength?: string | null;
    direction_reasoning?: string | null;
    strengths?: string[] | null;
    weaknesses?: string[] | null;
    status?: string | null;
  };
}) {
  const summary = diagnosis.record_direction ?? diagnosis.direction_strength;
  return (
    <div className="rounded border border-[var(--border-secondary)] p-2">
      <div className="mb-1 flex items-center justify-between">
        <span className="text-xs font-medium text-[var(--text-primary)]">{label}</span>
        <div className="flex items-center gap-1.5">
          {diagnosis.overall_grade && (
            <span className="rounded bg-[var(--surface-hover)] px-1 py-0.5 text-[10px] font-medium text-[var(--text-secondary)]">
              {diagnosis.overall_grade}
            </span>
          )}
          <span className={cn(
            "rounded-full px-1.5 py-0.5 text-[10px]",
            source === "ai" ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" : "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300",
          )}>
            {source === "ai" ? "🤖 AI" : "👤 수동"}
          </span>
        </div>
      </div>
      {summary && (
        <p className="mb-1 text-xs leading-relaxed text-[var(--text-secondary)]">
          {summary.length > 200 ? summary.slice(0, 200) + "..." : summary}
        </p>
      )}
      {diagnosis.direction_reasoning && (
        <p className="mb-1 text-[10px] text-[var(--text-tertiary)]">{diagnosis.direction_reasoning}</p>
      )}
      <div className="flex gap-4 text-[10px]">
        {diagnosis.strengths && diagnosis.strengths.length > 0 && (
          <span className="text-emerald-600 dark:text-emerald-400">+ 강점 {diagnosis.strengths.length}</span>
        )}
        {diagnosis.weaknesses && diagnosis.weaknesses.length > 0 && (
          <span className="text-amber-600 dark:text-amber-400">- 약점 {diagnosis.weaknesses.length}</span>
        )}
      </div>
    </div>
  );
}

// ── 8. 연결(엣지) 탭 (lazy fetch) ──

export function EdgesTab({ studentId, tenantId }: { studentId: string; tenantId?: string }) {
  const [edges, setEdges] = useState<EdgeRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!tenantId) { setLoading(false); return; }
    let cancelled = false;
    (async () => {
      try {
        const { fetchPersistedEdges } = await import("@/lib/domains/student-record/actions/diagnosis");
        const result = await fetchPersistedEdges(studentId, tenantId);
        if (!cancelled) setEdges(result);
      } catch {
        if (!cancelled) setError("연결 데이터를 불러올 수 없습니다.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [studentId, tenantId]);

  if (loading) return <LoadingMessage />;
  if (error) return <ErrorMessage>{error}</ErrorMessage>;
  if (!tenantId) return <EmptyMessage>테넌트 정보가 없습니다.</EmptyMessage>;
  if (!edges || edges.length === 0) return <EmptyMessage>감지된 연결이 없습니다.</EmptyMessage>;

  const grouped = new Map<string, EdgeRow[]>();
  for (const e of edges) {
    const arr = grouped.get(e.edge_type) ?? [];
    arr.push(e);
    grouped.set(e.edge_type, arr);
  }
  const staleCount = edges.filter((e) => e.is_stale).length;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-[10px] text-[var(--text-tertiary)]">
        <span>총 {edges.length}개 연결, {grouped.size}개 유형</span>
        {staleCount > 0 && <span className="text-amber-600">⚠ {staleCount}건 갱신 필요</span>}
      </div>
      {[...grouped.entries()].sort((a, b) => b[1].length - a[1].length).map(([type, items]) => {
        const meta = EDGE_LABELS[type] ?? { label: type, color: "bg-gray-400" };
        const maxWidth = Math.round((items.length / edges.length) * 100);
        return (
          <div key={type} className="space-y-0.5">
            <div className="flex items-center gap-2 text-xs">
              <span className={cn("h-2 w-2 rounded-full", meta.color)} />
              <span className="text-[var(--text-primary)]">{meta.label}</span>
              <span className="text-[10px] text-[var(--text-tertiary)]">{items.length}</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-[var(--surface-hover)]">
              <div className={cn("h-full rounded-full", meta.color)} style={{ width: `${maxWidth}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── 9. 성장 탭 ──

export function GrowthTab({ data }: { data?: DiagnosisTabData | null }) {
  if (!data) return <EmptyMessage>역량 데이터를 불러오는 중입니다.</EmptyMessage>;

  const { competencyScores } = data;
  const allScores = [...competencyScores.ai, ...competencyScores.consultant];
  if (allScores.length === 0) return <EmptyMessage>역량 점수가 없습니다.</EmptyMessage>;

  const byItem = new Map<string, { area: string; ai: string | null; consultant: string | null }>();
  for (const s of competencyScores.ai) {
    const key = s.competency_item;
    const entry = byItem.get(key) ?? { area: s.competency_area, ai: null, consultant: null };
    entry.ai = s.grade_value;
    byItem.set(key, entry);
  }
  for (const s of competencyScores.consultant) {
    const key = s.competency_item;
    const entry = byItem.get(key) ?? { area: s.competency_area, ai: null, consultant: null };
    entry.consultant = s.grade_value;
    byItem.set(key, entry);
  }

  const byArea = new Map<string, Array<[string, { ai: string | null; consultant: string | null }]>>();
  for (const [item, val] of byItem) {
    const arr = byArea.get(val.area) ?? [];
    arr.push([item, { ai: val.ai, consultant: val.consultant }]);
    byArea.set(val.area, arr);
  }

  return (
    <div className="space-y-3">
      <p className="text-[10px] text-[var(--text-tertiary)]">{byItem.size}개 역량 항목, {byArea.size}개 영역</p>
      {[...byArea.entries()].map(([area, items]) => (
        <div key={area}>
          <p className="mb-1 text-[10px] font-medium text-[var(--text-secondary)]">{area}</p>
          <div className="space-y-1">
            {items.map(([item, grades]) => (
              <div key={item} className="flex items-center justify-between rounded px-2 py-1 text-xs">
                <span className="text-[var(--text-primary)]">{item}</span>
                <div className="flex gap-2 text-[10px]">
                  {grades.ai && (
                    <span className="rounded bg-blue-100 px-1 py-0.5 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                      🤖 {grades.ai}
                    </span>
                  )}
                  {grades.consultant && (
                    <span className="rounded bg-violet-100 px-1 py-0.5 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300">
                      👤 {grades.consultant}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── 10. 진로 적합도 탭 ──

export function CareerFitTab({ data }: { data?: DiagnosisTabData | null }) {
  if (!data) return <EmptyMessage>진로 데이터를 불러오는 중입니다.</EmptyMessage>;

  const { targetMajor, targetSubClassificationName, courseAdequacy } = data;
  if (!targetMajor && !courseAdequacy) return <EmptyMessage>진로 목표가 설정되지 않았습니다.</EmptyMessage>;

  return (
    <div className="space-y-3">
      {targetMajor && (
        <div className="rounded border border-[var(--border-secondary)] p-2">
          <p className="text-[10px] text-[var(--text-tertiary)]">진로 목표</p>
          <p className="text-sm font-medium text-[var(--text-primary)]">{targetMajor}</p>
          {targetSubClassificationName && (
            <p className="text-[10px] text-[var(--text-tertiary)]">계열: {targetSubClassificationName}</p>
          )}
        </div>
      )}

      {courseAdequacy && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-[var(--text-secondary)]">교과 이수 적합도</span>
            <span className={cn(
              "text-sm font-bold",
              courseAdequacy.score >= 70 ? "text-emerald-600" : courseAdequacy.score >= 40 ? "text-amber-600" : "text-red-600",
            )}>
              {courseAdequacy.score}점
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-[var(--surface-hover)]">
            <div
              className={cn(
                "h-full rounded-full",
                courseAdequacy.score >= 70 ? "bg-emerald-500" : courseAdequacy.score >= 40 ? "bg-amber-500" : "bg-red-500",
              )}
              style={{ width: `${courseAdequacy.score}%` }}
            />
          </div>
          <div className="flex gap-3 text-[10px] text-[var(--text-tertiary)]">
            <span>일반선택 {Math.round(courseAdequacy.generalRate * 100)}%</span>
            <span>진로선택 {Math.round(courseAdequacy.careerRate * 100)}%</span>
            <span>이수 {courseAdequacy.taken.length}/{courseAdequacy.totalRecommended}</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ── 11. 수강 탭 ──

export function CourseFitTab({ data }: { data?: DiagnosisTabData | null }) {
  if (!data) return <EmptyMessage>수강 데이터를 불러오는 중입니다.</EmptyMessage>;
  const { courseAdequacy, takenSubjects } = data;
  if (!courseAdequacy) return <EmptyMessage>교과 이수 분석이 없습니다.</EmptyMessage>;

  return (
    <div className="space-y-3">
      {courseAdequacy.taken.length > 0 && (
        <div>
          <p className="mb-1 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
            ✓ 이수 추천과목 ({courseAdequacy.taken.length})
          </p>
          <div className="flex flex-wrap gap-1">
            {courseAdequacy.taken.map((s) => (
              <span key={s} className="rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300">
                {s}
              </span>
            ))}
          </div>
        </div>
      )}

      {courseAdequacy.notTaken.length > 0 && (
        <div>
          <p className="mb-1 text-[10px] font-medium text-amber-600 dark:text-amber-400">
            ✗ 미이수 ({courseAdequacy.notTaken.length})
          </p>
          <div className="flex flex-wrap gap-1">
            {courseAdequacy.notTaken.map((s) => (
              <span key={s} className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] text-amber-700 dark:bg-amber-900/20 dark:text-amber-300">
                {s}
              </span>
            ))}
          </div>
        </div>
      )}

      {courseAdequacy.notOffered.length > 0 && (
        <div>
          <p className="mb-1 text-[10px] font-medium text-[var(--text-tertiary)]">
            학교 미개설 ({courseAdequacy.notOffered.length})
          </p>
          <div className="flex flex-wrap gap-1">
            {courseAdequacy.notOffered.map((s) => (
              <span key={s} className="rounded bg-[var(--surface-hover)] px-1.5 py-0.5 text-[10px] text-[var(--text-tertiary)]">
                {s}
              </span>
            ))}
          </div>
        </div>
      )}

      {takenSubjects.length > 0 && (
        <div>
          <p className="mb-1 text-[10px] text-[var(--text-tertiary)]">전체 이수 {takenSubjects.length}과목</p>
        </div>
      )}
    </div>
  );
}

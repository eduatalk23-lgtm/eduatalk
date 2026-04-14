"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { crossRefQueryOptions, diagnosisTabQueryOptions, edgesQueryOptions } from "@/lib/query-options/studentRecord";
import { calculateSchoolYear } from "@/lib/utils/schoolYear";
import {
  buildConnectionGraph,
  EDGE_TYPE_META,
  type ConnectionGraph,
  type ConnectionNode,
  type CrossRefEdge,
  type CrossRefEdgeType,
} from "@/lib/domains/student-record/cross-reference";
import type { PersistedEdge } from "@/lib/domains/student-record/repository/edge-repository";
import { useStudentRecordContext } from "../StudentRecordContext";
import { ConnectionNodeCard } from "./ConnectionNodeCard";
import { ConnectionEmptyState } from "./ConnectionEmptyState";
import { ThemeConvergencePanel } from "./ThemeConvergencePanel";
import { cn } from "@/lib/cn";
import { ArrowLeft, Network } from "lucide-react";

type GroupMode = "node" | "edgeType";

export function ConnectionsPanelApp({
  studentId,
  tenantId,
}: {
  studentId: string;
  tenantId: string;
}) {
  const schoolYear = calculateSchoolYear();
  const { activeSubjectId } = useStudentRecordContext();

  const [groupBy, setGroupBy] = useState<GroupMode>("node");
  const [focusedNodeKey, setFocusedNodeKey] = useState<string | null>(null);

  // Phase E4: DB 영속화 엣지 우선 조회
  const { data: persistedEdges } = useQuery(edgesQueryOptions(studentId, tenantId));

  // Fallback: 런타임 계산용 데이터
  const { data: crossRefData } = useQuery(crossRefQueryOptions(studentId, tenantId));
  const { data: diagnosisData } = useQuery(
    diagnosisTabQueryOptions(studentId, schoolYear, tenantId),
  );

  const graph = useMemo<ConnectionGraph | null>(() => {
    // DB 엣지가 있으면 → DB 기반 그래프
    if (persistedEdges && persistedEdges.length > 0) {
      return buildGraphFromPersistedEdges(persistedEdges);
    }
    // Fallback: 런타임 계산
    if (!crossRefData || !diagnosisData) return null;
    return buildConnectionGraph({
      allTags: diagnosisData.activityTags,
      storylineLinks: crossRefData.storylineLinks,
      readingLinks: crossRefData.readingLinks,
      courseAdequacy: diagnosisData.courseAdequacy,
      recordLabelMap: new Map(Object.entries(crossRefData.recordLabelMap)),
      readingLabelMap: new Map(Object.entries(crossRefData.readingLabelMap)),
      recordContentMap: new Map(Object.entries(crossRefData.recordContentMap ?? {})),
    });
  }, [persistedEdges, crossRefData, diagnosisData]);

  // 1-hop 드릴다운: focusedNodeKey에 해당하는 노드 찾기
  const focusedNode = useMemo(() => {
    if (!focusedNodeKey || !graph) return null;
    return graph.nodes.find((n) => n.nodeKey === focusedNodeKey) ?? null;
  }, [focusedNodeKey, graph]);

  const hasRecords = (crossRefData?.recordLabelMap && Object.keys(crossRefData.recordLabelMap).length > 0) ?? false;

  if (!graph || graph.nodes.length === 0) {
    return <ConnectionEmptyState hasRecords={hasRecords} />;
  }

  // 1-hop 드릴다운 뷰
  if (focusedNode) {
    return (
      <div className="flex h-full flex-col">
        <button
          type="button"
          onClick={() => setFocusedNodeKey(null)}
          className="flex items-center gap-1 px-4 py-2 text-xs font-medium text-indigo-600 hover:text-indigo-800 dark:text-indigo-400"
        >
          <ArrowLeft className="h-3 w-3" />
          전체 연결
        </button>
        <div className="px-4 pb-2">
          <p className="text-sm font-semibold text-[var(--text-primary)]">{focusedNode.label}</p>
          <p className="text-[10px] text-[var(--text-tertiary)]">{focusedNode.edges.length}개 연결</p>
        </div>
        <div className="flex-1 overflow-y-auto px-4 pb-4">
          <ConnectionNodeCard
            node={focusedNode}
            isHighlighted
            onDrillDown={(key) => {
              const target = graph.nodes.find((n) => n.nodeKey === key);
              if (target) setFocusedNodeKey(key);
            }}
          />
        </div>
      </div>
    );
  }

  // 전체 뷰
  return (
    <div className="flex h-full flex-col">
      {/* 헤더 */}
      <div className="flex items-center gap-2 px-4 pb-1 pt-2">
        <Network className="h-4 w-4 text-[var(--text-tertiary)]" />
        <span className="text-xs font-semibold text-[var(--text-secondary)]">
          {graph.nodes.length}개 영역 · {graph.totalEdges}개 연결
        </span>
      </div>

      {/* 범례 — synthesis_inferred/projected 있을 때만 */}
      {(() => {
        const hasInferred = persistedEdges?.some((e: PersistedEdge) => e.edge_context === "synthesis_inferred") ?? false;
        const hasProjected = persistedEdges?.some((e: PersistedEdge) => e.edge_context === "projected") ?? false;
        if (!hasInferred && !hasProjected) return null;
        return (
          <div className="flex flex-wrap items-center gap-2 px-4 pb-1 text-[10px] text-[var(--text-tertiary)]">
            {hasInferred && (
              <span className="inline-flex items-center gap-1">
                <span className="inline-block rounded-sm bg-violet-500 px-1 font-bold text-white">추론</span>
                Synthesis 진단 후 추가
              </span>
            )}
            {hasProjected && (
              <span className="inline-flex items-center gap-1">
                <span className="inline-block rounded-sm bg-amber-500 px-1 font-bold text-white">예상</span>
                설계 모드 가안
              </span>
            )}
          </div>
        );
      })()}

      {/* 그룹핑 토글 */}
      <div className="flex gap-1 px-4 pb-2">
        {(["node", "edgeType"] as const).map((mode) => (
          <button
            key={mode}
            type="button"
            onClick={() => setGroupBy(mode)}
            className={cn(
              "rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors",
              groupBy === mode
                ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300"
                : "text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]",
            )}
          >
            {mode === "node" ? "영역별" : "엣지별"}
          </button>
        ))}
      </div>

      {/* Phase 1 Layer 2: 통합 테마 (hyperedge) 리스트 */}
      <ThemeConvergencePanel studentId={studentId} tenantId={tenantId} />

      {/* 콘텐츠 */}
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        {groupBy === "node" ? (
          <NodeGroupView
            graph={graph}
            activeSubjectId={activeSubjectId}
            onDrillDown={setFocusedNodeKey}
          />
        ) : (
          <EdgeTypeGroupView
            graph={graph}
            onDrillDown={setFocusedNodeKey}
          />
        )}
      </div>
    </div>
  );
}

// ─── 영역별 그룹 ─────────────────────────────

function NodeGroupView({
  graph,
  activeSubjectId,
  onDrillDown,
}: {
  graph: ConnectionGraph;
  activeSubjectId?: string | null;
  onDrillDown: (nodeKey: string) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      {graph.nodes.map((node) => {
        const isHighlighted = activeSubjectId
          ? node.recordIds.has(activeSubjectId)
          : false;
        return (
          <ConnectionNodeCard
            key={node.nodeKey}
            node={node}
            isHighlighted={isHighlighted}
            onDrillDown={(key) => {
              const target = graph.nodes.find((n) => n.nodeKey === key);
              if (target) onDrillDown(key);
            }}
          />
        );
      })}
    </div>
  );
}

// ─── 엣지별 그룹 ─────────────────────────────

function EdgeTypeGroupView({
  graph,
  onDrillDown,
}: {
  graph: ConnectionGraph;
  onDrillDown: (nodeKey: string) => void;
}) {
  // 모든 엣지를 타입별로 그룹화
  const grouped = useMemo(() => {
    const map = new Map<CrossRefEdgeType, { source: string; target: string; sourceKey: string }[]>();
    for (const node of graph.nodes) {
      for (const edge of node.edges) {
        const list = map.get(edge.type) ?? [];
        list.push({ source: node.label, target: edge.targetLabel, sourceKey: node.nodeKey });
        map.set(edge.type, list);
      }
    }
    return map;
  }, [graph]);

  return (
    <div className="flex flex-col gap-3">
      {[...grouped.entries()].map(([edgeType, items]) => {
        const meta = EDGE_TYPE_META[edgeType];
        return (
          <div key={edgeType}>
            <div className="flex items-center gap-2 pb-1.5">
              <span className={cn("text-xs font-semibold", meta.color)}>{meta.label}</span>
              <span className="text-[10px] text-[var(--text-tertiary)]">{items.length}건</span>
            </div>
            <div className="flex flex-col gap-1">
              {items.map((item, i) => (
                <button
                  key={`${item.source}-${item.target}-${i}`}
                  type="button"
                  onClick={() => onDrillDown(item.sourceKey)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-md border px-2 py-1.5 text-left text-[11px] transition-colors hover:opacity-80",
                    meta.bgColor,
                    meta.color,
                  )}
                >
                  <span className="truncate">{item.source}</span>
                  <span className="shrink-0 opacity-50">→</span>
                  <span className="truncate">{item.target}</span>
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Phase E4: DB 엣지 → ConnectionGraph 변환 ────

function buildGraphFromPersistedEdges(edges: PersistedEdge[]): ConnectionGraph {
  // source 노드별로 엣지 그룹화
  const nodeMap = new Map<string, {
    recordType: string;
    recordId: string;
    label: string;
    grade: number;
    edges: CrossRefEdge[];
  }>();

  for (const e of edges) {
    const key = `${e.source_record_type}:${e.source_record_id}`;
    const existing = nodeMap.get(key);
    const edge: CrossRefEdge = {
      type: e.edge_type,
      targetRecordType: e.target_record_type as CrossRefEdge["targetRecordType"],
      targetRecordId: e.target_record_id ?? undefined,
      targetLabel: e.target_label,
      reason: e.reason,
      sharedCompetencies: e.shared_competencies ?? undefined,
      edgeContext: e.edge_context as CrossRefEdge["edgeContext"],
    };

    if (existing) {
      existing.edges.push(edge);
    } else {
      nodeMap.set(key, {
        recordType: e.source_record_type,
        recordId: e.source_record_id,
        label: e.source_label,
        grade: e.source_grade ?? 0,
        edges: [edge],
      });
    }
  }

  const nodes: ConnectionNode[] = [...nodeMap.entries()].map(([nodeKey, data]) => ({
    nodeKey,
    recordIds: new Set([data.recordId]),
    recordType: data.recordType as ConnectionNode["recordType"],
    label: data.label,
    grade: data.grade,
    edges: data.edges,
  }));

  // 엣지 많은 순 정렬
  nodes.sort((a, b) => b.edges.length - a.edges.length);

  return {
    nodes,
    totalEdges: edges.length,
  };
}

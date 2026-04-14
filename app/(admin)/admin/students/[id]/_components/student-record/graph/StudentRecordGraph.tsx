"use client";

// ============================================
// Phase 1.x — 단일 학생 그래프 뷰
// Layer 1 binary edges + Layer 2 hypergraph 동시 렌더
//
// standalone 모드(전용 뷰)에서는 root/canvas ref div 모두 inline style로
// viewport 단위(100vw / calc(100dvh - 48px)) 직접 지정.
// 이 프로젝트 globals.css에 html/body height 설정이 없어 Tailwind h-full·flex-1
// 체인이 어디선가 끊겨 Cytoscape container가 0 또는 400(min-h)로 클램프된다.
// 자세한 배경: memory/feedback_fullscreen-canvas-inline-style.md
// ============================================

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import cytoscape, { type Core as CytoscapeCore, type ElementDefinition, type NodeSingular } from "cytoscape";
import fcose from "cytoscape-fcose";
import { ArrowLeft, Download, ExternalLink, Network, ZoomIn, ZoomOut, Maximize2, RotateCw } from "lucide-react";

let fcoseRegistered = false;
function ensureFcose() {
  if (fcoseRegistered) return;
  try {
    cytoscape.use(fcose);
    fcoseRegistered = true;
  } catch {
    fcoseRegistered = true;
  }
}
import { edgesQueryOptions, hyperedgesQueryOptions } from "@/lib/query-options/studentRecord";
import { cn } from "@/lib/cn";
import {
  buildGraphElements,
  RECORD_TYPE_LABEL,
} from "./graph-data-builder";
import {
  graphStylesheet,
  RECORD_TYPE_COLORS,
  EDGE_TYPE_COLORS,
  EDGE_TYPE_LABEL,
} from "./graph-styles";

interface SelectedInfo {
  kind: "record" | "hyperedge" | "edge";
  data: Record<string, unknown>;
}

interface HoverTooltip {
  x: number;
  y: number;
  kind: "record" | "hyperedge" | "edge";
  data: Record<string, unknown>;
}

export function StudentRecordGraph({
  studentId,
  tenantId,
  studentName,
  variant = "embedded",
}: {
  studentId: string;
  tenantId: string;
  studentName?: string | null;
  variant?: "embedded" | "standalone";
}) {
  const isDedicatedView = variant === "standalone";
  const { data: edges, isLoading: edgesLoading } = useQuery(
    edgesQueryOptions(studentId, tenantId),
  );
  const { data: hyperedges, isLoading: hyperedgesLoading } = useQuery(
    hyperedgesQueryOptions(studentId, tenantId),
  );

  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<CytoscapeCore | null>(null);
  const [selected, setSelected] = useState<SelectedInfo | null>(null);
  const [hover, setHover] = useState<HoverTooltip | null>(null);
  const [canvasSize, setCanvasSize] = useState<{ w: number; h: number }>({ w: 0, h: 0 });
  const [hiddenEdgeTypes, setHiddenEdgeTypes] = useState<Set<string>>(new Set());
  const [showHyperedges, setShowHyperedges] = useState(true);
  const [gradeFilter, setGradeFilter] = useState<number | null>(null);

  const elements: ElementDefinition[] = useMemo(
    () => buildGraphElements({ edges: edges ?? [], hyperedges: hyperedges ?? [] }),
    [edges, hyperedges],
  );

  const activeEdgeTypes = useMemo(() => {
    const set = new Set<string>();
    for (const e of edges ?? []) set.add(e.edge_type);
    return [...set].sort();
  }, [edges]);

  const availableGrades = useMemo(() => {
    const set = new Set<number>();
    for (const el of elements) {
      const g = (el.data as { grade?: number; kind?: string }).grade;
      if ((el.data as { kind?: string }).kind === "record" && g && g > 0) set.add(g);
    }
    return [...set].sort();
  }, [elements]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    if (elements.length === 0) return;

    ensureFcose();

    const cyInstance = cytoscape({
      container: el,
      elements,
      style: graphStylesheet,
      layout: { name: "preset" },
      wheelSensitivity: 0.2,
      minZoom: 0.2,
      maxZoom: 3,
    });
    cyRef.current = cyInstance;

    cyInstance.on("tap", "node", (evt) => {
      const node = evt.target as NodeSingular;
      const kind = node.data("kind");
      setSelected({ kind, data: node.data() });
    });
    cyInstance.on("tap", "edge", (evt) => {
      setSelected({ kind: "edge", data: evt.target.data() });
    });
    cyInstance.on("tap", (evt) => {
      if (evt.target === cyInstance) setSelected(null);
    });

    cyInstance.on("mouseover", "node, edge", (evt) => {
      const target = evt.target;
      const kind = target.data("kind");
      const tooltipKind =
        kind === "record" || kind === "hyperedge" ? kind : "edge";
      const rect = el.getBoundingClientRect();
      const rendered = (evt.renderedPosition ?? evt.position) as { x: number; y: number };
      setHover({
        x: rendered.x,
        y: rendered.y,
        kind: tooltipKind,
        data: target.data(),
      });
      if (target.isNode()) {
        cyInstance.elements().addClass("faded");
        const neighborhood = target.closedNeighborhood();
        neighborhood.removeClass("faded").addClass("highlight");
      } else {
        cyInstance.elements().addClass("faded");
        target.removeClass("faded").addClass("highlight");
        target.connectedNodes().removeClass("faded").addClass("highlight");
      }
      void rect;
    });
    cyInstance.on("mouseout", "node, edge", () => {
      setHover(null);
      cyInstance.elements().removeClass("faded").removeClass("highlight");
    });

    let lastLayoutSize = { w: 0, h: 0 };
    const runLayout = () => {
      const rect = el.getBoundingClientRect();
      setCanvasSize({ w: Math.round(rect.width), h: Math.round(rect.height) });
      if (rect.width < 100 || rect.height < 100) return;
      // 최초 또는 컨테이너 크기가 30% 이상 변했을 때 레이아웃 재실행
      const prev = lastLayoutSize;
      const sizeChangedSignificantly =
        prev.w === 0 ||
        Math.abs(rect.width - prev.w) / Math.max(prev.w, 1) > 0.3 ||
        Math.abs(rect.height - prev.h) / Math.max(prev.h, 1) > 0.3;

      cyInstance.resize();

      if (!sizeChangedSignificantly) {
        cyInstance.fit(undefined, 40);
        return;
      }

      lastLayoutSize = { w: rect.width, h: rect.height };
      cyInstance
        .layout({
          name: "fcose",
          animate: prev.w === 0,
          animationDuration: 400,
          quality: "default",
          randomize: prev.w === 0,
          nodeRepulsion: 5000,
          idealEdgeLength: 80,
          nodeSeparation: 75,
          gravity: 0.25,
          fit: true,
          padding: 40,
        } as unknown as cytoscape.LayoutOptions)
        .run();
    };

    const rafId = requestAnimationFrame(runLayout);
    const ro = new ResizeObserver(runLayout);
    ro.observe(el);

    return () => {
      cancelAnimationFrame(rafId);
      ro.disconnect();
      cyInstance.destroy();
      cyRef.current = null;
    };
  }, [elements]);

  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;
    cy.batch(() => {
      cy.edges("[kind = 'layer1']").forEach((e) => {
        const t = e.data("edgeType") as string;
        e.style("display", hiddenEdgeTypes.has(t) ? "none" : "element");
      });
      cy.elements("[kind = 'hyperedge'], [kind = 'hyperedge-spoke']").forEach((el) => {
        el.style("display", showHyperedges ? "element" : "none");
      });
      if (gradeFilter == null) {
        cy.nodes("[kind = 'record']").forEach((n) => n.style("opacity", 1));
      } else {
        cy.nodes("[kind = 'record']").forEach((n) => {
          const g = n.data("grade") as number;
          n.style("opacity", g === gradeFilter ? 1 : 0.15);
        });
      }
    });
  }, [hiddenEdgeTypes, showHyperedges, gradeFilter]);

  const toggleEdgeType = useCallback((type: string) => {
    setHiddenEdgeTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  }, []);

  const handleFit = useCallback(() => {
    cyRef.current?.fit(undefined, 40);
  }, []);

  const handleZoomIn = useCallback(() => {
    const cy = cyRef.current;
    if (!cy) return;
    cy.zoom({ level: cy.zoom() * 1.25, renderedPosition: { x: cy.width() / 2, y: cy.height() / 2 } });
  }, []);

  const handleZoomOut = useCallback(() => {
    const cy = cyRef.current;
    if (!cy) return;
    cy.zoom({ level: cy.zoom() / 1.25, renderedPosition: { x: cy.width() / 2, y: cy.height() / 2 } });
  }, []);

  const handleZoomReset = useCallback(() => {
    const cy = cyRef.current;
    if (!cy) return;
    cy.zoom(1);
    cy.center();
  }, []);

  const handleRelayout = useCallback(() => {
    const cy = cyRef.current;
    if (!cy) return;
    cy.resize();
    cy.layout({
      name: "fcose",
      animate: true,
      animationDuration: 500,
      randomize: true,
      nodeRepulsion: 5000,
      idealEdgeLength: 80,
      nodeSeparation: 75,
      gravity: 0.25,
      fit: true,
      padding: 40,
    } as unknown as cytoscape.LayoutOptions).run();
  }, []);

  const handleExportPng = useCallback(() => {
    const cy = cyRef.current;
    if (!cy) return;
    const png = cy.png({ full: true, scale: 2, bg: "#ffffff" });
    const a = document.createElement("a");
    a.href = png;
    a.download = `student-record-graph-${studentId.slice(0, 8)}.png`;
    a.click();
  }, [studentId]);

  const isLoading = edgesLoading || hyperedgesLoading;
  const isEmpty = !isLoading && elements.length === 0;

  return (
    <div
      className={cn(
        "flex flex-col overflow-hidden bg-white dark:bg-gray-950",
        !isDedicatedView && "h-full min-h-[400px]",
      )}
      style={
        isDedicatedView
          ? { height: "100dvh", width: "100vw", position: "fixed", top: 0, left: 0, zIndex: 40 }
          : undefined
      }
    >
      <div className="flex flex-wrap items-center gap-3 border-b border-gray-200 px-4 py-2 dark:border-gray-800">
        {isDedicatedView && (
          <a
            href={`/admin/students/${studentId}/record`}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
            title="생기부 편집으로"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            생기부
          </a>
        )}
        <div className="flex items-center gap-2 text-sm font-semibold text-gray-800 dark:text-gray-200">
          <Network className="h-4 w-4" />
          {studentName ? `${studentName} · ` : ""}생기부 그래프
          <span className="text-[11px] font-normal text-gray-500" suppressHydrationWarning>
            edges {edges?.length ?? 0} · hyperedges {hyperedges?.length ?? 0}
            {canvasSize.w > 0 ? ` · canvas ${canvasSize.w}×${canvasSize.h}` : ""}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {activeEdgeTypes.map((t) => {
            const active = !hiddenEdgeTypes.has(t);
            return (
              <button
                key={t}
                type="button"
                onClick={() => toggleEdgeType(t)}
                className={cn(
                  "rounded-full border px-2 py-0.5 text-[11px] font-medium transition",
                  active
                    ? "border-transparent text-white"
                    : "border-gray-300 bg-white text-gray-400 dark:border-gray-700 dark:bg-gray-900",
                )}
                style={active ? { backgroundColor: EDGE_TYPE_COLORS[t] ?? "#9ca3af" } : undefined}
              >
                {EDGE_TYPE_LABEL[t] ?? t}
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => setShowHyperedges((v) => !v)}
            className={cn(
              "rounded-full border px-2 py-0.5 text-[11px] font-medium transition",
              showHyperedges
                ? "border-transparent bg-pink-500 text-white"
                : "border-gray-300 bg-white text-gray-400 dark:border-gray-700 dark:bg-gray-900",
            )}
          >
            통합 테마
          </button>
          {availableGrades.length > 1 && (
            <div className="ml-1 flex items-center gap-1 text-[11px]">
              <span className="text-gray-500">학년:</span>
              <button
                type="button"
                onClick={() => setGradeFilter(null)}
                className={cn(
                  "rounded-full px-2 py-0.5 font-medium transition",
                  gradeFilter === null
                    ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300"
                    : "text-gray-500",
                )}
              >
                전체
              </button>
              {availableGrades.map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => setGradeFilter(g)}
                  className={cn(
                    "rounded-full px-2 py-0.5 font-medium transition",
                    gradeFilter === g
                      ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300"
                      : "text-gray-500",
                  )}
                >
                  {g}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="ml-auto flex items-center gap-2">
          {!isDedicatedView && (
            <a
              href={`/student-graph/${studentId}`}
              target="_blank"
              rel="noopener noreferrer"
              title="전체 화면으로 열기 (새 탭)"
              className="inline-flex items-center gap-1 rounded-md border border-indigo-200 bg-indigo-50 px-2 py-1 text-[11px] font-semibold text-indigo-700 hover:bg-indigo-100 dark:border-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-300"
            >
              <ExternalLink className="h-3 w-3" />
              전체 화면
            </a>
          )}
          <button
            type="button"
            onClick={handleRelayout}
            title="재배치"
            className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-white px-2 py-1 text-[11px] font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300"
          >
            <RotateCw className="h-3 w-3" />
            재배치
          </button>
          <button
            type="button"
            onClick={handleExportPng}
            title="PNG 저장"
            className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-white px-2 py-1 text-[11px] font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300"
          >
            <Download className="h-3 w-3" />
            PNG
          </button>
        </div>
      </div>

      <div
        className="relative min-h-0 flex-1"
        style={
          isDedicatedView
            ? { height: "calc(100dvh - 48px)", width: "100vw" }
            : undefined
        }
      >
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-gray-400">
            그래프 데이터 불러오는 중…
          </div>
        )}
        {isEmpty && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-center">
            <Network className="h-10 w-10 text-gray-300" />
            <p className="text-sm text-gray-500">아직 연결 데이터가 없습니다.</p>
            <p className="text-xs text-gray-400">
              AI 파이프라인 실행 후 그래프가 생성됩니다.
            </p>
          </div>
        )}
        <div
          ref={containerRef}
          className="absolute inset-0"
          style={
            isDedicatedView
              ? { width: "100vw", height: "calc(100dvh - 48px)" }
              : { minHeight: 400 }
          }
        />

        {/* 줌 컨트롤 */}
        <div className="absolute right-3 bottom-3 flex flex-col gap-1 rounded-md border border-gray-200 bg-white/95 p-1 shadow-sm backdrop-blur dark:border-gray-700 dark:bg-gray-900/95">
          <button
            type="button"
            onClick={handleZoomIn}
            title="확대"
            aria-label="확대"
            className="flex h-7 w-7 items-center justify-center rounded text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            <ZoomIn className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={handleZoomOut}
            title="축소"
            aria-label="축소"
            className="flex h-7 w-7 items-center justify-center rounded text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            <ZoomOut className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={handleZoomReset}
            title="원본 크기"
            aria-label="원본 크기"
            className="flex h-7 w-7 items-center justify-center rounded text-[10px] font-semibold text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            1:1
          </button>
          <button
            type="button"
            onClick={handleFit}
            title="전체 보기"
            aria-label="전체 보기"
            className="flex h-7 w-7 items-center justify-center rounded text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            <Maximize2 className="h-4 w-4" />
          </button>
        </div>

        {/* Hover 툴팁 */}
        {hover && !selected && (
          <HoverTooltipCard info={hover} />
        )}

        <div className="pointer-events-none absolute bottom-3 left-3 flex flex-col gap-1 text-[10px]">
          <div className="rounded-md border border-gray-200 bg-white/90 px-2 py-1 backdrop-blur dark:border-gray-700 dark:bg-gray-900/90">
            <div className="mb-1 font-semibold text-gray-700 dark:text-gray-300">레코드</div>
            <div className="flex flex-col gap-0.5 text-gray-600 dark:text-gray-400">
              {Object.entries(RECORD_TYPE_COLORS).map(([k, c]) => (
                <div key={k} className="flex items-center gap-1.5">
                  <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: c }} />
                  {RECORD_TYPE_LABEL[k] ?? k}
                </div>
              ))}
            </div>
          </div>
        </div>

        {selected && (
          <div className="pointer-events-auto absolute right-3 top-3 max-w-xs rounded-lg border border-gray-200 bg-white p-3 text-xs shadow-lg dark:border-gray-700 dark:bg-gray-900">
            <SelectedInfoPanel info={selected} onClose={() => setSelected(null)} />
          </div>
        )}
      </div>
    </div>
  );
}

function HoverTooltipCard({ info }: { info: HoverTooltip }) {
  const { x, y, kind, data } = info;
  const offsetX = 14;
  const offsetY = 14;
  return (
    <div
      className="pointer-events-none absolute z-20 max-w-[220px] rounded-md border border-gray-200 bg-white/95 px-2 py-1.5 text-[11px] shadow-md backdrop-blur dark:border-gray-700 dark:bg-gray-900/95"
      style={{ left: x + offsetX, top: y + offsetY }}
    >
      {kind === "record" && (
        <>
          <p className="font-semibold text-gray-900 dark:text-gray-100">
            {String(data.label ?? "")}
          </p>
          <p className="text-[10px] text-gray-500">
            {RECORD_TYPE_LABEL[String(data.recordType)] ?? String(data.recordType)}
            {data.grade ? ` · ${data.grade}학년` : ""}
          </p>
        </>
      )}
      {kind === "hyperedge" && (
        <>
          <p className="font-semibold text-pink-600 dark:text-pink-400">
            {String(data.themeLabel ?? data.label ?? "")}
          </p>
          <p className="text-[10px] text-gray-500">
            멤버 {String(data.memberCount ?? 0)}개 · 신뢰도{" "}
            {Number(data.confidence ?? 0).toFixed(2)}
          </p>
        </>
      )}
      {kind === "edge" && (
        <>
          <p className="font-semibold text-gray-900 dark:text-gray-100">
            {EDGE_TYPE_LABEL[String(data.edgeType)] ?? String(data.edgeType)}
          </p>
          {data.reason ? (
            <p className="text-[10px] leading-snug text-gray-500">
              {String(data.reason)}
            </p>
          ) : null}
        </>
      )}
    </div>
  );
}

function SelectedInfoPanel({
  info,
  onClose,
}: {
  info: SelectedInfo;
  onClose: () => void;
}) {
  const { kind, data } = info;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-start justify-between gap-2">
        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-gray-600 dark:bg-gray-800 dark:text-gray-300">
          {kind === "record" ? "레코드" : kind === "hyperedge" ? "통합 테마" : "연결"}
        </span>
        <button
          type="button"
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600"
          aria-label="닫기"
        >
          ✕
        </button>
      </div>
      {kind === "record" && (
        <>
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            {String(data.label ?? "")}
          </p>
          <p className="text-[11px] text-gray-500">
            {RECORD_TYPE_LABEL[String(data.recordType)] ?? String(data.recordType)}
            {data.grade ? ` · ${data.grade}학년` : ""}
          </p>
        </>
      )}
      {kind === "hyperedge" && (
        <>
          <p className="text-sm font-semibold text-pink-600 dark:text-pink-400">
            {String(data.themeLabel ?? data.label ?? "")}
          </p>
          <p className="text-[11px] text-gray-500">
            멤버 {String(data.memberCount ?? 0)}개 · 신뢰도 {Number(data.confidence ?? 0).toFixed(2)}
          </p>
          {Array.isArray(data.sharedCompetencies) && data.sharedCompetencies.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {(data.sharedCompetencies as string[]).map((c) => (
                <span
                  key={c}
                  className="rounded-full bg-pink-50 px-1.5 py-0.5 text-[10px] text-pink-700 dark:bg-pink-950/40 dark:text-pink-300"
                >
                  {c}
                </span>
              ))}
            </div>
          )}
          {data.evidence && (
            <p className="text-[11px] leading-snug text-gray-600 dark:text-gray-400">
              {String(data.evidence)}
            </p>
          )}
        </>
      )}
      {kind === "edge" && (
        <>
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            {EDGE_TYPE_LABEL[String(data.edgeType)] ?? String(data.edgeType)}
          </p>
          <p className="text-[11px] text-gray-500">
            신뢰도 {Number(data.confidence ?? 0).toFixed(2)}
            {data.edgeContext ? ` · ${String(data.edgeContext)}` : ""}
          </p>
          {data.reason && (
            <p className="text-[11px] leading-snug text-gray-600 dark:text-gray-400">
              {String(data.reason)}
            </p>
          )}
        </>
      )}
    </div>
  );
}

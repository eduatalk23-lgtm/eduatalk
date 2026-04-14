// ============================================
// Phase 1.x — Cytoscape 스타일시트
// record_type별 노드 색/형태, edge_type별 엣지 색,
// hyperedge pseudo-node 다이아몬드 스타일.
// ============================================

import type { StylesheetCSS } from "cytoscape";

export const RECORD_TYPE_COLORS: Record<string, string> = {
  setek: "#3b82f6",
  personal_setek: "#60a5fa",
  changche: "#10b981",
  haengteuk: "#f97316",
  reading: "#8b5cf6",
  score: "#ef4444",
};

export const EDGE_TYPE_COLORS: Record<string, string> = {
  COMPETENCY_SHARED: "#3b82f6",
  CONTENT_REFERENCE: "#8b5cf6",
  TEMPORAL_GROWTH: "#14b8a6",
  COURSE_SUPPORTS: "#6366f1",
  READING_ENRICHES: "#d946ef",
  THEME_CONVERGENCE: "#ec4899",
  TEACHER_VALIDATION: "#f59e0b",
};

export const EDGE_TYPE_LABEL: Record<string, string> = {
  COMPETENCY_SHARED: "역량 공유",
  CONTENT_REFERENCE: "내용 연결",
  TEMPORAL_GROWTH: "성장 경로",
  COURSE_SUPPORTS: "교과 뒷받침",
  READING_ENRICHES: "독서 확장",
  THEME_CONVERGENCE: "테마 수렴",
  TEACHER_VALIDATION: "교사 관찰",
};

// Phase 2 Layer 3 — stages_present_count(0~8)별 border 색상.
// 낮을수록 경고(적색), 높을수록 안전(녹색).
export const NARRATIVE_BORDER_COLOR = {
  critical: "#dc2626", // ≤3 적색
  warn: "#f59e0b",     // 4~5 황색
  ok: "#10b981",       // 6~8 녹색
};

export const graphStylesheet: StylesheetCSS[] = [
  {
    selector: "node[kind = 'record']",
    css: {
      label: "data(label)",
      "background-color": "#6b7280",
      "border-width": 1,
      "border-color": "#ffffff",
      color: "#111827",
      "text-outline-width": 2,
      "text-outline-color": "#ffffff",
      "font-size": 11,
      "text-valign": "bottom",
      "text-halign": "center",
      "text-margin-y": 4,
      "text-wrap": "ellipsis",
      "text-max-width": "140px",
      width: 30,
      height: 30,
      "transition-property": "opacity, border-width, width, height",
      "transition-duration": 200,
    },
  },
  ...Object.entries(RECORD_TYPE_COLORS).map(([type, color]) => ({
    selector: `node[kind = 'record'][recordType = '${type}']`,
    css: { "background-color": color },
  })),
  // Phase 2 Step 4a: narrative_arc stages_present_count 기반 border 하이라이트
  {
    selector: "node[kind = 'record'][narrativeStagesCount >= 0][narrativeStagesCount <= 3]",
    css: {
      "border-width": 3,
      "border-color": NARRATIVE_BORDER_COLOR.critical,
    },
  },
  {
    selector: "node[kind = 'record'][narrativeStagesCount >= 4][narrativeStagesCount <= 5]",
    css: {
      "border-width": 3,
      "border-color": NARRATIVE_BORDER_COLOR.warn,
    },
  },
  {
    selector: "node[kind = 'record'][narrativeStagesCount >= 6]",
    css: {
      "border-width": 3,
      "border-color": NARRATIVE_BORDER_COLOR.ok,
    },
  },
  {
    selector: "node[kind = 'hyperedge']",
    css: {
      label: "data(label)",
      shape: "round-diamond",
      "background-color": "#ec4899",
      "background-opacity": 0.3,
      "border-width": 2,
      "border-color": "#ec4899",
      color: "#9d174d",
      "text-outline-width": 2,
      "text-outline-color": "#ffffff",
      "font-size": 10,
      "font-weight": "bold",
      "text-valign": "center",
      "text-halign": "center",
      "text-wrap": "wrap",
      "text-max-width": "150px",
      width: "mapData(memberCount, 2, 8, 44, 72)",
      height: "mapData(memberCount, 2, 8, 44, 72)",
      "transition-property": "opacity, border-width",
      "transition-duration": 200,
    },
  },
  {
    selector: "edge[kind = 'layer1']",
    css: {
      width: 1.5,
      "line-color": "#9ca3af",
      "curve-style": "bezier",
      "target-arrow-shape": "none",
      opacity: 0.75,
    },
  },
  ...Object.entries(EDGE_TYPE_COLORS).map(([type, color]) => ({
    selector: `edge[kind = 'layer1'][edgeType = '${type}']`,
    css: { "line-color": color },
  })),
  {
    selector: "edge[kind = 'layer1'][edgeContext = 'synthesis_inferred']",
    css: {
      "line-style": "dashed",
      opacity: 0.6,
    },
  },
  {
    selector: "edge[kind = 'hyperedge-spoke']",
    css: {
      width: 2,
      "line-color": "#ec4899",
      opacity: 0.35,
      "curve-style": "bezier",
      "target-arrow-shape": "none",
    },
  },
  {
    selector: ":selected",
    css: {
      "border-width": 3,
      "border-color": "#facc15",
      "line-color": "#facc15",
      "overlay-opacity": 0.15,
      "overlay-color": "#facc15",
    },
  },
  {
    selector: ".faded",
    css: {
      opacity: 0.12,
    },
  },
  {
    selector: ".highlight",
    css: {
      "border-width": 3,
      "border-color": "#facc15",
      "z-index": 999,
    },
  },
  {
    selector: "edge.highlight",
    css: {
      width: 3,
      opacity: 1,
    },
  },
];

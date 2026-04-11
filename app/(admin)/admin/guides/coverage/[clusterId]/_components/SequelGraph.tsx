"use client";

import { useMemo } from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";
import type {
  ClusterGuide,
  SequelLink,
} from "@/lib/domains/guide/actions/cluster-detail";

// ============================================================
// 레이아웃 상수
// ============================================================

const COL_WIDTH = 200;
const COL_GAP = 80;
const NODE_H = 44;
const NODE_GAP = 12;
const PAD_X = 16;
const PAD_Y = 48; // 컬럼 헤더 공간

const DIFFICULTY_ORDER = ["basic", "intermediate", "advanced"] as const;
type Difficulty = (typeof DIFFICULTY_ORDER)[number];

const DIFF_STYLE: Record<
  Difficulty,
  { label: string; fill: string; stroke: string; headerFill: string }
> = {
  basic: {
    label: "기초",
    fill: "#f0fdf4",
    stroke: "#86efac",
    headerFill: "#22c55e",
  },
  intermediate: {
    label: "발전",
    fill: "#fefce8",
    stroke: "#fde047",
    headerFill: "#eab308",
  },
  advanced: {
    label: "심화",
    fill: "#fef2f2",
    stroke: "#fca5a5",
    headerFill: "#ef4444",
  },
};

// ============================================================
// 좌표 계산
// ============================================================

interface NodePos {
  id: string;
  title: string;
  qualityScore: number | null;
  status: string;
  x: number;
  y: number;
  col: number;
}

function buildLayout(
  guidesByDifficulty: Record<Difficulty, ClusterGuide[]>,
): { nodes: NodePos[]; width: number; height: number } {
  const nodes: NodePos[] = [];

  DIFFICULTY_ORDER.forEach((diff, colIdx) => {
    const guides = guidesByDifficulty[diff];
    const colX = PAD_X + colIdx * (COL_WIDTH + COL_GAP);

    guides.forEach((g, rowIdx) => {
      nodes.push({
        id: g.id,
        title: g.title,
        qualityScore: g.qualityScore,
        status: g.status,
        x: colX,
        y: PAD_Y + rowIdx * (NODE_H + NODE_GAP),
        col: colIdx,
      });
    });
  });

  const maxRows = Math.max(
    guidesByDifficulty.basic.length,
    guidesByDifficulty.intermediate.length,
    guidesByDifficulty.advanced.length,
    1,
  );

  const width = PAD_X * 2 + 3 * COL_WIDTH + 2 * COL_GAP;
  const height = PAD_Y + maxRows * (NODE_H + NODE_GAP) + 16;

  return { nodes, width, height };
}

// ============================================================
// 엣지 경로 (cubic bezier)
// ============================================================

function edgePath(from: NodePos, to: NodePos): string {
  const x1 = from.x + COL_WIDTH;
  const y1 = from.y + NODE_H / 2;
  const x2 = to.x;
  const y2 = to.y + NODE_H / 2;

  // 같은 컬럼이면 위/아래로 우회
  if (from.col === to.col) {
    const offset = 40;
    const side = from.x + COL_WIDTH + offset;
    return `M${x1},${y1} C${side},${y1} ${side},${y2} ${x2 + COL_WIDTH},${y2}`;
  }

  const dx = Math.abs(x2 - x1) * 0.4;
  return `M${x1},${y1} C${x1 + dx},${y1} ${x2 - dx},${y2} ${x2},${y2}`;
}

// ============================================================
// 컴포넌트
// ============================================================

interface SequelGraphProps {
  guidesByDifficulty: {
    basic: ClusterGuide[];
    intermediate: ClusterGuide[];
    advanced: ClusterGuide[];
  };
  sequelLinks: SequelLink[];
}

export function SequelGraph({
  guidesByDifficulty,
  sequelLinks,
}: SequelGraphProps) {
  const { nodes, width, height } = useMemo(
    () => buildLayout(guidesByDifficulty),
    [guidesByDifficulty],
  );

  const nodeMap = useMemo(() => {
    const m = new Map<string, NodePos>();
    for (const n of nodes) m.set(n.id, n);
    return m;
  }, [nodes]);

  // 엣지만 렌더링 가능한 것 필터
  const edges = useMemo(
    () =>
      sequelLinks.filter(
        (l) => nodeMap.has(l.fromId) && nodeMap.has(l.toId),
      ),
    [sequelLinks, nodeMap],
  );

  if (nodes.length === 0) {
    return (
      <p className="text-sm text-[var(--text-secondary)] py-4 text-center">
        시각화할 가이드가 없습니다.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width={width}
        height={height}
        className="select-none"
      >
        <defs>
          <marker
            id="arrowhead"
            markerWidth="8"
            markerHeight="6"
            refX="7"
            refY="3"
            orient="auto"
          >
            <polygon
              points="0 0, 8 3, 0 6"
              className="fill-secondary-400 dark:fill-secondary-500"
            />
          </marker>
        </defs>

        {/* 컬럼 헤더 */}
        {DIFFICULTY_ORDER.map((diff, colIdx) => {
          const style = DIFF_STYLE[diff];
          const x = PAD_X + colIdx * (COL_WIDTH + COL_GAP);
          return (
            <g key={diff}>
              <circle
                cx={x + 10}
                cy={18}
                r={5}
                fill={style.headerFill}
              />
              <text
                x={x + 22}
                y={22}
                className="text-xs font-semibold fill-[var(--text-heading)]"
              >
                {style.label}
              </text>
              <text
                x={x + COL_WIDTH}
                y={22}
                textAnchor="end"
                className="text-xs fill-[var(--text-secondary)]"
              >
                {guidesByDifficulty[diff].length}건
              </text>
            </g>
          );
        })}

        {/* 엣지 */}
        {edges.map((link, i) => {
          const from = nodeMap.get(link.fromId)!;
          const to = nodeMap.get(link.toId)!;
          const opacity = 0.3 + link.confidence * 0.7;
          const strokeWidth = 1 + link.confidence * 1.5;

          return (
            <path
              key={i}
              d={edgePath(from, to)}
              fill="none"
              className="stroke-secondary-400 dark:stroke-secondary-500"
              strokeWidth={strokeWidth}
              opacity={opacity}
              markerEnd="url(#arrowhead)"
            />
          );
        })}

        {/* 노드 */}
        {nodes.map((node) => {
          const diff = DIFFICULTY_ORDER[node.col];
          const style = DIFF_STYLE[diff];
          const truncTitle =
            node.title.length > 18
              ? node.title.slice(0, 17) + "…"
              : node.title;

          return (
            <g key={node.id}>
              <a href={`/admin/guides/${node.id}`}>
                <rect
                  x={node.x}
                  y={node.y}
                  width={COL_WIDTH}
                  height={NODE_H}
                  rx={8}
                  fill={style.fill}
                  stroke={style.stroke}
                  strokeWidth={1.5}
                  className="hover:stroke-primary-400 hover:stroke-2 transition-colors cursor-pointer"
                />
                <text
                  x={node.x + 10}
                  y={node.y + 18}
                  className="text-xs fill-[var(--text-primary)]"
                >
                  {truncTitle}
                </text>
                {node.qualityScore != null && (
                  <text
                    x={node.x + 10}
                    y={node.y + 34}
                    className={cn(
                      "text-xs",
                      node.qualityScore >= 80
                        ? "fill-green-600"
                        : node.qualityScore >= 60
                          ? "fill-yellow-600"
                          : "fill-red-500",
                    )}
                  >
                    {node.qualityScore}점
                  </text>
                )}
              </a>
            </g>
          );
        })}
      </svg>

      {/* 범례 */}
      {edges.length > 0 && (
        <div className="flex items-center gap-4 mt-2 text-xs text-[var(--text-secondary)]">
          <span className="flex items-center gap-1.5">
            <svg width="24" height="8">
              <line
                x1="0"
                y1="4"
                x2="20"
                y2="4"
                className="stroke-secondary-400"
                strokeWidth="1.5"
                opacity="0.5"
              />
              <polygon
                points="18 1, 24 4, 18 7"
                className="fill-secondary-400"
              />
            </svg>
            사슬 연결
          </span>
          <span>굵기/투명도 = confidence</span>
        </div>
      )}
    </div>
  );
}

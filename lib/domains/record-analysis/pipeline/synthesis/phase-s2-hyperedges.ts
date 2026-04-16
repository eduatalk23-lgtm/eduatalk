// ============================================
// S2-d: runHyperedgeComputation — Layer 2 N-ary 수렴 엣지 (Phase 1, 2026-04-14)
//
// 입력: Layer 1 student_record_edges (analysis 컨텍스트) 중
//   - edge_type ∈ {COMPETENCY_SHARED, THEME_CONVERGENCE, READING_ENRICHES}
//   - confidence ≥ 0.7
//   - source/target record_id 양쪽 존재
//   - shared_competencies 길이 ≥ 2
//
// 알고리즘 B' (pair-seed 클러스터링):
//   김세린 student sanity에서 확인된 문제 — COMPETENCY_SHARED 엣지가 dense해서
//   단순 union-find가 전체 38노드를 하나의 거대 컴포넌트로 합침(모두 size>5로 탈락).
//   `academic_inquiry` 95%, `academic_attitude` 82% 등 범용 역량이 접착제 역할.
//
//   해결: 각 엣지의 shared_competencies에서 모든 pair(2-조합)를 추출하고,
//         각 pair를 "테마 시드"로 삼아 그 pair를 공유하는 엣지만의 subgraph에서
//         union-find를 돌린다. size 3~5 통과하는 컴포넌트만 hyperedge 후보.
//   효과: 범용 pair는 자연스럽게 size>5로 탈락, 선명한 pair만 통과.
//         동적 threshold 불필요.
//
// Path B (2026-04-14 세션 3) — 레코드 단위 멤버 확장:
//   Layer 1 detectCompetencyShared는 record_type 레벨로 집계(세특 여러 과목 → 대표 1건)하여
//   target_record_id에 대표 recordId만 저장. 결과적으로 hyperedge 멤버 라벨이
//   "세특" 같은 record_type 명으로 표시되어 컨설턴트가 구체 레코드를 식별할 수 없었음.
//
//   해결: `expansionContext`(활동 태그 + recordLabelMap)를 전달받은 경우,
//         union-find 컴포넌트의 record_type 집합을 유지한 채
//         `activity_tags` 기반으로 seed pair 역량을 모두 가진 실제 레코드 전부를 멤버로 재구성.
//         size 필터(3~5)는 확장 후 적용. 결과적으로 "1학년 한국사 세특 / 2학년 진로활동 / 1학년 행동특성"
//         처럼 풍부한 라벨이 저장된다.
//
//   theme_label 희귀도 정렬: 학생 내 역량 출현 빈도 역수로 rare top-3 우선.
//   confidence 희귀도 가중: seed pair를 공유하는 레코드 수가 많을수록 하향 (floor 0.5).
//
// 출력: student_record_hyperedges (analysis 컨텍스트) atomic 치환.
//       같은 member set을 만드는 여러 pair-seed 결과는 shared_competencies
//       합집합으로 병합.
//
// 관측성: computedHyperedges / filteredBySize / filteredByConfidence / filteredByCompetency / pairsExplored
// ============================================

import { logActionError, logActionWarn } from "@/lib/logging/actionLogger";
import {
  assertSynthesisCtx,
  type PipelineContext,
  type TaskRunnerOutput,
} from "../pipeline-types";
import {
  findEdges,
  type PersistedEdge,
} from "@/lib/domains/student-record/repository/edge-repository";
import {
  replaceHyperedges,
  type HyperedgeInput,
  type HyperedgeMember,
} from "@/lib/domains/student-record/repository/hyperedge-repository";
import { findActivityTags } from "@/lib/domains/student-record/repository/competency-repository";
import { fetchCrossRefData } from "@/lib/domains/student-record/actions/cross-ref-data-builder";

const LOG_CTX = { domain: "record-analysis", action: "pipeline.hyperedge_computation" };

const ELIGIBLE_EDGE_TYPES = new Set([
  "COMPETENCY_SHARED",
  "THEME_CONVERGENCE",
  "READING_ENRICHES",
]);
const CONFIDENCE_MIN = 0.7;
const SIZE_MIN = 3;
const SIZE_MAX = 5;
const MIN_SHARED_COMPETENCIES = 2;

// Path B: seed pair가 공통인 레코드 수가 이 임계치 이상이면 confidence 하향 시작.
const CONFIDENCE_RARITY_THRESHOLD = 3;
const CONFIDENCE_FLOOR = 0.5;

// 세션 4 — 부분 중첩 병합 임계치 (Jaccard). 0.6 이상이면 한 테마로 흡수.
const JACCARD_MERGE_THRESHOLD = 0.6;
// 세션 4 — 최종 hyperedge 상한. 컨설턴트 체감 과잉 방지. 넘는 초과분은 rank 하위부터 탈락.
const HYPEREDGE_TOP_N = 8;
// 세션 5 polish — 테마 성립 최소 역량 수. 미만이면 "테마"로 부르기엔 느슨하므로 탈락.
const MIN_THEME_COMPETENCIES = 2;

export interface HyperedgeComputationResult {
  computedHyperedges: number;
  filteredBySize: number;
  filteredByConfidence: number;
  filteredByCompetency: number;
  pairsExplored: number;
  /** 세션 4: Jaccard 기반 부분 중첩 병합된 건수 */
  mergedByJaccard: number;
  /** 세션 4: top-N 캡으로 탈락한 건수 */
  droppedByRanking: number;
  /** 세션 5 polish: sharedCompetencies.size < 2 로 탈락한 건수 (병합 후 또는 단독 엔트리) */
  filteredByShallow: number;
}

// ============================================
// Path B — 레코드 단위 확장 컨텍스트
// ============================================

export interface HyperedgeRecordMeta {
  recordType: string;
  label: string;
  grade: number | null;
  /** 해당 레코드의 activity_tags에서 추출한 역량 집합 */
  competencies: Set<string>;
}

export interface HyperedgeExpansionContext {
  /** record_id → meta */
  recordMap: Map<string, HyperedgeRecordMeta>;
}

export async function runHyperedgeComputation(
  ctx: PipelineContext,
): Promise<TaskRunnerOutput & { result: HyperedgeComputationResult & { themeLabels: string[] } }> {
  assertSynthesisCtx(ctx);
  const { studentId, tenantId, pipelineId } = ctx;

  try {
    // C2: 설계 모드 폴백 — analysis edges가 없으면 projected edges로 전환.
    //   analysis tag가 없으면 draft_analysis tag로 전환.
    //   저장 컨텍스트도 'analysis' vs 'projected' 분기.
    const [analysisEdges, analysisTags, crd] = await Promise.all([
      findEdges(studentId, tenantId, "analysis", { includeStale: false }),
      findActivityTags(studentId, tenantId, { tagContext: "analysis" }),
      fetchCrossRefData(studentId, tenantId),
    ]);

    let edges = analysisEdges;
    let tags = analysisTags;
    let edgeContext: "analysis" | "projected" = "analysis";

    if (analysisEdges.length === 0) {
      const projectedEdges = await findEdges(studentId, tenantId, "projected", { includeStale: false });
      if (projectedEdges.length > 0) {
        edges = projectedEdges;
        edgeContext = "projected";
        // projected edges → draft_analysis tags로 확장
        tags = await findActivityTags(studentId, tenantId, { tagContext: "draft_analysis" });
      }
    }

    const expansionCtx = buildExpansionContext(tags, crd);
    if (expansionCtx.recordMap.size === 0) {
      logActionWarn(LOG_CTX, "recordMap 비어 있음 — 멤버 확장 없이 기존 경로 사용", { studentId });
    }

    const { hyperedges, stats } = computeHyperedges(edges, expansionCtx);

    await replaceHyperedges(studentId, tenantId, pipelineId, hyperedges, edgeContext);

    const themeLabels = hyperedges.map((h) => h.themeLabel);

    const modeLabel = edgeContext === "projected" ? "[설계] " : "";
    return {
      preview: `${modeLabel}${stats.computedHyperedges}개 통합 테마 (pair-seed ${stats.pairsExplored}개 탐색, size ${SIZE_MIN}~${SIZE_MAX})`,
      result: { ...stats, themeLabels },
    };
  } catch (err) {
    logActionError(LOG_CTX, err instanceof Error ? err : new Error(String(err)), { studentId, pipelineId });
    throw err;
  }
}

// ============================================
// 확장 컨텍스트 빌더 — activity_tags + crossRef 라벨 병합
// ============================================

type ActivityTagRow = Awaited<ReturnType<typeof findActivityTags>>[number];
type CrossRefData = Awaited<ReturnType<typeof fetchCrossRefData>>;

export function buildExpansionContext(
  tags: ActivityTagRow[],
  crd: CrossRefData,
): HyperedgeExpansionContext {
  const recordMap = new Map<string, HyperedgeRecordMeta>();
  for (const t of tags) {
    if (!t.record_id || !t.record_type || !t.competency_item) continue;
    const existing = recordMap.get(t.record_id);
    if (existing) {
      existing.competencies.add(t.competency_item);
      continue;
    }
    const label =
      crd.recordLabelMap[t.record_id] ??
      `${t.record_type} ${t.record_id.slice(0, 4)}`;
    const grade = crd.recordGradeMap?.[t.record_id] ?? null;
    recordMap.set(t.record_id, {
      recordType: t.record_type,
      label,
      grade,
      competencies: new Set([t.competency_item]),
    });
  }
  return { recordMap };
}

// ============================================
// 순수 함수 — 테스트용 export
// ============================================

type NodeKey = string; // "recordType:recordId"

interface NodeMeta {
  recordType: string;
  recordId: string;
  label: string;
  grade: number | null;
}

export function computeHyperedges(
  edges: PersistedEdge[],
  expansionCtx?: HyperedgeExpansionContext,
): {
  hyperedges: HyperedgeInput[];
  stats: HyperedgeComputationResult;
} {
  // 1) 엣지 필터 (타입 + confidence + 양쪽 recordId + sharedCompetencies 길이 ≥ 2)
  let filteredByConfidence = 0;
  let filteredByCompetency = 0;
  const eligible: PersistedEdge[] = [];
  const nodeMeta = new Map<NodeKey, NodeMeta>();

  for (const e of edges) {
    if (!ELIGIBLE_EDGE_TYPES.has(e.edge_type)) continue;
    if (!e.target_record_id) continue;
    if (e.confidence < CONFIDENCE_MIN) {
      filteredByConfidence++;
      continue;
    }
    const comps = e.shared_competencies ?? [];
    if (comps.length < MIN_SHARED_COMPETENCIES) {
      filteredByCompetency++;
      continue;
    }
    eligible.push(e);
    const src = nodeKey(e.source_record_type, e.source_record_id);
    const tgt = nodeKey(e.target_record_type, e.target_record_id);
    if (!nodeMeta.has(src)) {
      nodeMeta.set(src, {
        recordType: e.source_record_type,
        recordId: e.source_record_id,
        label: e.source_label,
        grade: e.source_grade,
      });
    }
    if (!nodeMeta.has(tgt)) {
      nodeMeta.set(tgt, {
        recordType: e.target_record_type,
        recordId: e.target_record_id,
        label: e.target_label,
        grade: e.target_grade,
      });
    }
  }

  // 2) 모든 pair 시드 추출
  const allPairs = new Set<string>();
  for (const e of eligible) {
    const comps = [...(e.shared_competencies ?? [])].sort();
    for (let i = 0; i < comps.length; i++) {
      for (let j = i + 1; j < comps.length; j++) {
        allPairs.add(`${comps[i]}|${comps[j]}`);
      }
    }
  }

  // 3) 각 pair를 시드로 하여 서브그래프 union-find → size 3~5 컴포넌트 추출
  interface Candidate {
    memberKeys: NodeKey[];
    sharedCompetencies: Set<string>;
    confidence: number;
    seedPair: [string, string];
  }
  const candidates: Candidate[] = [];
  let filteredBySize = 0;

  for (const pairStr of allPairs) {
    const [a, b] = pairStr.split("|") as [string, string];

    const pairEdges = eligible.filter((e) => {
      const s = new Set(e.shared_competencies ?? []);
      return s.has(a) && s.has(b);
    });
    if (pairEdges.length === 0) continue;

    // 서브그래프 union-find
    const parent = new Map<NodeKey, NodeKey>();
    const ensure = (k: NodeKey) => {
      if (!parent.has(k)) parent.set(k, k);
    };
    const find = (k: NodeKey): NodeKey => {
      let cur = k;
      while (parent.get(cur) !== cur) {
        const p = parent.get(cur)!;
        const pp = parent.get(p)!;
        parent.set(cur, pp);
        cur = pp;
      }
      return cur;
    };
    const union = (x: NodeKey, y: NodeKey) => {
      const rx = find(x);
      const ry = find(y);
      if (rx !== ry) parent.set(rx, ry);
    };

    for (const e of pairEdges) {
      const s = nodeKey(e.source_record_type, e.source_record_id);
      const t = nodeKey(e.target_record_type, e.target_record_id!);
      ensure(s);
      ensure(t);
      union(s, t);
    }

    const components = new Map<NodeKey, NodeKey[]>();
    for (const k of parent.keys()) {
      const r = find(k);
      const list = components.get(r) ?? [];
      list.push(k);
      components.set(r, list);
    }

    // 컴포넌트 평가 — Path B: expansionCtx 주어지면 레코드 단위로 확장 후 size 재판정
    for (const rawKeys of components.values()) {
      // 원 컴포넌트가 size>5면 이미 범용 pair라 확장 불필요 — 즉시 탈락
      if (rawKeys.length > SIZE_MAX) {
        filteredBySize++;
        continue;
      }
      const memberSet = new Set(rawKeys);
      const innerEdges = pairEdges.filter(
        (e) =>
          memberSet.has(nodeKey(e.source_record_type, e.source_record_id)) &&
          memberSet.has(nodeKey(e.target_record_type, e.target_record_id!)),
      );
      // 컴포넌트 내부 엣지의 shared_competencies 합집합 (seed pair 포함)
      const compSet = new Set<string>();
      for (const e of innerEdges) {
        for (const c of e.shared_competencies ?? []) compSet.add(c);
      }
      const rawConfidence = Math.min(...innerEdges.map((e) => e.confidence));

      // 확장 전 단계에서도 size<3이면, expansion으로 ≥3이 될 때만 살아남도록 통과
      // → expansion 없이는 탈락
      let expandedKeys: NodeKey[];
      if (expansionCtx) {
        expandedKeys = expandMembers(rawKeys, [a, b], expansionCtx, nodeMeta);
      } else {
        expandedKeys = [...rawKeys];
      }

      if (expandedKeys.length < SIZE_MIN || expandedKeys.length > SIZE_MAX) {
        filteredBySize++;
        continue;
      }

      candidates.push({
        memberKeys: expandedKeys.sort(),
        sharedCompetencies: compSet,
        confidence: rawConfidence,
        seedPair: [a, b],
      });
    }
  }

  // 4) member set 기준 dedup + 병합
  interface DedupedEntry {
    memberKeys: NodeKey[];
    sharedCompetencies: Set<string>;
    confidence: number;
    seedPairs: Array<[string, string]>;
  }
  const byMemberKey = new Map<string, DedupedEntry>();
  for (const c of candidates) {
    const key = c.memberKeys.join("|");
    const existing = byMemberKey.get(key);
    if (existing) {
      for (const s of c.sharedCompetencies) existing.sharedCompetencies.add(s);
      existing.confidence = Math.min(existing.confidence, c.confidence);
      existing.seedPairs.push(c.seedPair);
    } else {
      byMemberKey.set(key, {
        memberKeys: c.memberKeys,
        sharedCompetencies: new Set(c.sharedCompetencies),
        confidence: c.confidence,
        seedPairs: [c.seedPair],
      });
    }
  }

  // 4b) 각 엔트리의 sharedCompetencies를 "멤버 교집합"으로 먼저 좁힘 — 세션 4
  //    (expansionCtx 있을 때만. 없으면 기존 엣지 합집합 유지.)
  //    세션 5 polish: 교집합을 병합보다 먼저 적용해야 병합 후 compSet이 의미 있음.
  //    (엣지 합집합 상태로 병합하면 교집합이 0으로 수렴해 병합 무효화가 과발동.)
  const dedupedEntries = [...byMemberKey.values()];
  if (expansionCtx) {
    for (const entry of dedupedEntries) {
      const intersected = intersectMemberCompetencies(entry.memberKeys, expansionCtx);
      if (intersected.size === 0) continue;
      // seed pair는 멤버 편입 조건이므로 교집합에 항상 포함됨 — 별도 보정 불요.
      entry.sharedCompetencies = intersected;
    }
  }

  // 4c) 부분 중첩 병합 (Jaccard ≥ 0.6) — 세션 4
  //     세션 5 polish: 병합 후 교집합 < 2 이면 해당 병합을 무효화(원본 엔트리 유지).
  const { mergedEntries, mergedByJaccard } = mergeOverlappingEntries(dedupedEntries);

  // 4c-2) 세션 5 polish: sharedCompetencies.size < 2 인 엔트리 탈락
  let filteredByShallow = 0;
  const substantiveEntries: DedupedEntry[] = [];
  for (const entry of mergedEntries) {
    if (entry.sharedCompetencies.size < MIN_THEME_COMPETENCIES) {
      filteredByShallow++;
      continue;
    }
    substantiveEntries.push(entry);
  }

  // 4d) top-N 랭킹 — 세션 4
  const scored = substantiveEntries.map((entry) => ({
    entry,
    score: rankScore(entry, expansionCtx),
  }));
  scored.sort((x, y) => y.score - x.score);
  const droppedByRanking = Math.max(0, scored.length - HYPEREDGE_TOP_N);
  const ranked = scored.slice(0, HYPEREDGE_TOP_N).map((s) => s.entry);

  // 5) 최종 HyperedgeInput 변환 (라벨 희귀도 정렬 + confidence 희귀도 가중)
  const hyperedges: HyperedgeInput[] = [];
  for (const entry of ranked) {
    const sharedSorted = [...entry.sharedCompetencies].sort();
    const themeLabel = pickThemeLabel(sharedSorted, expansionCtx);
    const themeSlug = djb2Hex([...sharedSorted, ...entry.memberKeys].join("|"));

    const members: HyperedgeMember[] = entry.memberKeys.map((k) => {
      const expanded = expansionCtx?.recordMap.get(k.split(":")[1]);
      if (expanded) {
        return {
          recordType: expanded.recordType,
          recordId: k.split(":")[1],
          label: expanded.label,
          grade: expanded.grade,
        };
      }
      const m = nodeMeta.get(k);
      if (m) {
        return { recordType: m.recordType, recordId: m.recordId, label: m.label, grade: m.grade };
      }
      // nodeMeta에도 없으면 키에서 복원 (확장으로 새로 들어온 레코드 + 컨텍스트 없을 때의 안전장치)
      const [rt, rid] = k.split(":");
      return { recordType: rt, recordId: rid, label: rt, grade: null };
    });

    // 가장 대표적인(첫 번째) seed pair를 기준으로 confidence 조정.
    // 여러 pair로 수렴되면 이미 min이 적용된 상태라 추가 페널티는 과도.
    const primarySeed = entry.seedPairs[0];
    const adjustedConfidence = adjustConfidenceByRarity(entry.confidence, primarySeed, expansionCtx);

    // 세션 5 polish — seedPair dedup (정렬 키 기반). 병합 시 같은 pair가 중복 누적되면 evidence가 지저분.
    const seedPairKeys = new Set<string>();
    for (const [sa, sb] of entry.seedPairs) {
      const key = sa < sb ? `${sa}+${sb}` : `${sb}+${sa}`;
      seedPairKeys.add(key);
    }
    const seedPairSummary = [...seedPairKeys].slice(0, 3).join(", ");
    const evidence =
      `공유 역량 ${sharedSorted.length}개(${sharedSorted.join(", ")}), ` +
      `${entry.memberKeys.length}개 레코드 · min confidence ${adjustedConfidence.toFixed(2)} ` +
      `(시드 pair: ${seedPairSummary})`;
    hyperedges.push({
      themeSlug,
      themeLabel,
      hyperedgeType: "theme_convergence",
      members,
      confidence: adjustedConfidence,
      evidence,
      sharedKeywords: null,
      sharedCompetencies: sharedSorted,
    });
  }

  return {
    hyperedges,
    stats: {
      computedHyperedges: hyperedges.length,
      filteredBySize,
      filteredByConfidence,
      filteredByCompetency,
      pairsExplored: allPairs.size,
      mergedByJaccard,
      droppedByRanking,
      filteredByShallow,
    },
  };
}

// ============================================
// 세션 4 — 부분 중첩 병합 (Jaccard)
// ============================================

interface DedupedEntryLike {
  memberKeys: NodeKey[];
  sharedCompetencies: Set<string>;
  confidence: number;
  seedPairs: Array<[string, string]>;
}

/**
 * 멤버 Jaccard ≥ 0.6 이면 하나의 테마로 병합.
 * - 대표: 같은 그룹 내 (confidence desc, memberKeys.length desc) 우선인 엔트리.
 *   멤버는 대표의 것만 유지 (size cap 유지 + 시각 복잡도 억제).
 * - sharedCompetencies: 그룹 전체 교집합.
 * - confidence: 그룹 전체 min.
 * - seedPairs: 그룹 전체 누적 (evidence 요약에 3개까지 노출).
 */
function mergeOverlappingEntries(entries: DedupedEntryLike[]): {
  mergedEntries: DedupedEntryLike[];
  mergedByJaccard: number;
} {
  const n = entries.length;
  if (n < 2) return { mergedEntries: entries, mergedByJaccard: 0 };

  const parent = Array.from({ length: n }, (_, i) => i);
  const find = (x: number): number => {
    let cur = x;
    while (parent[cur] !== cur) {
      parent[cur] = parent[parent[cur]];
      cur = parent[cur];
    }
    return cur;
  };
  const union = (x: number, y: number) => {
    const rx = find(x);
    const ry = find(y);
    if (rx !== ry) parent[rx] = ry;
  };

  const memberSets = entries.map((e) => new Set(e.memberKeys));
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const a = memberSets[i];
      const b = memberSets[j];
      let inter = 0;
      for (const k of a) if (b.has(k)) inter++;
      const unionSize = a.size + b.size - inter;
      const jaccard = unionSize === 0 ? 0 : inter / unionSize;
      if (jaccard >= JACCARD_MERGE_THRESHOLD) union(i, j);
    }
  }

  const groups = new Map<number, number[]>();
  for (let i = 0; i < n; i++) {
    const r = find(i);
    const list = groups.get(r) ?? [];
    list.push(i);
    groups.set(r, list);
  }

  const mergedEntries: DedupedEntryLike[] = [];
  let mergedByJaccard = 0;
  for (const ids of groups.values()) {
    if (ids.length === 1) {
      mergedEntries.push(entries[ids[0]]);
      continue;
    }
    const picked = [...ids].sort((x, y) => {
      const ex = entries[x];
      const ey = entries[y];
      if (ey.confidence !== ex.confidence) return ey.confidence - ex.confidence;
      return ey.memberKeys.length - ex.memberKeys.length;
    })[0];
    const representative = entries[picked];

    // 교집합(sharedCompetencies) + min(confidence) + 누적(seedPairs)
    const mergedComps = new Set<string>(representative.sharedCompetencies);
    let mergedConf = representative.confidence;
    const mergedSeedPairs: Array<[string, string]> = [...representative.seedPairs];
    for (const idx of ids) {
      if (idx === picked) continue;
      const other = entries[idx];
      for (const c of mergedComps) {
        if (!other.sharedCompetencies.has(c)) mergedComps.delete(c);
      }
      mergedConf = Math.min(mergedConf, other.confidence);
      mergedSeedPairs.push(...other.seedPairs);
    }

    // 세션 5 polish — 병합 후 교집합<2면 병합 무효화. 원본 엔트리 개별 유지.
    // Why: Jaccard가 멤버 유사도를 판정해도 공통 테마가 1개 이하면 "하나의 축"이라 부를 근거가 약함.
    if (mergedComps.size < MIN_THEME_COMPETENCIES) {
      for (const idx of ids) mergedEntries.push(entries[idx]);
      continue;
    }

    mergedByJaccard += ids.length - 1; // 대표 1개만 남음 → (그룹크기-1)건 흡수
    mergedEntries.push({
      memberKeys: representative.memberKeys,
      sharedCompetencies: mergedComps,
      confidence: mergedConf,
      seedPairs: mergedSeedPairs,
    });
  }
  return { mergedEntries, mergedByJaccard };
}

// ============================================
// 세션 4 — 멤버 교집합으로 compSet 좁히기
// ============================================

/**
 * 멤버 전부가 공유하는 역량 교집합을 반환. 한 멤버라도 메타가 없거나 역량 집합이 비면 빈 Set.
 * 결과적으로 "범용 역량까지 넣은 엣지 합집합"이 아니라 "이 하이퍼엣지를 관통하는 진짜 공통 역량".
 */
function intersectMemberCompetencies(
  memberKeys: NodeKey[],
  ctx: HyperedgeExpansionContext,
): Set<string> {
  if (memberKeys.length === 0) return new Set();
  const firstId = memberKeys[0].split(":")[1];
  const firstMeta = ctx.recordMap.get(firstId);
  if (!firstMeta || firstMeta.competencies.size === 0) return new Set();

  const intersection = new Set(firstMeta.competencies);
  for (let i = 1; i < memberKeys.length; i++) {
    const rid = memberKeys[i].split(":")[1];
    const meta = ctx.recordMap.get(rid);
    if (!meta) return new Set();
    for (const c of intersection) {
      if (!meta.competencies.has(c)) intersection.delete(c);
    }
    if (intersection.size === 0) return intersection;
  }
  return intersection;
}

// ============================================
// 세션 4 — 랭킹 스코어
// ============================================

/**
 * score = confidence × rarityBoost × typeDiversityBoost
 *   - rarityBoost: sharedCompetencies 중 평균 "출현 레코드 수" 역수 (rare 역량 많을수록 +)
 *   - typeDiversityBoost: 멤버 record_type 고유 개수 / 3 (최대 1)
 * expansionCtx 없을 땐 confidence만 사용.
 */
function rankScore(
  entry: DedupedEntryLike,
  ctx?: HyperedgeExpansionContext,
): number {
  if (!ctx || ctx.recordMap.size === 0) return entry.confidence;

  // rarityBoost — 평균 출현 수가 작을수록 높게
  let rarityBoost = 1.0;
  if (entry.sharedCompetencies.size > 0) {
    let totalCount = 0;
    for (const comp of entry.sharedCompetencies) {
      let c = 0;
      for (const meta of ctx.recordMap.values()) {
        if (meta.competencies.has(comp)) c++;
      }
      totalCount += c;
    }
    const avg = totalCount / entry.sharedCompetencies.size;
    // 전체 학생 레코드 수 대비 상대 희귀도 — 평균이 전체의 30% 이하이면 최대 부스트 1.3, 80%+이면 0.8
    const ratio = avg / Math.max(1, ctx.recordMap.size);
    rarityBoost = Math.max(0.8, Math.min(1.3, 1.4 - ratio));
  }

  // typeDiversity — setek/changche/haengteuk 3종 전부이면 1.0, 1종만이면 ~0.33
  const types = new Set<string>();
  for (const k of entry.memberKeys) types.add(k.split(":")[0]);
  const typeDiversityBoost = 0.7 + 0.1 * types.size; // 1종=0.8, 2종=0.9, 3종=1.0, 4종=1.1

  return entry.confidence * rarityBoost * typeDiversityBoost;
}

// ============================================
// Path B — 멤버 확장
// ============================================

/**
 * 컴포넌트에 포함된 record_type 집합을 유지한 채,
 * expansionCtx에서 seed pair 역량을 모두 가진 **모든 레코드**로 멤버 재구성.
 * 원 컴포넌트 멤버는 항상 포함. nodeMeta에만 있던 대표 노드 정보도 보존.
 */
function expandMembers(
  rawKeys: NodeKey[],
  seedPair: [string, string],
  ctx: HyperedgeExpansionContext,
  nodeMeta: Map<NodeKey, NodeMeta>,
): NodeKey[] {
  const componentTypes = new Set<string>();
  for (const k of rawKeys) componentTypes.add(k.split(":")[0]);

  const expanded = new Set<NodeKey>(rawKeys);
  const [a, b] = seedPair;
  for (const [recordId, meta] of ctx.recordMap) {
    if (!componentTypes.has(meta.recordType)) continue;
    if (!meta.competencies.has(a) || !meta.competencies.has(b)) continue;
    const key = nodeKey(meta.recordType, recordId);
    expanded.add(key);
    // nodeMeta 에 없는 신규 확장 노드는 보강 (HyperedgeMember 생성 시 label/grade 유지)
    if (!nodeMeta.has(key)) {
      nodeMeta.set(key, {
        recordType: meta.recordType,
        recordId,
        label: meta.label,
        grade: meta.grade,
      });
    }
  }
  return [...expanded];
}

// ============================================
// Path B — 라벨 희귀도 정렬
// ============================================

/**
 * expansionCtx 주어지면: 학생 내 각 역량의 출현 레코드 수가 적을수록 우선 (rare-first).
 * 같은 rarity끼리는 알파벳 순.
 * expansionCtx 없으면 기존 단순 정렬(알파벳 top-3).
 */
function pickThemeLabel(
  sharedSorted: string[],
  ctx?: HyperedgeExpansionContext,
): string {
  if (!ctx || ctx.recordMap.size === 0 || sharedSorted.length === 0) {
    return sharedSorted.slice(0, 3).join(" · ");
  }
  const rarityCount = new Map<string, number>();
  for (const comp of sharedSorted) {
    let count = 0;
    for (const meta of ctx.recordMap.values()) {
      if (meta.competencies.has(comp)) count++;
    }
    rarityCount.set(comp, count);
  }
  const ranked = [...sharedSorted].sort((x, y) => {
    const cx = rarityCount.get(x) ?? Number.POSITIVE_INFINITY;
    const cy = rarityCount.get(y) ?? Number.POSITIVE_INFINITY;
    if (cx !== cy) return cx - cy; // 낮은 count(rare) 우선
    return x.localeCompare(y);
  });
  return ranked.slice(0, 3).join(" · ");
}

// ============================================
// Path B — confidence 희귀도 가중
// ============================================

/**
 * seed pair를 공유하는 레코드 수(=pair commonness)가 많을수록 confidence 하향.
 * 임계치(3) 이하면 조정 없음. 이상이면 log2 기반 완만한 감쇠, floor 0.5.
 */
function adjustConfidenceByRarity(
  baseConf: number,
  seedPair: [string, string],
  ctx?: HyperedgeExpansionContext,
): number {
  if (!ctx || ctx.recordMap.size === 0) return baseConf;
  const [a, b] = seedPair;
  let commonness = 0;
  for (const meta of ctx.recordMap.values()) {
    if (meta.competencies.has(a) && meta.competencies.has(b)) commonness++;
  }
  if (commonness <= CONFIDENCE_RARITY_THRESHOLD) return baseConf;

  // commonness=4 → 0.95×, commonness=8 → 0.85×, commonness=16 → 0.75×
  const excess = Math.log2(commonness / CONFIDENCE_RARITY_THRESHOLD);
  const factor = Math.max(0.7, 1 - 0.1 * excess);
  const adjusted = baseConf * factor;
  return Math.max(CONFIDENCE_FLOOR, Math.round(adjusted * 100) / 100);
}

function nodeKey(recordType: string, recordId: string): NodeKey {
  return `${recordType}:${recordId}`;
}

/** djb2 해시 → 8자리 16진수 (theme_slug 용, 결정론적 + 외부 의존 0) */
function djb2Hex(input: string): string {
  let hash = 5381;
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) + hash + input.charCodeAt(i)) | 0;
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

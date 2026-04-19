// ============================================
// α1-3: buildStudentState — StudentState World Model 빌더
//
// 학생 식별자 + 시점(asOf) → Layer 0~4 + 보조 영역(aux) 을 통합 수집해
// 불변 스냅샷을 반환한다. 영속화는 student-state-repository.upsertSnapshot.
//
// 설계 원칙:
//   - 읽기 전용. 사이드이펙트 없음 (영속화는 호출자 선택).
//   - DB 우선. 파이프라인 결과가 필요한 캐시(`ctx.results`)는 선택 주입.
//   - 데이터 부족은 null/빈배열로 허용(lenient) — metadata.completenessRatio 로 전달.
//
// α1-3 범위:
//   - Layer 0: profile_card (repository)
//   - Layer 1: competency_scores + content_quality (ai/ai_projected)
//   - Layer 2: hyperedges (analysis context)
//   - Layer 3: narrative_arc
//   - aux.volunteer: volunteer 테이블(최종 totalHours/lastActivityAt) +
//                    activity_tags(record_type='volunteer') 근거 +
//                    pipelineResults["competency_volunteer"] (선택) 로부터 themes/caringEvidence 보강
//   - blueprint: active main_exploration (scope=overall, direction=analysis)
//   - aux.awards/attendance/reading: α1-4/5 까지 스텁(null/빈)
//   - hakjongScore: α2 까지 null
//   - trajectory: 호출자 옵션으로 listTrajectory 포함 가능
// ============================================

import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";

import type {
  StudentState,
  StudentStateAsOf,
  StudentStateMetadata,
  ProfileCardSnapshot,
  CompetencyLayerState,
  CompetencyAxisState,
  ContentQualityAxisState,
  HyperedgeSnapshot,
  NarrativeArcSegment,
  NarrativeArcPhase,
  VolunteerState,
  AwardState,
  AttendanceState,
  ReadingState,
  BlueprintAnchor,
  TrajectoryPoint,
} from "../types/student-state";
import type {
  CompetencyArea,
  CompetencyItemCode,
  CompetencyGrade,
  RecordType,
} from "../types/enums";

import {
  findProfileCard,
  rowToProfileCard,
} from "../repository/profile-card-repository";
import {
  findCompetencyScoresBySchoolYears,
  findActivityTags,
} from "../repository/competency-repository";
import { findHyperedges } from "../repository/hyperedge-repository";
import { findNarrativeArcsByStudent } from "../repository/narrative-arc-repository";
import { getActiveMainExploration } from "../repository/main-exploration-repository";
import { fetchVolunteerUpTo } from "../repository/volunteer-repository";
import {
  listTrajectory,
  type PersistedStudentStateSnapshot,
} from "../repository/student-state-repository";

import { calculateSchoolYear, gradeToSchoolYear } from "@/lib/utils/schoolYear";

type Client = SupabaseClient<Database>;

// ============================================
// Public types
// ============================================

export interface BuildStudentStateOptions {
  client?: Client;
  /** 파이프라인 컨텍스트에서 볼 때 주입 — `ctx.results["competency_volunteer"]` 그대로. */
  pipelineResults?: Record<string, unknown> | null;
  /** trajectory 포함 여부 (기본 false — 쿼리 비용 절감). */
  includeTrajectory?: boolean;
  /** trajectory 최대 개수 (기본 10). */
  trajectoryLimit?: number;
}

// ============================================
// 내부 헬퍼
// ============================================

const COMPETENCY_ITEM_ORDER: readonly CompetencyItemCode[] = [
  "academic_achievement",
  "academic_attitude",
  "academic_inquiry",
  "career_course_effort",
  "career_course_achievement",
  "career_exploration",
  "community_collaboration",
  "community_caring",
  "community_integrity",
  "community_leadership",
];

function areaOf(code: CompetencyItemCode): CompetencyArea {
  if (code.startsWith("academic_")) return "academic";
  if (code.startsWith("career_")) return "career";
  return "community";
}

async function resolveClient(client?: Client): Promise<Client> {
  if (client) return client;
  return (await createSupabaseServerClient()) as unknown as Client;
}

/**
 * asOf 기본값: 학생 snapshot 기준 현 학년 × 2학기(학년 말).
 * asOf 일부만 주어지면 빈 필드 보완.
 */
async function resolveAsOf(
  client: Client,
  studentId: string,
  tenantId: string,
  partial?: Partial<StudentStateAsOf>,
): Promise<StudentStateAsOf> {
  const now = new Date();
  const nowSchoolYear = calculateSchoolYear(now);

  let grade: 1 | 2 | 3 = (partial?.grade as 1 | 2 | 3 | undefined) ?? 1;
  if (!partial?.grade) {
    const { data } = await client
      .from("students")
      .select("grade")
      .eq("id", studentId)
      .eq("tenant_id", tenantId)
      .maybeSingle();
    const g = data?.grade;
    if (g === 1 || g === 2 || g === 3) grade = g as 1 | 2 | 3;
  }

  const semester: 1 | 2 = partial?.semester ?? 2;
  const schoolYear = partial?.schoolYear ?? nowSchoolYear;
  const label =
    partial?.label ?? `${schoolYear}학년도 ${grade}학년 ${semester}학기`;

  return {
    schoolYear,
    grade,
    semester,
    label,
    builtAt: partial?.builtAt ?? new Date().toISOString(),
  };
}

/** asOf.schoolYear 기준 포함되는 학년도 목록 — 학생 grade 로 역산. */
function enumerateSchoolYears(asOf: StudentStateAsOf): number[] {
  const years: number[] = [];
  for (let g = 1; g <= asOf.grade; g++) {
    years.push(gradeToSchoolYear(g, asOf.grade, asOf.schoolYear));
  }
  return years;
}

// ============================================
// Layer 별 수집기
// ============================================

async function collectProfileCard(
  client: Client,
  studentId: string,
  tenantId: string,
  asOf: StudentStateAsOf,
): Promise<ProfileCardSnapshot | null> {
  if (asOf.grade < 2) return null;
  const row = await findProfileCard(studentId, tenantId, asOf.grade, "ai", client);
  if (!row) return null;

  const card = rowToProfileCard(row);
  const interestConsistencyText =
    typeof row.interest_consistency === "object" &&
    row.interest_consistency !== null &&
    "narrative" in row.interest_consistency
      ? ((row.interest_consistency as { narrative?: string }).narrative ?? null)
      : typeof row.interest_consistency === "string"
        ? row.interest_consistency
        : null;

  return {
    id: row.id,
    targetGrade: row.target_grade as 1 | 2 | 3,
    source: row.source,
    renderedText: "", // 렌더러는 파이프라인 경로에서만 필요 — snapshot 에 텍스트 미포함
    persistentStrengths: (card.persistentStrengths ?? []).map(
      (s: { competencyItem: string }) => s.competencyItem,
    ),
    persistentWeaknesses: (card.persistentWeaknesses ?? []).map(
      (w: { competencyItem: string }) => w.competencyItem,
    ),
    recurringQualityIssues: (card.recurringQualityIssues ?? []).map(
      (r: { code: string }) => r.code,
    ),
    interestConsistency: interestConsistencyText,
    updatedAt: row.updated_at,
  };
}

async function collectCompetencyLayer(
  client: Client,
  studentId: string,
  tenantId: string,
  asOf: StudentStateAsOf,
): Promise<CompetencyLayerState | null> {
  const years = enumerateSchoolYears(asOf);
  if (years.length === 0) return null;

  const [aiScores, projectedScores] = await Promise.all([
    findCompetencyScoresBySchoolYears(studentId, years, tenantId, "ai"),
    findCompetencyScoresBySchoolYears(studentId, years, tenantId, "ai_projected"),
  ]);

  // yearly scope 만 (학년 단위). 최신 학년도 값을 axis 로 선택 (없으면 null).
  const pickLatestByItem = (
    rows: Awaited<ReturnType<typeof findCompetencyScoresBySchoolYears>>,
  ) => {
    const byItem = new Map<string, typeof rows[number]>();
    for (const r of rows) {
      if (r.scope !== "yearly") continue;
      const prev = byItem.get(r.competency_item);
      if (!prev || prev.school_year < r.school_year) {
        byItem.set(r.competency_item, r);
      }
    }
    return byItem;
  };

  const aiByItem = pickLatestByItem(aiScores);
  const projectedByItem = pickLatestByItem(projectedScores);

  const axes: CompetencyAxisState[] = COMPETENCY_ITEM_ORDER.map((code) => {
    const ai = aiByItem.get(code);
    const projected = projectedByItem.get(code);
    const effective = ai ?? projected;
    return {
      code,
      area: areaOf(code),
      grade: (effective?.grade_value as CompetencyGrade | undefined) ?? null,
      source: ai
        ? "ai"
        : projected
          ? "ai_projected"
          : "ai",
      narrative: effective?.narrative ?? null,
      supportingRecordIds: (effective?.source_record_ids as string[] | null) ?? [],
    };
  });

  const [analysisQuality, projectedQuality] = await Promise.all([
    collectContentQualityAxis(client, studentId, tenantId, "ai"),
    collectContentQualityAxis(client, studentId, tenantId, "ai_projected"),
  ]);

  const hasAnyAxis = aiByItem.size > 0 || projectedByItem.size > 0;
  if (!hasAnyAxis && analysisQuality.sampleSize === 0 && projectedQuality.sampleSize === 0) {
    return null;
  }

  return { axes, analysisQuality, projectedQuality };
}

async function collectContentQualityAxis(
  client: Client,
  studentId: string,
  tenantId: string,
  source: "ai" | "ai_projected",
): Promise<ContentQualityAxisState> {
  const { data, error } = await client
    .from("student_record_content_quality")
    .select(
      "specificity, coherence, depth, grammar, scientific_validity, overall_score",
    )
    .eq("student_id", studentId)
    .eq("tenant_id", tenantId)
    .eq("source", source);
  if (error) throw error;

  const rows = data ?? [];
  if (rows.length === 0) {
    return {
      specificity: null,
      coherence: null,
      depth: null,
      grammar: null,
      scientificValidity: null,
      overallScore: null,
      sampleSize: 0,
      source,
    };
  }

  const avg = (key: keyof (typeof rows)[number]): number | null => {
    const nums = rows
      .map((r) => r[key])
      .filter((v): v is number => typeof v === "number");
    if (nums.length === 0) return null;
    return Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 10) / 10;
  };

  return {
    specificity: avg("specificity"),
    coherence: avg("coherence"),
    depth: avg("depth"),
    grammar: avg("grammar"),
    scientificValidity: avg("scientific_validity"),
    overallScore: avg("overall_score"),
    sampleSize: rows.length,
    source,
  };
}

async function collectHyperedges(
  studentId: string,
  tenantId: string,
): Promise<HyperedgeSnapshot[]> {
  const rows = await findHyperedges(studentId, tenantId, {
    contexts: ["analysis"],
  });
  return rows.map((h) => ({
    id: h.id,
    themeSlug: h.theme_slug,
    memberRecordIds: h.members.map((m) => m.recordId),
    sharedCompetencies: h.shared_competencies ?? [],
    confidence: h.confidence,
    hyperedgeType: h.hyperedge_type,
  }));
}

async function collectNarrativeArc(
  studentId: string,
  tenantId: string,
): Promise<NarrativeArcSegment[]> {
  const rows = await findNarrativeArcsByStudent(studentId, tenantId, { source: "ai" });
  return rows.map((r) => {
    const phasesPresent: NarrativeArcPhase[] = [];
    if (r.curiosity_present) phasesPresent.push("curiosity");
    if (r.topic_selection_present) phasesPresent.push("topic_selection");
    if (r.inquiry_content_present) phasesPresent.push("inquiry");
    if (r.references_present) phasesPresent.push("references");
    if (r.conclusion_present) phasesPresent.push("conclusion");
    if (r.teacher_observation_present) phasesPresent.push("teacher_observation");
    if (r.growth_narrative_present) phasesPresent.push("growth");
    if (r.reinquiry_present) phasesPresent.push("reinquiry");
    return {
      recordId: r.record_id,
      recordType: r.record_type as RecordType,
      phasesPresent,
      flowCompleteness: phasesPresent.length / 8,
    };
  });
}

// ─── 보조 영역 ────────────────────────────────────────────────────────────

async function collectVolunteerState(
  client: Client,
  studentId: string,
  tenantId: string,
  asOf: StudentStateAsOf,
  pipelineResults?: Record<string, unknown> | null,
): Promise<VolunteerState | null> {
  const [volunteers, tags] = await Promise.all([
    fetchVolunteerUpTo(client, studentId, tenantId, asOf.schoolYear),
    findActivityTags(studentId, tenantId, {
      recordType: "volunteer",
      tagContext: "analysis",
    }),
  ]);

  if (volunteers.length === 0 && tags.length === 0) {
    return null;
  }

  const totalHours = volunteers.reduce(
    (sum, v) => sum + Number(v.hours ?? 0),
    0,
  );
  const lastActivityAt =
    volunteers.reduce<string | null>((acc, v) => {
      const d = v.activity_date;
      if (!d) return acc;
      if (!acc || acc < d) return d;
      return acc;
    }, null) ?? null;

  // ctx.results 우선 — α1-2 runner 가 남긴 recurringThemes/caringEvidence
  const ctxVolunteer = pipelineResults?.competency_volunteer;
  const recurringFromCtx =
    ctxVolunteer && typeof ctxVolunteer === "object" && "recurringThemes" in ctxVolunteer
      ? ((ctxVolunteer as { recurringThemes?: string[] }).recurringThemes ?? [])
      : [];
  const caringFromCtx =
    ctxVolunteer && typeof ctxVolunteer === "object" && "caringEvidence" in ctxVolunteer
      ? ((ctxVolunteer as { caringEvidence?: string[] }).caringEvidence ?? [])
      : [];

  // ctx 부재 시 activity_tags 에서 근거 요약만 추출 (themes 는 ctx 소멸 시 비움)
  const caringFromTags =
    caringFromCtx.length > 0
      ? []
      : tags
          .filter((t) => t.competency_item === "community_caring")
          .map((t) => (t.evidence_summary ?? "").replace(/^\[AI\]\s*/, "").trim())
          .filter((s) => s.length > 0)
          .slice(0, 3);

  return {
    totalHours,
    recurringThemes: recurringFromCtx,
    caringEvidence: caringFromCtx.length > 0 ? caringFromCtx : caringFromTags,
    lastActivityAt,
  };
}

function emptyAwardState(): AwardState {
  return { items: [], leadershipEvidence: [], careerRelevance: [] };
}

function emptyAttendanceState(): AttendanceState | null {
  // α1-5 까지 미집계. 데이터 없음을 null 로 표현.
  return null;
}

async function collectReadingState(
  client: Client,
  studentId: string,
  tenantId: string,
  asOf: StudentStateAsOf,
): Promise<ReadingState | null> {
  // α1-3 범위: 단순 카운트만. 진로 일관성/링크는 α1-4 이후 재검토.
  const years = enumerateSchoolYears(asOf);
  if (years.length === 0) return null;
  const { data, error } = await client
    .from("student_record_reading")
    .select("id, created_at")
    .eq("student_id", studentId)
    .eq("tenant_id", tenantId)
    .in("school_year", years);
  if (error) return null;
  const rows = data ?? [];
  if (rows.length === 0) return null;
  const lastReadAt = rows.reduce<string | null>((acc, r) => {
    const d = (r as { created_at?: string | null }).created_at ?? null;
    if (!d) return acc;
    if (!acc || acc < d) return d;
    return acc;
  }, null);
  return {
    totalBooks: rows.length,
    careerAlignedBooks: 0,
    linkedRecordIds: [],
    lastReadAt,
  };
}

async function collectBlueprint(
  client: Client,
  studentId: string,
  tenantId: string,
): Promise<BlueprintAnchor | null> {
  const active = await getActiveMainExploration(
    studentId,
    tenantId,
    { scope: "overall", trackLabel: null, direction: "analysis" },
    client,
  );
  if (!active) return null;
  const tierPlan = active.tier_plan as
    | { foundational?: unknown; development?: unknown; advanced?: unknown }
    | null;
  return {
    mainExplorationId: active.id,
    version: active.version,
    origin: active.origin ?? "consultant_direct",
    tierPlan: tierPlan
      ? {
          foundational: tierPlan.foundational ?? null,
          development: tierPlan.development ?? null,
          advanced: tierPlan.advanced ?? null,
        }
      : null,
    targetMajor: active.career_field ?? null,
    targetUniversityLevel: null,
    updatedAt: active.updated_at,
  };
}

async function collectTrajectory(
  client: Client,
  studentId: string,
  tenantId: string,
  limit: number,
): Promise<TrajectoryPoint[]> {
  const rows = await listTrajectory(studentId, tenantId, { limit }, client);
  return rows.map((r: PersistedStudentStateSnapshot) => ({
    asOf: {
      schoolYear: r.school_year,
      grade: r.target_grade as 1 | 2 | 3,
      semester: r.target_semester,
      label: r.as_of_label,
      builtAt: r.built_at,
    },
    snapshotId: r.id,
    hakjongScore: r.hakjong_total,
    completenessRatio: r.completeness_ratio,
  }));
}

// ============================================
// Metadata
// ============================================

// Area 당 Reward computable 최소 축 수 — α2 Reward 엔진 착수 시 재조정 가능.
const MIN_AXES_FOR_COMPUTABLE = 2;

/** 10 축을 area 별로 분류. */
function axesByArea(axes: readonly CompetencyAxisState[]) {
  const groups = { academic: [] as CompetencyAxisState[], career: [] as CompetencyAxisState[], community: [] as CompetencyAxisState[] };
  for (const a of axes) groups[a.area].push(a);
  return groups;
}

function nonNullCount(axes: readonly CompetencyAxisState[]): number {
  return axes.reduce((n, a) => (a.grade !== null ? n + 1 : n), 0);
}

function buildMetadata(params: {
  profileCard: ProfileCardSnapshot | null;
  competencies: CompetencyLayerState | null;
  hyperedges: readonly HyperedgeSnapshot[];
  narrativeArc: readonly NarrativeArcSegment[];
  volunteer: VolunteerState | null;
  awards: AwardState | null;
  attendance: AttendanceState | null;
  reading: ReadingState | null;
  blueprint: BlueprintAnchor | null;
}): StudentStateMetadata {
  const layer0 = params.profileCard !== null;
  const layer1 =
    params.competencies !== null &&
    params.competencies.axes.some((a) => a.grade !== null);
  const layer2 = params.hyperedges.length > 0;
  const layer3 = params.narrativeArc.length > 0;
  const volunteerP = params.volunteer !== null;
  const awardsP = (params.awards?.items.length ?? 0) > 0;
  const attendanceP = params.attendance !== null;
  const readingP = params.reading !== null;
  const blueprintP = params.blueprint !== null;

  const signals = [
    layer0,
    layer1,
    layer2,
    layer3,
    volunteerP,
    awardsP,
    attendanceP,
    readingP,
    blueprintP,
  ];
  const completenessRatio = signals.filter(Boolean).length / signals.length;

  // Area 별 Layer 1 축 채움률
  const groups = params.competencies
    ? axesByArea(params.competencies.axes)
    : { academic: [], career: [], community: [] };
  const academicFill = groups.academic.length === 0 ? 0 : nonNullCount(groups.academic) / groups.academic.length;
  const careerFill = groups.career.length === 0 ? 0 : nonNullCount(groups.career) / groups.career.length;
  const communityL1Fill = groups.community.length === 0 ? 0 : nonNullCount(groups.community) / groups.community.length;
  // community 는 Layer 1 70% + aux 30% — 나눔/리더십/성실 3 보조축 존재비
  const communityAuxFill = ([volunteerP, awardsP, attendanceP].filter(Boolean).length) / 3;
  const communityFill = 0.7 * communityL1Fill + 0.3 * communityAuxFill;

  const areaCompleteness = {
    academic: Math.round(academicFill * 1000) / 1000,
    career: Math.round(careerFill * 1000) / 1000,
    community: Math.round(communityFill * 1000) / 1000,
  };

  // Area 별 Reward 산출 가능 여부 (Layer 1 축 ≥ MIN_AXES_FOR_COMPUTABLE)
  const academicComputable = nonNullCount(groups.academic) >= MIN_AXES_FOR_COMPUTABLE;
  const careerComputable = nonNullCount(groups.career) >= MIN_AXES_FOR_COMPUTABLE;
  const communityComputable = nonNullCount(groups.community) >= MIN_AXES_FOR_COMPUTABLE;
  const hakjongScoreComputable = {
    academic: academicComputable,
    career: careerComputable,
    community: communityComputable,
    total: academicComputable && careerComputable && communityComputable,
  };

  const staleReasons: string[] = [];
  // α1-3 범위: layer1 존재 + profile card 부재 (2학년 이상) → stale 후보. asOf.grade 는 상위에서 검증.

  return {
    snapshotId: null,
    completenessRatio,
    layer0Present: layer0,
    layer1Present: layer1,
    layer2Present: layer2,
    layer3Present: layer3,
    auxVolunteerPresent: volunteerP,
    auxAwardsPresent: awardsP,
    auxAttendancePresent: attendanceP,
    auxReadingPresent: readingP,
    areaCompleteness,
    hakjongScoreComputable,
    blueprintPresent: blueprintP,
    staleness: {
      hasStaleLayer: staleReasons.length > 0,
      staleReasons,
    },
  };
}

// ============================================
// Public entry
// ============================================

/**
 * 학생의 시점 기반 StudentState 스냅샷을 빌드한다.
 * 영속화는 호출자가 선택 — repository.upsertSnapshot 으로 DB 저장.
 *
 * @param asOf - 부분 지정 가능. 미지정 시 학생의 현재 학년 × 2학기 × 현 학년도.
 * @param options.pipelineResults - 파이프라인 진행 중 호출 시 ctx.results 전달 — volunteer 테마/근거 보강.
 */
export async function buildStudentState(
  studentId: string,
  tenantId: string,
  asOf?: Partial<StudentStateAsOf>,
  options?: BuildStudentStateOptions,
): Promise<StudentState> {
  const client = await resolveClient(options?.client);
  const resolvedAsOf = await resolveAsOf(client, studentId, tenantId, asOf);

  const [profileCard, competencies, hyperedges, narrativeArc, volunteer, reading, blueprint] =
    await Promise.all([
      collectProfileCard(client, studentId, tenantId, resolvedAsOf),
      collectCompetencyLayer(client, studentId, tenantId, resolvedAsOf),
      collectHyperedges(studentId, tenantId),
      collectNarrativeArc(studentId, tenantId),
      collectVolunteerState(
        client,
        studentId,
        tenantId,
        resolvedAsOf,
        options?.pipelineResults ?? null,
      ),
      collectReadingState(client, studentId, tenantId, resolvedAsOf),
      collectBlueprint(client, studentId, tenantId),
    ]);

  const awards = emptyAwardState(); // α1-4 까지 스텁
  const attendance = emptyAttendanceState(); // α1-5 까지 스텁

  const trajectory = options?.includeTrajectory
    ? await collectTrajectory(
        client,
        studentId,
        tenantId,
        options?.trajectoryLimit ?? 10,
      )
    : [];

  const metadata = buildMetadata({
    profileCard,
    competencies,
    hyperedges,
    narrativeArc,
    volunteer,
    awards,
    attendance,
    reading,
    blueprint,
  });

  return {
    studentId,
    tenantId,
    asOf: resolvedAsOf,
    profileCard,
    competencies,
    hyperedges,
    narrativeArc,
    trajectory,
    aux: { volunteer, awards, attendance, reading },
    hakjongScore: null, // α2
    blueprint,
    metadata,
  };
}

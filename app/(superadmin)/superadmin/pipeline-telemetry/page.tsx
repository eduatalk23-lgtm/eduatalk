import { redirect } from "next/navigation";
import { createSupabaseAdminClient, type SupabaseAdminClient } from "@/lib/supabase/admin";
import { getCachedUserRole } from "@/lib/auth/getCurrentUserRole";

type VariantKey = "v1_baseline" | "v2_axis_targeted" | "NULL";

type VariantRow = {
  variant: VariantKey;
  attempts: number;
  retried: number;
  avgScore: number;
  minScore: number;
  maxScore: number;
  belowThreshold: number;
  atOrAbove: number;
};

type RecordTypeRow = {
  recordType: string;
  variant: VariantKey;
  n: number;
  avgScore: number;
  passRate: number;
};

type DayBucket = {
  day: string;
  touched: number;
  p9Attempts: number;
  v1: number;
  v2: number;
};

const WINDOW_DAYS = 14;

export default async function PipelineTelemetryPage() {
  const { userId, role } = await getCachedUserRole();

  if (!userId || role !== "superadmin") {
    redirect("/login");
  }

  const adminClient = createSupabaseAdminClient();
  if (!adminClient) {
    return (
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10">
        <h1 className="text-3xl font-semibold">Phase 5 Telemetry</h1>
        <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-red-700">
          시스템 설정 오류: SUPABASE_SERVICE_ROLE_KEY 환경 변수가 설정되지 않았습니다.
        </div>
      </div>
    );
  }

  const flagEnabled = process.env.ENABLE_DRAFT_REFINEMENT === "true";

  const [variantBreakdown, recordTypeBreakdown, dayBuckets, retryDistribution] = await Promise.all([
    fetchVariantBreakdown(adminClient),
    fetchRecordTypeBreakdown(adminClient),
    fetchDayBuckets(adminClient),
    fetchRetryDistribution(adminClient),
  ]);

  const totals = summarize(variantBreakdown);

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-10">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold">Phase 5 Telemetry</h1>
        <p className="text-sm text-gray-600">
          P9 draft_refinement A/B variant 측정. 최근 {WINDOW_DAYS}일 / source=ai_projected (설계 모드 AI 가안) / cross-tenant 집계.
        </p>
        <FlagBanner enabled={flagEnabled} attempts={totals.attempts} />
      </header>

      <StatCards totals={totals} />

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold">variant 비교</h2>
        <VariantTable rows={variantBreakdown} />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold">record_type × variant</h2>
        <RecordTypeTable rows={recordTypeBreakdown} />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold">최근 추이 (14일)</h2>
        <DayBucketTable rows={dayBuckets} />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold">retry_count 분포</h2>
        <RetryDistributionTable rows={retryDistribution} />
      </section>
    </div>
  );
}

function FlagBanner({ enabled, attempts }: { enabled: boolean; attempts: number }) {
  if (!enabled) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <div className="font-medium">측정 대기 중 — ENABLE_DRAFT_REFINEMENT 가 off 상태입니다.</div>
        <div className="mt-1 text-amber-800">
          운영 전환 절차는 <code className="rounded bg-amber-100 px-1 py-0.5 text-xs">docs/phase-5-production-rollout-checklist.md</code> 참조. 현재 누적 attempts: {attempts}.
        </div>
      </div>
    );
  }
  return (
    <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-900">
      ENABLE_DRAFT_REFINEMENT = true · 측정 누적 중 (attempts: {attempts})
    </div>
  );
}

type Totals = {
  attempts: number;
  retried: number;
  v1Attempts: number;
  v2Attempts: number;
  avgScoreAll: number;
  passRate: number;
};

function summarize(rows: VariantRow[]): Totals {
  const attempts = rows.reduce((sum, r) => sum + r.attempts, 0);
  const retried = rows.reduce((sum, r) => sum + r.retried, 0);
  const v1 = rows.find((r) => r.variant === "v1_baseline");
  const v2 = rows.find((r) => r.variant === "v2_axis_targeted");
  const passed = rows.reduce((sum, r) => sum + r.atOrAbove, 0);
  const weightedScore = rows.reduce((sum, r) => sum + r.avgScore * r.attempts, 0);
  return {
    attempts,
    retried,
    v1Attempts: v1?.attempts ?? 0,
    v2Attempts: v2?.attempts ?? 0,
    avgScoreAll: attempts > 0 ? weightedScore / attempts : 0,
    passRate: attempts > 0 ? (100 * passed) / attempts : 0,
  };
}

function StatCards({ totals }: { totals: Totals }) {
  const cards: Array<{ label: string; value: string; hint?: string }> = [
    { label: "총 레코드", value: totals.attempts.toLocaleString(), hint: "최근 14일 · source=ai" },
    { label: "P9 retry", value: totals.retried.toLocaleString(), hint: "retry_count=1" },
    { label: "v1 / v2 시도", value: `${totals.v1Attempts} / ${totals.v2Attempts}`, hint: "판정 기준 각 ≥ 30" },
    { label: "70점 이상 비율", value: `${totals.passRate.toFixed(1)}%`, hint: `평균 ${totals.avgScoreAll.toFixed(1)}점` },
  ];
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
      {cards.map((c) => (
        <div key={c.label} className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <div className="text-sm text-gray-500">{c.label}</div>
          <div className="mt-2 text-2xl font-semibold">{c.value}</div>
          {c.hint && <div className="mt-1 text-xs text-gray-400">{c.hint}</div>}
        </div>
      ))}
    </div>
  );
}

function VariantTable({ rows }: { rows: VariantRow[] }) {
  if (rows.length === 0) {
    return <EmptyState message="아직 측정 데이터가 없습니다." />;
  }
  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
      <table className="min-w-full text-sm">
        <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
          <tr>
            <th className="px-4 py-3">variant</th>
            <th className="px-4 py-3 text-right">attempts</th>
            <th className="px-4 py-3 text-right">retried</th>
            <th className="px-4 py-3 text-right">avg</th>
            <th className="px-4 py-3 text-right">min</th>
            <th className="px-4 py-3 text-right">max</th>
            <th className="px-4 py-3 text-right">&lt;70</th>
            <th className="px-4 py-3 text-right">≥70</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.map((r) => (
            <tr key={r.variant}>
              <td className="px-4 py-3 font-mono text-xs">{r.variant}</td>
              <td className="px-4 py-3 text-right">{r.attempts}</td>
              <td className="px-4 py-3 text-right">{r.retried}</td>
              <td className="px-4 py-3 text-right font-semibold">{r.avgScore.toFixed(2)}</td>
              <td className="px-4 py-3 text-right">{r.minScore}</td>
              <td className="px-4 py-3 text-right">{r.maxScore}</td>
              <td className="px-4 py-3 text-right text-red-600">{r.belowThreshold}</td>
              <td className="px-4 py-3 text-right text-green-700">{r.atOrAbove}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RecordTypeTable({ rows }: { rows: RecordTypeRow[] }) {
  if (rows.length === 0) return <EmptyState message="record_type 집계 데이터 없음." />;
  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
      <table className="min-w-full text-sm">
        <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
          <tr>
            <th className="px-4 py-3">record_type</th>
            <th className="px-4 py-3">variant</th>
            <th className="px-4 py-3 text-right">n</th>
            <th className="px-4 py-3 text-right">avg</th>
            <th className="px-4 py-3 text-right">≥70 비율</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.map((r) => (
            <tr key={`${r.recordType}-${r.variant}`}>
              <td className="px-4 py-3">{r.recordType}</td>
              <td className="px-4 py-3 font-mono text-xs">{r.variant}</td>
              <td className="px-4 py-3 text-right">{r.n}</td>
              <td className="px-4 py-3 text-right font-semibold">{r.avgScore.toFixed(2)}</td>
              <td className="px-4 py-3 text-right">{r.passRate.toFixed(1)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DayBucketTable({ rows }: { rows: DayBucket[] }) {
  if (rows.length === 0) return <EmptyState message="최근 추이 데이터 없음." />;
  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
      <table className="min-w-full text-sm">
        <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
          <tr>
            <th className="px-4 py-3">day</th>
            <th className="px-4 py-3 text-right">touched</th>
            <th className="px-4 py-3 text-right">p9 attempts</th>
            <th className="px-4 py-3 text-right">v1</th>
            <th className="px-4 py-3 text-right">v2</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.map((r) => (
            <tr key={r.day}>
              <td className="px-4 py-3 font-mono text-xs">{r.day}</td>
              <td className="px-4 py-3 text-right">{r.touched}</td>
              <td className="px-4 py-3 text-right">{r.p9Attempts}</td>
              <td className="px-4 py-3 text-right">{r.v1}</td>
              <td className="px-4 py-3 text-right">{r.v2}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RetryDistributionTable({ rows }: { rows: Array<{ retryCount: number; n: number; pct: number }> }) {
  if (rows.length === 0) return <EmptyState message="retry_count 분포 데이터 없음." />;
  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
      <table className="min-w-full text-sm">
        <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
          <tr>
            <th className="px-4 py-3">retry_count</th>
            <th className="px-4 py-3 text-right">n</th>
            <th className="px-4 py-3 text-right">비율</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.map((r) => (
            <tr key={r.retryCount}>
              <td className="px-4 py-3 font-mono">{r.retryCount}</td>
              <td className="px-4 py-3 text-right">{r.n}</td>
              <td className="px-4 py-3 text-right">{r.pct.toFixed(1)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-6 text-center text-sm text-gray-500">
      {message}
    </div>
  );
}

type QualityRow = {
  record_type: string;
  refinement_variant: string | null;
  retry_count: number;
  overall_score: number;
  updated_at: string;
};

async function fetchQualityWindow(admin: SupabaseAdminClient): Promise<QualityRow[]> {
  const since = new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await admin
    .from("student_record_content_quality")
    .select("record_type, refinement_variant, retry_count, overall_score, updated_at")
    .eq("source", "ai_projected")
    .gte("created_at", since)
    .limit(10_000);
  if (error) {
    console.error("[pipeline-telemetry] fetch failed", error);
    return [];
  }
  return (data ?? []) as QualityRow[];
}

function variantKey(v: string | null): VariantKey {
  if (v === "v1_baseline" || v === "v2_axis_targeted") return v;
  return "NULL";
}

async function fetchVariantBreakdown(admin: SupabaseAdminClient): Promise<VariantRow[]> {
  const rows = await fetchQualityWindow(admin);
  const groups = new Map<VariantKey, QualityRow[]>();
  for (const row of rows) {
    const key = variantKey(row.refinement_variant);
    const bucket = groups.get(key) ?? [];
    bucket.push(row);
    groups.set(key, bucket);
  }
  const out: VariantRow[] = [];
  for (const [variant, bucket] of groups) {
    const attempts = bucket.length;
    const retried = bucket.filter((r) => r.retry_count === 1).length;
    const scores = bucket.map((r) => r.overall_score);
    const avg = scores.reduce((s, n) => s + n, 0) / Math.max(1, scores.length);
    out.push({
      variant,
      attempts,
      retried,
      avgScore: avg,
      minScore: scores.length > 0 ? Math.min(...scores) : 0,
      maxScore: scores.length > 0 ? Math.max(...scores) : 0,
      belowThreshold: bucket.filter((r) => r.overall_score < 70).length,
      atOrAbove: bucket.filter((r) => r.overall_score >= 70).length,
    });
  }
  const order: VariantKey[] = ["v1_baseline", "v2_axis_targeted", "NULL"];
  return out.sort((a, b) => order.indexOf(a.variant) - order.indexOf(b.variant));
}

async function fetchRecordTypeBreakdown(admin: SupabaseAdminClient): Promise<RecordTypeRow[]> {
  const rows = await fetchQualityWindow(admin);
  const groups = new Map<string, QualityRow[]>();
  for (const row of rows) {
    const key = `${row.record_type}|${variantKey(row.refinement_variant)}`;
    const bucket = groups.get(key) ?? [];
    bucket.push(row);
    groups.set(key, bucket);
  }
  const out: RecordTypeRow[] = [];
  for (const [key, bucket] of groups) {
    const [recordType, variant] = key.split("|") as [string, VariantKey];
    const n = bucket.length;
    const avg = bucket.reduce((s, r) => s + r.overall_score, 0) / Math.max(1, n);
    const passed = bucket.filter((r) => r.overall_score >= 70).length;
    out.push({
      recordType,
      variant,
      n,
      avgScore: avg,
      passRate: n > 0 ? (100 * passed) / n : 0,
    });
  }
  return out.sort(
    (a, b) => a.recordType.localeCompare(b.recordType) || a.variant.localeCompare(b.variant),
  );
}

async function fetchDayBuckets(admin: SupabaseAdminClient): Promise<DayBucket[]> {
  const rows = await fetchQualityWindow(admin);
  const buckets = new Map<string, DayBucket>();
  for (const row of rows) {
    const day = row.updated_at.slice(0, 10);
    const cur = buckets.get(day) ?? { day, touched: 0, p9Attempts: 0, v1: 0, v2: 0 };
    cur.touched += 1;
    if (row.retry_count === 1) cur.p9Attempts += 1;
    if (row.refinement_variant === "v1_baseline") cur.v1 += 1;
    if (row.refinement_variant === "v2_axis_targeted") cur.v2 += 1;
    buckets.set(day, cur);
  }
  return Array.from(buckets.values()).sort((a, b) => b.day.localeCompare(a.day));
}

async function fetchRetryDistribution(admin: SupabaseAdminClient): Promise<
  Array<{ retryCount: number; n: number; pct: number }>
> {
  const rows = await fetchQualityWindow(admin);
  const counts = new Map<number, number>();
  for (const row of rows) {
    counts.set(row.retry_count, (counts.get(row.retry_count) ?? 0) + 1);
  }
  const total = rows.length;
  return Array.from(counts.entries())
    .sort(([a], [b]) => a - b)
    .map(([retryCount, n]) => ({ retryCount, n, pct: total > 0 ? (100 * n) / total : 0 }));
}

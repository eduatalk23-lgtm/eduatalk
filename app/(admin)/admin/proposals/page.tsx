// ============================================
// α4 Proposal Dashboard (방향 B, 2026-04-20)
//
// tenant 전체 Proposal Engine 운영 현황 한 화면 요약.
//   - 집계: 총 job / 학생 / 엔진 분포 / severity / status / 비용 / 수락 통계
//   - 최근 job 50건: 학생 / 엔진 / 모델 / item 수 / 수락·거절 / 비용
//   - 각 행은 해당 학생 페이지로 deep link (진단 탭 Drawer 재활용)
//
// admin/consultant 권한 (requireAdminOrConsultant 내부 가드).
// ============================================

import Link from "next/link";
import { fetchTenantProposalsOverview } from "@/lib/domains/student-record/actions/diagnosis-helpers";
import { PageHeader } from "@/components/layout/PageHeader";
import { StatCard } from "@/components/molecules/StatCard";

export const dynamic = "force-dynamic";

const SEVERITY_COLOR: Record<
  "none" | "low" | "medium" | "high",
  string
> = {
  none: "text-[var(--text-tertiary)]",
  low: "text-info-600 dark:text-info-400",
  medium: "text-amber-600 dark:text-amber-400",
  high: "text-red-600 dark:text-red-400",
};

const STATUS_KO: Record<string, string> = {
  completed: "완료",
  failed: "실패",
  running: "실행중",
  pending: "대기",
  skipped: "건너뜀",
};

export default async function ProposalsDashboardPage() {
  const overview = await fetchTenantProposalsOverview({ recentLimit: 50 });
  const { stats, recentJobs } = overview;

  const acceptanceRate =
    stats.decisionStats.total > 0
      ? Math.round(
          ((stats.decisionStats.accepted + stats.decisionStats.executed) /
            stats.decisionStats.total) *
            100,
        )
      : 0;

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6">
      <PageHeader
        title="활동 제안 대시보드"
        description="Proposal Engine 가 생성한 제안과 컨설턴트 판정 현황"
        backHref="/admin/dashboard"
      />

      {/* 집계 */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="총 제안 Job" value={stats.totalJobs} color="blue" />
        <StatCard
          label="대상 학생"
          value={stats.distinctStudents}
          color="purple"
        />
        <StatCard
          label="총 item"
          value={stats.decisionStats.total}
          color="emerald"
        />
        <StatCard
          label="수락률"
          value={`${acceptanceRate}%`}
          color={acceptanceRate >= 50 ? "emerald" : "amber"}
        />
      </section>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          label="rule_v1 job"
          value={stats.engineCounts.rule_v1}
          color="blue"
        />
        <StatCard
          label="llm_v1 job"
          value={stats.engineCounts.llm_v1}
          color="purple"
        />
        <StatCard
          label="총 비용"
          value={`$${stats.totalCostUsd.toFixed(4)}`}
          color="amber"
        />
        <StatCard
          label="실패 job"
          value={stats.statusCounts.failed}
          color={stats.statusCounts.failed > 0 ? "red" : "emerald"}
        />
      </section>

      {/* 결정 분포 */}
      <section className="rounded-lg border border-[var(--border-primary)] bg-[var(--bg-secondary)] p-4">
        <h2 className="mb-3 text-sm font-semibold text-[var(--text-primary)]">
          컨설턴트 결정 분포
        </h2>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
          <DecisionCell label="수락" count={stats.decisionStats.accepted} tone="green" />
          <DecisionCell label="실행" count={stats.decisionStats.executed} tone="green" />
          <DecisionCell label="보류" count={stats.decisionStats.deferred} tone="muted" />
          <DecisionCell label="거절" count={stats.decisionStats.rejected} tone="red" />
          <DecisionCell label="미결" count={stats.decisionStats.pending} tone="muted" />
        </div>
      </section>

      {/* 최근 job 테이블 */}
      <section className="rounded-lg border border-[var(--border-primary)] bg-[var(--bg-secondary)]">
        <header className="flex items-center justify-between border-b border-[var(--border-primary)] px-4 py-2">
          <h2 className="text-sm font-semibold text-[var(--text-primary)]">
            최근 제안 {recentJobs.length}건
          </h2>
          <span className="text-xs text-[var(--text-tertiary)]">
            전체 {stats.totalJobs}건 중
          </span>
        </header>
        {recentJobs.length === 0 ? (
          <p className="p-4 text-sm text-[var(--text-tertiary)]">
            아직 생성된 제안이 없습니다. synthesis 파이프라인 완료 또는
            scripts/proposal-dryrun.ts --persist 로 생성 가능.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="bg-[var(--bg-primary)] text-xs text-[var(--text-tertiary)]">
                <tr>
                  <Th>시각</Th>
                  <Th>학생</Th>
                  <Th>엔진/모델</Th>
                  <Th>severity</Th>
                  <Th>상태</Th>
                  <Th>item</Th>
                  <Th>판정</Th>
                  <Th>비용</Th>
                </tr>
              </thead>
              <tbody>
                {recentJobs.map((j) => {
                  const pending = j.itemCount - j.acceptedCount - j.rejectedCount;
                  return (
                    <tr
                      key={j.jobId}
                      className="border-t border-[var(--border-primary)] hover:bg-[var(--bg-primary)]"
                    >
                      <Td>
                        <span className="text-xs text-[var(--text-tertiary)]">
                          {formatDate(j.triggeredAt)}
                        </span>
                      </Td>
                      <Td>
                        <Link
                          href={`/admin/students/${j.studentId}`}
                          className="font-medium text-[var(--text-primary)] hover:underline"
                        >
                          {j.studentName}
                        </Link>
                        {(j.grade || j.schoolName) && (
                          <div className="text-[10px] text-[var(--text-tertiary)]">
                            {[j.grade ? `${j.grade}학년` : null, j.schoolName]
                              .filter(Boolean)
                              .join(" · ")}
                          </div>
                        )}
                      </Td>
                      <Td>
                        <div className="text-[var(--text-primary)]">
                          {j.engine}
                        </div>
                        {j.model && (
                          <div className="text-[10px] text-[var(--text-tertiary)]">
                            {j.model}
                          </div>
                        )}
                      </Td>
                      <Td>
                        <span className={`font-medium ${SEVERITY_COLOR[j.severity]}`}>
                          {j.severity}
                        </span>
                      </Td>
                      <Td>
                        <span
                          className={
                            j.status === "failed"
                              ? "text-red-600 dark:text-red-400"
                              : "text-[var(--text-secondary)]"
                          }
                        >
                          {STATUS_KO[j.status] ?? j.status}
                        </span>
                      </Td>
                      <Td>{j.itemCount}</Td>
                      <Td>
                        <div className="flex flex-wrap gap-1 text-[10px]">
                          {j.acceptedCount > 0 && (
                            <span className="text-green-600 dark:text-green-400">
                              수락 {j.acceptedCount}
                            </span>
                          )}
                          {j.rejectedCount > 0 && (
                            <span className="text-red-600 dark:text-red-400">
                              거절 {j.rejectedCount}
                            </span>
                          )}
                          {pending > 0 && (
                            <span className="text-[var(--text-tertiary)]">
                              미결 {pending}
                            </span>
                          )}
                        </div>
                      </Td>
                      <Td>
                        {j.costUsd !== null && j.costUsd > 0
                          ? `$${j.costUsd.toFixed(4)}`
                          : "—"}
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <p className="text-xs text-[var(--text-tertiary)]">
        상세 검토는 학생 이름을 클릭해 학생 페이지 진단 탭에서 Drawer 로 진행.
        과거 이력·청사진 GAP·수락/거절 기록 모두 해당 Drawer 에서 확인 가능.
      </p>
    </div>
  );
}

// ─── 보조 컴포넌트 ────────────────────────────────────────────

function DecisionCell({
  label,
  count,
  tone,
}: {
  label: string;
  count: number;
  tone: "green" | "red" | "muted";
}) {
  const color =
    tone === "green"
      ? "text-green-600 dark:text-green-400"
      : tone === "red"
        ? "text-red-600 dark:text-red-400"
        : "text-[var(--text-secondary)]";
  return (
    <div className="flex flex-col items-center rounded border border-[var(--border-primary)] bg-[var(--bg-primary)] px-2 py-2">
      <span className="text-xs text-[var(--text-tertiary)]">{label}</span>
      <span className={`text-lg font-semibold ${color}`}>{count}</span>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-3 py-2 text-left font-semibold">{children}</th>
  );
}

function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-3 py-2 align-top">{children}</td>;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

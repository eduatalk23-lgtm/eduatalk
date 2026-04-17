import Link from "next/link";
import { ArrowLeft, Inbox } from "lucide-react";
import {
  fetchPendingAiGuidesAction,
  fetchAiGuideQueueCountsAction,
  type AiGuideQueueStatus,
} from "@/lib/domains/guide/actions/crud";
import { PendingApprovalClient } from "./_components/PendingApprovalClient";

export const metadata = {
  title: "AI 가이드 승인 큐 | TimeLevelUp",
};

const VALID_STATUSES: AiGuideQueueStatus[] = [
  "pending_approval",
  "queued_generation",
  "ai_failed",
];

function normalizeStatus(raw: string | string[] | undefined): AiGuideQueueStatus {
  const v = Array.isArray(raw) ? raw[0] : raw;
  return VALID_STATUSES.includes(v as AiGuideQueueStatus)
    ? (v as AiGuideQueueStatus)
    : "pending_approval";
}

export default async function PendingApprovalPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status: rawStatus } = await searchParams;
  const status = normalizeStatus(rawStatus);

  const [res, countsRes] = await Promise.all([
    fetchPendingAiGuidesAction(100, status),
    fetchAiGuideQueueCountsAction(),
  ]);
  const guides = (res.success ? res.data : []) ?? [];
  const counts = (countsRes.success ? countsRes.data : null) ?? {
    pending_approval: 0,
    queued_generation: 0,
    ai_failed: 0,
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/admin/guides"
          className="flex items-center gap-1 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
        >
          <ArrowLeft className="h-4 w-4" />
          가이드 목록
        </Link>
      </div>

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-heading-3 font-bold text-[var(--text-heading)]">
            AI 가이드 승인 큐
          </h1>
          <p className="mt-1 text-body-2 text-[var(--text-secondary)]">
            AI 파이프라인이 설계·생성한 가이드를 상태별로 관리합니다.
          </p>
        </div>
        <div className="flex items-center gap-1.5 rounded-full bg-orange-100 px-3 py-1 text-sm font-medium text-orange-700 dark:bg-orange-900/30 dark:text-orange-300">
          <Inbox className="h-4 w-4" />
          {guides.length}건
        </div>
      </div>

      {!res.success && (
        <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400">
          {"error" in res ? res.error : "데이터를 불러오지 못했습니다."}
        </div>
      )}

      <PendingApprovalClient initialGuides={guides} status={status} counts={counts} />
    </div>
  );
}

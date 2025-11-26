import type { PlanGroup } from "@/lib/types/plan";
import { planPurposeLabels, schedulerTypeLabels } from "@/lib/constants/planLabels";

type Step1DetailViewProps = {
  group: PlanGroup;
};

export function Step1DetailView({ group }: Step1DetailViewProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900">기본 정보</h2>
        <p className="mt-1 text-sm text-gray-500">
          플랜 그룹의 기본 설정 정보를 확인할 수 있습니다.
        </p>
      </div>

      <div className="grid gap-6 rounded-lg border border-gray-200 bg-white p-6 sm:grid-cols-2">
        <div>
          <dt className="text-sm font-medium text-gray-500">플랜 그룹 이름</dt>
          <dd className="mt-1 text-lg text-gray-900">
            {group.name || "—"}
          </dd>
        </div>
        <div>
          <dt className="text-sm font-medium text-gray-500">플랜 목적</dt>
          <dd className="mt-1 text-lg text-gray-900">
            {group.plan_purpose ? planPurposeLabels[group.plan_purpose] || group.plan_purpose : "—"}
          </dd>
        </div>
        <div>
          <dt className="text-sm font-medium text-gray-500">스케줄러 유형</dt>
          <dd className="mt-1 text-lg text-gray-900">
            {group.scheduler_type
              ? schedulerTypeLabels[group.scheduler_type] || group.scheduler_type
              : "—"}
          </dd>
        </div>
        <div>
          <dt className="text-sm font-medium text-gray-500">시작일</dt>
          <dd className="mt-1 text-lg text-gray-900">
            {group.period_start
              ? new Date(group.period_start).toLocaleDateString("ko-KR")
              : "—"}
          </dd>
        </div>
        <div>
          <dt className="text-sm font-medium text-gray-500">종료일</dt>
          <dd className="mt-1 text-lg text-gray-900">
            {group.period_end
              ? new Date(group.period_end).toLocaleDateString("ko-KR")
              : "—"}
          </dd>
        </div>
        {group.target_date && (
          <div>
            <dt className="text-sm font-medium text-gray-500">목표 날짜 (D-day)</dt>
            <dd className="mt-1 text-lg text-gray-900">
              {new Date(group.target_date).toLocaleDateString("ko-KR")}
            </dd>
          </div>
        )}
        <div>
          <dt className="text-sm font-medium text-gray-500">생성일</dt>
          <dd className="mt-1 text-lg text-gray-900">
            {group.created_at
              ? new Date(group.created_at).toLocaleString("ko-KR", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : "—"}
          </dd>
        </div>
      </div>
    </div>
  );
}


import { redirect } from "next/navigation";
import { getCachedUserRole } from "@/lib/auth/getCurrentUserRole";
import { isAdminRole } from "@/lib/auth/isAdminRole";
import { PageHeader } from "@/components/layout/PageHeader";
import {
  getNotificationMonitoringData,
  type SkipReasonStat,
  type DeviceStat,
} from "@/lib/domains/notification/monitoring";
import {
  Bell,
  BellOff,
  AlertTriangle,
  Smartphone,
  Users,
  MousePointerClick,
} from "lucide-react";

const SKIP_REASON_LABELS: Record<string, string> = {
  online: "앱 사용 중",
  quiet_hours: "방해금지 시간",
  muted: "채팅 뮤트",
  preference_off: "설정 비활성",
  rate_limited: "빈도 초과",
  duplicate: "중복",
  no_subscription: "구독 없음",
};

export default async function NotificationMonitoringPage() {
  const { userId, role } = await getCachedUserRole();
  if (!userId || !isAdminRole(role)) {
    redirect("/login");
  }

  const data = await getNotificationMonitoringData();

  if (!data) {
    return (
      <div className="p-6 md:p-8 lg:p-10">
        <PageHeader
          title="알림 모니터링"
          description="Push 알림 발송 현황 및 구독 통계"
        />
        <p className="mt-6 text-sm text-gray-500">
          데이터를 조회할 수 없습니다. 관리자 권한을 확인해주세요.
        </p>
      </div>
    );
  }

  const totalToday = data.today.sent + data.today.skipped + data.today.failed;

  return (
    <div className="p-6 md:p-8 lg:p-10">
      <div className="flex flex-col gap-6 md:gap-8">
        <PageHeader
          title="알림 모니터링"
          description="Push 알림 발송 현황 및 구독 통계"
        />

        {/* KPI 카드 */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            icon={<Bell className="h-5 w-5 text-primary-600" />}
            label="오늘 발송"
            value={data.today.sent}
            sub={`전체 ${totalToday}건`}
          />
          <StatCard
            icon={<BellOff className="h-5 w-5 text-warning-600" />}
            label="오늘 스킵"
            value={data.today.skipped}
            sub={
              totalToday > 0
                ? `${Math.round((data.today.skipped / totalToday) * 100)}%`
                : "0%"
            }
          />
          <StatCard
            icon={<AlertTriangle className="h-5 w-5 text-red-600" />}
            label="오늘 실패"
            value={data.today.failed}
            sub={
              data.today.failed > 0
                ? "발송 오류 확인 필요"
                : "정상"
            }
            highlight={data.today.failed > 0}
          />
          <StatCard
            icon={<MousePointerClick className="h-5 w-5 text-success-600" />}
            label="클릭률 (7일)"
            value={`${data.clickRate.rate}%`}
            sub={`${data.clickRate.clicked}/${data.clickRate.total}건`}
          />
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* 스킵 사유 분포 */}
          <div className="rounded-xl border border-gray-200 bg-white p-5 md:p-6 shadow-sm">
            <h2 className="text-base font-semibold mb-4">스킵 사유 분포</h2>
            {data.skipReasons.length === 0 ? (
              <p className="text-sm text-gray-500">오늘 스킵된 알림이 없습니다.</p>
            ) : (
              <div className="flex flex-col gap-3">
                {data.skipReasons.map((s: SkipReasonStat) => (
                  <SkipReasonBar key={s.reason} stat={s} />
                ))}
              </div>
            )}
          </div>

          {/* 활성 구독 */}
          <div className="rounded-xl border border-gray-200 bg-white p-5 md:p-6 shadow-sm">
            <h2 className="text-base font-semibold mb-4">
              <span className="flex items-center gap-2">
                <Smartphone className="h-4 w-4 text-gray-500" />
                활성 구독 현황
              </span>
            </h2>
            <div className="flex items-baseline gap-2 mb-4">
              <span className="text-3xl font-bold">{data.subscriptions.total}</span>
              <span className="text-sm text-gray-500">디바이스</span>
              <span className="text-sm text-gray-400">·</span>
              <span className="flex items-center gap-1 text-sm text-gray-500">
                <Users className="h-3.5 w-3.5" />
                {data.subscriptions.uniqueUsers}명
              </span>
            </div>
            {data.subscriptions.byDevice.length === 0 ? (
              <p className="text-sm text-gray-500">활성 구독이 없습니다.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {data.subscriptions.byDevice.map((d: DeviceStat) => (
                  <div
                    key={d.label}
                    className="flex items-center justify-between text-sm"
                  >
                    <span className="text-gray-700">{d.label}</span>
                    <span className="font-medium tabular-nums">
                      {d.count}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================
// 서브 컴포넌트
// ============================================

function StatCard({
  icon,
  label,
  value,
  sub,
  highlight,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  sub: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-5 shadow-sm ${
        highlight
          ? "border-red-200 bg-red-50"
          : "border-gray-200 bg-white"
      }`}
    >
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100">
          {icon}
        </div>
        <div>
          <p className="text-sm text-gray-500">{label}</p>
          <p className="text-2xl font-bold tabular-nums">{value}</p>
          <p className="text-xs text-gray-400">{sub}</p>
        </div>
      </div>
    </div>
  );
}

function SkipReasonBar({ stat }: { stat: SkipReasonStat }) {
  return (
    <div>
      <div className="flex items-center justify-between text-sm mb-1">
        <span className="text-gray-700">
          {SKIP_REASON_LABELS[stat.reason] ?? stat.reason}
        </span>
        <span className="font-medium tabular-nums">
          {stat.count}건 ({stat.percentage}%)
        </span>
      </div>
      <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
        <div
          className="h-full rounded-full bg-warning-400 transition-all"
          style={{ width: `${Math.max(stat.percentage, 2)}%` }}
        />
      </div>
    </div>
  );
}

"use client";

/**
 * Phase 6 P2 개선: 플랜 상태 UI 개선
 *
 * - 상태별 아이콘 및 색상 명확화
 * - 상태 설명 툴팁 추가
 * - 플랜 생성 필요 상태 시각적 강조
 */

import Link from "next/link";
import {
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  FileText,
  PlayCircle,
  PauseCircle,
  CheckCheck,
  HelpCircle,
  RefreshCw,
  UserMinus,
} from "lucide-react";
import { cn } from "@/lib/cn";
import type { Participant, SortColumn, SortOrder } from "./types";

// Phase 6 P2: 초대 상태 설정
type InvitationStatusConfig = {
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  bgColor: string;
  textColor: string;
  iconColor: string;
};

const invitationStatusConfigs: Record<string, InvitationStatusConfig> = {
  submitted: {
    label: "제출 완료",
    description: "학생이 캠프 참여 신청서를 제출했습니다. 플랜 생성을 진행해주세요.",
    icon: FileText,
    bgColor: "bg-blue-100",
    textColor: "text-blue-800",
    iconColor: "text-blue-600",
  },
  pending: {
    label: "대기중",
    description: "초대장을 발송했으나 아직 응답이 없습니다.",
    icon: Clock,
    bgColor: "bg-yellow-100",
    textColor: "text-yellow-800",
    iconColor: "text-yellow-600",
  },
  accepted: {
    label: "수락",
    description: "학생이 캠프 참여를 수락했습니다.",
    icon: CheckCircle2,
    bgColor: "bg-green-100",
    textColor: "text-green-800",
    iconColor: "text-green-600",
  },
  declined: {
    label: "거절",
    description: "학생이 캠프 참여를 거절했습니다.",
    icon: XCircle,
    bgColor: "bg-red-100",
    textColor: "text-red-800",
    iconColor: "text-red-600",
  },
  expired: {
    label: "만료",
    description: "초대 유효 기간이 만료되었습니다.",
    icon: Clock,
    bgColor: "bg-gray-100",
    textColor: "text-gray-600",
    iconColor: "text-gray-400",
  },
};

// Phase 6 P2: 플랜 상태 설정
type PlanStatusConfig = {
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  bgColor: string;
  textColor: string;
  iconColor: string;
};

const planStatusConfigs: Record<string, PlanStatusConfig> = {
  needs_creation: {
    label: "생성 필요",
    description: "플랜 그룹은 있지만 학습 플랜이 아직 생성되지 않았습니다.",
    icon: AlertTriangle,
    bgColor: "bg-orange-100",
    textColor: "text-orange-800",
    iconColor: "text-orange-600",
  },
  missing_group: {
    label: "그룹 누락",
    description: "플랜 그룹이 생성되지 않았습니다. 복구가 필요합니다.",
    icon: HelpCircle,
    bgColor: "bg-red-100",
    textColor: "text-red-800",
    iconColor: "text-red-600",
  },
  ready: {
    label: "준비 완료",
    description: "플랜이 생성되어 학습을 시작할 수 있습니다.",
    icon: CheckCircle2,
    bgColor: "bg-blue-100",
    textColor: "text-blue-800",
    iconColor: "text-blue-600",
  },
  in_progress: {
    label: "진행 중",
    description: "학생이 학습을 진행하고 있습니다.",
    icon: PlayCircle,
    bgColor: "bg-indigo-100",
    textColor: "text-indigo-800",
    iconColor: "text-indigo-600",
  },
  paused: {
    label: "일시정지",
    description: "학습이 일시 중지되었습니다.",
    icon: PauseCircle,
    bgColor: "bg-gray-100",
    textColor: "text-gray-700",
    iconColor: "text-gray-500",
  },
  completed: {
    label: "완료",
    description: "모든 학습 플랜을 완료했습니다.",
    icon: CheckCheck,
    bgColor: "bg-green-100",
    textColor: "text-green-800",
    iconColor: "text-green-600",
  },
  waiting: {
    label: "대기 중",
    description: "초대 응답을 기다리는 중입니다.",
    icon: Clock,
    bgColor: "bg-gray-100",
    textColor: "text-gray-600",
    iconColor: "text-gray-400",
  },
};

// Phase 6 P2: 상태 배지 컴포넌트
function StatusBadge({
  config,
  showIcon = true,
}: {
  config: InvitationStatusConfig | PlanStatusConfig;
  showIcon?: boolean;
}) {
  const Icon = config.icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
        config.bgColor,
        config.textColor
      )}
      title={config.description}
    >
      {showIcon && <Icon className={cn("h-3.5 w-3.5", config.iconColor)} />}
      {config.label}
    </span>
  );
}

type ParticipantsTableProps = {
  templateId: string;
  filteredParticipants: Participant[];
  selectedParticipantIds: Set<string>;
  sortBy: SortColumn | null;
  sortOrder: SortOrder;
  loading: boolean;
  lastLoadTimeRef: React.MutableRefObject<number>;
  onSort: (column: SortColumn) => void;
  onSelectAll: (checked: boolean) => void;
  onToggleSelect: (participant: Participant) => void;
  onReload: () => void;
  onExclude: (participant: Participant) => void;
};

export default function ParticipantsTable({
  templateId,
  filteredParticipants,
  selectedParticipantIds,
  sortBy,
  sortOrder,
  loading,
  lastLoadTimeRef,
  onSort,
  onSelectAll,
  onToggleSelect,
  onReload,
  onExclude,
}: ParticipantsTableProps) {
  const isAllSelected =
    filteredParticipants.length > 0 &&
    filteredParticipants.every((p) => {
      const key = p.plan_group_id || p.invitation_id;
      return selectedParticipantIds.has(key);
    });

  // Phase 6 P2: 플랜 상태 결정 함수
  const getPlanStatus = (participant: Participant): keyof typeof planStatusConfigs => {
    // 플랜 그룹이 없는 경우
    if (!participant.plan_group_id) {
      if (
        participant.invitation_status === "accepted" ||
        participant.display_status === "submitted"
      ) {
        return "missing_group";
      }
      return "waiting";
    }

    // 플랜 그룹은 있지만 플랜이 없는 경우
    if (!participant.hasPlans) {
      return "needs_creation";
    }

    // 플랜 그룹 상태에 따른 분류
    const status = participant.plan_group_status?.toLowerCase();
    if (status === "completed" || participant.plan_completion_rate === 100) {
      return "completed";
    }
    if (status === "paused") {
      return "paused";
    }
    if (
      status === "in_progress" ||
      status === "active" ||
      (participant.plan_completion_rate && participant.plan_completion_rate > 0)
    ) {
      return "in_progress";
    }

    return "ready";
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse rounded-lg border border-gray-200 bg-white">
        <thead className="bg-gray-50">
          <tr>
            <th className="border-b border-gray-200 px-4 py-3 text-left text-sm font-semibold text-gray-900">
              <input
                type="checkbox"
                checked={isAllSelected}
                onChange={(e) => onSelectAll(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />
            </th>
            <th className="border-b border-gray-200 px-4 py-3 text-left text-sm font-semibold text-gray-900">
              <button
                type="button"
                onClick={() => onSort("name")}
                className="flex items-center gap-1 hover:text-gray-700"
              >
                학생명
                {sortBy === "name" && (
                  <span className="text-xs">
                    {sortOrder === "asc" ? "↑" : "↓"}
                  </span>
                )}
              </button>
            </th>
            <th className="border-b border-gray-200 px-4 py-3 text-left text-sm font-semibold text-gray-900">
              학년/반
            </th>
            <th className="border-b border-gray-200 px-4 py-3 text-left text-sm font-semibold text-gray-900">
              초대 상태
            </th>
            <th className="border-b border-gray-200 px-4 py-3 text-left text-sm font-semibold text-gray-900">
              플랜 상태
            </th>
            <th className="border-b border-gray-200 px-4 py-3 text-center text-sm font-semibold text-gray-900">
              <button
                type="button"
                onClick={() => onSort("attendance_rate")}
                className="flex items-center justify-center gap-1 hover:text-gray-700"
              >
                출석률
                {sortBy === "attendance_rate" && (
                  <span className="text-xs">
                    {sortOrder === "asc" ? "↑" : "↓"}
                  </span>
                )}
              </button>
            </th>
            <th className="border-b border-gray-200 px-4 py-3 text-center text-sm font-semibold text-gray-900">
              <button
                type="button"
                onClick={() => onSort("study_minutes")}
                className="flex items-center justify-center gap-1 hover:text-gray-700"
              >
                학습 시간
                {sortBy === "study_minutes" && (
                  <span className="text-xs">
                    {sortOrder === "asc" ? "↑" : "↓"}
                  </span>
                )}
              </button>
            </th>
            <th className="border-b border-gray-200 px-4 py-3 text-center text-sm font-semibold text-gray-900">
              <button
                type="button"
                onClick={() => onSort("plan_completion_rate")}
                className="flex items-center justify-center gap-1 hover:text-gray-700"
              >
                진행률
                {sortBy === "plan_completion_rate" && (
                  <span className="text-xs">
                    {sortOrder === "asc" ? "↑" : "↓"}
                  </span>
                )}
              </button>
            </th>
            <th className="border-b border-gray-200 px-4 py-3 text-left text-sm font-semibold text-gray-900">
              참여일
            </th>
            <th className="border-b border-gray-200 px-4 py-3 text-left text-sm font-semibold text-gray-900">
              작업
            </th>
          </tr>
        </thead>
        <tbody>
          {filteredParticipants.length === 0 ? (
            <tr>
              <td
                colSpan={10}
                className="px-4 py-8 text-center text-sm text-gray-500"
              >
                참여자가 없습니다.
              </td>
            </tr>
          ) : (
            filteredParticipants.map((participant) => {
              const key = participant.plan_group_id || participant.invitation_id;
              const isSelected = selectedParticipantIds.has(key);
              const planStatus = getPlanStatus(participant);
              const needsAction =
                planStatus === "needs_creation" || planStatus === "missing_group";

              // Phase 6 P2: 초대 상태 설정 가져오기
              const displayStatus = participant.display_status ?? "pending";
              const invitationConfig =
                invitationStatusConfigs[displayStatus] ||
                invitationStatusConfigs.pending;

              // Phase 6 P2: 플랜 상태 설정 가져오기
              const planConfig = planStatusConfigs[planStatus];

              return (
                <tr
                  key={participant.invitation_id}
                  className={cn(
                    "hover:bg-gray-50 transition-colors",
                    needsAction && "bg-orange-50/50"
                  )}
                >
                  <td className="border-b border-gray-100 px-4 py-3">
                    <div className="relative">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => onToggleSelect(participant)}
                        className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                        title="선택"
                        aria-label={`${participant.student_name} 선택`}
                      />
                    </div>
                  </td>
                  <td className="border-b border-gray-100 px-4 py-3 text-sm font-medium text-gray-900">
                    <Link
                      href={`/admin/camp-templates/${templateId}/participants/student/${participant.student_id}`}
                      className="text-indigo-600 hover:text-indigo-800 hover:underline"
                    >
                      {participant.student_name}
                    </Link>
                  </td>
                  <td className="border-b border-gray-100 px-4 py-3 text-sm text-gray-600">
                    {participant.student_grade && participant.student_class
                      ? `${participant.student_grade}학년 ${participant.student_class}반`
                      : "—"}
                  </td>
                  {/* Phase 6 P2: 개선된 초대 상태 표시 */}
                  <td className="border-b border-gray-100 px-4 py-3 text-sm">
                    <StatusBadge config={invitationConfig} />
                  </td>
                  {/* Phase 6 P2: 개선된 플랜 상태 표시 */}
                  <td className="border-b border-gray-100 px-4 py-3 text-sm">
                    <StatusBadge config={planConfig} />
                  </td>
                  <td className="border-b border-gray-100 px-4 py-3 text-center text-sm">
                    {participant.attendance_rate !== null &&
                    participant.attendance_rate !== undefined ? (
                      <span
                        className={cn(
                          "inline-flex items-center rounded-full px-2 py-1 text-xs font-medium",
                          participant.attendance_rate >= 90
                            ? "bg-green-100 text-green-800"
                            : participant.attendance_rate >= 70
                              ? "bg-yellow-100 text-yellow-800"
                              : "bg-red-100 text-red-800"
                        )}
                      >
                        {participant.attendance_rate.toFixed(1)}%
                      </span>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="border-b border-gray-100 px-4 py-3 text-center text-sm text-gray-600">
                    {participant.study_minutes !== null &&
                    participant.study_minutes !== undefined ? (
                      <span>
                        {Math.floor(participant.study_minutes / 60)}시간{" "}
                        {participant.study_minutes % 60}분
                      </span>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="border-b border-gray-100 px-4 py-3 text-center text-sm">
                    {participant.plan_completion_rate !== null &&
                    participant.plan_completion_rate !== undefined ? (
                      <div className="flex flex-col items-center gap-1">
                        <span
                          className={cn(
                            "inline-flex items-center rounded-full px-2 py-1 text-xs font-medium",
                            participant.plan_completion_rate >= 80
                              ? "bg-green-100 text-green-800"
                              : participant.plan_completion_rate >= 60
                                ? "bg-yellow-100 text-yellow-800"
                                : "bg-red-100 text-red-800"
                          )}
                        >
                          {participant.plan_completion_rate}%
                        </span>
                        {/* Phase 6 P2: 미니 진행률 바 */}
                        <div className="h-1 w-12 overflow-hidden rounded-full bg-gray-200">
                          <div
                            className={cn(
                              "h-full rounded-full transition-all",
                              participant.plan_completion_rate >= 80
                                ? "bg-green-500"
                                : participant.plan_completion_rate >= 60
                                  ? "bg-yellow-500"
                                  : "bg-red-500"
                            )}
                            style={{ width: `${participant.plan_completion_rate}%` }}
                          />
                        </div>
                      </div>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="border-b border-gray-100 px-4 py-3 text-sm text-gray-600">
                    {participant.accepted_at
                      ? new Date(participant.accepted_at).toLocaleDateString("ko-KR")
                      : "—"}
                  </td>
                  <td className="border-b border-gray-100 px-4 py-3 text-sm">
                    <div className="flex items-center gap-2">
                      {participant.plan_group_id ? (
                        <>
                          {!participant.hasPlans ? (
                            <>
                              <Link
                                href={`/admin/camp-templates/${templateId}/participants/${participant.plan_group_id}/continue`}
                                className="inline-flex items-center justify-center gap-1 rounded-lg bg-orange-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-orange-700 shadow-sm"
                                title="플랜 생성을 완료하려면 클릭하세요"
                              >
                                <AlertTriangle className="h-3 w-3" />
                                남은 단계 진행
                              </Link>
                              <Link
                                href={`/admin/camp-templates/${templateId}/participants/${participant.plan_group_id}/review`}
                                className="inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 transition hover:bg-gray-50"
                                title="학생이 제출한 내용을 확인합니다"
                              >
                                제출 내용 확인
                              </Link>
                            </>
                          ) : (
                            <>
                              <Link
                                href={`/admin/camp-templates/${templateId}/participants/${participant.plan_group_id}/review`}
                                className="inline-flex items-center justify-center rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-indigo-700"
                              >
                                상세 보기
                              </Link>
                              <Link
                                href={`/admin/plan-groups/${participant.plan_group_id}`}
                                className="text-indigo-600 hover:text-indigo-800 text-xs"
                              >
                                플랜 보기
                              </Link>
                            </>
                          )}
                        </>
                      ) : (participant.display_status === "accepted" ||
                          participant.display_status === "submitted") &&
                        !participant.plan_group_id ? (
                        <div className="flex flex-col gap-1.5">
                          {/* Phase 6 P2: 개선된 경고 표시 */}
                          <div className="flex items-center gap-1 text-xs text-orange-600 font-medium">
                            <AlertTriangle className="h-3.5 w-3.5" />
                            플랜 그룹 누락
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => {
                                lastLoadTimeRef.current = 0;
                                onReload();
                              }}
                              disabled={loading}
                              className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              <RefreshCw
                                className={cn("h-3 w-3", loading && "animate-spin")}
                              />
                              {loading ? "새로고침 중..." : "새로고침"}
                            </button>
                            <Link
                              href={`/admin/camp-templates/${templateId}/participants?studentId=${participant.student_id}`}
                              className="text-xs text-indigo-600 hover:text-indigo-800 underline"
                            >
                              상세 확인
                            </Link>
                          </div>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400 flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          참여 대기중
                        </span>
                      )}
                      {/* 개별 제외 버튼 */}
                      <button
                        type="button"
                        onClick={() => onExclude(participant)}
                        className="inline-flex items-center justify-center rounded-lg p-1.5 text-gray-400 transition hover:bg-red-50 hover:text-red-600"
                        title="참여자 제외"
                      >
                        <UserMinus className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}

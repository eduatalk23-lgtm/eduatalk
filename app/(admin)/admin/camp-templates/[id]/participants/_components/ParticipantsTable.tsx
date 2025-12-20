"use client";

import Link from "next/link";
import type { Participant, SortColumn, SortOrder } from "./types";

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
}: ParticipantsTableProps) {
  const isAllSelected =
    filteredParticipants.length > 0 &&
    filteredParticipants.every((p) => {
      const key = p.plan_group_id || p.invitation_id;
      return selectedParticipantIds.has(key);
    });

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
              플랜 그룹
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
                colSpan={11}
                className="px-4 py-8 text-center text-sm text-gray-500"
              >
                참여자가 없습니다.
              </td>
            </tr>
          ) : (
            filteredParticipants.map((participant) => {
              const key = participant.plan_group_id || participant.invitation_id;
              const isSelected = selectedParticipantIds.has(key);
              const needsAction =
                participant.plan_group_id !== null && !participant.hasPlans;

              return (
                <tr
                  key={participant.invitation_id}
                  className={`hover:bg-gray-50 ${
                    needsAction ? "bg-orange-50/30" : ""
                  }`}
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
                  <td className="border-b border-gray-100 px-4 py-3 text-sm">
                    {participant.display_status === "submitted" && (
                      <span className="inline-flex items-center rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-800">
                        제출 완료
                      </span>
                    )}
                    {participant.display_status === "pending" && (
                      <span className="inline-flex items-center rounded-full bg-yellow-100 px-3 py-1 text-xs font-medium text-yellow-800">
                        대기중
                      </span>
                    )}
                    {participant.display_status === "accepted" && (
                      <span className="inline-flex items-center rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-800">
                        수락
                      </span>
                    )}
                    {participant.display_status === "declined" && (
                      <span className="inline-flex items-center rounded-full bg-red-100 px-3 py-1 text-xs font-medium text-red-800">
                        거절
                      </span>
                    )}
                  </td>
                  <td className="border-b border-gray-100 px-4 py-3 text-sm text-gray-600">
                    {participant.plan_group_name || "—"}
                  </td>
                  <td className="border-b border-gray-100 px-4 py-3 text-sm">
                    {needsAction ? (
                      <span className="inline-flex items-center rounded-full bg-orange-100 px-3 py-1 text-xs font-semibold text-orange-800">
                        작업 필요
                      </span>
                    ) : participant.plan_group_status ? (
                      <span className="inline-flex items-center rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-800">
                        {participant.plan_group_status}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="border-b border-gray-100 px-4 py-3 text-center text-sm">
                    {participant.attendance_rate !== null &&
                    participant.attendance_rate !== undefined ? (
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                          participant.attendance_rate >= 90
                            ? "bg-green-100 text-green-800"
                            : participant.attendance_rate >= 70
                            ? "bg-yellow-100 text-yellow-800"
                            : "bg-red-100 text-red-800"
                        }`}
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
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                          participant.plan_completion_rate >= 80
                            ? "bg-green-100 text-green-800"
                            : participant.plan_completion_rate >= 60
                            ? "bg-yellow-100 text-yellow-800"
                            : "bg-red-100 text-red-800"
                        }`}
                      >
                        {participant.plan_completion_rate}%
                      </span>
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
                                className="inline-flex items-center justify-center rounded-lg bg-orange-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-orange-700 shadow-sm"
                                title="플랜 생성을 완료하려면 클릭하세요"
                              >
                                🔧 남은 단계 진행
                              </Link>
                              <Link
                                href={`/admin/camp-templates/${templateId}/participants/${participant.plan_group_id}/review`}
                                className="inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 transition hover:bg-gray-50"
                                title="학생이 제출한 내용을 확인합니다"
                              >
                                제출 내용 확인
                              </Link>
                              {process.env.NODE_ENV === "development" && (
                                <span
                                  className="text-xs text-gray-400"
                                  title={`hasPlans: ${participant.hasPlans}, plan_group_id: ${participant.plan_group_id}`}
                                >
                                  (디버그)
                                </span>
                              )}
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
                        <div className="flex flex-col gap-1">
                          <span className="text-xs text-orange-600 font-medium">
                            ⚠️ 제출 완료 (플랜 그룹 없음)
                          </span>
                          <span className="text-xs text-gray-500">
                            플랜 그룹이 생성되지 않았을 수 있습니다
                          </span>
                          {process.env.NODE_ENV === "development" && (
                            <span className="text-xs text-gray-400">
                              디버그: invitation_id={participant.invitation_id}, student_id=
                              {participant.student_id}, status={participant.invitation_status}
                            </span>
                          )}
                          <div className="flex gap-2">
                            <button
                              onClick={() => {
                                lastLoadTimeRef.current = 0;
                                onReload();
                              }}
                              disabled={loading}
                              className="text-xs text-blue-600 hover:text-blue-800 underline disabled:opacity-50 disabled:cursor-not-allowed"
                            >
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
                        <span className="text-xs text-gray-400">
                          참여 대기중
                        </span>
                      )}
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


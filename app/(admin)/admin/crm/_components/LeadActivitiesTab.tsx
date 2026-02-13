"use client";

import { useState, useTransition } from "react";
import { cn } from "@/lib/cn";
import { useToast } from "@/components/ui/ToastProvider";
import Button from "@/components/atoms/Button";
import {
  borderInput,
  bgSurface,
  textPrimary,
} from "@/lib/utils/darkMode";
import {
  textPrimaryVar,
  textSecondaryVar,
  borderDefaultVar,
  bgSurfaceVar,
} from "@/lib/utils/darkMode";
import { ACTIVITY_TYPE_LABELS } from "@/lib/domains/crm/constants";
import {
  addLeadActivity,
  deleteLeadActivity,
} from "@/lib/domains/crm/actions/activities";
import { sendMissedCallNotification } from "@/lib/domains/crm/actions/notifications";
import type {
  SalesLeadWithRelations,
  LeadActivity,
  ActivityType,
  CrmPaginatedResult,
} from "@/lib/domains/crm/types";

type LeadActivitiesTabProps = {
  lead: SalesLeadWithRelations;
  activities: CrmPaginatedResult<LeadActivity>;
};

export function LeadActivitiesTab({
  lead,
  activities,
}: LeadActivitiesTabProps) {
  const { showSuccess, showError } = useToast();
  const [isPending, startTransition] = useTransition();
  const [activityType, setActivityType] = useState<ActivityType>("phone_call");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  const inputClass = cn(
    "rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2",
    borderInput,
    bgSurface,
    textPrimary,
    "focus:border-indigo-500 focus:ring-indigo-200 dark:focus:ring-indigo-800"
  );

  const handleAdd = () => {
    startTransition(async () => {
      const result = await addLeadActivity({
        leadId: lead.id,
        activityType,
        title: title.trim() || undefined,
        description: description.trim() || undefined,
      });
      if (result.success) {
        showSuccess("활동이 기록되었습니다.");
        setTitle("");
        setDescription("");
      } else {
        showError(result.error ?? "활동 기록에 실패했습니다.");
      }
    });
  };

  const handleDelete = (activityId: string) => {
    startTransition(async () => {
      const result = await deleteLeadActivity(activityId);
      if (result.success) {
        showSuccess("활동이 삭제되었습니다.");
      } else {
        showError(result.error ?? "삭제에 실패했습니다.");
      }
    });
  };

  const handleSendMissedCall = () => {
    startTransition(async () => {
      const result = await sendMissedCallNotification(lead.id);
      if (result.success) {
        showSuccess("부재 안내가 발송되었습니다.");
      } else {
        showError(result.error ?? "부재 안내 발송에 실패했습니다.");
      }
    });
  };

  return (
    <div className="flex flex-col gap-4">
      {/* 활동 추가 폼 */}
      <div
        className={cn(
          "rounded-lg border p-4",
          borderDefaultVar,
          bgSurfaceVar
        )}
      >
        <h3 className={cn("text-sm font-semibold mb-3", textPrimaryVar)}>
          활동 추가
        </h3>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <select
            value={activityType}
            onChange={(e) => setActivityType(e.target.value as ActivityType)}
            className={inputClass}
          >
            {Object.entries(ACTIVITY_TYPE_LABELS)
              .filter(([key]) => key !== "status_change")
              .map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
          </select>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="제목"
            className={cn(inputClass, "flex-1")}
          />
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="설명 (선택)"
            className={cn(inputClass, "flex-1")}
          />
          <Button
            variant="primary"
            size="sm"
            onClick={handleAdd}
            isLoading={isPending}
          >
            추가
          </Button>
        </div>
      </div>

      {/* 활동 타임라인 */}
      <div className="flex flex-col gap-2">
        {activities.items.length === 0 ? (
          <p className={cn("text-sm text-center py-8", textSecondaryVar)}>
            기록된 활동이 없습니다.
          </p>
        ) : (
          activities.items.map((activity) => (
            <div
              key={activity.id}
              className={cn(
                "rounded-lg border p-3",
                borderDefaultVar,
                bgSurfaceVar
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium",
                        "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                      )}
                    >
                      {ACTIVITY_TYPE_LABELS[
                        activity.activity_type as ActivityType
                      ] ?? activity.activity_type}
                    </span>
                    {activity.title && (
                      <span className={cn("text-sm font-medium", textPrimaryVar)}>
                        {activity.title}
                      </span>
                    )}
                  </div>
                  {activity.description && (
                    <p className={cn("text-sm", textSecondaryVar)}>
                      {activity.description}
                    </p>
                  )}
                  <span className={cn("text-xs", textSecondaryVar)}>
                    {new Date(activity.activity_date).toLocaleString("ko-KR")}
                  </span>
                </div>
                {activity.activity_type !== "status_change" && (
                  <div className="flex items-center gap-2 shrink-0">
                    {(activity.metadata as Record<string, unknown>)
                      ?.missedCallSent ? (
                      <span className="text-xs text-gray-400 dark:text-gray-500">
                        발송완료
                      </span>
                    ) : (
                      <button
                        onClick={handleSendMissedCall}
                        disabled={isPending}
                        className="text-xs text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300"
                      >
                        부재 안내
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(activity.id)}
                      disabled={isPending}
                      className="text-xs text-red-500 hover:text-red-700 dark:text-red-400"
                    >
                      삭제
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

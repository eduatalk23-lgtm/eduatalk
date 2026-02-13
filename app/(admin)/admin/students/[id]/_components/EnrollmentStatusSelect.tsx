"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/ToastProvider";
import { cn } from "@/lib/cn";
import { borderInput, bgSurface, textPrimary } from "@/lib/utils/darkMode";
import { updateEnrollmentStatusAction } from "@/lib/domains/enrollment/actions";
import {
  ENROLLMENT_STATUS_LABELS,
  type EnrollmentStatus,
  type EnrollmentWithProgram,
} from "@/lib/domains/enrollment/types";

type EnrollmentStatusSelectProps = {
  enrollment: EnrollmentWithProgram;
};

const STATUS_OPTIONS = Object.entries(ENROLLMENT_STATUS_LABELS) as [
  EnrollmentStatus,
  string,
][];

export function EnrollmentStatusSelect({
  enrollment,
}: EnrollmentStatusSelectProps) {
  const router = useRouter();
  const toast = useToast();
  const [isPending, startTransition] = useTransition();

  const handleChange = (newStatus: EnrollmentStatus) => {
    if (newStatus === enrollment.status) return;

    startTransition(async () => {
      try {
        const result = await updateEnrollmentStatusAction(
          enrollment.id,
          newStatus
        );
        if (result.success) {
          toast.showSuccess(
            `상태가 "${ENROLLMENT_STATUS_LABELS[newStatus]}"(으)로 변경되었습니다.`
          );
          router.refresh();
        } else {
          toast.showError(result.error ?? "상태 변경에 실패했습니다.");
        }
      } catch (error) {
        toast.showError(
          error instanceof Error
            ? error.message
            : "상태 변경에 실패했습니다."
        );
      }
    });
  };

  return (
    <select
      value={enrollment.status}
      onChange={(e) => handleChange(e.target.value as EnrollmentStatus)}
      onClick={(e) => e.stopPropagation()}
      disabled={isPending}
      className={cn(
        "rounded-lg border px-2 py-1 text-xs focus:outline-none focus:ring-2",
        borderInput,
        bgSurface,
        textPrimary,
        "focus:border-indigo-500 focus:ring-indigo-200 dark:focus:ring-indigo-800",
        isPending && "cursor-not-allowed opacity-50"
      )}
    >
      {STATUS_OPTIONS.map(([value, label]) => (
        <option key={value} value={value}>
          {label}
        </option>
      ))}
    </select>
  );
}

"use client";

import { Badge } from "@/components/ui/Badge";
import type { RecordStatus } from "@/lib/domains/student-record";

const STATUS_MAP: Record<RecordStatus, { label: string; color: "gray" | "amber" | "emerald" }> = {
  draft: { label: "초안", color: "gray" },
  review: { label: "검토 중", color: "amber" },
  final: { label: "확정", color: "emerald" },
};

interface RecordStatusBadgeProps {
  status: string;
}

export function RecordStatusBadge({ status }: RecordStatusBadgeProps) {
  const config = STATUS_MAP[status as RecordStatus] ?? STATUS_MAP.draft;
  return (
    <Badge color={config.color} size="xs">
      {config.label}
    </Badge>
  );
}

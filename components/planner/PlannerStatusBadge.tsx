import { cn } from "@/lib/cn";

type StatusConfig = { label: string; bg: string; text: string };

const adminLabels: Record<string, StatusConfig> = {
  draft: { label: "초안", bg: "bg-gray-100", text: "text-gray-700" },
  active: { label: "활성", bg: "bg-green-100", text: "text-green-700" },
  paused: { label: "일시정지", bg: "bg-yellow-100", text: "text-yellow-700" },
  archived: { label: "보관됨", bg: "bg-slate-100", text: "text-slate-700" },
  completed: { label: "완료", bg: "bg-blue-100", text: "text-blue-700" },
};

const studentLabels: Record<string, StatusConfig> = {
  draft: { label: "초안", bg: "bg-gray-100", text: "text-gray-700" },
  active: { label: "진행중", bg: "bg-green-100", text: "text-green-700" },
  paused: { label: "일시중지", bg: "bg-yellow-100", text: "text-yellow-700" },
  archived: { label: "보관됨", bg: "bg-gray-100", text: "text-gray-500" },
  completed: { label: "완료", bg: "bg-blue-100", text: "text-blue-700" },
};

interface PlannerStatusBadgeProps {
  status: string;
  /** admin: 관리자 라벨(활성, 일시정지), student: 학생 라벨(진행중, 일시중지) */
  variant?: "admin" | "student";
  className?: string;
}

export function PlannerStatusBadge({
  status,
  variant = "admin",
  className,
}: PlannerStatusBadgeProps) {
  const labels = variant === "student" ? studentLabels : adminLabels;
  const config = labels[status] || labels.draft;

  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 text-xs font-medium rounded",
        config.bg,
        config.text,
        className
      )}
    >
      {config.label}
    </span>
  );
}

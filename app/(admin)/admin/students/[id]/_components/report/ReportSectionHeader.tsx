import type { LucideIcon } from "lucide-react";

interface ReportSectionHeaderProps {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
}

export function ReportSectionHeader({
  icon: Icon,
  title,
  subtitle,
}: ReportSectionHeaderProps) {
  return (
    <div className="mb-6 flex items-center gap-4 border-l-4 border-indigo-500 pl-4">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-indigo-50">
        <Icon className="h-5 w-5 text-indigo-600" />
      </div>
      <div>
        <h2 className="report-section-title">{title}</h2>
        {subtitle && <p className="report-caption mt-0.5">{subtitle}</p>}
      </div>
    </div>
  );
}

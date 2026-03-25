import { GraduationCap } from "lucide-react";

interface CoverSectionProps {
  studentName: string | null;
  schoolName: string | null;
  grade: number;
  className: string | null;
  targetMajor: string | null;
  consultantName: string | null;
  generatedAt: string;
}

export function CoverSection({
  studentName,
  schoolName,
  grade,
  className,
  targetMajor,
  consultantName,
  generatedAt,
}: CoverSectionProps) {
  const date = new Date(generatedAt);
  const dateStr = `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일`;

  return (
    <section className="report-typography flex min-h-[80vh] flex-col print-avoid-break">
      {/* 상단 밴드: 그라디언트 + 세리프 타이포 */}
      <div className="flex flex-1 flex-col items-center justify-center rounded-b-3xl bg-gradient-to-br from-indigo-600 via-indigo-700 to-indigo-900 px-8 py-16 text-center text-white">
        <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/15 backdrop-blur">
          <GraduationCap className="h-8 w-8 text-white" />
        </div>

        <p className="report-caption mb-3 uppercase tracking-[0.2em] text-indigo-200">
          수시 컨설팅
        </p>
        <h1 className="report-page-title text-white">Report</h1>

        <div className="mt-10 space-y-3">
          <p className="report-subtitle font-semibold text-white">
            {studentName ?? "이름 없음"}
          </p>
          <p className="report-body text-indigo-200">
            {schoolName ?? "-"} · {grade}학년{className ? ` ${className}반` : ""}
          </p>
        </div>

        {targetMajor && (
          <div className="report-caption mt-8 rounded-full border border-white/30 bg-white/10 px-6 py-2.5 text-white backdrop-blur">
            목표 전공: {targetMajor}
          </div>
        )}
      </div>

      {/* 하단: 메타데이터 — 산세리프 */}
      <div className="flex items-center justify-between px-8 py-6">
        <span className="report-caption text-gray-400">
          {consultantName ? `담당 컨설턴트: ${consultantName}` : ""}
        </span>
        <span className="report-caption text-gray-400">{dateStr}</span>
      </div>
    </section>
  );
}

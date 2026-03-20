"use client";

import { useState, useRef, useEffect } from "react";
import { Download, FileText, FileSpreadsheet, Loader2 } from "lucide-react";
import type { ReportExportData } from "@/lib/domains/student-record/export/report-export";

interface ReportExportMenuProps {
  data: ReportExportData;
}

export function ReportExportMenu({ data }: ReportExportMenuProps) {
  const [open, setOpen] = useState(false);
  const [exporting, setExporting] = useState<"pdf" | "docx" | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  // 외부 클릭으로 닫기
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  async function handleExport(format: "pdf" | "docx") {
    setExporting(format);
    try {
      const { exportReportAsPdf, exportReportAsDocx } = await import(
        "@/lib/domains/student-record/export/report-export"
      );
      if (format === "pdf") {
        await exportReportAsPdf(data);
      } else {
        await exportReportAsDocx(data);
      }
    } catch {
      // 에러는 사용자에게 alert으로 표시
      alert("내보내기에 실패했습니다. 다시 시도해주세요.");
    } finally {
      setExporting(null);
      setOpen(false);
    }
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        disabled={exporting !== null}
        className="rounded px-2 py-1 text-[10px] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] flex items-center gap-0.5"
      >
        {exporting ? (
          <Loader2 className="w-3 h-3 animate-spin" />
        ) : (
          <Download className="w-3 h-3" />
        )}
        내보내기
      </button>

      {open && (
        <div className="absolute right-0 top-full z-10 mt-1 w-36 rounded-lg border border-[var(--border-primary)] bg-[var(--surface-primary)] shadow-lg">
          <button
            type="button"
            onClick={() => handleExport("pdf")}
            disabled={exporting !== null}
            className="flex w-full items-center gap-2 px-3 py-2 text-xs text-[var(--text-primary)] hover:bg-[var(--surface-hover)] rounded-t-lg disabled:opacity-50"
          >
            {exporting === "pdf" ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <FileText className="w-3.5 h-3.5 text-red-500" />
            )}
            PDF 다운로드
          </button>
          <button
            type="button"
            onClick={() => handleExport("docx")}
            disabled={exporting !== null}
            className="flex w-full items-center gap-2 px-3 py-2 text-xs text-[var(--text-primary)] hover:bg-[var(--surface-hover)] rounded-b-lg disabled:opacity-50"
          >
            {exporting === "docx" ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <FileSpreadsheet className="w-3.5 h-3.5 text-blue-500" />
            )}
            Word 다운로드
          </button>
        </div>
      )}
    </div>
  );
}

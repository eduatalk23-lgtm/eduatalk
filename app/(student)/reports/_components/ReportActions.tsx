"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { generateReportPDF, sendReportEmail } from "../_actions";

type ReportActionsProps = {
  period: "weekly" | "monthly";
};

export function ReportActions({ period }: ReportActionsProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const router = useRouter();

  const handleDownload = () => {
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      try {
        const result = await generateReportPDF(period);
        if (result.success && result.pdfBuffer) {
          // PDF 다운로드
          const blob = new Blob([new Uint8Array(result.pdfBuffer)], { type: "application/pdf" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `학습리포트_${period === "weekly" ? "주간" : "월간"}_${new Date().toISOString().slice(0, 10)}.pdf`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          setSuccess("PDF가 다운로드되었습니다.");
        } else {
          setError(result.error ?? "PDF 생성에 실패했습니다.");
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "PDF 생성에 실패했습니다.");
      }
    });
  };

  const handleEmail = () => {
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      try {
        const result = await sendReportEmail(period);
        if (result.success) {
          setSuccess("이메일이 전송되었습니다.");
        } else {
          setError(result.error ?? "이메일 전송에 실패했습니다.");
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "이메일 전송에 실패했습니다.");
      }
    });
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2">
        <Link
          href={`/reports?period=${period === "weekly" ? "monthly" : "weekly"}`}
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          {period === "weekly" ? "월간 리포트" : "주간 리포트"}
        </Link>
        <button
          onClick={handleDownload}
          disabled={isPending}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isPending ? "생성 중..." : "PDF 다운로드"}
        </button>
        <button
          onClick={handleEmail}
          disabled={isPending}
          className="rounded-lg border border-indigo-300 bg-white px-4 py-2 text-sm font-semibold text-indigo-700 transition hover:bg-indigo-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isPending ? "전송 중..." : "이메일 전송"}
        </button>
      </div>
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">
          {success}
        </div>
      )}
    </div>
  );
}


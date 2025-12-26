"use client";

import { useState } from "react";
import { Download, FileSpreadsheet } from "lucide-react";
import type { CampAttendanceStats, CampLearningStats } from "@/lib/domains/camp/types";

type CampReportExportProps = {
  templateName: string;
  attendanceStats: CampAttendanceStats | null;
  learningStats: CampLearningStats | null;
};

export function CampReportExport({
  templateName,
  attendanceStats,
  learningStats,
}: CampReportExportProps) {
  const [isExporting, setIsExporting] = useState(false);

  const handleExportExcel = async () => {
    setIsExporting(true);
    try {
      // 동적 import로 번들 크기 최적화 (~650KB 절감)
      const XLSX = await import("xlsx");
      const workbook = XLSX.utils.book_new();

      // 1. 요약 시트
      const summaryData = [
        ["캠프 리포트 요약"],
        [""],
        ["항목", "값"],
        ["캠프 이름", templateName],
        ["총 참여자", attendanceStats?.total_participants || learningStats?.participant_stats.length || 0],
        ["전체 출석률", `${attendanceStats?.attendance_rate?.toFixed(1) || 0}%`],
        ["총 학습 시간 (분)", learningStats?.total_study_minutes || 0],
        ["평균 학습 시간 (분)", learningStats?.average_study_minutes_per_participant || 0],
        ["총 플랜 수", learningStats?.total_plans || 0],
        ["완료된 플랜 수", learningStats?.completed_plans || 0],
      ];
      const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
      XLSX.utils.book_append_sheet(workbook, summarySheet, "요약");

      // 2. 출석 통계 시트
      if (attendanceStats?.participant_stats && attendanceStats.participant_stats.length > 0) {
        const attendanceHeaders = [
          "학생 이름",
          "출석률 (%)",
          "출석",
          "결석",
          "지각",
          "조퇴",
          "공결",
        ];
        const attendanceRows = attendanceStats.participant_stats.map((stat) => [
          stat.student_name,
          stat.attendance_rate?.toFixed(1) || "0.0",
          stat.present_count || 0,
          stat.absent_count || 0,
          stat.late_count || 0,
          stat.early_leave_count || 0,
          stat.excused_count || 0,
        ]);
        const attendanceSheetData = [attendanceHeaders, ...attendanceRows];
        const attendanceSheet = XLSX.utils.aoa_to_sheet(attendanceSheetData);
        XLSX.utils.book_append_sheet(workbook, attendanceSheet, "출석 통계");
      }

      // 3. 학습 통계 시트
      if (learningStats?.participant_stats && learningStats.participant_stats.length > 0) {
        const learningHeaders = [
          "학생 이름",
          "학습 시간 (분)",
          "학습 시간",
          "플랜 완료율 (%)",
          "전체 플랜",
          "완료된 플랜",
          "주요 과목",
        ];
        const learningRows = learningStats.participant_stats.map((stat) => {
          const hours = Math.floor(stat.study_minutes / 60);
          const mins = stat.study_minutes % 60;
          const topSubjects = Object.entries(stat.subject_distribution)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 3)
            .map(([subject]) => subject)
            .join(", ");

          return [
            stat.student_name,
            stat.study_minutes,
            `${hours}시간 ${mins}분`,
            stat.plan_completion_rate,
            stat.total_plans || 0,
            stat.completed_plans || 0,
            topSubjects || "-",
          ];
        });
        const learningSheetData = [learningHeaders, ...learningRows];
        const learningSheet = XLSX.utils.aoa_to_sheet(learningSheetData);
        XLSX.utils.book_append_sheet(workbook, learningSheet, "학습 통계");
      }

      // 파일 다운로드
      const fileName = `캠프_리포트_${templateName}_${new Date().toISOString().split("T")[0]}.xlsx`;
      XLSX.writeFile(workbook, fileName);
    } catch (error) {
      console.error("Excel 내보내기 실패:", error);
      alert("Excel 파일 생성에 실패했습니다.");
    } finally {
      setIsExporting(false);
    }
  };

  const hasData = attendanceStats || learningStats;

  return (
    <button
      onClick={handleExportExcel}
      disabled={isExporting || !hasData}
      className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
      title="리포트를 Excel 파일로 다운로드합니다"
    >
      {isExporting ? (
        <>
          <Download className="h-4 w-4 animate-bounce" />
          내보내는 중...
        </>
      ) : (
        <>
          <FileSpreadsheet className="h-4 w-4" />
          Excel 내보내기
        </>
      )}
    </button>
  );
}

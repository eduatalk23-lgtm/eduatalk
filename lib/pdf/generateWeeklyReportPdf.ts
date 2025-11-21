import PDFDocument from "pdfkit";
import type { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  getWeeklyPlanSummary,
  getWeeklyStudyTimeSummary,
  getWeeklyGoalProgress,
  getWeeklyWeakSubjectTrend,
} from "@/lib/reports/weekly";
import { getRecommendations, getTopRecommendations } from "@/lib/recommendations/engine";
import { getWeeklyCoaching } from "@/app/(student)/report/weekly/coachingAction";

type SupabaseServerClient = Awaited<
  ReturnType<typeof createSupabaseServerClient>
>;

interface StudentInfo {
  name: string | null;
}

/**
 * 주간 리포트 PDF 생성
 */
export async function generateWeeklyReportPdf(
  supabase: SupabaseServerClient,
  studentId: string,
  weekRange: { start: Date; end: Date }
): Promise<Buffer> {
  return new Promise(async (resolve, reject) => {
    try {
      // 학생 정보 조회
      const selectStudent = () =>
        supabase.from("students").select("name").eq("id", studentId);

      let { data: studentData, error: studentError } = await selectStudent();

      if (studentError && studentError.code === "42703") {
        ({ data: studentData, error: studentError } = await selectStudent());
      }

      const student: StudentInfo = {
        name: (studentData as Array<{ name: string | null }> | null)?.[0]?.name ?? null,
      };

      // 리포트 데이터 조회
      const [planSummary, studyTimeSummary, goalProgress, weakSubjects, recommendations, coachingResult] = await Promise.all([
        getWeeklyPlanSummary(supabase, studentId, weekRange.start, weekRange.end),
        getWeeklyStudyTimeSummary(supabase, studentId, weekRange.start, weekRange.end),
        getWeeklyGoalProgress(supabase, studentId, weekRange.start, weekRange.end),
        getWeeklyWeakSubjectTrend(supabase, studentId, weekRange.start, weekRange.end),
        getRecommendations(supabase, studentId),
        getWeeklyCoaching(studentId),
      ]);

      // PDF 문서 생성
      const doc = new PDFDocument({
        size: "A4",
        margins: { top: 50, bottom: 50, left: 50, right: 50 },
      });

      const buffers: Buffer[] = [];
      doc.on("data", buffers.push.bind(buffers));
      doc.on("end", () => {
        const pdfBuffer = Buffer.concat(buffers);
        resolve(pdfBuffer);
      });
      doc.on("error", reject);

      // 헤더
      doc
        .fontSize(24)
        .font("Helvetica-Bold")
        .text("주간 학습 리포트", { align: "center" })
        .moveDown(0.5);

      // 학생 이름 및 기간
      const studentName = student.name || "학생";
      const startDate = formatDateKorean(weekRange.start);
      const endDate = formatDateKorean(weekRange.end);

      doc
        .fontSize(14)
        .font("Helvetica")
        .text(`학생: ${studentName}`, { align: "center" })
        .moveDown(0.3)
        .text(`기간: ${startDate} ~ ${endDate}`, { align: "center" })
        .moveDown(0.3)
        .text(`생성일: ${formatDateKorean(new Date())}`, { align: "center" })
        .moveDown(1);

      // 주요 지표 테이블
      doc.fontSize(16).font("Helvetica-Bold").text("주요 지표", { underline: true }).moveDown(0.5);

      const metrics = [
        ["항목", "값"],
        ["총 학습시간", `${studyTimeSummary.totalHours}시간 ${studyTimeSummary.totalMinutes % 60}분`],
        ["플랜 실행률", `${planSummary.completionRate}%`],
        ["목표 달성률", `${goalProgress.averageProgress}%`],
        ["완료한 플랜", `${planSummary.completedPlans}개 / ${planSummary.totalPlans}개`],
        ["진행 중 목표", `${goalProgress.activeGoals}개`],
      ];

      drawTable(doc, metrics, 500);
      doc.moveDown(1);

      // 과목별 학습시간
      if (studyTimeSummary.bySubject.length > 0) {
        doc.fontSize(16).font("Helvetica-Bold").text("과목별 학습시간", { underline: true }).moveDown(0.5);

        const subjectTable = [
          ["과목", "학습시간", "비율"],
          ...studyTimeSummary.bySubject.slice(0, 10).map((s) => [
            s.subject,
            `${Math.floor(s.minutes / 60)}시간 ${s.minutes % 60}분`,
            `${s.percentage}%`,
          ]),
        ];

        drawTable(doc, subjectTable, 500);
        doc.moveDown(1);
      }

      // 일별 학습시간
      if (studyTimeSummary.byDay.length > 0) {
        doc.addPage();
        doc.fontSize(16).font("Helvetica-Bold").text("일별 학습시간", { underline: true }).moveDown(0.5);

        const dayTable = [
          ["요일", "날짜", "학습시간"],
          ...studyTimeSummary.byDay.map((d) => [
            d.dayOfWeek,
            formatDateKorean(new Date(d.date)),
            `${Math.floor(d.minutes / 60)}시간 ${d.minutes % 60}분`,
          ]),
        ];

        drawTable(doc, dayTable, 500);
        doc.moveDown(1);
      }

      // 목표 진행률
      if (goalProgress.goals.length > 0) {
        doc.fontSize(16).font("Helvetica-Bold").text("목표 진행률", { underline: true }).moveDown(0.5);

        const goalTable = [
          ["목표", "유형", "진행률", "상태"],
          ...goalProgress.goals.slice(0, 10).map((g) => [
            g.title.length > 20 ? g.title.substring(0, 20) + "..." : g.title,
            g.goalType,
            `${g.progressPercentage}%`,
            getStatusLabel(g.status),
          ]),
        ];

        drawTable(doc, goalTable, 500);
        doc.moveDown(1);
      }

      // 취약 과목
      if (weakSubjects.subjects.length > 0) {
        doc.addPage();
        doc.fontSize(16).font("Helvetica-Bold").text("취약 과목 분석", { underline: true }).moveDown(0.5);

        weakSubjects.subjects.forEach((subject, index) => {
          doc.fontSize(12).font("Helvetica-Bold").text(`${index + 1}. ${subject.subject}`, { continued: false });
          doc.font("Helvetica").fontSize(10);
          doc.text(`위험도: ${subject.riskScore}점`, { indent: 20 });
          doc.text(`이번 주 학습시간: ${subject.studyTimeMinutes}분`, { indent: 20 });
          if (subject.studyTimeChange !== 0) {
            const changeText =
              subject.studyTimeChange > 0
                ? `+${subject.studyTimeChange}분 (증가)`
                : `${subject.studyTimeChange}분 (감소)`;
            doc.text(`지난주 대비: ${changeText}`, { indent: 20 });
          }
          doc.text(`분석: ${subject.reason}`, { indent: 20 });
          doc.moveDown(0.5);
        });
      }

      // 코칭 메시지
      if (coachingResult.success && coachingResult.data) {
        const coaching = coachingResult.data;
        doc.addPage();
        doc.fontSize(16).font("Helvetica-Bold").text("이번주 코칭 요약", { underline: true }).moveDown(0.5);

        // Summary
        doc.fontSize(12).font("Helvetica-Bold").text("요약", { indent: 10 }).moveDown(0.3);
        doc.font("Helvetica").fontSize(11);
        doc.text(coaching.summary, { indent: 20 });
        doc.moveDown(0.5);

        // Highlights
        if (coaching.highlights.length > 0) {
          doc.fontSize(12).font("Helvetica-Bold").text("잘한 점", { indent: 10 }).moveDown(0.3);
          doc.font("Helvetica").fontSize(11);
          coaching.highlights.forEach((highlight, index) => {
            doc.text(`${index + 1}. ${highlight}`, { indent: 20 });
            doc.moveDown(0.2);
          });
          doc.moveDown(0.3);
        }

        // Warnings
        if (coaching.warnings.length > 0) {
          doc.fontSize(12).font("Helvetica-Bold").text("주의할 점", { indent: 10 }).moveDown(0.3);
          doc.font("Helvetica").fontSize(11);
          coaching.warnings.forEach((warning, index) => {
            doc.text(`${index + 1}. ${warning}`, { indent: 20 });
            doc.moveDown(0.2);
          });
          doc.moveDown(0.3);
        }

        // Next Week Guide
        if (coaching.nextWeekGuide.length > 0) {
          doc.fontSize(12).font("Helvetica-Bold").text("다음주 가이드", { indent: 10 }).moveDown(0.3);
          doc.font("Helvetica").fontSize(11);
          coaching.nextWeekGuide.forEach((guide, index) => {
            doc.text(`${index + 1}. ${guide}`, { indent: 20 });
            doc.moveDown(0.2);
          });
        }
      }

      // 학습 추천
      const topRecommendations = getTopRecommendations(recommendations, 5);
      if (topRecommendations.length > 0) {
        doc.addPage();
        doc.fontSize(16).font("Helvetica-Bold").text("학습 추천", { underline: true }).moveDown(0.5);
        doc.font("Helvetica").fontSize(11);

        topRecommendations.forEach((rec, index) => {
          doc.text(`${index + 1}. ${rec}`, { indent: 10 });
          doc.moveDown(0.3);
        });
      }

      // 푸터
      const pageCount = doc.bufferedPageRange().count;
      for (let i = 0; i < pageCount; i++) {
        doc.switchToPage(i);
        doc.fontSize(8).font("Helvetica").text(
          `페이지 ${i + 1} / ${pageCount}`,
          50,
          doc.page.height - 30,
          { align: "center", width: 500 }
        );
      }

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * 월간 리포트 PDF 생성
 */
export async function generateMonthlyReportPdf(
  supabase: SupabaseServerClient,
  studentId: string,
  monthRange: { start: Date; end: Date }
): Promise<Buffer> {
  return new Promise(async (resolve, reject) => {
    try {
      // 학생 정보 조회
      const selectStudent = () =>
        supabase.from("students").select("name").eq("id", studentId);

      let { data: studentData, error: studentError } = await selectStudent();

      if (studentError && studentError.code === "42703") {
        ({ data: studentData, error: studentError } = await selectStudent());
      }

      const student: StudentInfo = {
        name: (studentData as Array<{ name: string | null }> | null)?.[0]?.name ?? null,
      };

      // 리포트 데이터 조회
      const { getMonthlyReportData } = await import("@/lib/reports/monthly");
      const [reportData, recommendations] = await Promise.all([
        getMonthlyReportData(supabase, studentId, monthRange.start),
        getRecommendations(supabase, studentId),
      ]);

      // PDF 문서 생성
      const doc = new PDFDocument({
        size: "A4",
        margins: { top: 50, bottom: 50, left: 50, right: 50 },
      });

      const buffers: Buffer[] = [];
      doc.on("data", buffers.push.bind(buffers));
      doc.on("end", () => {
        const pdfBuffer = Buffer.concat(buffers);
        resolve(pdfBuffer);
      });
      doc.on("error", reject);

      // 헤더
      doc
        .fontSize(24)
        .font("Helvetica-Bold")
        .text("월간 학습 리포트", { align: "center" })
        .moveDown(0.5);

      // 학생 이름 및 기간
      const studentName = student.name || "학생";
      const monthLabel = reportData.period.monthLabel;

      doc
        .fontSize(14)
        .font("Helvetica")
        .text(`학생: ${studentName}`, { align: "center" })
        .moveDown(0.3)
        .text(`기간: ${monthLabel}`, { align: "center" })
        .moveDown(0.3)
        .text(`생성일: ${formatDateKorean(new Date())}`, { align: "center" })
        .moveDown(1);

      // 주요 지표 테이블
      doc.fontSize(16).font("Helvetica-Bold").text("주요 지표", { underline: true }).moveDown(0.5);

      const metrics = [
        ["항목", "값"],
        ["총 학습시간", `${Math.floor(reportData.totals.studyMinutes / 60)}시간 ${reportData.totals.studyMinutes % 60}분`],
        ["플랜 실행률", `${reportData.totals.completionRate}%`],
        ["목표 달성률", `${reportData.totals.goalRate}%`],
      ];

      if (reportData.comparison.studyTimeChange !== 0) {
        const changeText =
          reportData.comparison.studyTimeChange > 0
            ? `+${Math.floor(reportData.comparison.studyTimeChange / 60)}시간 (증가)`
            : `${Math.floor(reportData.comparison.studyTimeChange / 60)}시간 (감소)`;
        metrics.push(["지난달 대비 학습시간", changeText]);
      }

      drawTable(doc, metrics, 500);
      doc.moveDown(1);

      // 주차별 학습시간
      if (reportData.studyTimeByWeek.length > 0) {
        doc.fontSize(16).font("Helvetica-Bold").text("주차별 학습시간", { underline: true }).moveDown(0.5);

        const weekTable = [
          ["주차", "기간", "학습시간"],
          ...reportData.studyTimeByWeek.map((w) => [
            `${w.weekNumber}주차`,
            `${formatDateKorean(new Date(w.startDate))} ~ ${formatDateKorean(new Date(w.endDate))}`,
            `${w.hours}시간 ${w.minutes % 60}분`,
          ]),
        ];

        drawTable(doc, weekTable, 500);
        doc.moveDown(1);
      }

      // 과목별 학습시간
      if (reportData.studyTimeBySubject.length > 0) {
        doc.addPage();
        doc.fontSize(16).font("Helvetica-Bold").text("과목별 학습시간", { underline: true }).moveDown(0.5);

        const subjectTable = [
          ["과목", "학습시간", "비율"],
          ...reportData.studyTimeBySubject.slice(0, 10).map((s) => [
            s.subject,
            `${s.hours}시간 ${s.minutes % 60}분`,
            `${s.percentage}%`,
          ]),
        ];

        drawTable(doc, subjectTable, 500);
        doc.moveDown(1);
      }

      // 목표 진행률
      if (reportData.goals.goals.length > 0) {
        doc.fontSize(16).font("Helvetica-Bold").text("목표 진행률", { underline: true }).moveDown(0.5);

        const goalTable = [
          ["목표", "유형", "진행률", "상태"],
          ...reportData.goals.goals.slice(0, 10).map((g) => [
            g.title.length > 20 ? g.title.substring(0, 20) + "..." : g.title,
            g.goalType,
            `${g.progressPercentage}%`,
            getStatusLabel(g.status),
          ]),
        ];

        drawTable(doc, goalTable, 500);
        doc.moveDown(1);
      }

      // 성적 변화
      if (reportData.scores.thisMonth.length > 0 || reportData.scores.lastMonth.length > 0) {
        doc.addPage();
        doc.fontSize(16).font("Helvetica-Bold").text("성적 변화", { underline: true }).moveDown(0.5);

        if (reportData.scores.thisMonth.length > 0) {
          doc.fontSize(12).font("Helvetica-Bold").text("이번 달 성적").moveDown(0.3);
          const scoreTable = [
            ["과목", "등급", "점수", "시험일"],
            ...reportData.scores.thisMonth.map((s) => [
              s.subject,
              `${s.grade}등급`,
              `${s.rawScore}점`,
              formatDateKorean(new Date(s.testDate)),
            ]),
          ];
          drawTable(doc, scoreTable, 500);
          doc.moveDown(0.5);
        }

        if (reportData.scores.trend !== "stable") {
          const trendText =
            reportData.scores.trend === "improving" ? "개선 중" : "하락 중";
          doc.fontSize(12).font("Helvetica").text(`전체 성적 추세: ${trendText}`, { indent: 20 });
        }
      }

      // 취약 과목
      if (reportData.subjects.weak.length > 0) {
        doc.fontSize(16).font("Helvetica-Bold").text("취약 과목", { underline: true }).moveDown(0.5);
        doc.fontSize(12).font("Helvetica").text(reportData.subjects.weak.join(", "));
        doc.moveDown(1);
      }

      // 학습 추천
      const topRecommendations = getTopRecommendations(recommendations, 5);
      if (topRecommendations.length > 0) {
        doc.addPage();
        doc.fontSize(16).font("Helvetica-Bold").text("학습 추천", { underline: true }).moveDown(0.5);
        doc.font("Helvetica").fontSize(11);

        topRecommendations.forEach((rec, index) => {
          doc.text(`${index + 1}. ${rec}`, { indent: 10 });
          doc.moveDown(0.3);
        });
      }

      // 푸터
      const pageCount = doc.bufferedPageRange().count;
      for (let i = 0; i < pageCount; i++) {
        doc.switchToPage(i);
        doc.fontSize(8).font("Helvetica").text(
          `페이지 ${i + 1} / ${pageCount}`,
          50,
          doc.page.height - 30,
          { align: "center", width: 500 }
        );
      }

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * 테이블 그리기 헬퍼 함수
 */
function drawTable(
  doc: InstanceType<typeof PDFDocument>,
  rows: string[][],
  tableWidth: number
): void {
  const colCount = rows[0].length;
  const colWidth = tableWidth / colCount;
  const rowHeight = 20;
  const startY = doc.y;

  rows.forEach((row, rowIndex) => {
    const isHeader = rowIndex === 0;
    const y = startY + rowIndex * rowHeight;

    row.forEach((cell, colIndex) => {
      const x = 50 + colIndex * colWidth;

      // 셀 테두리
      doc.rect(x, y, colWidth, rowHeight).stroke();

      // 텍스트
      doc
        .font(isHeader ? "Helvetica-Bold" : "Helvetica")
        .fontSize(isHeader ? 11 : 10)
        .text(cell, x + 5, y + 5, {
          width: colWidth - 10,
          height: rowHeight - 10,
          align: colIndex === 0 ? "left" : "center",
        });
    });
  });

  doc.y = startY + rows.length * rowHeight;
}

/**
 * 날짜 포맷팅 (한국어)
 */
function formatDateKorean(date: Date): string {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  return `${year}년 ${month}월 ${day}일`;
}

/**
 * 상태 레이블 변환
 */
function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    scheduled: "예정",
    in_progress: "진행중",
    completed: "완료",
    failed: "미달성",
  };
  return labels[status] || status;
}


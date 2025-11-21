"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { collectReportData } from "./_utils";
import puppeteer from "puppeteer";

// PDF 생성
export async function generateReportPDF(
  period: "weekly" | "monthly"
): Promise<{ success: boolean; pdfBuffer?: Buffer; error?: string }> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "로그인이 필요합니다." };
  }

  try {
    // 리포트 데이터 수집
    const reportData = await collectReportData(supabase, user.id, period);

    // HTML 생성
    const html = generateReportHTML(reportData);

    // Puppeteer로 PDF 생성
    const browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: "networkidle0" });
      const pdfUint8Array = await page.pdf({
        format: "A4",
        printBackground: true,
        margin: {
          top: "20mm",
          right: "15mm",
          bottom: "20mm",
          left: "15mm",
        },
      });

      await browser.close();

      // Uint8Array를 Buffer로 변환
      const pdfBuffer = Buffer.from(pdfUint8Array);

      return { success: true, pdfBuffer };
    } catch (error) {
      await browser.close();
      throw error;
    }
  } catch (error) {
    console.error("[reports] PDF 생성 실패", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "PDF 생성에 실패했습니다.",
    };
  }
}

// 이메일 전송 (기본 구조 - 실제 이메일 서비스 연동 필요)
export async function sendReportEmail(
  period: "weekly" | "monthly"
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "로그인이 필요합니다." };
  }

  try {
    // PDF 생성
    const pdfResult = await generateReportPDF(period);
    if (!pdfResult.success || !pdfResult.pdfBuffer) {
      return { success: false, error: pdfResult.error ?? "PDF 생성에 실패했습니다." };
    }

    // 이메일 전송 로직
    // 실제 구현 시 Resend, SendGrid, Nodemailer 등을 사용
    // 여기서는 기본 구조만 제공

    // 사용자 이메일 조회
    const userEmail = user.email;
    if (!userEmail) {
      return { success: false, error: "이메일 주소를 찾을 수 없습니다." };
    }

    // TODO: 실제 이메일 전송 구현
    // 예시:
    // await sendEmail({
    //   to: userEmail,
    //   subject: `학습 리포트 - ${period === "weekly" ? "주간" : "월간"}`,
    //   attachments: [{
    //     filename: `학습리포트_${period === "weekly" ? "주간" : "월간"}.pdf`,
    //     content: pdfResult.pdfBuffer,
    //   }],
    // });

    // 임시로 성공 반환 (실제 구현 필요)
    console.log(`[reports] 이메일 전송 요청: ${userEmail}, 기간: ${period}`);
    return { success: true };
  } catch (error) {
    console.error("[reports] 이메일 전송 실패", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "이메일 전송에 실패했습니다.",
    };
  }
}

// HTML 생성
function generateReportHTML(data: Awaited<ReturnType<typeof collectReportData>>): string {
  const { studentInfo, periodLabel, weeklySummary, gradeTrends, weakSubjects, strategies, nextWeekSchedule } = data;

  return `
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>학습 리포트 - ${periodLabel}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: "Malgun Gothic", "맑은 고딕", sans-serif;
      font-size: 12pt;
      line-height: 1.6;
      color: #333;
      padding: 20px;
    }
    .header {
      text-align: center;
      margin-bottom: 30px;
      padding-bottom: 20px;
      border-bottom: 3px solid #4f46e5;
    }
    .header h1 {
      font-size: 24pt;
      color: #4f46e5;
      margin-bottom: 10px;
    }
    .header .period {
      font-size: 14pt;
      color: #666;
    }
    .student-info {
      background: #f3f4f6;
      padding: 15px;
      border-radius: 8px;
      margin-bottom: 25px;
    }
    .student-info h2 {
      font-size: 16pt;
      margin-bottom: 10px;
      color: #1f2937;
    }
    .student-info p {
      margin: 5px 0;
      font-size: 11pt;
    }
    .section {
      margin-bottom: 30px;
      page-break-inside: avoid;
    }
    .section h2 {
      font-size: 18pt;
      color: #1f2937;
      margin-bottom: 15px;
      padding-bottom: 10px;
      border-bottom: 2px solid #e5e7eb;
    }
    .summary-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 15px;
      margin-bottom: 20px;
    }
    .summary-card {
      background: #f9fafb;
      padding: 15px;
      border-radius: 8px;
      border-left: 4px solid #4f46e5;
    }
    .summary-card h3 {
      font-size: 12pt;
      color: #6b7280;
      margin-bottom: 8px;
    }
    .summary-card .value {
      font-size: 20pt;
      font-weight: bold;
      color: #1f2937;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 20px;
    }
    th, td {
      padding: 10px;
      text-align: left;
      border-bottom: 1px solid #e5e7eb;
    }
    th {
      background: #f3f4f6;
      font-weight: bold;
      color: #1f2937;
    }
    .trend-up {
      color: #10b981;
      font-weight: bold;
    }
    .trend-down {
      color: #ef4444;
      font-weight: bold;
    }
    .trend-stable {
      color: #6b7280;
    }
    .risk-high {
      background: #fee2e2;
      color: #991b1b;
      padding: 5px 10px;
      border-radius: 4px;
      font-weight: bold;
    }
    .risk-medium {
      background: #fef3c7;
      color: #92400e;
      padding: 5px 10px;
      border-radius: 4px;
    }
    .priority-high {
      color: #ef4444;
      font-weight: bold;
    }
    .priority-medium {
      color: #f59e0b;
    }
    .priority-low {
      color: #10b981;
    }
    .schedule-day {
      margin-bottom: 15px;
      padding: 10px;
      background: #f9fafb;
      border-radius: 6px;
    }
    .schedule-day h4 {
      font-size: 14pt;
      margin-bottom: 8px;
      color: #1f2937;
    }
    .schedule-item {
      padding: 5px 0;
      font-size: 11pt;
    }
    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #e5e7eb;
      text-align: center;
      color: #6b7280;
      font-size: 10pt;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>학습 리포트</h1>
    <div class="period">${periodLabel}</div>
  </div>

  <div class="student-info">
    <h2>학생 정보</h2>
    <p><strong>이름:</strong> ${studentInfo.name ?? "정보 없음"}</p>
    <p><strong>학년:</strong> ${studentInfo.grade ?? "정보 없음"}</p>
    <p><strong>반:</strong> ${studentInfo.class ?? "정보 없음"}</p>
  </div>

  <div class="section">
    <h2>📊 이번 ${data.period === "weekly" ? "주" : "달"} 학습 요약</h2>
    <div class="summary-grid">
      <div class="summary-card">
        <h3>총 학습 시간</h3>
        <div class="value">${Math.round(weeklySummary.totalLearningTime / 60)}시간 ${weeklySummary.totalLearningTime % 60}분</div>
      </div>
      <div class="summary-card">
        <h3>완료율</h3>
        <div class="value">${weeklySummary.completionRate.toFixed(1)}%</div>
      </div>
      <div class="summary-card">
        <h3>완료된 플랜</h3>
        <div class="value">${weeklySummary.completedPlans} / ${weeklySummary.totalPlans}</div>
      </div>
      <div class="summary-card">
        <h3>학습한 과목</h3>
        <div class="value">${weeklySummary.subjects.length}개</div>
      </div>
    </div>
    ${weeklySummary.subjects.length > 0 ? `<p><strong>과목:</strong> ${weeklySummary.subjects.join(", ")}</p>` : ""}
  </div>

  ${gradeTrends.length > 0 ? `
  <div class="section">
    <h2>📈 과목별 성적 변화 추이</h2>
    <table>
      <thead>
        <tr>
          <th>과목</th>
          <th>평균 등급</th>
          <th>추이</th>
          <th>최근 시험</th>
        </tr>
      </thead>
      <tbody>
        ${gradeTrends.map((trend) => {
          const latest = trend.recentGrades[trend.recentGrades.length - 1];
          const trendClass =
            trend.trend === "improving"
              ? "trend-up"
              : trend.trend === "declining"
              ? "trend-down"
              : "trend-stable";
          const trendText =
            trend.trend === "improving"
              ? "📈 개선"
              : trend.trend === "declining"
              ? "📉 하락"
              : "➡️ 유지";
          return `
          <tr>
            <td>${trend.subject}</td>
            <td>${trend.averageGrade.toFixed(1)}등급</td>
            <td class="${trendClass}">${trendText}</td>
            <td>${latest ? `${latest.test_date} (${latest.grade}등급)` : "-"}</td>
          </tr>
        `;
        }).join("")}
      </tbody>
    </table>
  </div>
  ` : ""}

  ${weakSubjects.length > 0 ? `
  <div class="section">
    <h2>⚠️ 취약과목 알림</h2>
    <table>
      <thead>
        <tr>
          <th>과목</th>
          <th>Risk Index</th>
          <th>상태</th>
        </tr>
      </thead>
      <tbody>
        ${weakSubjects.map((weak) => {
          const riskClass = weak.risk_score >= 70 ? "risk-high" : "risk-medium";
          return `
          <tr>
            <td>${weak.subject}</td>
            <td>${weak.risk_score.toFixed(1)}점</td>
            <td><span class="${riskClass}">${weak.reason}</span></td>
          </tr>
        `;
        }).join("")}
      </tbody>
    </table>
  </div>
  ` : ""}

  ${strategies.length > 0 ? `
  <div class="section">
    <h2>💡 추천 학습 전략</h2>
    <table>
      <thead>
        <tr>
          <th>과목</th>
          <th>우선순위</th>
          <th>전략</th>
        </tr>
      </thead>
      <tbody>
        ${strategies.map((strategy) => {
          const priorityClass =
            strategy.priority === "high"
              ? "priority-high"
              : strategy.priority === "medium"
              ? "priority-medium"
              : "priority-low";
          const priorityText =
            strategy.priority === "high"
              ? "높음"
              : strategy.priority === "medium"
              ? "보통"
              : "낮음";
          return `
          <tr>
            <td>${strategy.subject}</td>
            <td class="${priorityClass}">${priorityText}</td>
            <td>${strategy.strategy}</td>
          </tr>
        `;
        }).join("")}
      </tbody>
    </table>
  </div>
  ` : ""}

  ${nextWeekSchedule.length > 0 ? `
  <div class="section">
    <h2>📅 다음주 자동 스케줄 요약</h2>
    ${nextWeekSchedule.map((day) => {
      return `
      <div class="schedule-day">
        <h4>${day.date} (${day.dayOfWeek})</h4>
        ${day.plans.map((plan) => {
          return `
          <div class="schedule-item">
            <strong>${plan.time}</strong> - ${plan.content}${plan.subject ? ` (${plan.subject})` : ""}
          </div>
        `;
        }).join("")}
      </div>
    `;
    }).join("")}
  </div>
  ` : ""}

  <div class="footer">
    <p>본 리포트는 TimeLevelUp 학습 관리 시스템에서 자동 생성되었습니다.</p>
    <p>생성일시: ${new Date().toLocaleString("ko-KR")}</p>
  </div>
</body>
</html>
  `;
}


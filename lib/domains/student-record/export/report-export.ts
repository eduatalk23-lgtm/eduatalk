// ============================================
// E-3 — 리포트 PDF/Word 내보내기
// ============================================

const SECTION_LABELS: Record<string, string> = {
  intro: "소개",
  subject_setek: "교과 학습 활동",
  personal_setek: "개인 탐구 활동",
  changche: "창의적 체험활동",
  reading: "독서 활동",
  haengteuk: "학교생활 및 인성",
  growth: "종합 성장 요약",
};

/** 내보내기용 섹션 (ActivitySummarySection보다 유연) */
export interface ExportSection {
  sectionType: string;
  title: string;
  content: string;
  relatedSubjects?: string[];
}

export interface ReportExportData {
  title: string;
  studentName: string;
  targetGrades: number[];
  createdAt: string;
  /** AI 생성 섹션 */
  sections: ExportSection[];
  /** 수동 편집 텍스트 (있으면 sections 대신 사용) */
  editedText?: string | null;

  // Phase F4: 종합 리포트 확장 필드 (optional)
  diagnosis?: {
    overallGrade: string;
    recordDirection: string;
    strengths: string[];
    weaknesses: string[];
    recommendedMajors: string[];
  } | null;
  competencyScores?: Array<{
    area: string;
    label: string;
    grade: string;
  }> | null;
  courseAdequacy?: {
    score: number;
    majorCategory: string;
    taken: string[];
    notTaken: string[];
    generalRate: number;
    careerRate: number;
  } | null;
  strategies?: Array<{
    targetArea: string;
    content: string;
    priority: string;
  }> | null;
}

// ============================================
// PDF 내보내기 (jspdf + html2canvas)
// ============================================

export async function exportReportAsPdf(data: ReportExportData): Promise<void> {
  const [{ default: jsPDF }, { default: html2canvas }] = await Promise.all([
    import("jspdf"),
    import("html2canvas"),
  ]);

  // 렌더링용 임시 DOM 생성
  const container = document.createElement("div");
  container.style.cssText =
    "position:absolute;left:-9999px;top:0;width:794px;padding:48px;background:white;font-family:sans-serif;color:#111;";
  container.innerHTML = buildReportHtml(data);
  document.body.appendChild(container);

  try {
    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      logging: false,
    });

    const imgWidth = 210; // A4 mm
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    const pageHeight = 297; // A4 mm

    const pdf = new jsPDF("p", "mm", "a4");
    let position = 0;

    // 여러 페이지 지원
    while (position < imgHeight) {
      if (position > 0) pdf.addPage();
      pdf.addImage(
        canvas.toDataURL("image/jpeg", 0.95),
        "JPEG",
        0,
        -position,
        imgWidth,
        imgHeight,
      );
      position += pageHeight;
    }

    const fileName = buildFileName(data, "pdf");
    pdf.save(fileName);
  } finally {
    document.body.removeChild(container);
  }
}

// ============================================
// Word 내보내기 (docx)
// ============================================

export async function exportReportAsDocx(data: ReportExportData): Promise<void> {
  const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } =
    await import("docx");
  const { saveAs } = await import("file-saver");

  const dateStr = formatDate(data.createdAt);
  const children: (typeof Paragraph.prototype)[] = [];

  // 제목
  children.push(
    new Paragraph({
      text: data.title,
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
    }),
  );

  // 부제: 학생명 / 학년 / 날짜
  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 },
      children: [
        new TextRun({
          text: `${data.studentName} · ${data.targetGrades.join(",")}학년 · ${dateStr}`,
          size: 20,
          color: "666666",
        }),
      ],
    }),
  );

  // 구분선
  children.push(
    new Paragraph({
      spacing: { after: 300 },
      border: { bottom: { style: "single" as const, size: 6, color: "333333" } },
    }),
  );

  if (data.editedText) {
    // 수동 편집 텍스트
    for (const line of data.editedText.split("\n")) {
      children.push(
        new Paragraph({
          children: [new TextRun({ text: line, size: 22 })],
          spacing: { after: 120 },
        }),
      );
    }
  } else {
    // F4: 종합 진단
    if (data.diagnosis) {
      const d = data.diagnosis;
      children.push(new Paragraph({ text: "종합 진단", heading: HeadingLevel.HEADING_2, spacing: { before: 300, after: 150 } }));
      children.push(new Paragraph({ children: [new TextRun({ text: `종합등급: ${d.overallGrade} · ${d.recordDirection}`, size: 22, bold: true })], spacing: { after: 100 } }));
      for (const s of d.strengths) {
        children.push(new Paragraph({ children: [new TextRun({ text: `✅ ${s}`, size: 20 })], spacing: { after: 60 } }));
      }
      for (const w of d.weaknesses) {
        children.push(new Paragraph({ children: [new TextRun({ text: `⚠️ ${w}`, size: 20 })], spacing: { after: 60 } }));
      }
      if (d.recommendedMajors.length > 0) {
        children.push(new Paragraph({ children: [new TextRun({ text: `추천 전공: ${d.recommendedMajors.join(", ")}`, size: 20, color: "666666" })], spacing: { after: 150 } }));
      }
    }

    // F4: 교과 이수 적합도
    if (data.courseAdequacy) {
      const ca = data.courseAdequacy;
      children.push(new Paragraph({ text: "교과 이수 적합도", heading: HeadingLevel.HEADING_2, spacing: { before: 300, after: 150 } }));
      children.push(new Paragraph({ children: [new TextRun({ text: `${ca.majorCategory} 계열 · 적합도 ${ca.score}% (일반 ${ca.generalRate}% / 진로 ${ca.careerRate}%)`, size: 22 })], spacing: { after: 80 } }));
      if (ca.taken.length > 0) children.push(new Paragraph({ children: [new TextRun({ text: `이수: ${ca.taken.join(", ")}`, size: 20 })], spacing: { after: 60 } }));
      if (ca.notTaken.length > 0) children.push(new Paragraph({ children: [new TextRun({ text: `미이수: ${ca.notTaken.join(", ")}`, size: 20, color: "CC0000" })], spacing: { after: 100 } }));
    }

    // F4: 보완 전략
    if (data.strategies && data.strategies.length > 0) {
      children.push(new Paragraph({ text: "보완 전략", heading: HeadingLevel.HEADING_2, spacing: { before: 300, after: 150 } }));
      for (const st of data.strategies) {
        children.push(new Paragraph({ children: [new TextRun({ text: `[${st.targetArea}] ${st.content}`, size: 20 })], spacing: { after: 80 } }));
      }
    }

    // 활동 요약서 섹션별 렌더링
    for (const sec of data.sections) {
      const label = SECTION_LABELS[sec.sectionType] ?? sec.title;
      const subtitle =
        sec.relatedSubjects && sec.relatedSubjects.length > 0
          ? ` (${sec.relatedSubjects.join(", ")})`
          : "";

      children.push(
        new Paragraph({
          text: label + subtitle,
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 300, after: 150 },
        }),
      );

      for (const line of sec.content.split("\n")) {
        if (!line.trim()) continue;
        children.push(
          new Paragraph({
            children: [new TextRun({ text: line, size: 22 })],
            spacing: { after: 100 },
          }),
        );
      }
    }
  }

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
          },
        },
        children,
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  const fileName = buildFileName(data, "docx");
  saveAs(blob, fileName);
}

// ============================================
// 내부 헬퍼
// ============================================

function buildReportHtml(data: ReportExportData): string {
  const dateStr = formatDate(data.createdAt);
  let body = "";

  body += `<div style="text-align:center;border-bottom:2px solid #222;padding-bottom:16px;margin-bottom:24px;">`;
  body += `<h1 style="font-size:22px;font-weight:bold;margin:0;">${escapeHtml(data.title)}</h1>`;
  body += `<p style="font-size:12px;color:#666;margin-top:8px;">${escapeHtml(data.studentName)} · ${data.targetGrades.join(",")}학년 · ${dateStr}</p>`;
  body += `</div>`;

  if (data.editedText) {
    body += `<div style="font-size:13px;line-height:1.8;white-space:pre-wrap;">${escapeHtml(data.editedText)}</div>`;
  } else {
    // F4: 종합 진단 섹션
    if (data.diagnosis) {
      const d = data.diagnosis;
      body += `<div style="margin-bottom:20px;">`;
      body += `<h2 style="font-size:15px;font-weight:600;border-bottom:1px solid #ddd;padding-bottom:4px;margin-bottom:8px;">종합 진단</h2>`;
      body += `<p style="font-size:13px;margin-bottom:6px;"><strong>종합등급:</strong> ${escapeHtml(d.overallGrade)} · ${escapeHtml(d.recordDirection)}</p>`;
      if (d.strengths.length > 0) {
        body += `<p style="font-size:13px;margin-bottom:4px;"><strong>강점:</strong></p><ul style="font-size:12px;margin:0 0 8px 16px;">`;
        for (const s of d.strengths) body += `<li>${escapeHtml(s)}</li>`;
        body += `</ul>`;
      }
      if (d.weaknesses.length > 0) {
        body += `<p style="font-size:13px;margin-bottom:4px;"><strong>약점:</strong></p><ul style="font-size:12px;margin:0 0 8px 16px;">`;
        for (const w of d.weaknesses) body += `<li>${escapeHtml(w)}</li>`;
        body += `</ul>`;
      }
      if (d.recommendedMajors.length > 0) {
        body += `<p style="font-size:12px;color:#666;">추천 전공: ${d.recommendedMajors.map(escapeHtml).join(", ")}</p>`;
      }
      body += `</div>`;
    }

    // F4: 역량 등급 섹션
    if (data.competencyScores && data.competencyScores.length > 0) {
      body += `<div style="margin-bottom:20px;">`;
      body += `<h2 style="font-size:15px;font-weight:600;border-bottom:1px solid #ddd;padding-bottom:4px;margin-bottom:8px;">역량 등급</h2>`;
      body += `<table style="font-size:12px;width:100%;border-collapse:collapse;">`;
      body += `<tr style="background:#f5f5f5;"><th style="padding:4px 8px;text-align:left;border:1px solid #ddd;">영역</th><th style="padding:4px 8px;text-align:left;border:1px solid #ddd;">항목</th><th style="padding:4px 8px;text-align:center;border:1px solid #ddd;">등급</th></tr>`;
      for (const cs of data.competencyScores) {
        body += `<tr><td style="padding:4px 8px;border:1px solid #ddd;">${escapeHtml(cs.area)}</td><td style="padding:4px 8px;border:1px solid #ddd;">${escapeHtml(cs.label)}</td><td style="padding:4px 8px;text-align:center;border:1px solid #ddd;">${escapeHtml(cs.grade)}</td></tr>`;
      }
      body += `</table></div>`;
    }

    // F4: 교과 이수 적합도 섹션
    if (data.courseAdequacy) {
      const ca = data.courseAdequacy;
      body += `<div style="margin-bottom:20px;">`;
      body += `<h2 style="font-size:15px;font-weight:600;border-bottom:1px solid #ddd;padding-bottom:4px;margin-bottom:8px;">교과 이수 적합도</h2>`;
      body += `<p style="font-size:13px;margin-bottom:6px;"><strong>${escapeHtml(ca.majorCategory)}</strong> 계열 · 적합도 <strong>${ca.score}%</strong> (일반 ${ca.generalRate}% / 진로 ${ca.careerRate}%)</p>`;
      if (ca.taken.length > 0) body += `<p style="font-size:12px;">이수: ${ca.taken.map(escapeHtml).join(", ")}</p>`;
      if (ca.notTaken.length > 0) body += `<p style="font-size:12px;color:#c00;">미이수: ${ca.notTaken.map(escapeHtml).join(", ")}</p>`;
      body += `</div>`;
    }

    // F4: 보완 전략 섹션
    if (data.strategies && data.strategies.length > 0) {
      body += `<div style="margin-bottom:20px;">`;
      body += `<h2 style="font-size:15px;font-weight:600;border-bottom:1px solid #ddd;padding-bottom:4px;margin-bottom:8px;">보완 전략</h2>`;
      for (const st of data.strategies) {
        const badge = st.priority === "critical" ? "🔴" : st.priority === "high" ? "🟠" : "🟡";
        body += `<p style="font-size:12px;margin-bottom:6px;">${badge} <strong>[${escapeHtml(st.targetArea)}]</strong> ${escapeHtml(st.content)}</p>`;
      }
      body += `</div>`;
    }

    // 활동 요약서 섹션
    for (const sec of data.sections) {
      const label = SECTION_LABELS[sec.sectionType] ?? sec.title;
      const subtitle =
        sec.relatedSubjects && sec.relatedSubjects.length > 0
          ? ` <span style="font-weight:normal;color:#999;">(${sec.relatedSubjects.join(", ")})</span>`
          : "";
      body += `<div style="margin-bottom:20px;">`;
      body += `<h2 style="font-size:15px;font-weight:600;border-bottom:1px solid #ddd;padding-bottom:4px;margin-bottom:8px;">${escapeHtml(label)}${subtitle}</h2>`;
      body += `<p style="font-size:13px;line-height:1.8;white-space:pre-wrap;">${escapeHtml(sec.content)}</p>`;
      body += `</div>`;
    }
  }

  return body;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`;
}

function buildFileName(data: ReportExportData, ext: string): string {
  const date = new Date(data.createdAt);
  const dateStr = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}`;
  return `${data.studentName}_${data.title}_${dateStr}.${ext}`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

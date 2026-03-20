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
    // 섹션별 렌더링
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

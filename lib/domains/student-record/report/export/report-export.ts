// ============================================
// E-3 — 리포트 PDF/Word 내보내기 (허브)
// 실제 구현은 각 책임별 파일에 위치:
//   report-transform.ts — 타입, 상수, 데이터 변환
//   report-docx.ts      — Word(DOCX) 내보내기
//   report-html.ts      — HTML 렌더러 (PDF용)
// ============================================

// 타입/상수/변환 함수 re-export (하위 호환)
export type { ExportSection, ReportExportData } from "./transform";
export {
  EDGE_TYPE_LABELS,
  AREA_LABELS,
  SECTION_LABELS,
  buildReportExportData,
  buildRoadmapForExport,
  buildEdgeSummaryForExport,
} from "./transform";

// DOCX re-export
export { exportReportAsDocx } from "./docx";

// HTML builder re-export
export { buildReportHtml } from "./html";

// ============================================
// PDF 내보내기 (jspdf + html2canvas)
// buildReportHtml에 의존하므로 이 파일에 유지
// ============================================

import { buildReportHtml } from "./html";
import type { ReportExportData } from "./transform";

export function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`;
}

export function buildFileName(data: ReportExportData, ext: string): string {
  const date = new Date(data.createdAt);
  const dateStr = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}`;
  return `${data.studentName}_${data.title}_${dateStr}.${ext}`;
}

export async function exportReportAsPdf(data: ReportExportData): Promise<void> {
  const [{ default: jsPDF }, { default: html2canvas }] = await Promise.all([
    import("jspdf"),
    import("html2canvas"),
  ]);

  // 렌더링용 임시 DOM 생성
  // font-family: CSS 변수 --font-noto-serif(Noto Serif KR)를 우선 적용하여 한글 깨짐 방지.
  // Next.js가 Noto_Serif_KR을 이미 로드하므로 별도 CDN link 불필요.
  const container = document.createElement("div");
  container.style.cssText =
    "position:absolute;left:-9999px;top:0;width:794px;padding:48px;background:white;font-family:var(--font-noto-serif),'Noto Serif KR','Noto Sans KR',sans-serif;color:#111;";
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

// ============================================
// 가이드 PDF/DOCX 내보내기
// ============================================

import type {
  GuideType,
  GuideDetail,
  ContentSection,
  OutlineItem,
  RelatedPaper,
} from "../types";
import { GUIDE_TYPE_LABELS } from "../types";
import {
  GUIDE_SECTION_CONFIG,
  resolveContentSections,
} from "../section-config";

export type ExportFormat = "prose" | "outline" | "both";

export interface GuideExportOptions {
  /** 포함할 섹션 키 */
  selectedSectionKeys: string[];
  /** 도서 정보 포함 */
  includeBookInfo?: boolean;
  /** 관련 논문 포함 */
  includeRelatedPapers?: boolean;
  /** 관련 도서 포함 */
  includeRelatedBooks?: boolean;
  /** 내보내기 형식 (기본: both) */
  exportFormat?: ExportFormat;
}

// ============================================
// PDF 내보내기 (jspdf + html2canvas)
// ============================================

export async function exportGuideAsPdf(
  guide: GuideDetail,
  options: GuideExportOptions,
): Promise<void> {
  const [{ default: jsPDF }, { default: html2canvas }] = await Promise.all([
    import("jspdf"),
    import("html2canvas"),
  ]);

  // PDF 페이지 여백 (mm)
  const marginTop = 15;
  const marginBottom = 15;
  const marginLR = 12;

  const container = document.createElement("div");
  container.style.cssText =
    "position:absolute;left:-9999px;top:0;width:794px;padding:64px 56px;background:white;font-family:'Pretendard',sans-serif;color:#111;";
  container.innerHTML = buildGuideHtml(guide, options);
  document.body.appendChild(container);

  try {
    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      logging: false,
    });

    const pdf = new jsPDF("p", "mm", "a4");
    const pdfWidth = 210;
    const pdfPageHeight = 297;
    const contentWidth = pdfWidth - marginLR * 2;
    const contentHeight = pdfPageHeight - marginTop - marginBottom;

    // 캔버스 1px = PDF mm 변환 비율
    const ratio = contentWidth / canvas.width;
    const canvasPageHeight = Math.floor(contentHeight / ratio);

    // 페이지 경계에서 안전한 분할점 찾기
    const breakPoints = findSafeBreakPoints(canvas, canvasPageHeight);
    const pageCanvas = document.createElement("canvas");
    const pageCtx = pageCanvas.getContext("2d")!;

    for (let i = 0; i < breakPoints.length; i++) {
      const yStart = i === 0 ? 0 : breakPoints[i - 1];
      const yEnd = breakPoints[i];
      const sliceHeight = yEnd - yStart;

      if (sliceHeight <= 0) continue;
      if (i > 0) pdf.addPage();

      // 페이지 단위 캔버스 생성
      pageCanvas.width = canvas.width;
      pageCanvas.height = sliceHeight;
      pageCtx.fillStyle = "#fff";
      pageCtx.fillRect(0, 0, pageCanvas.width, sliceHeight);
      pageCtx.drawImage(
        canvas,
        0, yStart, canvas.width, sliceHeight,
        0, 0, canvas.width, sliceHeight,
      );

      const imgData = pageCanvas.toDataURL("image/jpeg", 0.95);
      const sliceHeightMm = sliceHeight * ratio;
      pdf.addImage(imgData, "JPEG", marginLR, marginTop, contentWidth, sliceHeightMm);
    }

    pdf.save(buildFileName(guide.title, "pdf"));
  } finally {
    document.body.removeChild(container);
  }
}

/**
 * 캔버스에서 안전한 페이지 분할점을 찾는다.
 * 페이지 경계 근처(±탐색범위)에서 "가장 흰" 행을 찾아 그곳에서 분할.
 */
function findSafeBreakPoints(
  canvas: HTMLCanvasElement,
  pageHeight: number,
): number[] {
  const ctx = canvas.getContext("2d")!;
  const breaks: number[] = [];
  const searchRange = Math.floor(pageHeight * 0.08); // 페이지 높이의 8% 탐색
  let cursor = 0;

  while (cursor + pageHeight < canvas.height) {
    const idealBreak = cursor + pageHeight;
    const scanStart = Math.max(cursor + 1, idealBreak - searchRange);
    const scanEnd = Math.min(canvas.height, idealBreak + searchRange);

    let bestRow = idealBreak;
    let bestWhiteness = -1;

    // 각 행의 "흰색 정도" 측정 — 흰색에 가까울수록 안전한 분할점
    for (let y = scanStart; y < scanEnd; y++) {
      const rowData = ctx.getImageData(0, y, canvas.width, 1).data;
      let whiteness = 0;
      for (let x = 0; x < rowData.length; x += 4) {
        // R, G, B 모두 240+ 이면 거의 흰색
        if (rowData[x] > 240 && rowData[x + 1] > 240 && rowData[x + 2] > 240) {
          whiteness++;
        }
      }
      if (whiteness > bestWhiteness) {
        bestWhiteness = whiteness;
        bestRow = y;
      }
    }

    breaks.push(bestRow);
    cursor = bestRow;
  }

  // 마지막 페이지
  breaks.push(canvas.height);
  return breaks;
}

// ============================================
// Word 내보내기 (docx)
// ============================================

export async function exportGuideAsDocx(
  guide: GuideDetail,
  options: GuideExportOptions,
): Promise<void> {
  const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } =
    await import("docx");
  const { saveAs } = await import("file-saver");

  const children: InstanceType<typeof Paragraph>[] = [];
  const sections = guide.content
    ? resolveContentSections(guide.guide_type, guide.content)
    : [];
  const config = GUIDE_SECTION_CONFIG[guide.guide_type] ?? [];

  // 제목
  children.push(
    new Paragraph({
      text: guide.title,
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
    }),
  );

  // 부제
  const subtitle = [
    GUIDE_TYPE_LABELS[guide.guide_type],
    guide.curriculum_year && `${guide.curriculum_year} 개정`,
    guide.subject_area,
    guide.subject_select,
  ]
    .filter(Boolean)
    .join(" · ");

  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 },
      children: [
        new TextRun({ text: subtitle, size: 20, color: "666666" }),
      ],
    }),
  );

  // 구분선
  children.push(
    new Paragraph({
      spacing: { after: 300 },
      border: {
        bottom: { style: "single" as const, size: 6, color: "333333" },
      },
    }),
  );

  // 도서 정보
  if (options.includeBookInfo && guide.book_title) {
    children.push(
      new Paragraph({
        spacing: { after: 200 },
        children: [
          new TextRun({ text: guide.book_title, size: 24, bold: true }),
          new TextRun({
            text: ` — ${[guide.book_author, guide.book_publisher].filter(Boolean).join(" / ")}`,
            size: 20,
            color: "666666",
          }),
        ],
      }),
    );
  }

  // 섹션별 렌더링
  for (const def of config.filter((d) => !d.adminOnly).sort((a, b) => a.order - b.order)) {
    if (!options.selectedSectionKeys.includes(def.key)) continue;

    const matching = sections.filter((s) => s.key === def.key);
    if (matching.length === 0) continue;

    children.push(
      new Paragraph({
        text: def.label,
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 300, after: 150 },
      }),
    );

    for (const sec of matching) {
      if (sec.label && sec.label !== def.label) {
        children.push(
          new Paragraph({
            children: [
              new TextRun({ text: sec.label, size: 22, bold: true }),
            ],
            spacing: { after: 80 },
          }),
        );
      }

      // 통합 뷰: outline 대주제별로 하위 항목 + prose 인라인
      if (sec.outline && sec.outline.length > 0) {
        const groups = groupOutlineByDepth0(sec.outline);
        const proseChunks = splitProseForExport(
          stripHtml(sec.content),
          groups.length,
        );

        for (let gi = 0; gi < groups.length; gi++) {
          const group = groups[gi];

          // depth=0 대주제
          children.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: `${gi + 1}. ${group.heading.text}`,
                  size: 22,
                  bold: true,
                }),
              ],
              spacing: { before: 200, after: 80 },
            }),
          );
          pushTipAndResources(children, group.heading, TextRun, Paragraph);

          // depth=1,2 하위 항목
          for (const child of group.children) {
            const indent = (child.depth - 1) * 360 + 360;
            const bullet = child.depth === 1 ? "├─" : "·";
            const runs: InstanceType<typeof TextRun>[] = [
              new TextRun({
                text: `${bullet} ${child.text}`,
                size: child.depth === 1 ? 21 : 20,
                bold: child.depth === 1,
              }),
            ];
            children.push(
              new Paragraph({
                children: runs,
                indent: { left: indent },
                spacing: { after: 30 },
              }),
            );
            pushTipAndResources(children, child, TextRun, Paragraph, indent);
          }

          // prose 인라인
          if (proseChunks[gi]) {
            children.push(
              new Paragraph({
                spacing: { before: 60, after: 20 },
                border: {
                  left: { style: "single" as const, size: 6, color: "93C5FD" },
                },
                indent: { left: 360 },
                children: [],
              }),
            );
            for (const line of proseChunks[gi].split("\n")) {
              if (!line.trim()) continue;
              children.push(
                new Paragraph({
                  children: [
                    new TextRun({ text: line, size: 20, color: "374151" }),
                  ],
                  indent: { left: 360 },
                  spacing: { after: 60 },
                }),
              );
            }
          }
        }
      } else {
        // outline이 없는 섹션: 기존 prose 렌더링
        if (sec.items && sec.items.length > 0) {
          for (const item of sec.items) {
            children.push(
              new Paragraph({
                children: [new TextRun({ text: `• ${item}`, size: 22 })],
                spacing: { after: 60 },
              }),
            );
          }
        } else {
          const text = stripHtml(sec.content);
          for (const line of text.split("\n")) {
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
    }
  }

  // 관련 논문
  if (options.includeRelatedPapers && guide.content?.related_papers?.length) {
    children.push(
      new Paragraph({
        text: "관련 논문",
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 300, after: 150 },
      }),
    );
    for (const paper of guide.content.related_papers as RelatedPaper[]) {
      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: paper.title, size: 22, bold: true }),
            ...(paper.url
              ? [new TextRun({ text: ` (${paper.url})`, size: 20, color: "0066CC" })]
              : []),
          ],
          spacing: { after: 60 },
        }),
      );
      if (paper.summary) {
        children.push(
          new Paragraph({
            children: [new TextRun({ text: paper.summary, size: 20 })],
            spacing: { after: 100 },
          }),
        );
      }
    }
  }

  // 관련 도서
  if (options.includeRelatedBooks && guide.content?.related_books?.length) {
    children.push(
      new Paragraph({
        text: "관련 도서",
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 300, after: 150 },
      }),
    );
    for (const book of guide.content.related_books) {
      children.push(
        new Paragraph({
          children: [new TextRun({ text: `• ${book}`, size: 22 })],
          spacing: { after: 60 },
        }),
      );
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
  saveAs(blob, buildFileName(guide.title, "docx"));
}

// ============================================
// HTML 빌더 (PDF용)
// ============================================

function buildGuideHtml(
  guide: GuideDetail,
  options: GuideExportOptions,
): string {
  const sections = guide.content
    ? resolveContentSections(guide.guide_type, guide.content)
    : [];
  const config = GUIDE_SECTION_CONFIG[guide.guide_type] ?? [];

  let html = "";

  // 헤더
  html += `<div style="text-align:center;border-bottom:2px solid #222;padding-bottom:16px;margin-bottom:24px;">`;
  html += `<h1 style="font-size:22px;font-weight:bold;margin:0;">${esc(guide.title)}</h1>`;

  const subtitle = [
    GUIDE_TYPE_LABELS[guide.guide_type],
    guide.curriculum_year && `${guide.curriculum_year} 개정`,
    guide.subject_area,
    guide.subject_select,
  ]
    .filter(Boolean)
    .join(" · ");

  html += `<p style="font-size:12px;color:#666;margin-top:8px;">${esc(subtitle)}</p>`;
  html += `</div>`;

  // 도서 정보
  if (options.includeBookInfo && guide.book_title) {
    html += `<div style="background:#fffbeb;border-radius:8px;padding:12px 16px;margin-bottom:20px;">`;
    html += `<p style="font-size:14px;font-weight:600;margin:0;">${esc(guide.book_title)}</p>`;
    html += `<p style="font-size:12px;color:#92400e;margin:4px 0 0;">${esc([guide.book_author, guide.book_publisher].filter(Boolean).join(" / "))}</p>`;
    html += `</div>`;
  }

  // 섹션별 렌더링
  for (const def of config.filter((d) => !d.adminOnly).sort((a, b) => a.order - b.order)) {
    if (!options.selectedSectionKeys.includes(def.key)) continue;

    const matching = sections.filter((s) => s.key === def.key);
    if (matching.length === 0) continue;

    html += `<div style="margin-bottom:20px;">`;
    html += `<h2 style="font-size:15px;font-weight:600;border-bottom:1px solid #ddd;padding-bottom:4px;margin-bottom:8px;">${esc(def.label)}</h2>`;

    for (const sec of matching) {
      if (sec.label && sec.label !== def.label) {
        html += `<p style="font-size:13px;font-weight:600;margin-bottom:4px;">${esc(sec.label)}</p>`;
      }

      // 통합 뷰: outline 대주제별로 하위 항목 + prose 인라인
      if (sec.outline && sec.outline.length > 0) {
        const groups = groupOutlineByDepth0(sec.outline);
        const plainProse = sec.content_format === "html" || sec.content.startsWith("<")
          ? sec.content.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim()
          : sec.content;
        const proseChunks = splitProseForExport(plainProse, groups.length);

        for (let gi = 0; gi < groups.length; gi++) {
          const group = groups[gi];
          // 대주제
          html += `<div style="margin-top:12px;">`;
          html += `<p style="font-size:14px;font-weight:bold;margin-bottom:4px;"><span style="display:inline-flex;align-items:center;justify-content:center;width:20px;height:20px;border-radius:50%;background:#EBF5FF;color:#1A56DB;font-size:11px;font-weight:bold;margin-right:6px;">${gi + 1}</span>${esc(group.heading.text)}</p>`;
          // tip/resources
          html += renderTipResourcesHtml(group.heading);
          // 하위 항목
          for (const child of group.children) {
            const ml = (child.depth - 1) * 16 + 24;
            const fs = child.depth === 1 ? 12 : 11;
            const fw = child.depth === 1 ? "500" : "normal";
            html += `<div style="margin-left:${ml}px;font-size:${fs}px;font-weight:${fw};line-height:1.5;color:#374151;">› ${esc(child.text)}</div>`;
            html += renderTipResourcesHtml(child, ml);
          }
          // prose 인라인
          if (proseChunks[gi]) {
            html += `<div style="margin:8px 0 4px 24px;padding:8px 12px;border-left:3px solid #93C5FD;background:#F0F7FF;font-size:12px;line-height:1.7;color:#374151;">${esc(proseChunks[gi])}</div>`;
          }
          html += `</div>`;
        }
      } else {
        // outline이 없는 섹션
        if (sec.items && sec.items.length > 0) {
          html += `<ul style="font-size:13px;margin:0 0 8px 16px;">`;
          for (const item of sec.items) {
            html += `<li>${esc(item)}</li>`;
          }
          html += `</ul>`;
        } else if (sec.content_format === "html" || sec.content.startsWith("<")) {
          html += `<div style="font-size:13px;line-height:1.8;">${sec.content}</div>`;
        } else {
          html += `<p style="font-size:13px;line-height:1.8;white-space:pre-wrap;">${esc(sec.content)}</p>`;
        }
      }

      // 이미지
      if (sec.images && sec.images.length > 0) {
        for (const img of sec.images) {
          html += `<div style="margin:8px 0;">`;
          html += `<img src="${esc(img.url)}" style="max-width:100%;border-radius:4px;" crossorigin="anonymous" />`;
          if (img.caption) {
            html += `<p style="font-size:11px;color:#666;margin-top:4px;">${esc(img.caption)}</p>`;
          }
          html += `</div>`;
        }
      }
    }
    html += `</div>`;
  }

  // 관련 논문
  if (options.includeRelatedPapers && guide.content?.related_papers?.length) {
    html += `<div style="margin-bottom:20px;">`;
    html += `<h2 style="font-size:15px;font-weight:600;border-bottom:1px solid #ddd;padding-bottom:4px;margin-bottom:8px;">관련 논문</h2>`;
    for (const paper of guide.content.related_papers as RelatedPaper[]) {
      html += `<p style="font-size:13px;margin-bottom:6px;"><strong>${esc(paper.title)}</strong>`;
      if (paper.url) html += ` <span style="color:#06c;">(${esc(paper.url)})</span>`;
      html += `</p>`;
      if (paper.summary) {
        html += `<p style="font-size:12px;color:#666;margin-bottom:8px;">${esc(paper.summary)}</p>`;
      }
    }
    html += `</div>`;
  }

  // 관련 도서
  if (options.includeRelatedBooks && guide.content?.related_books?.length) {
    html += `<div style="margin-bottom:20px;">`;
    html += `<h2 style="font-size:15px;font-weight:600;border-bottom:1px solid #ddd;padding-bottom:4px;margin-bottom:8px;">관련 도서</h2>`;
    html += `<ul style="font-size:13px;margin:0 0 8px 16px;">`;
    for (const book of guide.content.related_books) {
      html += `<li>${esc(book)}</li>`;
    }
    html += `</ul>`;
    html += `</div>`;
  }

  return html;
}

// ============================================
// 헬퍼
// ============================================

// ============================================
// 통합 뷰 헬퍼 (outline 그룹화 + prose 분할)
// ============================================

interface OutlineGroup {
  heading: OutlineItem;
  children: OutlineItem[];
}

function groupOutlineByDepth0(items: OutlineItem[]): OutlineGroup[] {
  const groups: OutlineGroup[] = [];
  let current: OutlineGroup | null = null;
  for (const item of items) {
    if (item.depth === 0) {
      current = { heading: item, children: [] };
      groups.push(current);
    } else if (current) {
      current.children.push(item);
    }
  }
  if (groups.length === 0 && items.length > 0) {
    groups.push({ heading: { depth: 0, text: items[0].text }, children: items.slice(1) });
  }
  return groups;
}

function splitProseForExport(text: string, groupCount: number): string[] {
  if (groupCount <= 1) return [text];
  const paragraphs = text.split(/\n\n+/).filter((p) => p.trim());
  if (paragraphs.length <= groupCount) {
    const result: string[] = [];
    for (let i = 0; i < groupCount; i++) result.push(paragraphs[i] ?? "");
    return result;
  }
  const perGroup = Math.ceil(paragraphs.length / groupCount);
  const result: string[] = [];
  for (let i = 0; i < groupCount; i++) {
    result.push(paragraphs.slice(i * perGroup, (i + 1) * perGroup).join("\n\n"));
  }
  return result;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function pushTipAndResources(children: any[], item: OutlineItem, TextRun: any, Paragraph: any, indent = 360) {
  if (item.tip) {
    children.push(
      new Paragraph({
        children: [new TextRun({ text: `  💡 ${item.tip}`, size: 18, color: "D97306", italics: true })],
        indent: { left: indent },
        spacing: { after: 20 },
      }),
    );
  }
  if (item.resources?.length) {
    children.push(
      new Paragraph({
        children: [new TextRun({ text: `  📚 ${item.resources.join(", ")}`, size: 18, color: "1D6FA5" })],
        indent: { left: indent },
        spacing: { after: 20 },
      }),
    );
  }
}

function renderTipResourcesHtml(item: OutlineItem, ml = 24): string {
  let html = "";
  if (item.tip) {
    html += `<div style="margin-left:${ml}px;font-size:11px;color:#D97306;font-style:italic;">💡 ${esc(item.tip)}</div>`;
  }
  if (item.resources?.length) {
    html += `<div style="margin-left:${ml}px;font-size:11px;color:#1D6FA5;">📚 ${esc(item.resources.join(", "))}</div>`;
  }
  return html;
}

function esc(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function stripHtml(html: string): string {
  const div = document.createElement("div");
  div.innerHTML = html;
  return div.textContent ?? "";
}

function buildFileName(title: string, ext: string): string {
  const now = new Date();
  const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
  const safeTitle = title.replace(/[/\\?%*:|"<>]/g, "_").slice(0, 40);
  return `${safeTitle}_${dateStr}.${ext}`;
}

/** 가이드에서 내보내기 가능한 섹션 키 목록 (adminOnly 제외) */
export function getExportableSectionKeys(
  guideType: GuideType,
): Array<{ key: string; label: string }> {
  return (GUIDE_SECTION_CONFIG[guideType] ?? [])
    .filter((d) => !d.adminOnly)
    .sort((a, b) => a.order - b.order)
    .map((d) => ({ key: d.key, label: d.label }));
}

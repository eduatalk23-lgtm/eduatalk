// ============================================
// 클라이언트 파일 콘텐츠 추출기
// PDF → 페이지별 이미지, HTML → 텍스트, Image → base64
// 브라우저에서 실행 (Vercel 타임아웃 회피)
// ============================================

import type { ExtractedContent, ImportFileFormat } from "./types";

const ACCEPTED_EXTENSIONS: Record<ImportFileFormat, string[]> = {
  pdf: [".pdf"],
  html: [".html", ".htm"],
  image: [".png", ".jpg", ".jpeg", ".webp"],
};

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

/** MIME 타입/확장자로 파일 형식 판별 */
export function detectFileFormat(file: File): ImportFileFormat | null {
  const ext = `.${file.name.split(".").pop()?.toLowerCase()}`;

  for (const [format, exts] of Object.entries(ACCEPTED_EXTENSIONS)) {
    if (exts.includes(ext)) return format as ImportFileFormat;
  }

  if (file.type === "application/pdf") return "pdf";
  if (file.type === "text/html") return "html";
  if (file.type.startsWith("image/")) return "image";

  return null;
}

/** 지원 파일 타입 accept 문자열 */
export const ACCEPT_FILE_TYPES = ".pdf,.html,.htm,.png,.jpg,.jpeg,.webp";

/** 파일 유효성 검사 */
export function validateImportFile(file: File): string | null {
  if (file.size > MAX_FILE_SIZE) {
    return `파일 크기가 50MB를 초과합니다 (${(file.size / 1024 / 1024).toFixed(1)}MB)`;
  }

  const format = detectFileFormat(file);
  if (!format) {
    return `지원하지 않는 파일 형식입니다. PDF, HTML, 이미지(PNG/JPG) 파일을 선택해주세요.`;
  }

  return null;
}

/** 파일에서 콘텐츠 추출 (클라이언트 실행) */
export async function extractContent(
  file: File,
  onProgress?: (percent: number) => void,
): Promise<ExtractedContent> {
  const format = detectFileFormat(file);
  if (!format) throw new Error("지원하지 않는 파일 형식입니다.");

  switch (format) {
    case "pdf":
      return extractFromPdf(file, onProgress);
    case "html":
      return extractFromHtml(file);
    case "image":
      return extractFromImage(file);
  }
}

// ============================================
// PDF 추출: pdfjs-dist → 페이지별 base64 이미지
// ============================================

async function extractFromPdf(
  file: File,
  onProgress?: (percent: number) => void,
): Promise<ExtractedContent> {
  const pdfjsLib = await import("pdfjs-dist");

  // public 디렉토리의 워커 사용 (.js 확장자 — Next.js MIME 호환)
  pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.js";

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const totalPages = pdf.numPages;
  const pages: string[] = [];

  for (let i = 1; i <= totalPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: 2.0 }); // 원본 변환기 기준 (OCR 정확도)

    const canvas = document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;

    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas context를 생성할 수 없습니다.");

    await page.render({ canvas, viewport }).promise;

    // base64 이미지 (data URL prefix 제거)
    // PNG (클라이언트→Gemini 직접 전송이므로 무손실 품질 사용)
    const dataUrl = canvas.toDataURL("image/png");
    pages.push(dataUrl.split(",")[1]);

    onProgress?.(Math.round((i / totalPages) * 100));
  }

  return { format: "pdf", pages };
}

// ============================================
// HTML 추출: 텍스트 직접 추출
// ============================================

async function extractFromHtml(file: File): Promise<ExtractedContent> {
  const htmlContent = await file.text();

  // DOMParser로 텍스트 추출 (스크립트/스타일 제거)
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlContent, "text/html");

  // 불필요한 태그 제거
  doc.querySelectorAll("script, style, noscript").forEach((el) => el.remove());

  // 테이블 구조 보존 (NEIS 생기부는 테이블 기반)
  const text = preserveTableStructure(doc.body);

  return { format: "html", text };
}

/** 테이블 구조를 텍스트로 변환 (행/열 구분 유지) */
function preserveTableStructure(element: Element): string {
  const lines: string[] = [];

  function walk(node: Node) {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent?.trim();
      if (text) lines.push(text);
      return;
    }

    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const el = node as Element;
    const tag = el.tagName.toLowerCase();

    if (tag === "tr") {
      const cells: string[] = [];
      el.querySelectorAll("td, th").forEach((cell) => {
        cells.push(cell.textContent?.trim() ?? "");
      });
      if (cells.some(Boolean)) lines.push(cells.join(" | "));
      return;
    }

    if (tag === "br" || tag === "p" || tag === "div") {
      lines.push("");
    }

    for (const child of node.childNodes) {
      walk(child);
    }
  }

  walk(element);

  return lines
    .map((l) => l.trim())
    .filter(Boolean)
    .join("\n");
}

// ============================================
// 이미지 추출: base64 인코딩
// ============================================

async function extractFromImage(file: File): Promise<ExtractedContent> {
  const arrayBuffer = await file.arrayBuffer();
  const base64 = arrayBufferToBase64(arrayBuffer);
  return { format: "image", images: [base64] };
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

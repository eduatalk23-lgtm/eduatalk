// ============================================
// C3.1 — PDF 텍스트 추출 (pdf-parse v2 API)
// ============================================

import { PDFParse } from "pdf-parse";
import { logActionDebug } from "@/lib/logging/actionLogger";

const LOG_CTX = { domain: "guide", action: "pdf-extractor" };

/** PDF 추출 결과 */
export interface PDFExtractionResult {
  text: string;
  pageCount: number;
  title?: string;
}

/** 최대 추출 텍스트 길이 (약 20,000자 — Gemini 컨텍스트 고려) */
const MAX_TEXT_LENGTH = 20_000;

/** 최대 파싱 페이지 수 */
const MAX_PAGES = 50;

/**
 * URL에서 PDF를 다운로드하고 텍스트를 추출합니다.
 * @param pdfUrl PDF 파일 URL (https:// 또는 Supabase Storage URL)
 * @returns 추출된 텍스트 + 메타데이터
 */
export async function extractTextFromPdfUrl(
  pdfUrl: string,
): Promise<PDFExtractionResult> {
  logActionDebug(LOG_CTX, `Fetching PDF: ${pdfUrl}`);

  const response = await fetch(pdfUrl, {
    signal: AbortSignal.timeout(30_000),
  });

  if (!response.ok) {
    throw new Error(`PDF 다운로드 실패: ${response.status} ${response.statusText}`);
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("pdf") && !contentType.includes("octet-stream")) {
    throw new Error(
      `PDF 형식이 아닙니다 (Content-Type: ${contentType})`,
    );
  }

  const buffer = await response.arrayBuffer();
  return extractTextFromBuffer(new Uint8Array(buffer));
}

/**
 * PDF Buffer에서 텍스트를 추출합니다. (pdf-parse v2 API)
 */
export async function extractTextFromBuffer(
  data: Uint8Array,
): Promise<PDFExtractionResult> {
  const parser = new PDFParse({ data });

  // 텍스트 추출 (최대 MAX_PAGES 페이지)
  const textResult = await parser.getText({ first: MAX_PAGES } as Record<string, unknown>);

  let text = textResult.text.trim();

  // 빈 PDF 체크
  if (!text || text.length < 50) {
    parser.destroy();
    throw new Error("PDF에서 텍스트를 추출할 수 없습니다. 스캔 PDF이거나 빈 문서일 수 있습니다.");
  }

  // 메타데이터 추출
  let title: string | undefined;
  try {
    const infoResult = await parser.getInfo();
    title = infoResult.info?.Title || undefined;
  } catch {
    // 메타데이터 추출 실패해도 무시
  }

  parser.destroy();

  // 연속 공백/줄바꿈 정리
  text = text
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ");

  // 길이 제한
  if (text.length > MAX_TEXT_LENGTH) {
    logActionDebug(LOG_CTX, `Truncating PDF text: ${text.length} → ${MAX_TEXT_LENGTH}`);
    text = text.slice(0, MAX_TEXT_LENGTH) + "\n\n[... 이하 생략 ...]";
  }

  return {
    text,
    pageCount: textResult.total,
    title,
  };
}

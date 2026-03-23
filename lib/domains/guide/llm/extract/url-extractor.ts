// ============================================
// C3.1 — URL 콘텐츠 추출
// ============================================

import { logActionDebug } from "@/lib/logging/actionLogger";

const LOG_CTX = { domain: "guide", action: "url-extractor" };

/** URL 추출 결과 */
export interface URLExtractionResult {
  text: string;
  title?: string;
  url: string;
}

/** 최대 추출 텍스트 길이 */
const MAX_TEXT_LENGTH = 15_000;

/** 차단 도메인/IP 패턴 (SSRF 방어) */
const BLOCKED_PATTERNS = [
  /^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.)/, // 사설 IP (RFC 1918)
  /localhost/i,
  /127\.\d+\.\d+\.\d+/,       // loopback 전체
  /^0\.0\.0\.0/,               // 와일드카드
  /\[?::1\]?/,                 // IPv6 loopback
  /::ffff:/i,                  // IPv4-mapped IPv6
  /\[?fe80:/i,                 // IPv6 link-local
  /169\.254\.\d+\.\d+/,       // AWS/GCP 메타데이터 (link-local)
  /metadata\.google\.internal/i, // GCP 메타데이터
];

/**
 * URL에서 웹페이지 텍스트를 추출합니다.
 * HTML 태그를 제거하고 본문 텍스트만 반환합니다.
 */
export async function extractTextFromUrl(
  url: string,
): Promise<URLExtractionResult> {
  // URL 검증
  const parsed = new URL(url);
  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("HTTP/HTTPS URL만 지원합니다.");
  }

  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(parsed.hostname)) {
      throw new Error("허용되지 않는 URL입니다.");
    }
  }

  logActionDebug(LOG_CTX, `Fetching URL: ${url}`);

  const response = await fetch(url, {
    signal: AbortSignal.timeout(15_000),
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; TimeLevelUp-Bot/1.0)",
      Accept: "text/html,application/xhtml+xml,text/plain",
    },
  });

  if (!response.ok) {
    throw new Error(`페이지를 가져올 수 없습니다: ${response.status} ${response.statusText}`);
  }

  const html = await response.text();
  const title = extractTitle(html);
  let text = extractMainText(html);

  if (!text || text.length < 50) {
    throw new Error("페이지에서 충분한 텍스트를 추출할 수 없습니다.");
  }

  if (text.length > MAX_TEXT_LENGTH) {
    logActionDebug(LOG_CTX, `Truncating URL text: ${text.length} → ${MAX_TEXT_LENGTH}`);
    text = text.slice(0, MAX_TEXT_LENGTH) + "\n\n[... 이하 생략 ...]";
  }

  return { text, title, url };
}

/** HTML에서 <title> 추출 */
function extractTitle(html: string): string | undefined {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match ? decodeHtmlEntities(match[1].trim()) : undefined;
}

/** HTML에서 본문 텍스트 추출 (태그 제거) */
function extractMainText(html: string): string {
  let text = html;

  // script, style, nav, header, footer, aside 제거
  text = text.replace(
    /<(script|style|nav|header|footer|aside|noscript|iframe|svg)[^>]*>[\s\S]*?<\/\1>/gi,
    "",
  );

  // HTML 주석 제거
  text = text.replace(/<!--[\s\S]*?-->/g, "");

  // 블록 태그를 줄바꿈으로 변환
  text = text.replace(/<\/(p|div|h[1-6]|li|tr|br|blockquote|section|article)[^>]*>/gi, "\n");
  text = text.replace(/<br\s*\/?>/gi, "\n");

  // 나머지 태그 제거
  text = text.replace(/<[^>]+>/g, " ");

  // HTML 엔티티 디코딩
  text = decodeHtmlEntities(text);

  // 정리
  text = text
    .replace(/[ \t]+/g, " ")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return text;
}

/** HTML 엔티티 디코딩 */
function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

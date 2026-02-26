import type { ChatLinkPreviewInsert } from "./types";

/** URL 추출 정규식 */
const URL_REGEX = /https?:\/\/[^\s<>"{}|\\^`[\]]+/g;

/** 메시지 내용에서 URL 추출 */
export function extractUrls(content: string): string[] {
  const matches = content.match(URL_REGEX);
  if (!matches) return [];

  // 중복 제거, 최대 3개
  return [...new Set(matches)].slice(0, 3);
}

/** OG 메타 태그에서 content 값 추출 */
function extractMetaContent(html: string, property: string): string | null {
  // og:title, og:description 등 - property 속성
  const ogRegex = new RegExp(
    `<meta[^>]*property=["']${escapeRegex(property)}["'][^>]*content=["']([^"']*)["']`,
    "i"
  );
  const ogMatch = html.match(ogRegex);
  if (ogMatch?.[1]) return decodeHtmlEntities(ogMatch[1]);

  // content가 property 앞에 올 수도 있음
  const reverseRegex = new RegExp(
    `<meta[^>]*content=["']([^"']*)["'][^>]*property=["']${escapeRegex(property)}["']`,
    "i"
  );
  const reverseMatch = html.match(reverseRegex);
  if (reverseMatch?.[1]) return decodeHtmlEntities(reverseMatch[1]);

  // name 속성으로도 시도 (description 등)
  const nameRegex = new RegExp(
    `<meta[^>]*name=["']${escapeRegex(property)}["'][^>]*content=["']([^"']*)["']`,
    "i"
  );
  const nameMatch = html.match(nameRegex);
  if (nameMatch?.[1]) return decodeHtmlEntities(nameMatch[1]);

  return null;
}

/** <title> 태그에서 제목 추출 */
function extractTitle(html: string): string | null {
  const match = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  return match?.[1] ? decodeHtmlEntities(match[1].trim()) : null;
}

/** HTML 엔티티 디코딩 */
function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, "/");
}

/** 정규식 특수문자 이스케이프 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** 상대 URL을 절대 URL로 변환 */
function resolveUrl(base: string, relative: string | null): string | null {
  if (!relative) return null;
  if (relative.startsWith("http://") || relative.startsWith("https://")) return relative;
  if (relative.startsWith("//")) return `https:${relative}`;

  try {
    return new URL(relative, base).href;
  } catch {
    return null;
  }
}

// ============================================
// Rate Limiting (서버 사이드, 슬라이딩 윈도우)
// ============================================

/** 글로벌 요청 제한 (분당) */
const RATE_LIMIT_PER_MINUTE = 30;
/** 동일 URL 캐시 TTL (밀리초) — 같은 URL 중복 페치 방지 */
const URL_CACHE_TTL = 10 * 60 * 1000; // 10분

/** 슬라이딩 윈도우 타임스탬프 */
const requestTimestamps: number[] = [];

/** URL → 결과 캐시 (중복 요청 방지) */
const urlCache = new Map<string, { result: Omit<ChatLinkPreviewInsert, "message_id"> | null; expiresAt: number }>();

/** Rate limit 체크 (슬라이딩 윈도우) */
function checkRateLimit(): boolean {
  const now = Date.now();
  const windowStart = now - 60_000;

  // 윈도우 밖 타임스탬프 제거
  while (requestTimestamps.length > 0 && requestTimestamps[0] < windowStart) {
    requestTimestamps.shift();
  }

  if (requestTimestamps.length >= RATE_LIMIT_PER_MINUTE) {
    return false; // 제한 초과
  }

  requestTimestamps.push(now);
  return true;
}

/** URL 캐시에서 조회 (중복 페치 방지) */
function getCachedResult(url: string): { hit: boolean; result: Omit<ChatLinkPreviewInsert, "message_id"> | null } {
  const cached = urlCache.get(url);
  if (cached && cached.expiresAt > Date.now()) {
    return { hit: true, result: cached.result };
  }
  // 만료된 엔트리 정리
  if (cached) urlCache.delete(url);
  return { hit: false, result: null };
}

/** 결과를 캐시에 저장 */
function setCachedResult(url: string, result: Omit<ChatLinkPreviewInsert, "message_id"> | null): void {
  // 캐시 크기 제한 (최대 200개)
  if (urlCache.size >= 200) {
    const firstKey = urlCache.keys().next().value;
    if (firstKey) urlCache.delete(firstKey);
  }
  urlCache.set(url, { result, expiresAt: Date.now() + URL_CACHE_TTL });
}

/**
 * URL에서 OG 태그를 파싱하여 링크 프리뷰 데이터 반환
 * 서버 사이드에서만 호출 (fire-and-forget, 메시지 전송을 블로킹하지 않음)
 *
 * Rate limiting:
 * - 분당 30회 글로벌 제한 (슬라이딩 윈도우)
 * - 동일 URL 10분 캐시 (중복 요청 방지)
 */
export async function fetchLinkPreview(
  url: string
): Promise<Omit<ChatLinkPreviewInsert, "message_id"> | null> {
  // 1. URL 캐시 확인 (동일 URL 중복 페치 방지)
  const cached = getCachedResult(url);
  if (cached.hit) return cached.result;

  // 2. Rate limit 체크
  if (!checkRateLimit()) {
    return null; // 제한 초과 시 조용히 스킵
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "TimeLevelUp-LinkPreview/1.0",
        Accept: "text/html",
      },
      redirect: "follow",
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      setCachedResult(url, null);
      return null;
    }

    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html")) {
      setCachedResult(url, null);
      return null;
    }

    // HTML의 앞부분만 읽기 (OG 태그는 <head>에 있으므로 전체를 읽을 필요 없음)
    const reader = response.body?.getReader();
    if (!reader) {
      setCachedResult(url, null);
      return null;
    }

    let html = "";
    const decoder = new TextDecoder();
    while (html.length < 50000) {
      const { done, value } = await reader.read();
      if (done) break;
      html += decoder.decode(value, { stream: true });
      // </head>를 찾으면 이후 읽기 중단
      if (html.includes("</head>")) break;
    }
    reader.cancel().catch(() => {});

    const title =
      extractMetaContent(html, "og:title") ??
      extractMetaContent(html, "twitter:title") ??
      extractTitle(html);

    if (!title) {
      setCachedResult(url, null);
      return null;
    }

    const description =
      extractMetaContent(html, "og:description") ??
      extractMetaContent(html, "twitter:description") ??
      extractMetaContent(html, "description");

    const imageUrl = resolveUrl(
      url,
      extractMetaContent(html, "og:image") ??
        extractMetaContent(html, "twitter:image")
    );

    const siteName =
      extractMetaContent(html, "og:site_name") ?? new URL(url).hostname;

    const result = {
      url,
      title: title.slice(0, 200),
      description: description?.slice(0, 300) ?? null,
      image_url: imageUrl,
      site_name: siteName?.slice(0, 100) ?? null,
    };

    setCachedResult(url, result);
    return result;
  } catch {
    setCachedResult(url, null);
    return null;
  }
}

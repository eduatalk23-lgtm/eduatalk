/**
 * 출처 자동 수집 서비스 (DB 캐시 우선 → Claude Web Search fallback)
 *
 * 1. resource description을 임베딩 → academic_sources 벡터 검색
 * 2. 유사도 ≥ 0.7 → DB 캐시 사용 (비용 $0)
 * 3. 미스 → Claude Web Search → 결과를 DB에 축적
 * 실패해도 가이드 생성에 영향 없음 (non-fatal).
 */

import Anthropic from "@anthropic-ai/sdk";
import { logActionDebug, logActionWarn } from "@/lib/logging/actionLogger";
import type { ContentSection, ResourceItem, RelatedPaper } from "../../types";
import {
  searchAcademicSources,
  insertAcademicSource,
  detectSourceDb,
} from "./academic-sources";

// ============================================
// 설정
// ============================================

const LOG_CTX = { domain: "guide", action: "enrichSources" };

/** 한국 학술 DB 도메인 */
const KOREAN_ACADEMIC_DOMAINS = [
  "riss.kr",
  "kci.go.kr",
  "dbpia.co.kr",
  "scholar.google.com",
  "kiss.kstudy.com",
  "scienceall.com",
  "kosis.kr",
  "ncbi.nlm.nih.gov",
  "koreascience.kr",
];

const URL_VALIDATION_TIMEOUT_MS = 5000;
const DEFAULT_MAX_RESOURCES = 8;

// ============================================
// 타입
// ============================================

export interface EnrichmentResult {
  enrichedSections: ContentSection[];
  enrichedPapers: RelatedPaper[];
  stats: {
    totalResources: number;
    searchesPerformed: number;
    urlsFound: number;
    urlsValidated: number;
  };
}

export interface EnrichmentOptions {
  /** 최대 enrichment 대상 수 (비용 제어) */
  maxResources?: number;
  /** 도메인 허용 목록 */
  allowedDomains?: string[];
  /** URL HEAD 검증 여부 */
  validateUrls?: boolean;
  /** 드라이런 (검색 실행 안 함) */
  dryRun?: boolean;
  /** 과목 영역 필터 (DB 벡터 검색 시 사용) */
  subjectAreas?: string[];
}

// ============================================
// Anthropic 클라이언트 (싱글톤)
// ============================================

let _client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!_client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY 환경변수가 설정되지 않았습니다.");
    _client = new Anthropic({ apiKey });
  }
  return _client;
}

// ============================================
// 메인 오케스트레이터
// ============================================

export async function enrichGuideResources(
  sections: ContentSection[],
  relatedPapers: RelatedPaper[],
  guideTitle: string,
  options?: EnrichmentOptions,
): Promise<EnrichmentResult> {
  const maxResources = options?.maxResources ?? DEFAULT_MAX_RESOURCES;
  const domains = options?.allowedDomains ?? KOREAN_ACADEMIC_DOMAINS;
  const shouldValidate = options?.validateUrls ?? true;

  const stats = { totalResources: 0, searchesPerformed: 0, urlsFound: 0, urlsValidated: 0 };

  if (options?.dryRun) {
    return { enrichedSections: sections, enrichedPapers: relatedPapers, stats };
  }

  const client = getClient();

  // 1) sections 내 resources 수집
  const resourceTargets: { sectionIdx: number; outlineIdx: number; resourceIdx: number; resource: ResourceItem }[] = [];

  for (let si = 0; si < sections.length; si++) {
    const outline = sections[si].outline;
    if (!outline) continue;
    for (let oi = 0; oi < outline.length; oi++) {
      const resources = outline[oi].resources;
      if (!resources) continue;
      for (let ri = 0; ri < resources.length; ri++) {
        const res = typeof resources[ri] === "string"
          ? { description: resources[ri] as string }
          : resources[ri] as ResourceItem;
        if (!res.url) {
          resourceTargets.push({ sectionIdx: si, outlineIdx: oi, resourceIdx: ri, resource: res });
        }
      }
    }
  }

  stats.totalResources = resourceTargets.length + relatedPapers.filter((p) => !p.url).length;

  // 예산 제한 적용
  const targets = resourceTargets.slice(0, maxResources);
  const paperTargets = relatedPapers
    .filter((p) => !p.url)
    .slice(0, Math.max(0, maxResources - targets.length));

  // 2) 순차 검색 (rate limit 고려)
  const enrichedSections = sections.map((s) => ({ ...s, outline: s.outline?.map((o) => ({ ...o })) }));

  for (const target of targets) {
    try {
      const enriched = await enrichSingleResource(client, target.resource, guideTitle, domains, options?.subjectAreas);
      stats.searchesPerformed++;

      if (enriched.url) {
        stats.urlsFound++;
        if (shouldValidate) {
          const valid = await validateUrl(enriched.url);
          if (valid) {
            stats.urlsValidated++;
            const outline = enrichedSections[target.sectionIdx].outline!;
            const resources = outline[target.outlineIdx].resources as ResourceItem[];
            resources[target.resourceIdx] = enriched;
          }
        } else {
          stats.urlsValidated++;
          const outline = enrichedSections[target.sectionIdx].outline!;
          const resources = outline[target.outlineIdx].resources as ResourceItem[];
          resources[target.resourceIdx] = enriched;
        }
      }
    } catch (err) {
      logActionWarn(LOG_CTX, `Resource enrichment failed: ${target.resource.description.slice(0, 50)}`, {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // 3) relatedPapers enrichment
  const enrichedPapers = [...relatedPapers];
  for (let i = 0; i < paperTargets.length; i++) {
    const paper = paperTargets[i];
    const paperIdx = relatedPapers.indexOf(paper);
    try {
      const result = await enrichPaper(client, paper, guideTitle, domains);
      stats.searchesPerformed++;

      if (result.url) {
        stats.urlsFound++;
        if (shouldValidate) {
          const valid = await validateUrl(result.url);
          if (valid) {
            stats.urlsValidated++;
            enrichedPapers[paperIdx] = result;
          }
        } else {
          stats.urlsValidated++;
          enrichedPapers[paperIdx] = result;
        }
      }
    } catch (err) {
      logActionWarn(LOG_CTX, `Paper enrichment failed: ${paper.title.slice(0, 50)}`, {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  logActionDebug(LOG_CTX, `Enrichment complete: ${stats.urlsValidated}/${stats.totalResources} URLs validated`, stats);

  return { enrichedSections, enrichedPapers, stats };
}

// ============================================
// 단일 리소스 검색
// ============================================

async function enrichSingleResource(
  client: Anthropic,
  resource: ResourceItem,
  guideContext: string,
  domains: string[],
  subjectAreas?: string[],
): Promise<ResourceItem> {
  // 1) DB 캐시 검색 (벡터 유사도)
  try {
    const dbResults = await searchAcademicSources(
      `${resource.description} ${guideContext}`,
      { subjectAreas, matchCount: 1, similarityThreshold: 0.78 },
    );
    if (dbResults.length > 0) {
      const hit = dbResults[0];
      logActionDebug(LOG_CTX, `DB cache hit: "${resource.description.slice(0, 30)}" → ${hit.title.slice(0, 40)} (score: ${hit.score.toFixed(2)})`);
      return {
        ...resource,
        url: hit.url,
        citedText: hit.cited_text ?? hit.abstract_snippet ?? undefined,
      };
    }
  } catch {
    // DB 검색 실패 시 웹 검색으로 진행
  }

  // 2) Claude Web Search fallback
  const query = buildSearchQuery(resource.description, resource.consultantHint, guideContext);

  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1024,
    tools: [
      {
        type: "web_search_20250305",
        name: "web_search",
        max_uses: 2,
        allowed_domains: domains,
        user_location: {
          type: "approximate",
          country: "KR",
          timezone: "Asia/Seoul",
        },
      },
    ],
    messages: [
      {
        role: "user",
        content: `다음 참고 자료에 해당하는 실제 학술 논문 또는 자료의 웹 페이지를 찾아주세요.

참고 자료 설명: ${resource.description}
${resource.consultantHint ? `검색 힌트: ${resource.consultantHint}` : ""}
가이드 주제: ${guideContext}

찾은 URL과 해당 페이지에서 관련 내용 1~2문장을 인용해주세요.
찾지 못하면 "URL_NOT_FOUND"라고만 답하세요.`,
      },
    ],
  });

  const { url, citedText } = extractSearchResults(response);

  if (!url) return resource;

  // 3) DB에 축적 (비동기, 실패 무시)
  insertAcademicSource({
    url,
    title: resource.description.slice(0, 200),
    cited_text: citedText ?? undefined,
    source_db: detectSourceDb(url),
    keywords: query.split(/\s+/).filter((w) => w.length > 1),
    subject_areas: subjectAreas,
  }).catch(() => {});

  return { ...resource, url, citedText: citedText ?? undefined };
}

// ============================================
// 논문 검색
// ============================================

async function enrichPaper(
  client: Anthropic,
  paper: RelatedPaper,
  guideContext: string,
  domains: string[],
): Promise<RelatedPaper> {
  // 1) DB 캐시 검색
  try {
    const dbResults = await searchAcademicSources(
      `${paper.title} ${paper.summary ?? ""}`,
      { matchCount: 1, similarityThreshold: 0.82 },
    );
    if (dbResults.length > 0) {
      const hit = dbResults[0];
      logActionDebug(LOG_CTX, `DB cache hit (paper): "${paper.title.slice(0, 30)}" → ${hit.url.slice(0, 50)}`);
      return {
        ...paper,
        url: hit.url,
        citedText: hit.cited_text ?? hit.abstract_snippet ?? undefined,
      };
    }
  } catch {
    // DB 실패 → 웹 검색
  }

  // 2) Claude Web Search
  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1024,
    tools: [
      {
        type: "web_search_20250305",
        name: "web_search",
        max_uses: 2,
        allowed_domains: domains,
        user_location: {
          type: "approximate",
          country: "KR",
          timezone: "Asia/Seoul",
        },
      },
    ],
    messages: [
      {
        role: "user",
        content: `다음 논문의 실제 URL을 한국 학술 데이터베이스(RISS, KCI, DBpia)에서 찾아주세요.

논문 제목: ${paper.title}
${paper.summary ? `요약: ${paper.summary}` : ""}
관련 가이드: ${guideContext}

찾은 URL과 논문 초록에서 1~2문장을 인용해주세요.
찾지 못하면 "URL_NOT_FOUND"라고만 답하세요.`,
      },
    ],
  });

  const { url, citedText } = extractSearchResults(response);

  if (!url) return paper;

  // DB에 축적
  insertAcademicSource({
    url,
    title: paper.title,
    abstract_snippet: paper.summary ?? undefined,
    cited_text: citedText ?? undefined,
    source_db: detectSourceDb(url),
    keywords: paper.title.split(/\s+/).filter((w) => w.length > 1),
  }).catch(() => {});

  return { ...paper, url, citedText: citedText ?? undefined };
}

// ============================================
// 검색 쿼리 빌드
// ============================================

function buildSearchQuery(description: string, hint?: string, context?: string): string {
  const parts: string[] = [];
  if (hint) parts.push(hint);
  else parts.push(description.slice(0, 60));
  if (context) parts.push(context.slice(0, 30));
  return parts.join(" ");
}

// ============================================
// 응답 파싱
// ============================================

function extractSearchResults(
  response: Anthropic.Message,
): { url: string | null; citedText: string | null } {
  let bestUrl: string | null = null;
  let citedText: string | null = null;

  for (const block of response.content) {
    if (block.type === "text") {
      const text = block.text;
      if (text.includes("URL_NOT_FOUND")) return { url: null, citedText: null };

      // citations 배열에서 URL 추출 (block을 unknown으로 캐스팅)
      const blockAny = block as unknown as { citations?: Array<{ type: string; url?: string; cited_text?: string }> };
      if (blockAny.citations && Array.isArray(blockAny.citations)) {
        for (const citation of blockAny.citations) {
          if (citation.type === "web_search_result_location" && citation.url) {
            if (!bestUrl) bestUrl = citation.url;
            if (citation.cited_text && !citedText) {
              citedText = citation.cited_text;
            }
          }
        }
      }

      // URL이 text에 포함된 경우 fallback
      if (!bestUrl) {
        const urlMatch = text.match(/https?:\/\/[^\s)>\]"']+/);
        if (urlMatch) bestUrl = urlMatch[0];
      }

      if (!citedText && text.length > 20 && !text.includes("URL_NOT_FOUND")) {
        citedText = text.slice(0, 200);
      }
    }

    // web_search_tool_result에서도 URL 추출
    if (block.type === "web_search_tool_result") {
      const resultBlock = block as unknown as { content?: Array<{ type: string; url?: string }> };
      if (resultBlock.content && Array.isArray(resultBlock.content)) {
        for (const result of resultBlock.content) {
          if (result.type === "web_search_result" && result.url) {
            if (!bestUrl) bestUrl = result.url;
          }
        }
      }
    }
  }

  return { url: bestUrl, citedText };
}

// ============================================
// URL 유효성 검증
// ============================================

async function validateUrl(url: string): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), URL_VALIDATION_TIMEOUT_MS);

    const response = await fetch(url, {
      method: "HEAD",
      signal: controller.signal,
      redirect: "follow",
      headers: { "User-Agent": "TimeLevelUp-Bot/1.0 (educational-guide-validator)" },
    });

    clearTimeout(timeout);

    // HEAD가 405(Method Not Allowed)이면 GET으로 재시도
    if (response.status === 405) {
      const controller2 = new AbortController();
      const timeout2 = setTimeout(() => controller2.abort(), URL_VALIDATION_TIMEOUT_MS);
      const getResp = await fetch(url, {
        method: "GET",
        signal: controller2.signal,
        redirect: "follow",
        headers: { "User-Agent": "TimeLevelUp-Bot/1.0 (educational-guide-validator)" },
      });
      clearTimeout(timeout2);
      return getResp.ok;
    }

    return response.ok;
  } catch {
    return false;
  }
}

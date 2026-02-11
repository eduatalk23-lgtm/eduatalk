/**
 * Fixie 프록시를 경유하는 fetch 유틸리티
 * Vercel 프로덕션에서 고정 IP로 외부 API 호출 시 사용
 *
 * FIXIE_URL 환경 변수가 설정되어 있으면 프록시 경유,
 * 없으면 네이티브 fetch() 사용 (로컬 개발 환경)
 */

import { ProxyAgent, fetch as undiciFetch } from "undici";

let cachedAgent: ProxyAgent | null = null;

function getProxyAgent(): ProxyAgent | null {
  const fixieUrl = process.env.FIXIE_URL;
  if (!fixieUrl) return null;

  if (!cachedAgent) {
    cachedAgent = new ProxyAgent(fixieUrl);
  }
  return cachedAgent;
}

/**
 * 프록시를 경유하는 fetch
 * FIXIE_URL이 설정되어 있으면 undici ProxyAgent를 통해 요청,
 * 없으면 네이티브 fetch 사용
 */
export async function proxyFetch(
  url: string | URL,
  init?: RequestInit & { signal?: AbortSignal }
): Promise<Response> {
  const agent = getProxyAgent();

  if (!agent) {
    // 프록시 없음 (로컬 개발 환경) → 네이티브 fetch
    return fetch(url, init);
  }

  // undici fetch with ProxyAgent
  const response = await undiciFetch(url.toString(), {
    method: init?.method,
    headers: init?.headers as Record<string, string> | undefined,
    body: init?.body as string | undefined,
    signal: init?.signal ?? undefined,
    dispatcher: agent,
  });

  // undici Response를 Web API Response로 변환
  const body = await response.text();
  return new Response(body, {
    status: response.status,
    statusText: response.statusText,
    headers: Object.fromEntries(response.headers.entries()),
  });
}

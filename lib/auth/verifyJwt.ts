import { jwtVerify, createRemoteJWKSet, type JWTPayload } from "jose";

/**
 * Supabase JWT 서명 검증 (Edge Runtime 호환).
 *
 * 우선순위:
 * 1) SUPABASE_JWT_SECRET 환경변수 → HS256 검증 (legacy / 기본 시크릿)
 * 2) NEXT_PUBLIC_SUPABASE_URL → JWKS 자동 fetch (asymmetric keys 활성 프로젝트)
 *
 * 둘 다 사용 불가하면 검증 결과 null 반환 (호출자는 보수적으로 처리).
 */

let cachedJwks: ReturnType<typeof createRemoteJWKSet> | null = null;
let cachedSecret: Uint8Array | null = null;

function getHsSecret(): Uint8Array | null {
  const raw = process.env.SUPABASE_JWT_SECRET;
  if (!raw) return null;
  if (cachedSecret) return cachedSecret;
  cachedSecret = new TextEncoder().encode(raw);
  return cachedSecret;
}

function getJwks(): ReturnType<typeof createRemoteJWKSet> | null {
  if (cachedJwks) return cachedJwks;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) return null;
  cachedJwks = createRemoteJWKSet(
    new URL(`${url.replace(/\/$/, "")}/auth/v1/.well-known/jwks.json`),
  );
  return cachedJwks;
}

/**
 * @returns 검증 통과한 payload, 실패/검증불가 시 null
 */
export async function verifySupabaseJwt(
  accessToken: string,
): Promise<JWTPayload | null> {
  // 1) HS256 시도
  const secret = getHsSecret();
  if (secret) {
    try {
      const { payload } = await jwtVerify(accessToken, secret, {
        algorithms: ["HS256"],
      });
      return payload;
    } catch {
      // HS256 실패 시 JWKS 시도 (혼합 환경 대비)
    }
  }

  // 2) JWKS 시도 (asymmetric)
  const jwks = getJwks();
  if (jwks) {
    try {
      const { payload } = await jwtVerify(accessToken, jwks);
      return payload;
    } catch {
      return null;
    }
  }

  return null;
}

// ============================================
// 콘텐츠 해시 유틸리티
// 레코드 변경 감지용 — 파이프라인 stale 판정
// ============================================

/**
 * 레코드 배열에서 변경 감지용 해시 생성
 * id + updated_at 조합으로 결정론적 해시 산출
 */
export function computeContentHash(
  records: Array<{ id: string; updated_at: string | null }>,
): string {
  const sorted = [...records].sort((a, b) => a.id.localeCompare(b.id));
  const payload = sorted.map((r) => `${r.id}:${r.updated_at ?? ""}`).join("|");

  // djb2 해시 — 암호학적 보안 불필요, 변경 감지용
  let hash = 5381;
  for (let i = 0; i < payload.length; i++) {
    hash = ((hash << 5) + hash + payload.charCodeAt(i)) | 0;
  }
  return (hash >>> 0).toString(36);
}

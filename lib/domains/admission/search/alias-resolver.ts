// ============================================
// Phase 8.3: 대학 이름 별칭 해석 (순수 함수)
// ============================================

export interface AliasEntry {
  aliasName: string;
  canonicalName: string;
}

/**
 * 검색어로 매칭되는 모든 대학 이름 확장.
 * alias_name 또는 canonical_name 중 하나라도 매칭되면,
 * 같은 canonical_name을 공유하는 모든 alias_name + canonical_name 반환.
 *
 * 예: "KAIST" 검색 → ["KAIST", "한국과학기술원"]
 * 예: "강원대" 검색 → ["강원대학교(춘천)", "강원대학교(원주)", ..., "강원대학교"]
 */
export function expandAliasNames(
  aliases: AliasEntry[],
  searchTerm: string,
): string[] {
  if (!searchTerm.trim()) return [];

  const term = searchTerm.toLowerCase();

  // 1. 검색어와 매칭되는 alias 찾기 (alias_name OR canonical_name 부분 일치)
  const matchedCanonicals = new Set<string>();
  for (const entry of aliases) {
    if (
      entry.aliasName.toLowerCase().includes(term) ||
      entry.canonicalName.toLowerCase().includes(term)
    ) {
      matchedCanonicals.add(entry.canonicalName);
    }
  }

  if (matchedCanonicals.size === 0) return [];

  // 2. 매칭된 canonical에 속하는 모든 이름 수집
  const result = new Set<string>();
  for (const entry of aliases) {
    if (matchedCanonicals.has(entry.canonicalName)) {
      result.add(entry.aliasName);
      result.add(entry.canonicalName);
    }
  }

  return [...result];
}

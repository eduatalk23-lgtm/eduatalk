import { describe, it, expect } from "vitest";
import { expandAliasNames, type AliasEntry } from "../search/alias-resolver";

// 테스트용 별칭 데이터 (실제 시드와 동일 구조)
const ALIASES: AliasEntry[] = [
  // 영문 약칭
  { aliasName: "KAIST", canonicalName: "한국과학기술원" },
  { aliasName: "POSTECH", canonicalName: "포항공과대학교" },
  { aliasName: "GIST", canonicalName: "광주과학기술원" },
  { aliasName: "UNIST", canonicalName: "울산과학기술원" },
  { aliasName: "DGIST", canonicalName: "대구경북과학기술원" },
  { aliasName: "KENTECH", canonicalName: "한국에너지공과대학교" },
  // 캠퍼스
  { aliasName: "강원대학교(춘천)", canonicalName: "강원대학교" },
  { aliasName: "강원대학교(원주)", canonicalName: "강원대학교" },
  { aliasName: "강원대학교(강릉)", canonicalName: "강원대학교" },
  { aliasName: "강원대학교(삼척)", canonicalName: "강원대학교" },
  { aliasName: "강원대학교(도계)", canonicalName: "강원대학교" },
  { aliasName: "단국대학교(천안)", canonicalName: "단국대학교" },
  { aliasName: "상명대학교(천안)", canonicalName: "상명대학교" },
  { aliasName: "홍익대학교(세종)", canonicalName: "홍익대학교" },
  // 국립 접두사
  { aliasName: "공주대학교", canonicalName: "국립공주대학교" },
  { aliasName: "군산대학교", canonicalName: "국립군산대학교" },
  // 개명
  { aliasName: "경상대학교", canonicalName: "경상국립대학교" },
  { aliasName: "한경대학교", canonicalName: "한경국립대학교" },
  // 특수
  { aliasName: "가야대학교", canonicalName: "가야대학교(김해)" },
  { aliasName: "경국대학교", canonicalName: "경국대학교" },
];

describe("expandAliasNames", () => {
  it("영문 약칭 → 한국어 공식명 양방향 해석", () => {
    // KAIST 검색 → KAIST + 한국과학기술원
    const fromEng = expandAliasNames(ALIASES, "KAIST");
    expect(fromEng).toContain("KAIST");
    expect(fromEng).toContain("한국과학기술원");

    // 한국과학기술원 검색 → 동일
    const fromKor = expandAliasNames(ALIASES, "한국과학기술원");
    expect(fromKor).toContain("KAIST");
    expect(fromKor).toContain("한국과학기술원");
  });

  it("강원대학교 → 5개 캠퍼스 변형 + 본교명 포함", () => {
    const result = expandAliasNames(ALIASES, "강원대");
    expect(result).toHaveLength(6); // 5 campuses + 1 canonical
    expect(result).toContain("강원대학교(춘천)");
    expect(result).toContain("강원대학교(원주)");
    expect(result).toContain("강원대학교(강릉)");
    expect(result).toContain("강원대학교(삼척)");
    expect(result).toContain("강원대학교(도계)");
    expect(result).toContain("강원대학교");
  });

  it("캠퍼스 검색 시 같은 canonical 그룹 전체 반환", () => {
    // 춘천 캠퍼스로 검색 → 강원대 전체 포함
    const result = expandAliasNames(ALIASES, "춘천");
    expect(result).toContain("강원대학교(춘천)");
    expect(result).toContain("강원대학교");
  });

  it("국립 접두사 해석", () => {
    // 공주대학교 검색 → 공주대학교 + 국립공주대학교
    const result = expandAliasNames(ALIASES, "공주대학교");
    expect(result).toContain("공주대학교");
    expect(result).toContain("국립공주대학교");
  });

  it("개명 대학 해석", () => {
    const result = expandAliasNames(ALIASES, "경상대");
    expect(result).toContain("경상대학교");
    expect(result).toContain("경상국립대학교");
  });

  it("매칭 없는 경우 빈 배열 반환", () => {
    expect(expandAliasNames(ALIASES, "존재하지않는대학교")).toEqual([]);
  });

  it("빈 검색어는 빈 배열 반환", () => {
    expect(expandAliasNames(ALIASES, "")).toEqual([]);
    expect(expandAliasNames(ALIASES, "   ")).toEqual([]);
  });

  it("대소문자 구분 없이 매칭", () => {
    const result = expandAliasNames(ALIASES, "kaist");
    expect(result).toContain("KAIST");
    expect(result).toContain("한국과학기술원");
  });

  it("특수 케이스: 가야대 → 가야대학교(김해)", () => {
    const result = expandAliasNames(ALIASES, "가야대");
    expect(result).toContain("가야대학교");
    expect(result).toContain("가야대학교(김해)");
  });
});

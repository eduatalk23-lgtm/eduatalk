// ============================================
// Phase G S-2/S-3: Layer 1 tool 가드 — filterToolsForRole 행위 검증
// 서브에이전트 MCP tool (analyzeRecordDeep/designStudentPlan/analyzeAdmission)
// 가 admin-like role 만 노출되도록.
// ============================================

import { describe, it, expect } from "vitest";

import {
  ADMIN_ONLY_TOOL_NAMES,
  filterToolsForRole,
  isAdminLikeRole,
  type McpUserRole,
} from "../roleFilter";

function makeToolSet(): Record<string, { exec: () => void }> {
  return {
    // read-only (전 role 공개)
    navigateTo: { exec: () => {} },
    getScores: { exec: () => {} },
    analyzeRecord: { exec: () => {} },
    getPipelineStatus: { exec: () => {} },
    getStudentRecords: { exec: () => {} },
    getStudentDiagnosis: { exec: () => {} },
    getStudentStorylines: { exec: () => {} },
    getStudentOverview: { exec: () => {} },
    // admin-only (서브에이전트 위임)
    analyzeRecordDeep: { exec: () => {} },
    designStudentPlan: { exec: () => {} },
    analyzeAdmission: { exec: () => {} },
  };
}

describe("isAdminLikeRole", () => {
  it("admin/consultant/superadmin 은 true", () => {
    expect(isAdminLikeRole("admin")).toBe(true);
    expect(isAdminLikeRole("consultant")).toBe(true);
    expect(isAdminLikeRole("superadmin")).toBe(true);
  });

  it("student/parent/null/undefined 는 false", () => {
    expect(isAdminLikeRole("student")).toBe(false);
    expect(isAdminLikeRole("parent")).toBe(false);
    expect(isAdminLikeRole(null)).toBe(false);
    expect(isAdminLikeRole(undefined)).toBe(false);
  });
});

describe("ADMIN_ONLY_TOOL_NAMES 집합", () => {
  it("Phase G 서브 3종 전부 포함", () => {
    expect(ADMIN_ONLY_TOOL_NAMES.has("analyzeRecordDeep")).toBe(true);
    expect(ADMIN_ONLY_TOOL_NAMES.has("designStudentPlan")).toBe(true);
    expect(ADMIN_ONLY_TOOL_NAMES.has("analyzeAdmission")).toBe(true);
  });

  it("read-only tool 은 포함 금지", () => {
    const readOnly = [
      "navigateTo",
      "getScores",
      "analyzeRecord",
      "getPipelineStatus",
      "getStudentRecords",
      "getStudentDiagnosis",
      "getStudentStorylines",
      "getStudentOverview",
    ];
    for (const name of readOnly) {
      expect(ADMIN_ONLY_TOOL_NAMES.has(name)).toBe(false);
    }
  });
});

describe("filterToolsForRole", () => {
  it.each<[McpUserRole, boolean]>([
    ["admin", true],
    ["consultant", true],
    ["superadmin", true],
  ])("%s 는 admin-only tool 을 유지한다", (role, expectAllKept) => {
    const tools = makeToolSet();
    const filtered = filterToolsForRole(tools, role);
    expect(Object.keys(filtered).length).toBe(Object.keys(tools).length);
    expect("analyzeRecordDeep" in filtered).toBe(expectAllKept);
    expect("designStudentPlan" in filtered).toBe(expectAllKept);
    expect("analyzeAdmission" in filtered).toBe(expectAllKept);
  });

  it.each<McpUserRole>(["student", "parent", null, undefined])(
    "%s 는 admin-only tool 3종을 제거한다",
    (role) => {
      const tools = makeToolSet();
      const filtered = filterToolsForRole(tools, role);

      expect("analyzeRecordDeep" in filtered).toBe(false);
      expect("designStudentPlan" in filtered).toBe(false);
      expect("analyzeAdmission" in filtered).toBe(false);

      // read-only tool 은 유지
      expect("getScores" in filtered).toBe(true);
      expect("getStudentRecords" in filtered).toBe(true);
      expect("navigateTo" in filtered).toBe(true);
    },
  );

  it("결과는 원본과 다른 객체 (admin 포함 — 새 레퍼런스 일관성 X, 하지만 mutation 금지)", () => {
    const tools = makeToolSet();
    const filtered = filterToolsForRole(tools, "student");
    expect(filtered).not.toBe(tools);
    // 원본 tool 객체는 무결
    expect(Object.keys(tools).length).toBe(11);
  });

  it("빈 tool set 은 빈 객체 반환", () => {
    expect(filterToolsForRole({}, "student")).toEqual({});
    expect(filterToolsForRole({}, "admin")).toEqual({});
  });

  it("admin-only tool 에 없는 키는 role 무관 유지", () => {
    const custom = {
      unknownTool: { exec: () => {} },
      analyzeRecordDeep: { exec: () => {} },
    };
    const studentSet = filterToolsForRole(custom, "student");
    expect("unknownTool" in studentSet).toBe(true);
    expect("analyzeRecordDeep" in studentSet).toBe(false);
  });
});

// ============================================
// Phase G S-2-a: MCP tool role filter — 단위 테스트
// ============================================

import { describe, it, expect } from "vitest";
import {
  ADMIN_ONLY_TOOL_NAMES,
  filterToolsForRole,
  isAdminLikeRole,
} from "../_shared/roleFilter";

const FAKE_TOOLS = {
  navigateTo: "t1",
  getScores: "t2",
  analyzeRecord: "t3",
  getStudentRecords: "t4",
  analyzeRecordDeep: "t5",
} as const;

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

describe("ADMIN_ONLY_TOOL_NAMES", () => {
  it("analyzeRecordDeep 을 포함한다", () => {
    expect(ADMIN_ONLY_TOOL_NAMES.has("analyzeRecordDeep")).toBe(true);
  });
  it("일반 조회 tool 은 포함되지 않는다", () => {
    expect(ADMIN_ONLY_TOOL_NAMES.has("navigateTo")).toBe(false);
    expect(ADMIN_ONLY_TOOL_NAMES.has("getScores")).toBe(false);
    expect(ADMIN_ONLY_TOOL_NAMES.has("getStudentRecords")).toBe(false);
  });
});

describe("filterToolsForRole", () => {
  it("admin 은 모든 tool 유지", () => {
    const result = filterToolsForRole(FAKE_TOOLS, "admin");
    expect(Object.keys(result).sort()).toEqual(Object.keys(FAKE_TOOLS).sort());
  });

  it("consultant 도 모든 tool 유지", () => {
    const result = filterToolsForRole(FAKE_TOOLS, "consultant");
    expect(result).toHaveProperty("analyzeRecordDeep");
  });

  it("student 는 analyzeRecordDeep 제외", () => {
    const result = filterToolsForRole(FAKE_TOOLS, "student");
    expect(result).not.toHaveProperty("analyzeRecordDeep");
    expect(result).toHaveProperty("navigateTo");
    expect(result).toHaveProperty("getScores");
    expect(result).toHaveProperty("getStudentRecords");
  });

  it("parent 도 analyzeRecordDeep 제외", () => {
    const result = filterToolsForRole(FAKE_TOOLS, "parent");
    expect(result).not.toHaveProperty("analyzeRecordDeep");
  });

  it("role=null 은 admin-only 전부 제거", () => {
    const result = filterToolsForRole(FAKE_TOOLS, null);
    expect(result).not.toHaveProperty("analyzeRecordDeep");
  });

  it("role=undefined 도 admin-only 제거", () => {
    const result = filterToolsForRole(FAKE_TOOLS, undefined);
    expect(result).not.toHaveProperty("analyzeRecordDeep");
  });

  it("원본 딕셔너리를 변경하지 않는다 (순수성)", () => {
    const snapshot = { ...FAKE_TOOLS };
    filterToolsForRole(FAKE_TOOLS, "student");
    expect(FAKE_TOOLS).toEqual(snapshot);
  });
});

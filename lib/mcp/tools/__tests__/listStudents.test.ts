// ============================================
// Phase E-1 Sprint 1: listStudents tool — 단위 테스트
// ============================================

import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@/lib/domains/student/actions/search", () => ({
  searchStudentsAction: vi.fn(),
}));

import { searchStudentsAction } from "@/lib/domains/student/actions/search";
import { listStudentsExecute } from "../listStudents";
import { ADMIN_ONLY_TOOL_NAMES } from "../_shared/roleFilter";

const mockedSearch = vi.mocked(searchStudentsAction);

function fakeStudent(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "s-1",
    name: "김세린",
    grade: 2,
    class: "3",
    phone: "010-0000-0000",
    division: "고등부",
    school_name: "인제고",
    gender: "여" as const,
    is_active: true,
    status: "enrolled" as const,
    has_email: true,
    profile_image_url: null,
    withdrawn_at: null,
    withdrawn_reason: null,
    ...overrides,
  };
}

describe("listStudents tool", () => {
  beforeEach(() => {
    mockedSearch.mockReset();
  });

  describe("Layer 1 가드 (roleFilter 등록)", () => {
    it("ADMIN_ONLY_TOOL_NAMES 에 포함된다", () => {
      expect(ADMIN_ONLY_TOOL_NAMES.has("listStudents")).toBe(true);
    });
  });

  describe("정상 경로", () => {
    it("학생 목록을 카드용 필드로 축약해 반환한다", async () => {
      mockedSearch.mockResolvedValue({
        success: true,
        students: [
          fakeStudent({ id: "a", name: "김세린", grade: 2 }),
          fakeStudent({ id: "b", name: "이민수", grade: 1 }),
        ],
        total: 2,
      });

      const out = await listStudentsExecute({});

      expect(out.ok).toBe(true);
      if (!out.ok) return;
      expect(out.students).toHaveLength(2);
      expect(out.students[0]).toMatchObject({
        id: "a",
        name: "김세린",
        grade: 2,
        className: "3",
        schoolName: "인제고",
        division: "고등부",
        status: "enrolled",
      });
      // PII(전화번호 등)는 노출되지 않아야 함
      expect(out.students[0]).not.toHaveProperty("phone");
      expect(out.students[0]).not.toHaveProperty("has_email");
    });

    it("grade/status 필터를 searchStudentsAction 으로 전달한다", async () => {
      mockedSearch.mockResolvedValue({ success: true, students: [], total: 0 });

      await listStudentsExecute({ grade: 2, status: "enrolled" });

      expect(mockedSearch).toHaveBeenCalledWith(
        "",
        expect.objectContaining({ grade: "2", status: "enrolled" }),
      );
    });

    it("query 는 trim 되어 전달된다", async () => {
      mockedSearch.mockResolvedValue({ success: true, students: [], total: 0 });

      await listStudentsExecute({ query: "  김세린  " });

      expect(mockedSearch).toHaveBeenCalledWith("김세린", expect.anything());
    });

    it("query 가 null/undefined 여도 빈 문자열로 정규화", async () => {
      mockedSearch.mockResolvedValue({ success: true, students: [], total: 0 });

      await listStudentsExecute({ query: null });
      expect(mockedSearch).toHaveBeenLastCalledWith("", expect.anything());

      await listStudentsExecute({});
      expect(mockedSearch).toHaveBeenLastCalledWith("", expect.anything());
    });
  });

  describe("limit 처리", () => {
    it("기본 20개로 자른다", async () => {
      const many = Array.from({ length: 30 }, (_, i) =>
        fakeStudent({ id: `s-${i}`, name: `학생${i}` }),
      );
      mockedSearch.mockResolvedValue({ success: true, students: many, total: 30 });

      const out = await listStudentsExecute({});

      expect(out.ok).toBe(true);
      if (!out.ok) return;
      expect(out.students).toHaveLength(20);
      expect(out.total).toBe(30);
      expect(out.truncated).toBe(true);
    });

    it("limit=5 를 적용한다", async () => {
      const many = Array.from({ length: 10 }, (_, i) =>
        fakeStudent({ id: `s-${i}`, name: `학생${i}` }),
      );
      mockedSearch.mockResolvedValue({ success: true, students: many, total: 10 });

      const out = await listStudentsExecute({ limit: 5 });

      expect(out.ok).toBe(true);
      if (!out.ok) return;
      expect(out.students).toHaveLength(5);
      expect(out.truncated).toBe(true);
    });

    it("limit 이 총 개수보다 크면 truncated=false", async () => {
      mockedSearch.mockResolvedValue({
        success: true,
        students: [fakeStudent()],
        total: 1,
      });

      const out = await listStudentsExecute({ limit: 50 });

      expect(out.ok).toBe(true);
      if (!out.ok) return;
      expect(out.truncated).toBe(false);
    });
  });

  describe("실패 경로", () => {
    it("searchStudentsAction 실패 시 ok:false 로 reason 전달", async () => {
      mockedSearch.mockResolvedValue({
        success: false,
        students: [],
        total: 0,
        error: "테넌트 정보를 찾을 수 없습니다.",
      });

      const out = await listStudentsExecute({});

      expect(out.ok).toBe(false);
      if (out.ok) return;
      expect(out.reason).toBe("테넌트 정보를 찾을 수 없습니다.");
    });

    it("error 가 없으면 기본 메시지", async () => {
      mockedSearch.mockResolvedValue({
        success: false,
        students: [],
        total: 0,
      });

      const out = await listStudentsExecute({});

      expect(out.ok).toBe(false);
      if (out.ok) return;
      expect(out.reason).toBe("학생 목록을 불러오지 못했습니다.");
    });
  });
});

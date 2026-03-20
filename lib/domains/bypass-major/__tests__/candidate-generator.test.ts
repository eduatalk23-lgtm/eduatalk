import { describe, it, expect, vi, beforeEach } from "vitest";
import type {
  DepartmentWithCurriculum,
  BypassMajorPair,
  UniversityDepartment,
} from "../types";

// Mock repository
vi.mock("../repository", () => ({
  findDepartmentById: vi.fn(),
  findBypassPairs: vi.fn(),
  findDepartmentsByMajorClassification: vi.fn(),
  fetchCurriculumBatch: vi.fn(),
  findDepartmentByName: vi.fn(),
}));

// Mock server-only
vi.mock("server-only", () => ({}));

import { generateCandidates } from "../candidate-generator";
import {
  findDepartmentById,
  findBypassPairs,
  findDepartmentsByMajorClassification,
  fetchCurriculumBatch,
} from "../repository";

const mockedFindDepartmentById = vi.mocked(findDepartmentById);
const mockedFindBypassPairs = vi.mocked(findBypassPairs);
const mockedFindDeptsByClassification = vi.mocked(
  findDepartmentsByMajorClassification,
);
const mockedFetchCurriculumBatch = vi.mocked(fetchCurriculumBatch);

// ── fixtures ──────────────────────────────────────

const BASE_INPUT = {
  studentId: "student-1",
  targetDeptId: "dept-target",
  schoolYear: 2026,
  tenantId: "tenant-1",
};

function makeDept(
  id: string,
  override?: Partial<DepartmentWithCurriculum>,
): DepartmentWithCurriculum {
  return {
    id,
    legacy_id: 1,
    university_name: "서울대학교",
    college_name: null,
    department_name: "테스트학과",
    major_classification: "공학",
    mid_classification: null,
    sub_classification: null,
    classification_code: null,
    campus: null,
    notes: null,
    created_at: "",
    updated_at: "",
    curriculum: [],
    ...override,
  };
}

function makePair(
  id: string,
  bypassDeptId: string | null,
  bypassName: string,
): BypassMajorPair {
  return {
    id,
    department_id: "dept-target",
    bypass_department_name: bypassName,
    bypass_department_id: bypassDeptId,
    legacy_management_id: null,
    created_at: "",
  };
}

// ── tests ─────────────────────────────────────────

describe("generateCandidates", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("throws when target department not found", async () => {
    mockedFindDepartmentById.mockResolvedValue(null);

    await expect(generateCandidates(BASE_INPUT)).rejects.toThrow(
      "목표 학과를 찾을 수 없습니다.",
    );
  });

  it("returns pre-mapped candidates only", async () => {
    mockedFindDepartmentById.mockResolvedValue(makeDept("dept-target"));
    mockedFindBypassPairs.mockResolvedValue([
      makePair("p1", "dept-bypass-1", "우회학과A"),
      makePair("p2", "dept-bypass-2", "우회학과B"),
      makePair("p3", null, "미해소학과"), // bypass_department_id 없음 → 건너뜀
    ]);
    mockedFindDeptsByClassification.mockResolvedValue([]);
    mockedFetchCurriculumBatch.mockResolvedValue(
      new Map([
        ["dept-target", ["미적분", "선형대수", "확률통계"]],
        ["dept-bypass-1", ["미적분", "선형대수", "이산수학"]],
        ["dept-bypass-2", ["프로그래밍", "자료구조"]],
      ]),
    );

    const result = await generateCandidates(BASE_INPUT);

    expect(result.stats.preMapped).toBe(2);
    expect(result.stats.similarity).toBe(0);
    expect(result.candidates).toHaveLength(2);
    expect(result.candidates[0].source).toBe("pre_mapped");
    expect(result.candidates[0].candidate_department_id).toBe("dept-bypass-1");
  });

  it("returns similarity candidates from same major classification", async () => {
    mockedFindDepartmentById.mockResolvedValue(
      makeDept("dept-target", { major_classification: "공학" }),
    );
    mockedFindBypassPairs.mockResolvedValue([]);
    mockedFindDeptsByClassification.mockResolvedValue([
      { id: "dept-sim-1" } as UniversityDepartment,
      { id: "dept-sim-2" } as UniversityDepartment,
    ]);
    mockedFetchCurriculumBatch.mockResolvedValue(
      new Map([
        ["dept-target", ["미적분", "선형대수", "확률통계", "프로그래밍"]],
        ["dept-sim-1", ["미적분", "선형대수", "확률통계", "이산수학"]], // 높은 유사도
        ["dept-sim-2", ["경영학원론", "마케팅"]], // 낮은 유사도
      ]),
    );

    const result = await generateCandidates(BASE_INPUT);

    expect(result.stats.similarity).toBeGreaterThan(0);
    // dept-sim-2 유사도 < 10% → 제외
    const ids = result.candidates.map((c) => c.candidate_department_id);
    expect(ids).toContain("dept-sim-1");
    expect(ids).not.toContain("dept-sim-2");
  });

  it("filters out candidates below similarity threshold", async () => {
    mockedFindDepartmentById.mockResolvedValue(
      makeDept("dept-target", { major_classification: "공학" }),
    );
    mockedFindBypassPairs.mockResolvedValue([]);
    mockedFindDeptsByClassification.mockResolvedValue([
      { id: "dept-low" } as UniversityDepartment,
    ]);
    mockedFetchCurriculumBatch.mockResolvedValue(
      new Map([
        [
          "dept-target",
          Array.from({ length: 50 }, (_, i) => `과목${i}`),
        ],
        ["dept-low", ["완전다른과목A", "완전다른과목B"]], // 유사도 ~0%
      ]),
    );

    const result = await generateCandidates(BASE_INPUT);

    expect(result.candidates).toHaveLength(0);
    expect(result.stats.totalGenerated).toBe(0);
  });

  it("respects maxCandidates limit", async () => {
    mockedFindDepartmentById.mockResolvedValue(
      makeDept("dept-target", { major_classification: "공학" }),
    );
    mockedFindBypassPairs.mockResolvedValue([]);

    // 5개 유사 학과 생성
    const depts = Array.from({ length: 5 }, (_, i) => ({
      id: `dept-${i}`,
    })) as UniversityDepartment[];
    mockedFindDeptsByClassification.mockResolvedValue(depts);

    const currMap = new Map<string, string[]>();
    const targetCourses = ["A", "B", "C", "D", "E"];
    currMap.set("dept-target", targetCourses);
    for (let i = 0; i < 5; i++) {
      // 각각 다른 유사도
      currMap.set(`dept-${i}`, targetCourses.slice(0, 5 - i));
    }
    mockedFetchCurriculumBatch.mockResolvedValue(currMap);

    const result = await generateCandidates({
      ...BASE_INPUT,
      maxCandidates: 3,
    });

    expect(result.candidates.length).toBeLessThanOrEqual(3);
  });

  it("deduplicates pre-mapped and similarity candidates", async () => {
    mockedFindDepartmentById.mockResolvedValue(
      makeDept("dept-target", { major_classification: "공학" }),
    );
    // dept-dup is both pre-mapped AND in same classification
    mockedFindBypassPairs.mockResolvedValue([
      makePair("p1", "dept-dup", "중복학과"),
    ]);
    mockedFindDeptsByClassification.mockResolvedValue([
      { id: "dept-dup" } as UniversityDepartment,
      { id: "dept-other" } as UniversityDepartment,
    ]);
    mockedFetchCurriculumBatch.mockResolvedValue(
      new Map([
        ["dept-target", ["A", "B", "C"]],
        ["dept-dup", ["A", "B", "D"]], // 유사도 높음
        ["dept-other", ["A", "B", "E"]], // 유사도 높음
      ]),
    );

    const result = await generateCandidates(BASE_INPUT);

    // dept-dup should appear only once, as pre_mapped
    const dupCandidates = result.candidates.filter(
      (c) => c.candidate_department_id === "dept-dup",
    );
    expect(dupCandidates).toHaveLength(1);
    expect(dupCandidates[0].source).toBe("pre_mapped");

    // dept-other appears as similarity
    const otherCandidate = result.candidates.find(
      (c) => c.candidate_department_id === "dept-other",
    );
    expect(otherCandidate?.source).toBe("similarity");
  });

  it("handles target with no major_classification gracefully", async () => {
    mockedFindDepartmentById.mockResolvedValue(
      makeDept("dept-target", { major_classification: null }),
    );
    mockedFindBypassPairs.mockResolvedValue([]);
    mockedFetchCurriculumBatch.mockResolvedValue(new Map());

    const result = await generateCandidates(BASE_INPUT);

    // 대분류 없으면 similarity 후보 0
    expect(result.stats.similarity).toBe(0);
    expect(mockedFindDeptsByClassification).not.toHaveBeenCalled();
  });
});

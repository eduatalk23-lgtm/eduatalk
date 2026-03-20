import { describe, it, expect, vi, beforeEach } from "vitest";
import type {
  DepartmentWithCurriculum,
  BypassMajorPair,
  UniversityDepartment,
} from "../types";
import type { CourseWithType } from "../similarity-engine";

/** string[] → CourseWithType[] 헬퍼 */
function toCourses(names: string[]): CourseWithType[] {
  return names.map((n) => ({ courseName: n, courseType: null }));
}

// Mock repository
vi.mock("../repository", () => ({
  findDepartmentById: vi.fn(),
  findBypassPairs: vi.fn(),
  findDepartmentsByMajorClassification: vi.fn(),
  fetchCurriculumWithTypeBatch: vi.fn(),
  findDepartmentByName: vi.fn(),
}));

// Mock server-only
vi.mock("server-only", () => ({}));

import { generateCandidates } from "../candidate-generator";
import {
  findDepartmentById,
  findBypassPairs,
  findDepartmentsByMajorClassification,
  fetchCurriculumWithTypeBatch,
} from "../repository";

const mockedFindDepartmentById = vi.mocked(findDepartmentById);
const mockedFindBypassPairs = vi.mocked(findBypassPairs);
const mockedFindDeptsByClassification = vi.mocked(
  findDepartmentsByMajorClassification,
);
const mockedFetchCurriculumWithTypeBatch = vi.mocked(fetchCurriculumWithTypeBatch);

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
    mockedFetchCurriculumWithTypeBatch.mockResolvedValue(
      new Map([
        ["dept-target", toCourses(["미적분", "선형대수", "확률통계"])],
        ["dept-bypass-1", toCourses(["미적분", "선형대수", "이산수학"])],
        ["dept-bypass-2", toCourses(["프로그래밍", "자료구조"])],
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
    mockedFetchCurriculumWithTypeBatch.mockResolvedValue(
      new Map([
        ["dept-target", toCourses(["미적분", "선형대수", "확률통계", "프로그래밍"])],
        ["dept-sim-1", toCourses(["미적분", "선형대수", "확률통계", "이산수학"])],
        ["dept-sim-2", toCourses(["경영학원론", "마케팅"])],
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
    mockedFetchCurriculumWithTypeBatch.mockResolvedValue(
      new Map([
        [
          "dept-target",
          toCourses(Array.from({ length: 50 }, (_, i) => `과목${i}`)),
        ],
        ["dept-low", toCourses(["완전다른과목A", "완전다른과목B"])],
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

    const currMap = new Map<string, CourseWithType[]>();
    const targetNames = ["A", "B", "C", "D", "E"];
    currMap.set("dept-target", toCourses(targetNames));
    for (let i = 0; i < 5; i++) {
      currMap.set(`dept-${i}`, toCourses(targetNames.slice(0, 5 - i)));
    }
    mockedFetchCurriculumWithTypeBatch.mockResolvedValue(currMap);

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
    mockedFetchCurriculumWithTypeBatch.mockResolvedValue(
      new Map([
        ["dept-target", toCourses(["A", "B", "C"])],
        ["dept-dup", toCourses(["A", "B", "D"])],
        ["dept-other", toCourses(["A", "B", "E"])],
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
    mockedFetchCurriculumWithTypeBatch.mockResolvedValue(new Map());

    const result = await generateCandidates(BASE_INPUT);

    // 대분류 없으면 similarity 후보 0
    expect(result.stats.similarity).toBe(0);
    expect(mockedFindDeptsByClassification).not.toHaveBeenCalled();
  });
});

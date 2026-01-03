/**
 * Prerequisite Service Unit Tests
 * Phase 3.2: 선수지식 매핑 시스템
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  PrerequisiteService,
  getPrerequisiteGraph,
  suggestLearningOrder,
  identifyLearningGaps,
  recommendGapFillers,
  type Concept,
  type PrerequisiteGraph,
  type OrderedLearningPath,
  type LearningGap,
} from "@/lib/domains/plan/llm/services/prerequisiteService";

// ============================================
// Mocks
// ============================================

const mockSelect = vi.fn();
const mockInsert = vi.fn();
const mockEq = vi.fn();
const mockIn = vi.fn();
const mockOrder = vi.fn();
const mockSingle = vi.fn();
const mockNot = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(() =>
    Promise.resolve({
      from: vi.fn((table: string) => {
        return {
          select: mockSelect,
          insert: mockInsert,
        };
      }),
    })
  ),
}));

// ============================================
// Test Data
// ============================================

const mockConcepts: Concept[] = [
  {
    id: "concept-1",
    name: "이차함수",
    difficultyLevel: 2,
    prerequisites: [],
    keywords: ["함수", "이차"],
    subjectCategory: "수학",
  },
  {
    id: "concept-2",
    name: "이차방정식",
    difficultyLevel: 3,
    prerequisites: ["concept-1"],
    keywords: ["방정식", "이차"],
    subjectCategory: "수학",
  },
  {
    id: "concept-3",
    name: "판별식",
    difficultyLevel: 3,
    prerequisites: ["concept-2"],
    keywords: ["판별식", "근"],
    subjectCategory: "수학",
  },
  {
    id: "concept-4",
    name: "근과 계수의 관계",
    difficultyLevel: 4,
    prerequisites: ["concept-2", "concept-3"],
    keywords: ["근", "계수"],
    subjectCategory: "수학",
  },
];

const mockConceptDbRows = mockConcepts.map((c) => ({
  id: c.id,
  name: c.name,
  name_en: null,
  subject_id: null,
  subject_category: c.subjectCategory,
  difficulty_level: c.difficultyLevel,
  prerequisites: c.prerequisites,
  keywords: c.keywords,
  description: null,
  curriculum_revision: "2015",
  grade_level: [1, 2],
}));

const mockMappings = [
  {
    id: "mapping-1",
    content_type: "book",
    content_id: "book-1",
    concept_id: "concept-3",
    coverage_depth: 0.8,
    page_range: "[1,50)",
    episode_range: null,
  },
  {
    id: "mapping-2",
    content_type: "book",
    content_id: "book-1",
    concept_id: "concept-4",
    coverage_depth: 0.9,
    page_range: "[51,100)",
    episode_range: null,
  },
];

// ============================================
// Tests
// ============================================

describe("PrerequisiteService", () => {
  let service: PrerequisiteService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new PrerequisiteService("tenant-1");

    // Reset mock chains
    mockSelect.mockReturnValue({
      eq: mockEq,
      in: mockIn,
      order: mockOrder,
      single: mockSingle,
      not: mockNot,
    });
    mockEq.mockReturnValue({
      eq: mockEq,
      in: mockIn,
      order: mockOrder,
      single: mockSingle,
      not: mockNot,
    });
    mockIn.mockReturnValue({
      order: mockOrder,
      eq: mockEq,
    });
    mockOrder.mockReturnValue({
      data: [],
      error: null,
    });
    mockNot.mockReturnValue({
      data: [],
      error: null,
    });
  });

  describe("buildPrerequisiteGraph", () => {
    it("should return empty graph for empty content list", async () => {
      const result = await service.buildPrerequisiteGraph([]);

      expect(result.nodes.size).toBe(0);
      expect(result.roots).toEqual([]);
      expect(result.leaves).toEqual([]);
      expect(result.maxDepth).toBe(0);
    });

    it("should return empty graph when no mappings exist", async () => {
      mockIn.mockReturnValue({
        data: [],
        error: null,
      });

      const result = await service.buildPrerequisiteGraph(["book-1"]);

      expect(result.nodes.size).toBe(0);
    });

    it("should build graph with correct structure", async () => {
      // Mock mappings query
      mockIn.mockReturnValueOnce({
        data: mockMappings,
        error: null,
      });

      // Mock concepts query (first batch)
      mockIn.mockReturnValueOnce({
        data: mockConceptDbRows.filter((c) => ["concept-3", "concept-4"].includes(c.id)),
        error: null,
      });

      // Mock concepts query (prerequisites)
      mockIn.mockReturnValueOnce({
        data: mockConceptDbRows.filter((c) => ["concept-1", "concept-2"].includes(c.id)),
        error: null,
      });

      // Empty batch (no more prerequisites)
      mockIn.mockReturnValueOnce({
        data: [],
        error: null,
      });

      const result = await service.buildPrerequisiteGraph(["book-1"]);

      expect(result.nodes.size).toBe(4);
      expect(result.roots).toContain("concept-1");
      expect(result.leaves).toContain("concept-4");
    });

    it("should throw error on database failure", async () => {
      // Reset and set up mock to return error
      mockSelect.mockReset();
      mockSelect.mockReturnValue({
        in: vi.fn().mockReturnValue({
          data: null,
          error: { message: "Database error" },
        }),
      });

      await expect(service.buildPrerequisiteGraph(["book-1"])).rejects.toThrow(
        "Failed to fetch concept mappings"
      );
    });
  });

  describe("suggestLearningOrder", () => {
    it("should return empty path for empty content list", async () => {
      // Empty content list should return empty path without calling DB
      const result = await service.suggestLearningOrder([], "intermediate");

      expect(result.order).toEqual([]);
      expect(result.totalEstimatedHours).toBe(0);
    });

    it("should return topologically sorted order for beginner", async () => {
      setupGraphBuildingMocks();

      const result = await service.suggestLearningOrder(["book-1"], "beginner");

      expect(result.order.length).toBeGreaterThan(0);
      expect(result.reasoning).toContain("초급");
    });

    it("should return topologically sorted order for intermediate", async () => {
      setupGraphBuildingMocks();

      const result = await service.suggestLearningOrder(["book-1"], "intermediate");

      expect(result.order.length).toBeGreaterThan(0);
      expect(result.reasoning).toContain("중급");
    });

    it("should return topologically sorted order for advanced", async () => {
      setupGraphBuildingMocks();

      const result = await service.suggestLearningOrder(["book-1"], "advanced");

      expect(result.order.length).toBeGreaterThan(0);
      expect(result.reasoning).toContain("고급");
    });

    it("should include difficulty progression", async () => {
      setupGraphBuildingMocks();

      const result = await service.suggestLearningOrder(["book-1"], "intermediate");

      expect(result.difficultyProgression.length).toBe(result.order.length);
    });

    // Helper function to set up graph building mocks
    function setupGraphBuildingMocks() {
      mockIn.mockReset();
      mockIn.mockReturnValueOnce({
        data: mockMappings,
        error: null,
      });
      mockIn.mockReturnValueOnce({
        data: mockConceptDbRows.filter((c) => ["concept-3", "concept-4"].includes(c.id)),
        error: null,
      });
      mockIn.mockReturnValueOnce({
        data: mockConceptDbRows.filter((c) => ["concept-1", "concept-2"].includes(c.id)),
        error: null,
      });
      mockIn.mockReturnValueOnce({
        data: [],
        error: null,
      });
      mockIn.mockReturnValueOnce({
        data: mockMappings,
        error: null,
      });
    }
  });

  describe("identifyGaps", () => {
    it("should return empty gaps when no concepts required", async () => {
      mockEq.mockReturnValue({
        data: [],
        error: null,
      });

      const result = await service.identifyGaps("student-1", "book-1");

      expect(result).toEqual([]);
    });

    it("should identify missing prerequisites", async () => {
      // Mock content mapping
      mockEq.mockReturnValueOnce({
        data: [{ concept_id: "concept-3" }],
        error: null,
      });

      // Mock concept fetch (first batch)
      mockIn.mockReturnValueOnce({
        data: [mockConceptDbRows[2]], // concept-3
        error: null,
      });

      // Mock concept fetch (prerequisites)
      mockIn.mockReturnValueOnce({
        data: [mockConceptDbRows[1]], // concept-2
        error: null,
      });

      // Mock concept fetch (more prerequisites)
      mockIn.mockReturnValueOnce({
        data: [mockConceptDbRows[0]], // concept-1
        error: null,
      });

      // Empty batch
      mockIn.mockReturnValueOnce({
        data: [],
        error: null,
      });

      // Mock student completed plans
      mockEq.mockReturnValueOnce({
        eq: vi.fn().mockReturnValue({
          not: vi.fn().mockReturnValue({
            data: [], // No completed plans
            error: null,
          }),
        }),
      });

      const result = await service.identifyGaps("student-1", "book-1");

      // Student has no mastery, so all concepts should be gaps
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe("recommendGapFillers", () => {
    it("should return empty recommendations for empty gaps", async () => {
      const result = await service.recommendGapFillers([]);

      expect(result).toEqual([]);
    });

    it("should recommend content for gaps", async () => {
      const gaps: LearningGap[] = [
        {
          conceptId: "concept-2",
          conceptName: "이차방정식",
          gapType: "missing",
          currentMastery: 0,
          requiredMastery: 0.6,
          priority: 4,
          affectedTargets: ["book-1"],
        },
      ];

      // Reset and set up all mock calls for recommendGapFillers
      mockIn.mockReset();

      // 1. Mock content mappings for concept (getContentMappingsForConcepts)
      mockIn.mockReturnValueOnce({
        data: [
          {
            id: "mapping-3",
            content_type: "book",
            content_id: "book-2",
            concept_id: "concept-2",
            coverage_depth: 0.9,
            page_range: null,
            episode_range: null,
          },
        ],
        error: null,
      });

      // 2. Mock book details (getContentDetails - master_books)
      mockIn.mockReturnValueOnce({
        data: [
          {
            id: "book-2",
            title: "이차방정식 완벽정복",
            difficulty_level: 3,
            total_pages: 200,
          },
        ],
        error: null,
      });

      // 3. Mock lecture details (getContentDetails - master_lectures)
      mockIn.mockReturnValueOnce({
        data: [],
        error: null,
      });

      const result = await service.recommendGapFillers(gaps);

      expect(result.length).toBe(1);
      expect(result[0].contentId).toBe("book-2");
      expect(result[0].conceptsCovered).toContain("concept-2");
    });
  });

  describe("getConcept", () => {
    it("should return null for non-existent concept", async () => {
      mockSingle.mockResolvedValue({ data: null, error: null });

      const result = await service.getConcept("non-existent");

      expect(result).toBeNull();
    });

    it("should return concept when exists", async () => {
      mockSingle.mockResolvedValue({
        data: mockConceptDbRows[0],
        error: null,
      });

      const result = await service.getConcept("concept-1");

      expect(result).not.toBeNull();
      expect(result?.name).toBe("이차함수");
    });
  });

  describe("getConceptsBySubject", () => {
    it("should return empty array for unknown subject", async () => {
      mockOrder.mockReturnValue({
        data: [],
        error: null,
      });

      const result = await service.getConceptsBySubject("unknown");

      expect(result).toEqual([]);
    });

    it("should return concepts for subject", async () => {
      mockOrder.mockReturnValue({
        data: mockConceptDbRows,
        error: null,
      });

      const result = await service.getConceptsBySubject("수학");

      expect(result.length).toBe(4);
      expect(result[0].subjectCategory).toBe("수학");
    });
  });

  describe("createConcept", () => {
    it("should create concept and return id", async () => {
      mockInsert.mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { id: "new-concept-id" },
            error: null,
          }),
        }),
      });

      const result = await service.createConcept({
        name: "새 개념",
        difficultyLevel: 2,
        prerequisites: [],
        keywords: ["테스트"],
      });

      expect(result).toBe("new-concept-id");
    });

    it("should throw error on creation failure", async () => {
      mockInsert.mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: null,
            error: { message: "Insert failed" },
          }),
        }),
      });

      await expect(
        service.createConcept({
          name: "새 개념",
          difficultyLevel: 2,
          prerequisites: [],
          keywords: [],
        })
      ).rejects.toThrow("Failed to create concept");
    });
  });

  describe("createContentMapping", () => {
    it("should create mapping and return id", async () => {
      mockInsert.mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { id: "new-mapping-id" },
            error: null,
          }),
        }),
      });

      const result = await service.createContentMapping({
        contentType: "book",
        contentId: "book-1",
        conceptId: "concept-1",
        coverageDepth: 0.8,
        pageRange: [1, 50],
      });

      expect(result).toBe("new-mapping-id");
    });
  });

  describe("static utilities", () => {
    describe("graphToVisualizationData", () => {
      it("should convert graph to visualization format", () => {
        const mockGraph: PrerequisiteGraph = {
          nodes: new Map([
            [
              "concept-1",
              {
                concept: mockConcepts[0],
                depth: 0,
                children: [],
                parents: [],
              },
            ],
            [
              "concept-2",
              {
                concept: mockConcepts[1],
                depth: 1,
                children: [],
                parents: [],
              },
            ],
          ]),
          roots: ["concept-1"],
          leaves: ["concept-2"],
          maxDepth: 1,
        };

        // Link nodes
        const node1 = mockGraph.nodes.get("concept-1")!;
        const node2 = mockGraph.nodes.get("concept-2")!;
        node1.children.push(node2);
        node2.parents.push(node1);

        const result = PrerequisiteService.graphToVisualizationData(mockGraph);

        expect(result.nodes.length).toBe(2);
        expect(result.edges.length).toBe(1);
        expect(result.edges[0]).toEqual({ from: "concept-1", to: "concept-2" });
      });
    });

    describe("analyzeDifficultyProgression", () => {
      it("should return smooth for gradual progression", () => {
        const path: OrderedLearningPath = {
          order: [
            {
              conceptId: "1",
              conceptName: "A",
              order: 1,
              difficultyLevel: 2,
              estimatedHours: 1,
              isPrerequisite: false,
              relatedContentIds: [],
            },
            {
              conceptId: "2",
              conceptName: "B",
              order: 2,
              difficultyLevel: 3,
              estimatedHours: 1,
              isPrerequisite: false,
              relatedContentIds: [],
            },
          ],
          totalEstimatedHours: 2,
          difficultyProgression: [2, 3],
          reasoning: "test",
        };

        const result = PrerequisiteService.analyzeDifficultyProgression(path);

        expect(result.isSmooth).toBe(true);
        expect(result.maxJump).toBe(1);
        expect(result.recommendations).toEqual([]);
      });

      it("should detect steep jumps", () => {
        const path: OrderedLearningPath = {
          order: [
            {
              conceptId: "1",
              conceptName: "기초",
              order: 1,
              difficultyLevel: 1,
              estimatedHours: 1,
              isPrerequisite: false,
              relatedContentIds: [],
            },
            {
              conceptId: "2",
              conceptName: "심화",
              order: 2,
              difficultyLevel: 4,
              estimatedHours: 1,
              isPrerequisite: false,
              relatedContentIds: [],
            },
          ],
          totalEstimatedHours: 2,
          difficultyProgression: [1, 4],
          reasoning: "test",
        };

        const result = PrerequisiteService.analyzeDifficultyProgression(path);

        expect(result.isSmooth).toBe(false);
        expect(result.maxJump).toBe(3);
        expect(result.recommendations.length).toBeGreaterThan(0);
      });
    });
  });
});

describe("Convenience Functions", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockSelect.mockReturnValue({
      eq: mockEq,
      in: mockIn,
      order: mockOrder,
    });
    mockIn.mockReturnValue({
      data: [],
      error: null,
    });
    mockEq.mockReturnValue({
      data: [],
      error: null,
    });
  });

  it("getPrerequisiteGraph should be a function", () => {
    expect(typeof getPrerequisiteGraph).toBe("function");
  });

  it("suggestLearningOrder should be a function", () => {
    expect(typeof suggestLearningOrder).toBe("function");
  });

  it("identifyLearningGaps should be a function", () => {
    expect(typeof identifyLearningGaps).toBe("function");
  });

  it("recommendGapFillers should be a function", () => {
    expect(typeof recommendGapFillers).toBe("function");
  });
});

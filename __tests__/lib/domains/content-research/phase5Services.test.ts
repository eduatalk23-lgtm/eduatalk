/**
 * Phase 5 Services Unit Tests
 * 콘텐츠 축적 시스템 테스트
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ============================================================================
// Phase 5.1: AI Metadata Extractor Tests
// ============================================================================

describe("AIMetadataExtractor", () => {
  describe("Type Exports", () => {
    it("should export AIMetadataExtractor class", async () => {
      const { AIMetadataExtractor } = await import(
        "@/lib/domains/content-research/services/aiMetadataExtractor"
      );
      expect(AIMetadataExtractor).toBeDefined();
    });

    it("should export convenience functions", async () => {
      const {
        getAIMetadataExtractor,
        calculateOverallConfidence,
        isMetadataComplete,
      } = await import("@/lib/domains/content-research/services/aiMetadataExtractor");

      expect(typeof getAIMetadataExtractor).toBe("function");
      expect(typeof calculateOverallConfidence).toBe("function");
      expect(typeof isMetadataComplete).toBe("function");
    });
  });

  describe("AIMetadataExtractor Class", () => {
    it("should be instantiable with tenantId", async () => {
      const { AIMetadataExtractor } = await import(
        "@/lib/domains/content-research/services/aiMetadataExtractor"
      );

      const extractor = new AIMetadataExtractor("tenant-1");
      expect(extractor).toBeDefined();
      expect(typeof extractor.extractFromTitle).toBe("function");
      expect(typeof extractor.enrichWithPublisherInfo).toBe("function");
      expect(typeof extractor.extractBatch).toBe("function");
      expect(typeof extractor.findPublisherPattern).toBe("function");
      expect(typeof extractor.estimateCost).toBe("function");
    });
  });

  describe("calculateOverallConfidence", () => {
    it("should calculate weighted confidence from metadata", async () => {
      const { calculateOverallConfidence } = await import(
        "@/lib/domains/content-research/services/aiMetadataExtractor"
      );

      // ExtractedMetadata with confidence scores
      const metadata = {
        subject: "수학",
        subjectConfidence: 0.9,
        subjectCategory: "수학I",
        subjectCategoryConfidence: 0.85,
        difficulty: "intermediate" as const,
        difficultyConfidence: 0.8,
        gradeLevel: ["고1", "고2"],
        gradeLevelConfidence: 0.75,
        curriculum: "2015",
        curriculumConfidence: 0.7,
      };

      const result = calculateOverallConfidence(metadata);
      expect(typeof result).toBe("number");
      expect(result).toBeGreaterThan(0);
      expect(result).toBeLessThanOrEqual(1);
    });

    it("should handle metadata with zero confidence", async () => {
      const { calculateOverallConfidence } = await import(
        "@/lib/domains/content-research/services/aiMetadataExtractor"
      );

      const metadata = {
        subject: "",
        subjectConfidence: 0,
        subjectCategory: "",
        subjectCategoryConfidence: 0,
        difficulty: "easy" as const,
        difficultyConfidence: 0,
        gradeLevel: [],
        gradeLevelConfidence: 0,
        curriculum: "",
        curriculumConfidence: 0,
      };

      const result = calculateOverallConfidence(metadata);
      expect(result).toBe(0);
    });
  });

  describe("isMetadataComplete", () => {
    it("should return true for complete book metadata", async () => {
      const { isMetadataComplete } = await import(
        "@/lib/domains/content-research/services/aiMetadataExtractor"
      );

      const metadata = {
        subject: "수학",
        subjectConfidence: 0.9,
        subjectCategory: "수학I",
        subjectCategoryConfidence: 0.85,
        difficulty: "intermediate" as const,
        difficultyConfidence: 0.8,
        gradeLevel: ["고1", "고2"],
        gradeLevelConfidence: 0.75,
      };

      expect(isMetadataComplete(metadata, "book")).toBe(true);
    });

    it("should return false for incomplete metadata", async () => {
      const { isMetadataComplete } = await import(
        "@/lib/domains/content-research/services/aiMetadataExtractor"
      );

      const metadata = {
        subject: "수학",
        subjectConfidence: 0.9,
        // missing other required fields
      };

      expect(isMetadataComplete(metadata as any, "book")).toBe(false);
    });
  });
});

// ============================================================================
// Phase 5.2: Bulk Import Service Tests
// ============================================================================

describe("BulkImportService", () => {
  describe("Type Exports", () => {
    it("should export BulkImportService class", async () => {
      const { BulkImportService } = await import(
        "@/lib/domains/content-research/services/bulkImportService"
      );
      expect(BulkImportService).toBeDefined();
    });

    it("should export field constants", async () => {
      const { REQUIRED_FIELDS, RECOMMENDED_FIELDS } = await import(
        "@/lib/domains/content-research/services/bulkImportService"
      );

      expect(REQUIRED_FIELDS).toBeDefined();
      expect(REQUIRED_FIELDS.book).toBeDefined();
      expect(REQUIRED_FIELDS.lecture).toBeDefined();

      expect(RECOMMENDED_FIELDS).toBeDefined();
      expect(RECOMMENDED_FIELDS.book).toBeDefined();
      expect(RECOMMENDED_FIELDS.lecture).toBeDefined();
    });

    it("should export utility functions", async () => {
      const { formatValidationSummary, normalizeRowForDB } = await import(
        "@/lib/domains/content-research/services/bulkImportService"
      );

      expect(typeof formatValidationSummary).toBe("function");
      expect(typeof normalizeRowForDB).toBe("function");
    });
  });

  describe("BulkImportService Class", () => {
    it("should be instantiable with contentType", async () => {
      const { BulkImportService } = await import(
        "@/lib/domains/content-research/services/bulkImportService"
      );

      const bookService = new BulkImportService("book");
      expect(bookService).toBeDefined();
      expect(typeof bookService.validateRow).toBe("function");
      expect(typeof bookService.validateAll).toBe("function");
      expect(typeof bookService.calculateDerivedFields).toBe("function");
      expect(typeof bookService.getRequiredFields).toBe("function");
      expect(typeof bookService.getRecommendedFields).toBe("function");
    });

    it("should return correct required fields for books", async () => {
      const { BulkImportService } = await import(
        "@/lib/domains/content-research/services/bulkImportService"
      );

      const service = new BulkImportService("book");
      const requiredFields = service.getRequiredFields();

      expect(requiredFields).toContain("title");
      expect(requiredFields).toContain("subject");
      expect(requiredFields).toContain("total_pages");
    });

    it("should return correct required fields for lectures", async () => {
      const { BulkImportService } = await import(
        "@/lib/domains/content-research/services/bulkImportService"
      );

      const service = new BulkImportService("lecture");
      const requiredFields = service.getRequiredFields();

      expect(requiredFields).toContain("title");
      expect(requiredFields).toContain("subject");
      expect(requiredFields).toContain("total_episodes");
      expect(requiredFields).toContain("total_duration");
    });
  });

  describe("REQUIRED_FIELDS", () => {
    it("should have all AI plan generation required fields for books", async () => {
      const { REQUIRED_FIELDS } = await import(
        "@/lib/domains/content-research/services/bulkImportService"
      );

      const bookFields = REQUIRED_FIELDS.book;

      // AI 플랜 생성 필수 필드
      expect(bookFields).toContain("title");
      expect(bookFields).toContain("subject");
      expect(bookFields).toContain("subject_category");
      expect(bookFields).toContain("total_pages");
      expect(bookFields).toContain("difficulty_level");
    });

    it("should have all AI plan generation required fields for lectures", async () => {
      const { REQUIRED_FIELDS } = await import(
        "@/lib/domains/content-research/services/bulkImportService"
      );

      const lectureFields = REQUIRED_FIELDS.lecture;

      // AI 플랜 생성 필수 필드
      expect(lectureFields).toContain("title");
      expect(lectureFields).toContain("subject");
      expect(lectureFields).toContain("subject_category");
      expect(lectureFields).toContain("total_episodes");
      expect(lectureFields).toContain("total_duration");
      expect(lectureFields).toContain("difficulty_level");
    });
  });

  describe("normalizeRowForDB", () => {
    it("should normalize book row with derived fields", async () => {
      const { normalizeRowForDB } = await import(
        "@/lib/domains/content-research/services/bulkImportService"
      );

      const row = {
        title: "수학의 정석",
        subject: "수학",
        subject_category: "수학I",
        total_pages: 500,
        difficulty_level: "intermediate",
      };

      const normalized = normalizeRowForDB(row, "book");

      expect(normalized.title).toBe("수학의 정석");
      expect(normalized.total_pages).toBe(500);
    });

    it("should normalize lecture row", async () => {
      const { normalizeRowForDB } = await import(
        "@/lib/domains/content-research/services/bulkImportService"
      );

      const row = {
        title: "현우진 뉴런",
        subject: "수학",
        subject_category: "수학I",
        total_episodes: 48,
        total_duration: 2400,
        difficulty_level: "advanced",
      };

      const normalized = normalizeRowForDB(row, "lecture");

      expect(normalized.title).toBe("현우진 뉴런");
      expect(normalized.total_episodes).toBe(48);
      expect(normalized.total_duration).toBe(2400);
    });
  });

  describe("formatValidationSummary", () => {
    it("should format validation results correctly", async () => {
      const { formatValidationSummary } = await import(
        "@/lib/domains/content-research/services/bulkImportService"
      );

      const result = {
        totalRows: 10,
        validRows: 7,
        invalidRows: 3,
        warnings: 2,
        rows: [],
      };

      const summary = formatValidationSummary(result);

      expect(summary).toContain("10");
      expect(summary).toContain("7");
      expect(summary).toContain("3");
    });
  });
});

// ============================================================================
// Phase 5.3: Partners Actions Tests
// ============================================================================

describe("Partners Actions", () => {
  describe("Type Exports", () => {
    it("should export partner action functions", async () => {
      const {
        getPartners,
        getPartner,
        createPartner,
        updatePartner,
        deletePartner,
        getPartnerSyncLogs,
        togglePartnerActive,
      } = await import("@/lib/domains/content-research/actions/partners");

      expect(typeof getPartners).toBe("function");
      expect(typeof getPartner).toBe("function");
      expect(typeof createPartner).toBe("function");
      expect(typeof updatePartner).toBe("function");
      expect(typeof deletePartner).toBe("function");
      expect(typeof getPartnerSyncLogs).toBe("function");
      expect(typeof togglePartnerActive).toBe("function");
    });
  });
});

// ============================================================================
// Prompts Tests
// ============================================================================

describe("Metadata Extraction Prompts", () => {
  describe("Prompt Exports", () => {
    it("should export all prompt functions and constants", async () => {
      const {
        METADATA_EXTRACTION_SYSTEM_PROMPT,
        buildMetadataExtractionPrompt,
        parseMetadataResponse,
        estimateMetadataExtractionTokens,
      } = await import("@/lib/domains/content-research/prompts/metadataExtraction");

      expect(METADATA_EXTRACTION_SYSTEM_PROMPT).toBeDefined();
      expect(typeof METADATA_EXTRACTION_SYSTEM_PROMPT).toBe("string");
      expect(typeof buildMetadataExtractionPrompt).toBe("function");
      expect(typeof parseMetadataResponse).toBe("function");
      expect(typeof estimateMetadataExtractionTokens).toBe("function");
    });
  });

  describe("buildMetadataExtractionPrompt", () => {
    it("should build prompt for book content", async () => {
      const { buildMetadataExtractionPrompt } = await import(
        "@/lib/domains/content-research/prompts/metadataExtraction"
      );

      // API: buildMetadataExtractionPrompt(title, contentType, publisher?, additionalContext?)
      const prompt = buildMetadataExtractionPrompt(
        "수학의 정석 기본편",
        "book",
        "성지출판"
      );

      expect(prompt).toContain("수학의 정석");
      expect(prompt).toContain("성지출판");
      expect(prompt).toContain("교재"); // contentType 'book' → '교재'
    });

    it("should build prompt for lecture content", async () => {
      const { buildMetadataExtractionPrompt } = await import(
        "@/lib/domains/content-research/prompts/metadataExtraction"
      );

      const prompt = buildMetadataExtractionPrompt(
        "현우진 뉴런 수학1",
        "lecture"
      );

      expect(prompt).toContain("현우진");
      expect(prompt).toContain("강의"); // contentType 'lecture' → '강의'
    });
  });

  describe("estimateMetadataExtractionTokens", () => {
    it("should estimate tokens for extraction request", async () => {
      const { estimateMetadataExtractionTokens } = await import(
        "@/lib/domains/content-research/prompts/metadataExtraction"
      );

      // API: estimateMetadataExtractionTokens(title, contentType, publisher?)
      const estimate = estimateMetadataExtractionTokens(
        "수학의 정석",
        "book"
      );

      // Returns { systemTokens, userTokens, totalTokens }
      expect(typeof estimate).toBe("object");
      expect(estimate.systemTokens).toBeGreaterThan(0);
      expect(estimate.userTokens).toBeGreaterThan(0);
      expect(estimate.totalTokens).toBe(estimate.systemTokens + estimate.userTokens);
    });
  });
});

// ============================================================================
// Domain Index Exports Tests
// ============================================================================

describe("Content Research Domain Index Exports", () => {
  it("should export all Phase 5.1 AI extractor types and functions", async () => {
    const contentResearch = await import("@/lib/domains/content-research");

    // Service class
    expect(contentResearch.AIMetadataExtractor).toBeDefined();
    expect(contentResearch.getAIMetadataExtractor).toBeDefined();

    // Utility functions
    expect(typeof contentResearch.calculateOverallConfidence).toBe("function");
    expect(typeof contentResearch.isMetadataComplete).toBe("function");
  });

  it("should export all Phase 5.2 bulk import types and functions", async () => {
    const contentResearch = await import("@/lib/domains/content-research");

    // Service class
    expect(contentResearch.BulkImportService).toBeDefined();

    // Constants
    expect(contentResearch.REQUIRED_FIELDS).toBeDefined();
    expect(contentResearch.RECOMMENDED_FIELDS).toBeDefined();

    // Utility functions
    expect(typeof contentResearch.formatValidationSummary).toBe("function");
    expect(typeof contentResearch.normalizeRowForDB).toBe("function");
  });

  it("should export all Phase 5.3 partner actions", async () => {
    const contentResearch = await import("@/lib/domains/content-research");

    expect(typeof contentResearch.getPartners).toBe("function");
    expect(typeof contentResearch.getPartner).toBe("function");
    expect(typeof contentResearch.createPartner).toBe("function");
    expect(typeof contentResearch.updatePartner).toBe("function");
    expect(typeof contentResearch.deletePartner).toBe("function");
    expect(typeof contentResearch.getPartnerSyncLogs).toBe("function");
    expect(typeof contentResearch.togglePartnerActive).toBe("function");
  });

  it("should export prompt utilities", async () => {
    const contentResearch = await import("@/lib/domains/content-research");

    expect(contentResearch.METADATA_EXTRACTION_SYSTEM_PROMPT).toBeDefined();
    expect(typeof contentResearch.buildMetadataExtractionPrompt).toBe("function");
    expect(typeof contentResearch.parseMetadataResponse).toBe("function");
    expect(typeof contentResearch.estimateMetadataExtractionTokens).toBe("function");
  });

  it("should export action functions", async () => {
    const contentResearch = await import("@/lib/domains/content-research");

    // Extract metadata actions
    expect(typeof contentResearch.extractContentMetadata).toBe("function");
    expect(typeof contentResearch.extractBatchMetadata).toBe("function");
    expect(typeof contentResearch.getMetadataQualityScore).toBe("function");

    // Validate import actions
    expect(typeof contentResearch.validateImportData).toBe("function");
    expect(typeof contentResearch.applyAISuggestionsToRows).toBe("function");
    expect(typeof contentResearch.getFieldRequirements).toBe("function");
  });
});

/**
 * LLM Cache Service Unit Tests
 * Phase 2.1: LLM 응답 캐시 레이어
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  LLMCacheService,
  withLLMCache,
  type OperationType,
} from "@/lib/domains/plan/llm/services/llmCacheService";

// ============================================
// Mock Supabase Admin Client
// ============================================

const mockSelect = vi.fn();
const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockDelete = vi.fn();
const mockUpsert = vi.fn();
const mockRpc = vi.fn();

const mockFrom = vi.fn(() => ({
  select: mockSelect,
  insert: mockInsert,
  update: mockUpdate,
  delete: mockDelete,
  upsert: mockUpsert,
}));

const mockSupabaseClient = {
  from: mockFrom,
  rpc: mockRpc,
};

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: vi.fn(() => mockSupabaseClient),
}));

// ============================================
// Test Setup
// ============================================

describe("LLMCacheService", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Reset chain methods
    mockSelect.mockReturnValue({
      eq: vi.fn().mockReturnThis(),
      gt: vi.fn().mockReturnThis(),
      like: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    });

    mockUpsert.mockResolvedValue({ error: null });
    mockRpc.mockResolvedValue({ data: 0, error: null });
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  // ============================================
  // Static Methods Tests
  // ============================================

  describe("buildKey", () => {
    it("should create cache key in operation:identifier format", () => {
      const key = LLMCacheService.buildKey("plan_generation", "student_123");
      expect(key).toBe("plan_generation:student_123");
    });

    it("should handle different operation types", () => {
      const operations: OperationType[] = [
        "plan_generation",
        "plan_optimization",
        "content_recommendation",
        "framework_generation",
        "content_analysis",
      ];

      for (const op of operations) {
        const key = LLMCacheService.buildKey(op, "test");
        expect(key).toBe(`${op}:test`);
      }
    });
  });

  describe("hashRequest", () => {
    it("should generate consistent SHA256 hash", () => {
      const request = { a: 1, b: "test" };
      const hash1 = LLMCacheService.hashRequest(request);
      const hash2 = LLMCacheService.hashRequest(request);

      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64); // SHA256 hex is 64 characters
    });

    it("should normalize object keys for consistent hashing", () => {
      // Same content, different key order
      const request1 = { b: "test", a: 1 };
      const request2 = { a: 1, b: "test" };

      const hash1 = LLMCacheService.hashRequest(request1);
      const hash2 = LLMCacheService.hashRequest(request2);

      expect(hash1).toBe(hash2);
    });

    it("should handle nested objects", () => {
      const request = {
        student: { name: "test", grade: 2 },
        settings: { dailyMinutes: 180 },
      };
      const hash = LLMCacheService.hashRequest(request);

      expect(hash).toHaveLength(64);
    });

    it("should handle arrays", () => {
      const request = { items: [1, 2, 3], names: ["a", "b"] };
      const hash = LLMCacheService.hashRequest(request);

      expect(hash).toHaveLength(64);
    });

    it("should produce different hashes for different content", () => {
      const request1 = { a: 1 };
      const request2 = { a: 2 };

      const hash1 = LLMCacheService.hashRequest(request1);
      const hash2 = LLMCacheService.hashRequest(request2);

      expect(hash1).not.toBe(hash2);
    });
  });

  // ============================================
  // Instance Methods Tests
  // ============================================

  describe("get", () => {
    it("should return null on cache miss", async () => {
      const cache = new LLMCacheService("tenant-1");

      mockSelect.mockReturnValue({
        eq: vi.fn().mockReturnThis(),
        gt: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      });

      const result = await cache.get("plan_generation:test", "hash123");
      expect(result).toBeNull();
    });

    it("should return cached data on hit", async () => {
      const cache = new LLMCacheService("tenant-1");
      const cachedData = { plans: [{ date: "2026-01-05" }] };

      mockSelect.mockReturnValue({
        eq: vi.fn().mockReturnThis(),
        gt: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: {
            id: "cache-1",
            tenant_id: "tenant-1",
            response_data: cachedData,
          },
          error: null,
        }),
      });

      const result = await cache.get("plan_generation:test", "hash123");
      expect(result).toEqual(cachedData);
    });

    it("should filter by tenant_id", async () => {
      const cache = new LLMCacheService("tenant-1");

      mockSelect.mockReturnValue({
        eq: vi.fn().mockReturnThis(),
        gt: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: {
            id: "cache-1",
            tenant_id: "tenant-2", // Different tenant
            response_data: { data: "test" },
          },
          error: null,
        }),
      });

      const result = await cache.get("plan_generation:test", "hash123");
      expect(result).toBeNull(); // Should not return data from different tenant
    });

    it("should handle null tenant_id for global cache", async () => {
      const cache = new LLMCacheService(null);
      const cachedData = { plans: [] };

      mockSelect.mockReturnValue({
        eq: vi.fn().mockReturnThis(),
        gt: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: {
            id: "cache-1",
            tenant_id: null,
            response_data: cachedData,
          },
          error: null,
        }),
      });

      const result = await cache.get("plan_generation:test", "hash123");
      expect(result).toEqual(cachedData);
    });
  });

  describe("set", () => {
    it("should store cache entry with correct TTL", async () => {
      const cache = new LLMCacheService("tenant-1");
      const data = { plans: [{ date: "2026-01-05" }] };

      await cache.set("plan_generation:test", "hash123", data, "plan_generation");

      expect(mockFrom).toHaveBeenCalledWith("llm_response_cache");
      expect(mockUpsert).toHaveBeenCalled();

      const upsertCall = mockUpsert.mock.calls[0][0];
      expect(upsertCall.tenant_id).toBe("tenant-1");
      expect(upsertCall.cache_key).toBe("plan_generation:test");
      expect(upsertCall.request_hash).toBe("hash123");
      expect(upsertCall.response_data).toEqual(data);
      expect(upsertCall.operation_type).toBe("plan_generation");

      // Check expires_at is set (24 hours for plan_generation)
      const expiresAt = new Date(upsertCall.expires_at);
      const createdAt = new Date(upsertCall.created_at);
      const diffHours = (expiresAt.getTime() - createdAt.getTime()) / (1000 * 60 * 60);
      expect(diffHours).toBeCloseTo(24, 0);
    });

    it("should use different TTL for different operations", async () => {
      const cache = new LLMCacheService("tenant-1");
      const data = { recommendations: [] };

      await cache.set(
        "content_recommendation:test",
        "hash123",
        data,
        "content_recommendation"
      );

      const upsertCall = mockUpsert.mock.calls[0][0];
      const expiresAt = new Date(upsertCall.expires_at);
      const createdAt = new Date(upsertCall.created_at);
      const diffHours = (expiresAt.getTime() - createdAt.getTime()) / (1000 * 60 * 60);
      expect(diffHours).toBeCloseTo(1, 0); // 1 hour for content_recommendation
    });

    it("should store optional metadata", async () => {
      const cache = new LLMCacheService("tenant-1");
      const data = { plans: [] };

      await cache.set("plan_generation:test", "hash123", data, "plan_generation", {
        modelId: "claude-sonnet-4",
        tokenUsage: { input: 1000, output: 500 },
        costUsd: 0.015,
      });

      const upsertCall = mockUpsert.mock.calls[0][0];
      expect(upsertCall.model_id).toBe("claude-sonnet-4");
      expect(upsertCall.token_usage).toEqual({ input: 1000, output: 500 });
      expect(upsertCall.cost_usd).toBe(0.015);
    });
  });

  describe("invalidate", () => {
    it("should delete matching cache entries", async () => {
      const cache = new LLMCacheService("tenant-1");

      const mockDeleteChain = {
        like: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockResolvedValue({ data: [{ id: "1" }, { id: "2" }], error: null }),
      };
      mockDelete.mockReturnValue(mockDeleteChain);

      const deleted = await cache.invalidate("plan_generation:student_%");

      expect(mockFrom).toHaveBeenCalledWith("llm_response_cache");
      expect(mockDelete).toHaveBeenCalled();
      expect(deleted).toBe(2);
    });

    it("should handle no matches", async () => {
      const cache = new LLMCacheService("tenant-1");

      const mockDeleteChain = {
        like: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockResolvedValue({ data: [], error: null }),
      };
      mockDelete.mockReturnValue(mockDeleteChain);

      const deleted = await cache.invalidate("nonexistent:%");
      expect(deleted).toBe(0);
    });
  });

  describe("cleanup", () => {
    it("should call cleanup RPC function", async () => {
      const cache = new LLMCacheService("tenant-1");

      mockRpc.mockResolvedValue({ data: 5, error: null });

      const result = await cache.cleanup();

      expect(mockRpc).toHaveBeenCalledWith("cleanup_expired_llm_cache");
      expect(result).toEqual({ deleted: 5 });
    });

    it("should handle RPC errors", async () => {
      const cache = new LLMCacheService("tenant-1");

      mockRpc.mockResolvedValue({ data: null, error: { message: "Error" } });

      const result = await cache.cleanup();
      expect(result).toEqual({ deleted: 0 });
    });
  });

  describe("getStats", () => {
    it("should return cache statistics", async () => {
      const cache = new LLMCacheService("tenant-1");

      const mockStatsData = [
        {
          tenant_id: "tenant-1",
          operation_type: "plan_generation",
          total_entries: 100,
          total_hits: 250,
          active_entries: 80,
          total_cost_saved: "15.50",
          avg_input_tokens: "1000",
          avg_output_tokens: "500",
          last_cache_at: "2026-01-03T10:00:00Z",
        },
      ];

      // Chain mock for: from().select().eq().eq()
      const mockEqSecond = vi.fn().mockResolvedValue({ data: mockStatsData, error: null });
      const mockEqFirst = vi.fn().mockReturnValue({ eq: mockEqSecond });
      const mockSelectStats = vi.fn().mockReturnValue({ eq: mockEqFirst });

      mockFrom.mockReturnValue({
        select: mockSelectStats,
      });

      const stats = await cache.getStats("plan_generation");

      expect(stats).toHaveLength(1);
      expect(stats[0]).toEqual({
        tenantId: "tenant-1",
        operationType: "plan_generation",
        totalEntries: 100,
        totalHits: 250,
        activeEntries: 80,
        totalCostSaved: 15.5,
        avgInputTokens: 1000,
        avgOutputTokens: 500,
        lastCacheAt: "2026-01-03T10:00:00Z",
      });
    });
  });
});

// ============================================
// withLLMCache Helper Tests
// ============================================

describe("withLLMCache", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockSelect.mockReturnValue({
      eq: vi.fn().mockReturnThis(),
      gt: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    });
    mockUpsert.mockResolvedValue({ error: null });
  });

  it("should return cached data on hit", async () => {
    const cachedData = { plans: [{ date: "2026-01-05" }] };

    mockSelect.mockReturnValue({
      eq: vi.fn().mockReturnThis(),
      gt: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: {
          id: "cache-1",
          tenant_id: "tenant-1",
          response_data: cachedData,
        },
        error: null,
      }),
    });

    const fetchFn = vi.fn();

    const result = await withLLMCache(
      "tenant-1",
      "plan_generation",
      "student_123",
      { studentId: "123" },
      fetchFn
    );

    expect(result.data).toEqual(cachedData);
    expect(result.fromCache).toBe(true);
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("should call fetchFn on cache miss and store result", async () => {
    const newData = { plans: [{ date: "2026-01-06" }] };

    const fetchFn = vi.fn().mockResolvedValue({
      data: newData,
      modelId: "claude-sonnet-4",
      tokenUsage: { input: 1000, output: 500 },
      costUsd: 0.015,
    });

    const result = await withLLMCache(
      "tenant-1",
      "plan_generation",
      "student_123",
      { studentId: "123" },
      fetchFn
    );

    expect(result.data).toEqual(newData);
    expect(result.fromCache).toBe(false);
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(mockUpsert).toHaveBeenCalled();
  });
});

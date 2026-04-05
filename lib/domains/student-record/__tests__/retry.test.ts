import { describe, it, expect, vi, beforeEach } from "vitest";
import { withRetry } from "../llm/retry";

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("withRetry", () => {
  it("성공 시 즉시 반환", async () => {
    const fn = vi.fn().mockResolvedValue("ok");
    const result = await withRetry(fn);
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("일시 실패 후 재시도하여 성공 (짧은 backoff)", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error("500 internal server error"))
      .mockResolvedValue("ok");

    const result = await withRetry(fn, { backoff: [10, 20, 30], label: "test" });
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("최대 재시도 초과 시 마지막 에러 throw", async () => {
    const err = new Error("503 service unavailable");
    const fn = vi.fn().mockRejectedValue(err);

    await expect(
      withRetry(fn, { backoff: [10, 20, 30], maxRetries: 2, label: "test" }),
    ).rejects.toThrow(err);
    expect(fn).toHaveBeenCalledTimes(3); // 1 initial + 2 retries
  });

  describe("에러 카테고리별 적응형 백오프", () => {
    it("rate_limit: 429 에러 분류 및 재시도", async () => {
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      const fn = vi
        .fn()
        .mockRejectedValueOnce(new Error("429 rate limit exceeded"))
        .mockResolvedValue("ok");

      // maxRetries=1 + 짧은 테스트용 (적응형은 에러 카테고리로 분류)
      const result = await withRetry(fn, { maxRetries: 1, label: "test" });
      expect(result).toBe("ok");
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining("rate_limit"),
      );
    }, 10_000);

    it("client_error: 400 에러는 재시도 안 함", async () => {
      const err = new Error("400 bad request: invalid parameter");
      const fn = vi.fn().mockRejectedValue(err);

      await expect(withRetry(fn, { label: "test" })).rejects.toThrow(err);
      expect(fn).toHaveBeenCalledTimes(1); // 재시도 없이 즉시 throw
    });

    it("client_error: 403 에러도 재시도 안 함", async () => {
      const err = new Error("403 forbidden");
      const fn = vi.fn().mockRejectedValue(err);

      await expect(withRetry(fn, { label: "test" })).rejects.toThrow(err);
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it("timeout: 짧은 백오프로 빠르게 재시도", async () => {
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      const fn = vi
        .fn()
        .mockRejectedValueOnce(new Error("request timed out"))
        .mockResolvedValue("ok");

      const result = await withRetry(fn, { maxRetries: 1, label: "test" });
      expect(result).toBe("ok");
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining("timeout"),
      );
    });

    it("server_error: 중간 백오프", async () => {
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      const fn = vi
        .fn()
        .mockRejectedValueOnce(new Error("502 bad gateway"))
        .mockResolvedValue("ok");

      const result = await withRetry(fn, { maxRetries: 1, label: "test" });
      expect(result).toBe("ok");
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining("server_error"),
      );
    });

    it("unknown: 기존과 동일한 백오프", async () => {
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      const fn = vi
        .fn()
        .mockRejectedValueOnce(new Error("some unknown error"))
        .mockResolvedValue("ok");

      const result = await withRetry(fn, { maxRetries: 1, label: "test" });
      expect(result).toBe("ok");
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining("unknown"),
      );
    });
  });

  describe("하위 호환", () => {
    it("명시적 backoff 배열 전달 시 adaptive 무시", async () => {
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      // client_error(400)이지만 명시적 backoff → 재시도 시도
      const fn = vi
        .fn()
        .mockRejectedValueOnce(new Error("400 invalid"))
        .mockResolvedValue("ok");

      const result = await withRetry(fn, {
        backoff: [10, 20],
        maxRetries: 2,
        label: "test",
      });
      expect(result).toBe("ok");
      expect(fn).toHaveBeenCalledTimes(2);
      // adaptive 로그 안 남음
      expect(warnSpy).not.toHaveBeenCalled();
    });

    it("adaptiveBackoff: false 시 기존 동작", async () => {
      const fn = vi
        .fn()
        .mockRejectedValueOnce(new Error("some error"))
        .mockResolvedValue("ok");

      const result = await withRetry(fn, {
        adaptiveBackoff: false,
        backoff: [10],
        label: "test",
      });
      expect(result).toBe("ok");
      expect(fn).toHaveBeenCalledTimes(2);
    });
  });

  describe("에러 분류 정확도", () => {
    it("quota 에러 → rate_limit", async () => {
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      const fn = vi
        .fn()
        .mockRejectedValueOnce(new Error("RESOURCE_EXHAUSTED: quota exceeded"))
        .mockResolvedValue("ok");

      await withRetry(fn, { maxRetries: 1, label: "test" });
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("rate_limit"));
    }, 10_000);

    it("ECONNRESET → timeout", async () => {
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      const fn = vi
        .fn()
        .mockRejectedValueOnce(new Error("read ECONNRESET"))
        .mockResolvedValue("ok");

      await withRetry(fn, { maxRetries: 1, label: "test" });
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("timeout"));
    });

    it("non-Error 객체 → unknown", async () => {
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      const fn = vi
        .fn()
        .mockRejectedValueOnce("string error")
        .mockResolvedValue("ok");

      await withRetry(fn, { maxRetries: 1, label: "test" });
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("unknown"));
    });
  });
});

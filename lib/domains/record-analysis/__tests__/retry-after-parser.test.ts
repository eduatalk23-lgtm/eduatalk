import { describe, it, expect } from "vitest";
import { APICallError } from "ai";
import { extractRetryAfterMs } from "../llm/retry-after-parser";

describe("extractRetryAfterMs", () => {
  describe("APICallError responseHeaders", () => {
    it("Retry-After (초) 추출", () => {
      const err = new APICallError({
        message: "rate limit",
        url: "https://x",
        requestBodyValues: {},
        statusCode: 429,
        responseHeaders: { "retry-after": "23" },
      });
      expect(extractRetryAfterMs(err)).toBe(23_000);
    });

    it("Retry-After (HTTP-date) 추출", () => {
      const future = new Date(Date.now() + 10_000).toUTCString();
      const err = new APICallError({
        message: "rate limit",
        url: "https://x",
        requestBodyValues: {},
        statusCode: 429,
        responseHeaders: { "retry-after": future },
      });
      const ms = extractRetryAfterMs(err);
      expect(ms).toBeGreaterThan(8_000);
      expect(ms).toBeLessThanOrEqual(10_000);
    });

    it("X-RateLimit-Reset (delta 초) 추출", () => {
      const err = new APICallError({
        message: "rate limit",
        url: "https://x",
        requestBodyValues: {},
        statusCode: 429,
        responseHeaders: { "x-ratelimit-reset": "45" },
      });
      expect(extractRetryAfterMs(err)).toBe(45_000);
    });

    it("X-RateLimit-Reset (unix epoch 초) 추출", () => {
      const futureSec = Math.floor((Date.now() + 30_000) / 1000);
      const err = new APICallError({
        message: "rate limit",
        url: "https://x",
        requestBodyValues: {},
        statusCode: 429,
        responseHeaders: { "x-ratelimit-reset": String(futureSec) },
      });
      const ms = extractRetryAfterMs(err);
      expect(ms).toBeGreaterThan(28_000);
      expect(ms).toBeLessThanOrEqual(30_000);
    });
  });

  describe("Error.message 정규식", () => {
    it("'retry after 30s' 추출", () => {
      const err = new Error("Quota exceeded — please retry after 30s");
      expect(extractRetryAfterMs(err)).toBe(30_000);
    });

    it("'wait 12 seconds' 추출", () => {
      const err = new Error("Rate limited, wait 12 seconds");
      expect(extractRetryAfterMs(err)).toBe(12_000);
    });

    it("Gemini 'retry in 23.5s' 소수 추출 (ceil)", () => {
      const err = new Error("Resource exhausted — please retry in 23.5s");
      expect(extractRetryAfterMs(err)).toBe(23_500);
    });
  });

  describe("error.cause.headers (fetch Response)", () => {
    it("Headers 객체에서 Retry-After 추출", () => {
      const headers = new Headers({ "retry-after": "5" });
      const err = Object.assign(new Error("429"), { cause: { headers } });
      expect(extractRetryAfterMs(err)).toBe(5_000);
    });
  });

  describe("힌트 없음", () => {
    it("plain Error 는 null", () => {
      expect(extractRetryAfterMs(new Error("internal server error"))).toBeNull();
    });

    it("non-Error 는 null", () => {
      expect(extractRetryAfterMs("string")).toBeNull();
      expect(extractRetryAfterMs(null)).toBeNull();
      expect(extractRetryAfterMs({ foo: "bar" })).toBeNull();
    });

    it("음수 값은 null", () => {
      const err = new APICallError({
        message: "x",
        url: "https://x",
        requestBodyValues: {},
        statusCode: 429,
        responseHeaders: { "retry-after": "-1" },
      });
      expect(extractRetryAfterMs(err)).toBeNull();
    });
  });
});

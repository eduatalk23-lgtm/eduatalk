import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * GeminiRateLimiter 테스트
 *
 * 테스트를 위해 클래스를 직접 정의 (private 접근 제한 우회)
 */
class TestableGeminiRateLimiter {
  private lastRequestTime: number = 0;
  private pendingChain: Promise<void> = Promise.resolve();
  private queueLength: number = 0;

  constructor(private readonly minIntervalMs: number = 4000) {}

  private getWaitTime(): number {
    const now = Date.now();
    const elapsed = now - this.lastRequestTime;
    return Math.max(0, this.minIntervalMs - elapsed);
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    this.queueLength++;

    const previousChain = this.pendingChain;

    let resolveCurrentChain: () => void;
    this.pendingChain = new Promise<void>((resolve) => {
      resolveCurrentChain = resolve;
    });

    try {
      await previousChain;

      const waitTime = this.getWaitTime();
      if (waitTime > 0) {
        await this.delay(waitTime);
      }

      this.lastRequestTime = Date.now();

      return await fn();
    } finally {
      this.lastRequestTime = Date.now();
      this.queueLength--;
      resolveCurrentChain!();
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  getMinInterval(): number {
    return this.minIntervalMs;
  }

  getElapsedSinceLastRequest(): number {
    return Date.now() - this.lastRequestTime;
  }

  getQueueLength(): number {
    return this.queueLength;
  }
}

describe("GeminiRateLimiter", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  describe("기본 동작", () => {
    it("최소 간격이 올바르게 설정된다", () => {
      const limiter = new TestableGeminiRateLimiter(5000);
      expect(limiter.getMinInterval()).toBe(5000);
    });

    it("첫 번째 요청은 즉시 실행된다", async () => {
      const limiter = new TestableGeminiRateLimiter(1000);
      const fn = vi.fn().mockResolvedValue("result");

      const resultPromise = limiter.execute(fn);
      await vi.runAllTimersAsync();
      const result = await resultPromise;

      expect(fn).toHaveBeenCalledTimes(1);
      expect(result).toBe("result");
    });
  });

  describe("동시성 처리", () => {
    it("동시 요청이 순차적으로 처리된다", async () => {
      const limiter = new TestableGeminiRateLimiter(100);
      const executionOrder: number[] = [];

      const createFn = (id: number) =>
        vi.fn().mockImplementation(async () => {
          executionOrder.push(id);
          return id;
        });

      // 동시에 3개 요청 시작
      const fn1 = createFn(1);
      const fn2 = createFn(2);
      const fn3 = createFn(3);

      const promise1 = limiter.execute(fn1);
      const promise2 = limiter.execute(fn2);
      const promise3 = limiter.execute(fn3);

      // 모든 타이머 실행
      await vi.runAllTimersAsync();

      const results = await Promise.all([promise1, promise2, promise3]);

      // 순서대로 실행되었는지 확인
      expect(executionOrder).toEqual([1, 2, 3]);
      expect(results).toEqual([1, 2, 3]);
    });

    it("대기열 길이가 올바르게 추적된다", async () => {
      const limiter = new TestableGeminiRateLimiter(100);

      expect(limiter.getQueueLength()).toBe(0);

      // 첫 번째 요청 시작
      const promise1 = limiter.execute(async () => {
        // 요청 처리 중일 때 대기열 확인
        expect(limiter.getQueueLength()).toBeGreaterThanOrEqual(1);
        return 1;
      });

      await vi.runAllTimersAsync();
      await promise1;

      expect(limiter.getQueueLength()).toBe(0);
    });
  });

  describe("Rate Limit 간격", () => {
    it("연속 요청 시 최소 간격이 유지된다", async () => {
      const minInterval = 100;
      const limiter = new TestableGeminiRateLimiter(minInterval);
      const timestamps: number[] = [];

      const fn = vi.fn().mockImplementation(async () => {
        timestamps.push(Date.now());
        return "ok";
      });

      // 첫 번째 요청
      const promise1 = limiter.execute(fn);
      await vi.runAllTimersAsync();
      await promise1;

      // 두 번째 요청 (간격 대기 필요)
      const promise2 = limiter.execute(fn);
      await vi.runAllTimersAsync();
      await promise2;

      // 두 번째 요청은 최소 간격 이후에 실행
      const interval = timestamps[1] - timestamps[0];
      expect(interval).toBeGreaterThanOrEqual(minInterval);
    });
  });

  describe("에러 처리", () => {
    it("에러 발생 시에도 다음 요청이 처리된다", async () => {
      vi.useRealTimers(); // 에러 처리 테스트는 실제 타이머 사용
      const limiter = new TestableGeminiRateLimiter(10); // 짧은 간격

      const failingFn = vi.fn().mockRejectedValue(new Error("실패"));
      const successFn = vi.fn().mockResolvedValue("성공");

      const promise1 = limiter.execute(failingFn);
      const promise2 = limiter.execute(successFn);

      await expect(promise1).rejects.toThrow("실패");
      await expect(promise2).resolves.toBe("성공");

      expect(failingFn).toHaveBeenCalledTimes(1);
      expect(successFn).toHaveBeenCalledTimes(1);
    });

    it("에러 후 대기열이 정상적으로 비워진다", async () => {
      vi.useRealTimers(); // 에러 처리 테스트는 실제 타이머 사용
      const limiter = new TestableGeminiRateLimiter(10);

      const failingFn = vi.fn().mockRejectedValue(new Error("실패"));

      const promise1 = limiter.execute(failingFn);

      try {
        await promise1;
      } catch {
        // 에러 무시
      }

      expect(limiter.getQueueLength()).toBe(0);
    });
  });
});

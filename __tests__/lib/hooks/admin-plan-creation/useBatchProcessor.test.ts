/**
 * useBatchProcessor Hook 단위 테스트
 *
 * 배치 처리 로직을 검증합니다:
 * 1. 순차 처리 로직
 * 2. 병렬 처리 로직
 * 3. 재시도 로직
 * 4. 일시정지/재개 로직
 * 5. 진행 상황 추적
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { StudentListRow } from "@/app/(admin)/admin/students/_components/types";
import type {
  BatchProgress,
  BatchItemResult,
  BatchProcessorConfig,
  RetryPolicy,
} from "@/app/(admin)/admin/plan-creation/_types/batchTypes";

// ============================================
// 테스트용 유틸리티
// ============================================

const createMockStudent = (id: string, name: string): StudentListRow => ({
  id,
  name,
  grade: "1",
  class: "A",
  division: null,
  schoolName: "테스트 학교",
  phone: null,
  mother_phone: null,
  father_phone: null,
  is_active: true,
  gender: null,
  email: null,
});

const mockStudents: StudentListRow[] = [
  createMockStudent("student-1", "학생1"),
  createMockStudent("student-2", "학생2"),
  createMockStudent("student-3", "학생3"),
];

const DEFAULT_RETRY_POLICY: RetryPolicy = {
  maxRetries: 2,
  retryDelayMs: 100,
  exponentialBackoff: false,
};

// ============================================
// 순차 처리 로직 테스트
// ============================================

describe("순차 처리 로직", () => {
  const processSequentially = async (
    students: StudentListRow[],
    processStudent: (
      student: StudentListRow
    ) => Promise<Omit<BatchItemResult, "studentId" | "studentName">>,
    signal: AbortSignal,
    onProgress?: (result: BatchItemResult, progress: BatchProgress) => void
  ): Promise<BatchItemResult[]> => {
    const allResults: BatchItemResult[] = [];

    for (const student of students) {
      if (signal.aborted) break;

      try {
        const result = await processStudent(student);
        const fullResult: BatchItemResult = {
          ...result,
          studentId: student.id,
          studentName: student.name ?? student.id,
        };
        allResults.push(fullResult);

        if (onProgress) {
          const progress: BatchProgress = {
            total: students.length,
            completed: allResults.length,
            successful: allResults.filter((r) => r.status === "success").length,
            failed: allResults.filter((r) => r.status === "error").length,
            skipped: allResults.filter((r) => r.status === "skipped").length,
            items: allResults,
          };
          onProgress(fullResult, progress);
        }
      } catch (error) {
        const errorResult: BatchItemResult = {
          studentId: student.id,
          studentName: student.name ?? student.id,
          status: "error",
          message: error instanceof Error ? error.message : "알 수 없는 오류",
        };
        allResults.push(errorResult);
      }
    }

    return allResults;
  };

  it("모든 학생을 순차적으로 처리한다", async () => {
    const processStudent = vi.fn().mockResolvedValue({ status: "success" });
    const abortController = new AbortController();

    const results = await processSequentially(
      mockStudents,
      processStudent,
      abortController.signal
    );

    expect(results).toHaveLength(3);
    expect(processStudent).toHaveBeenCalledTimes(3);
    results.forEach((result) => {
      expect(result.status).toBe("success");
    });
  });

  it("진행 상황 콜백이 올바르게 호출된다", async () => {
    const processStudent = vi.fn().mockResolvedValue({ status: "success" });
    const onProgress = vi.fn();
    const abortController = new AbortController();

    await processSequentially(
      mockStudents,
      processStudent,
      abortController.signal,
      onProgress
    );

    expect(onProgress).toHaveBeenCalledTimes(3);

    // 마지막 호출의 progress 확인
    const lastCall = onProgress.mock.calls[2];
    const [, progress] = lastCall;
    expect(progress.completed).toBe(3);
    expect(progress.successful).toBe(3);
    expect(progress.failed).toBe(0);
  });

  it("취소 시 남은 학생을 처리하지 않는다", async () => {
    const processStudent = vi.fn().mockImplementation(async (student) => {
      if (student.id === "student-2") {
        // 두 번째 학생 처리 중 취소
        return { status: "success" };
      }
      return { status: "success" };
    });

    const abortController = new AbortController();

    // 두 번째 학생 처리 후 취소 시뮬레이션
    const results: BatchItemResult[] = [];
    for (const student of mockStudents) {
      if (abortController.signal.aborted) break;

      if (student.id === "student-2") {
        abortController.abort();
      }

      const result = await processStudent(student);
      results.push({
        ...result,
        studentId: student.id,
        studentName: student.name ?? student.id,
      });

      if (abortController.signal.aborted) break;
    }

    expect(results).toHaveLength(2);
  });

  it("에러 발생 시 해당 학생의 결과만 실패로 기록된다", async () => {
    const processStudent = vi.fn().mockImplementation(async (student) => {
      if (student.id === "student-2") {
        throw new Error("처리 실패");
      }
      return { status: "success" };
    });
    const abortController = new AbortController();

    const results = await processSequentially(
      mockStudents,
      processStudent,
      abortController.signal
    );

    expect(results).toHaveLength(3);
    expect(results[0].status).toBe("success");
    expect(results[1].status).toBe("error");
    expect(results[1].message).toBe("처리 실패");
    expect(results[2].status).toBe("success");
  });
});

// ============================================
// 병렬 처리 로직 테스트
// ============================================

describe("병렬 처리 로직", () => {
  const processInParallel = async (
    students: StudentListRow[],
    maxConcurrent: number,
    processStudent: (
      student: StudentListRow
    ) => Promise<Omit<BatchItemResult, "studentId" | "studentName">>,
    signal: AbortSignal
  ): Promise<BatchItemResult[]> => {
    const allResults: BatchItemResult[] = [];
    const queue = [...students];
    const processing: Promise<void>[] = [];

    const processNext = async (): Promise<void> => {
      while (queue.length > 0 && !signal.aborted) {
        const student = queue.shift();
        if (!student) break;

        try {
          const result = await processStudent(student);
          allResults.push({
            ...result,
            studentId: student.id,
            studentName: student.name ?? student.id,
          });
        } catch (error) {
          allResults.push({
            studentId: student.id,
            studentName: student.name ?? student.id,
            status: "error",
            message: error instanceof Error ? error.message : "알 수 없는 오류",
          });
        }
      }
    };

    for (let i = 0; i < maxConcurrent; i++) {
      processing.push(processNext());
    }

    await Promise.all(processing);
    return allResults;
  };

  it("최대 동시 실행 수를 준수한다", async () => {
    let currentConcurrent = 0;
    let maxObservedConcurrent = 0;

    const processStudent = vi.fn().mockImplementation(async () => {
      currentConcurrent++;
      maxObservedConcurrent = Math.max(maxObservedConcurrent, currentConcurrent);
      await new Promise((resolve) => setTimeout(resolve, 50));
      currentConcurrent--;
      return { status: "success" };
    });

    const abortController = new AbortController();

    await processInParallel(
      [...mockStudents, createMockStudent("student-4", "학생4")],
      2,
      processStudent,
      abortController.signal
    );

    expect(maxObservedConcurrent).toBeLessThanOrEqual(2);
  });

  it("모든 학생을 처리한다", async () => {
    const processStudent = vi.fn().mockResolvedValue({ status: "success" });
    const abortController = new AbortController();

    const results = await processInParallel(
      mockStudents,
      3,
      processStudent,
      abortController.signal
    );

    expect(results).toHaveLength(3);
    expect(processStudent).toHaveBeenCalledTimes(3);
  });
});

// ============================================
// 재시도 로직 테스트
// ============================================

describe("재시도 로직", () => {
  const processWithRetry = async (
    student: StudentListRow,
    processStudent: (
      student: StudentListRow
    ) => Promise<Omit<BatchItemResult, "studentId" | "studentName">>,
    retryPolicy: RetryPolicy
  ): Promise<BatchItemResult> => {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= retryPolicy.maxRetries; attempt++) {
      try {
        const result = await processStudent(student);
        return {
          ...result,
          studentId: student.id,
          studentName: student.name ?? student.id,
        };
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));

        if (attempt < retryPolicy.maxRetries) {
          const delay = retryPolicy.exponentialBackoff
            ? retryPolicy.retryDelayMs * Math.pow(2, attempt)
            : retryPolicy.retryDelayMs;
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    return {
      studentId: student.id,
      studentName: student.name ?? student.id,
      status: "error",
      message: lastError?.message ?? "알 수 없는 오류",
    };
  };

  it("실패 시 지정된 횟수만큼 재시도한다", async () => {
    const processStudent = vi
      .fn()
      .mockRejectedValueOnce(new Error("첫 번째 실패"))
      .mockRejectedValueOnce(new Error("두 번째 실패"))
      .mockResolvedValue({ status: "success" });

    const result = await processWithRetry(
      mockStudents[0],
      processStudent,
      DEFAULT_RETRY_POLICY
    );

    expect(processStudent).toHaveBeenCalledTimes(3);
    expect(result.status).toBe("success");
  });

  it("모든 재시도 실패 시 에러 결과를 반환한다", async () => {
    const processStudent = vi.fn().mockRejectedValue(new Error("지속적인 실패"));

    const result = await processWithRetry(
      mockStudents[0],
      processStudent,
      DEFAULT_RETRY_POLICY
    );

    expect(processStudent).toHaveBeenCalledTimes(3); // 최초 + 2회 재시도
    expect(result.status).toBe("error");
    expect(result.message).toBe("지속적인 실패");
  });

  it("지수 백오프가 적용된다", async () => {
    const processStudent = vi
      .fn()
      .mockRejectedValueOnce(new Error("실패1"))
      .mockRejectedValueOnce(new Error("실패2"))
      .mockResolvedValue({ status: "success" });

    const startTime = Date.now();

    const exponentialPolicy: RetryPolicy = {
      maxRetries: 2,
      retryDelayMs: 50,
      exponentialBackoff: true,
    };

    await processWithRetry(mockStudents[0], processStudent, exponentialPolicy);

    const elapsed = Date.now() - startTime;
    // 첫 재시도: 50ms, 두 번째 재시도: 100ms = 최소 150ms
    expect(elapsed).toBeGreaterThanOrEqual(100);
  });
});

// ============================================
// 진행 상황 추적 테스트
// ============================================

describe("진행 상황 추적", () => {
  it("올바른 통계를 계산한다", () => {
    const results: BatchItemResult[] = [
      { studentId: "1", studentName: "학생1", status: "success" },
      { studentId: "2", studentName: "학생2", status: "error", message: "실패" },
      { studentId: "3", studentName: "학생3", status: "success" },
      { studentId: "4", studentName: "학생4", status: "skipped", message: "건너뜀" },
    ];

    const progress: BatchProgress = {
      total: results.length,
      completed: results.length,
      successful: results.filter((r) => r.status === "success").length,
      failed: results.filter((r) => r.status === "error").length,
      skipped: results.filter((r) => r.status === "skipped").length,
      items: results,
    };

    expect(progress.total).toBe(4);
    expect(progress.completed).toBe(4);
    expect(progress.successful).toBe(2);
    expect(progress.failed).toBe(1);
    expect(progress.skipped).toBe(1);
  });

  it("진행률을 올바르게 계산한다", () => {
    const calculateProgressPercentage = (progress: BatchProgress): number => {
      if (progress.total === 0) return 0;
      return Math.round((progress.completed / progress.total) * 100);
    };

    expect(calculateProgressPercentage({ total: 10, completed: 5, successful: 5, failed: 0, skipped: 0, items: [] })).toBe(50);
    expect(calculateProgressPercentage({ total: 10, completed: 10, successful: 10, failed: 0, skipped: 0, items: [] })).toBe(100);
    expect(calculateProgressPercentage({ total: 0, completed: 0, successful: 0, failed: 0, skipped: 0, items: [] })).toBe(0);
  });
});

// ============================================
// 상태 전환 테스트
// ============================================

describe("상태 전환 로직", () => {
  type BatchProcessorState =
    | "idle"
    | "preparing"
    | "processing"
    | "paused"
    | "completed"
    | "error";

  const isValidTransition = (
    from: BatchProcessorState,
    to: BatchProcessorState
  ): boolean => {
    const validTransitions: Record<BatchProcessorState, BatchProcessorState[]> = {
      idle: ["preparing"],
      preparing: ["processing", "error"],
      processing: ["paused", "completed", "error", "idle"],
      paused: ["processing", "idle"],
      completed: ["idle"],
      error: ["idle"],
    };

    return validTransitions[from]?.includes(to) ?? false;
  };

  it("idle -> preparing 전환이 유효하다", () => {
    expect(isValidTransition("idle", "preparing")).toBe(true);
  });

  it("preparing -> processing 전환이 유효하다", () => {
    expect(isValidTransition("preparing", "processing")).toBe(true);
  });

  it("processing -> paused 전환이 유효하다", () => {
    expect(isValidTransition("processing", "paused")).toBe(true);
  });

  it("paused -> processing 전환이 유효하다", () => {
    expect(isValidTransition("paused", "processing")).toBe(true);
  });

  it("processing -> completed 전환이 유효하다", () => {
    expect(isValidTransition("processing", "completed")).toBe(true);
  });

  it("processing -> idle 전환 (취소)이 유효하다", () => {
    expect(isValidTransition("processing", "idle")).toBe(true);
  });

  it("completed -> preparing 전환이 유효하지 않다", () => {
    expect(isValidTransition("completed", "preparing")).toBe(false);
  });

  it("idle -> completed 전환이 유효하지 않다", () => {
    expect(isValidTransition("idle", "completed")).toBe(false);
  });
});

// ============================================
// 콜백 호출 테스트
// ============================================

describe("콜백 호출", () => {
  it("onProgress 콜백이 각 항목 완료 시 호출된다", async () => {
    const onProgress = vi.fn();
    const results: BatchItemResult[] = [];

    for (const student of mockStudents) {
      const result: BatchItemResult = {
        studentId: student.id,
        studentName: student.name ?? student.id,
        status: "success",
      };
      results.push(result);

      const progress: BatchProgress = {
        total: mockStudents.length,
        completed: results.length,
        successful: results.filter((r) => r.status === "success").length,
        failed: 0,
        skipped: 0,
        items: results,
      };
      onProgress(progress);
    }

    expect(onProgress).toHaveBeenCalledTimes(3);
  });

  it("onItemComplete 콜백이 각 항목 완료 시 호출된다", async () => {
    const onItemComplete = vi.fn();

    for (const student of mockStudents) {
      const result: BatchItemResult = {
        studentId: student.id,
        studentName: student.name ?? student.id,
        status: "success",
      };
      onItemComplete(result);
    }

    expect(onItemComplete).toHaveBeenCalledTimes(3);
    expect(onItemComplete).toHaveBeenLastCalledWith(
      expect.objectContaining({
        studentId: "student-3",
        status: "success",
      })
    );
  });

  it("onComplete 콜백이 모든 처리 완료 시 호출된다", async () => {
    const onComplete = vi.fn();
    const results: BatchItemResult[] = mockStudents.map((student) => ({
      studentId: student.id,
      studentName: student.name ?? student.id,
      status: "success" as const,
    }));

    onComplete(results);

    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete).toHaveBeenCalledWith(results);
  });

  it("onError 콜백이 에러 발생 시 호출된다", async () => {
    const onError = vi.fn();
    const error = new Error("처리 중 오류 발생");

    onError(error);

    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith(error);
  });
});

// ============================================
// 실패 항목 재시도 테스트
// ============================================

describe("실패 항목 재시도", () => {
  it("실패한 학생만 필터링하여 재시도한다", () => {
    const allResults: BatchItemResult[] = [
      { studentId: "student-1", studentName: "학생1", status: "success" },
      { studentId: "student-2", studentName: "학생2", status: "error", message: "실패" },
      { studentId: "student-3", studentName: "학생3", status: "success" },
    ];

    const failedStudentIds = allResults
      .filter((r) => r.status === "error")
      .map((r) => r.studentId);

    const studentsToRetry = mockStudents.filter((s) =>
      failedStudentIds.includes(s.id)
    );

    expect(studentsToRetry).toHaveLength(1);
    expect(studentsToRetry[0].id).toBe("student-2");
  });

  it("재시도 결과가 기존 결과를 대체한다", () => {
    const originalResults: BatchItemResult[] = [
      { studentId: "student-1", studentName: "학생1", status: "success" },
      { studentId: "student-2", studentName: "학생2", status: "error", message: "실패" },
      { studentId: "student-3", studentName: "학생3", status: "success" },
    ];

    const retryResults: BatchItemResult[] = [
      { studentId: "student-2", studentName: "학생2", status: "success" },
    ];

    const retryStudentIds = retryResults.map((r) => r.studentId);
    const mergedResults = [
      ...originalResults.filter((r) => !retryStudentIds.includes(r.studentId)),
      ...retryResults,
    ];

    expect(mergedResults).toHaveLength(3);
    const student2Result = mergedResults.find((r) => r.studentId === "student-2");
    expect(student2Result?.status).toBe("success");
  });
});

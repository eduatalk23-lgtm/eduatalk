"use client";

/**
 * 배치 처리 훅
 * 여러 학생에 대한 플랜 생성을 순차/병렬로 처리
 */

import { useState, useCallback, useRef } from "react";
import type { StudentListRow } from "@/app/(admin)/admin/students/_components/types";
import type {
  BatchProgress,
  BatchItemResult,
  BatchProcessorState,
  BatchProcessorConfig,
  BatchProcessorControl,
  RetryPolicy,
} from "../_types/batchTypes";

interface UseBatchProcessorOptions<TSettings> {
  students: StudentListRow[];
  settings?: TSettings;
  config: BatchProcessorConfig;
  processStudent: (
    student: StudentListRow,
    settings: TSettings | undefined,
    signal: AbortSignal
  ) => Promise<Omit<BatchItemResult, "studentId" | "studentName">>;
}

interface UseBatchProcessorReturn extends BatchProcessorControl {
  state: BatchProcessorState;
  progress: BatchProgress;
  results: BatchItemResult[];
  error: Error | null;
}

const DEFAULT_RETRY_POLICY: RetryPolicy = {
  maxRetries: 2,
  retryDelayMs: 1000,
  exponentialBackoff: true,
};

export function useBatchProcessor<TSettings = unknown>({
  students,
  settings,
  config,
  processStudent,
}: UseBatchProcessorOptions<TSettings>): UseBatchProcessorReturn {
  const [state, setState] = useState<BatchProcessorState>("idle");
  const [progress, setProgress] = useState<BatchProgress>({
    total: students.length,
    completed: 0,
    successful: 0,
    failed: 0,
    skipped: 0,
    items: [],
  });
  const [results, setResults] = useState<BatchItemResult[]>([]);
  const [error, setError] = useState<Error | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const isPausedRef = useRef(false);
  const resumeResolverRef = useRef<(() => void) | null>(null);

  const retryPolicy = config.retry ?? DEFAULT_RETRY_POLICY;

  // 진행 상황 업데이트 헬퍼
  const updateProgress = useCallback(
    (result: BatchItemResult, newProgress: Partial<BatchProgress>) => {
      setProgress((prev) => {
        const updated = {
          ...prev,
          ...newProgress,
          items: [...prev.items.filter((i) => i.studentId !== result.studentId), result],
        };
        config.onProgress?.(updated);
        return updated;
      });
    },
    [config]
  );

  // 개별 학생 처리 (재시도 로직 포함)
  const processStudentWithRetry = useCallback(
    async (
      student: StudentListRow,
      signal: AbortSignal
    ): Promise<BatchItemResult> => {
      let lastError: Error | null = null;

      for (let attempt = 0; attempt <= retryPolicy.maxRetries; attempt++) {
        // 취소 확인
        if (signal.aborted) {
          return {
            studentId: student.id,
            studentName: student.name ?? student.id,
            status: "skipped",
            message: "취소됨",
          };
        }

        // 일시정지 확인
        while (isPausedRef.current) {
          await new Promise<void>((resolve) => {
            resumeResolverRef.current = resolve;
          });
        }

        try {
          const startedAt = new Date();

          // 진행 중 상태 업데이트
          const studentName = student.name ?? student.id;
          const processingResult: BatchItemResult = {
            studentId: student.id,
            studentName,
            status: "processing",
            startedAt,
          };
          updateProgress(processingResult, {
            currentStudentId: student.id,
            currentStudentName: studentName,
          });

          // 실제 처리
          const result = await processStudent(student, settings, signal);
          const completedResult: BatchItemResult = {
            ...result,
            studentId: student.id,
            studentName,
            startedAt,
            completedAt: new Date(),
          };

          config.onItemComplete?.(completedResult);
          return completedResult;
        } catch (err) {
          lastError = err instanceof Error ? err : new Error(String(err));

          // 재시도 가능 여부 확인
          if (attempt < retryPolicy.maxRetries) {
            const delay = retryPolicy.exponentialBackoff
              ? retryPolicy.retryDelayMs * Math.pow(2, attempt)
              : retryPolicy.retryDelayMs;
            await new Promise((resolve) => setTimeout(resolve, delay));
          }
        }
      }

      // 모든 재시도 실패
      const failedResult: BatchItemResult = {
        studentId: student.id,
        studentName: student.name ?? student.id,
        status: "error",
        message: lastError?.message ?? "알 수 없는 오류",
        error: lastError ?? undefined,
        completedAt: new Date(),
      };
      config.onItemComplete?.(failedResult);
      return failedResult;
    },
    [retryPolicy, processStudent, settings, config, updateProgress]
  );

  // 순차 처리
  const processSequentially = useCallback(
    async (
      targetStudents: StudentListRow[],
      signal: AbortSignal
    ): Promise<BatchItemResult[]> => {
      const allResults: BatchItemResult[] = [];

      for (const student of targetStudents) {
        if (signal.aborted) break;

        const result = await processStudentWithRetry(student, signal);
        allResults.push(result);

        // 진행 상황 업데이트
        const completed = allResults.length;
        const successful = allResults.filter((r) => r.status === "success").length;
        const failed = allResults.filter((r) => r.status === "error").length;
        const skipped = allResults.filter((r) => r.status === "skipped").length;

        updateProgress(result, {
          completed,
          successful,
          failed,
          skipped,
        });
        setResults([...allResults]);
      }

      return allResults;
    },
    [processStudentWithRetry, updateProgress]
  );

  // 병렬 처리
  const processInParallel = useCallback(
    async (
      targetStudents: StudentListRow[],
      signal: AbortSignal
    ): Promise<BatchItemResult[]> => {
      const maxConcurrent = config.parallel?.maxConcurrent ?? 3;
      const allResults: BatchItemResult[] = [];
      const queue = [...targetStudents];
      const processing: Promise<void>[] = [];

      const processNext = async (): Promise<void> => {
        while (queue.length > 0 && !signal.aborted) {
          const student = queue.shift();
          if (!student) break;

          const result = await processStudentWithRetry(student, signal);
          allResults.push(result);

          // 진행 상황 업데이트
          const completed = allResults.length;
          const successful = allResults.filter((r) => r.status === "success").length;
          const failed = allResults.filter((r) => r.status === "error").length;
          const skipped = allResults.filter((r) => r.status === "skipped").length;

          updateProgress(result, {
            completed,
            successful,
            failed,
            skipped,
          });
          setResults([...allResults]);
        }
      };

      // 최대 동시 실행 수만큼 워커 시작
      for (let i = 0; i < maxConcurrent; i++) {
        processing.push(processNext());
      }

      await Promise.all(processing);
      return allResults;
    },
    [config.parallel?.maxConcurrent, processStudentWithRetry, updateProgress]
  );

  // 시작
  const start = useCallback(async () => {
    if (state !== "idle") return;

    setState("preparing");
    setError(null);
    setResults([]);
    setProgress({
      total: students.length,
      completed: 0,
      successful: 0,
      failed: 0,
      skipped: 0,
      items: [],
    });

    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    try {
      setState("processing");

      const finalResults =
        config.strategy === "parallel"
          ? await processInParallel(students, signal)
          : await processSequentially(students, signal);

      setResults(finalResults);
      config.onComplete?.(finalResults);
      setState("completed");
    } catch (err) {
      const processError = err instanceof Error ? err : new Error(String(err));
      setError(processError);
      config.onError?.(processError);
      setState("error");
    }
  }, [state, students, config, processSequentially, processInParallel]);

  // 일시정지
  const pause = useCallback(() => {
    if (state !== "processing") return;
    isPausedRef.current = true;
    setState("paused");
  }, [state]);

  // 재개
  const resume = useCallback(() => {
    if (state !== "paused") return;
    isPausedRef.current = false;
    resumeResolverRef.current?.();
    setState("processing");
  }, [state]);

  // 취소
  const cancel = useCallback(() => {
    abortControllerRef.current?.abort();
    isPausedRef.current = false;
    resumeResolverRef.current?.();
    setState("idle");
  }, []);

  // 실패한 학생 재시도
  const retry = useCallback(
    async (studentIds: string[]) => {
      const failedStudents = students.filter((s) => studentIds.includes(s.id));
      if (failedStudents.length === 0) return;

      setState("processing");
      abortControllerRef.current = new AbortController();
      const signal = abortControllerRef.current.signal;

      try {
        const retryResults =
          config.strategy === "parallel"
            ? await processInParallel(failedStudents, signal)
            : await processSequentially(failedStudents, signal);

        // 기존 결과에서 재시도 학생 결과 교체
        setResults((prev) => {
          const nonRetried = prev.filter((r) => !studentIds.includes(r.studentId));
          return [...nonRetried, ...retryResults];
        });

        config.onComplete?.(retryResults);
        setState("completed");
      } catch (err) {
        const processError = err instanceof Error ? err : new Error(String(err));
        setError(processError);
        config.onError?.(processError);
        setState("error");
      }
    },
    [students, config, processSequentially, processInParallel]
  );

  return {
    state,
    progress,
    results,
    error,
    start,
    pause,
    resume,
    cancel,
    retry,
  };
}

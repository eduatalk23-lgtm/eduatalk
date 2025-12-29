/**
 * useUndoRedo 훅
 *
 * 범용 Undo/Redo 스택을 제공합니다.
 * 키보드 단축키 (Ctrl/Cmd + Z, Ctrl/Cmd + Shift + Z) 지원을 포함합니다.
 *
 * @module lib/hooks/useUndoRedo
 */

"use client";

import { useState, useCallback, useEffect, useMemo, useRef } from "react";

// ============================================================================
// 타입 정의
// ============================================================================

/**
 * 히스토리 엔트리
 */
export interface HistoryEntry<T> {
  /** 상태 스냅샷 */
  state: T;
  /** 타임스탬프 */
  timestamp: number;
  /** 액션 설명 (선택적) */
  description?: string;
}

/**
 * Undo/Redo 훅 옵션
 */
export interface UseUndoRedoOptions<T> {
  /** 초기 상태 */
  initialState: T;
  /** 최대 히스토리 길이 (기본값: 50) */
  maxHistoryLength?: number;
  /** 키보드 단축키 활성화 (기본값: true) */
  enableKeyboardShortcuts?: boolean;
  /** 상태 비교 함수 (변경 감지용) */
  compare?: (a: T, b: T) => boolean;
  /** Undo 시 콜백 */
  onUndo?: (state: T, description?: string) => void;
  /** Redo 시 콜백 */
  onRedo?: (state: T, description?: string) => void;
  /** 히스토리 변경 시 콜백 */
  onChange?: (state: T) => void;
}

/**
 * Undo/Redo 훅 반환값
 */
export interface UseUndoRedoResult<T> {
  /** 현재 상태 */
  state: T;
  /** 상태 업데이트 (히스토리에 추가) */
  setState: (newState: T | ((prev: T) => T), description?: string) => void;
  /** Undo 실행 */
  undo: () => void;
  /** Redo 실행 */
  redo: () => void;
  /** Undo 가능 여부 */
  canUndo: boolean;
  /** Redo 가능 여부 */
  canRedo: boolean;
  /** 히스토리 초기화 */
  reset: (newState?: T) => void;
  /** 현재 히스토리 */
  history: HistoryEntry<T>[];
  /** 현재 히스토리 인덱스 */
  historyIndex: number;
  /** 특정 히스토리 인덱스로 이동 */
  goToHistory: (index: number) => void;
  /** Undo 히스토리 (이전 상태들) */
  undoHistory: HistoryEntry<T>[];
  /** Redo 히스토리 (되돌린 상태들) */
  redoHistory: HistoryEntry<T>[];
}

// ============================================================================
// 상수
// ============================================================================

const DEFAULT_MAX_HISTORY_LENGTH = 50;

// ============================================================================
// 유틸리티
// ============================================================================

/**
 * 기본 상태 비교 함수 (얕은 비교)
 */
function defaultCompare<T>(a: T, b: T): boolean {
  if (a === b) return true;
  if (typeof a !== "object" || typeof b !== "object") return false;
  if (a === null || b === null) return false;
  return JSON.stringify(a) === JSON.stringify(b);
}

// ============================================================================
// 훅
// ============================================================================

/**
 * Undo/Redo 훅
 *
 * @example
 * ```tsx
 * const {
 *   state,
 *   setState,
 *   undo,
 *   redo,
 *   canUndo,
 *   canRedo,
 * } = useUndoRedo({
 *   initialState: { count: 0 },
 *   onUndo: (state) => console.log('Undo:', state),
 * });
 *
 * return (
 *   <div>
 *     <p>Count: {state.count}</p>
 *     <button onClick={() => setState({ count: state.count + 1 }, 'Increment')}>
 *       +1
 *     </button>
 *     <button onClick={undo} disabled={!canUndo}>Undo</button>
 *     <button onClick={redo} disabled={!canRedo}>Redo</button>
 *   </div>
 * );
 * ```
 */
export function useUndoRedo<T>(
  options: UseUndoRedoOptions<T>
): UseUndoRedoResult<T> {
  const {
    initialState,
    maxHistoryLength = DEFAULT_MAX_HISTORY_LENGTH,
    enableKeyboardShortcuts = true,
    compare = defaultCompare,
    onUndo,
    onRedo,
    onChange,
  } = options;

  // 히스토리 상태
  const [history, setHistory] = useState<HistoryEntry<T>[]>([
    { state: initialState, timestamp: Date.now() },
  ]);
  const [historyIndex, setHistoryIndex] = useState(0);

  // Refs for callbacks to avoid stale closures
  const onUndoRef = useRef(onUndo);
  const onRedoRef = useRef(onRedo);
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    onUndoRef.current = onUndo;
    onRedoRef.current = onRedo;
    onChangeRef.current = onChange;
  }, [onUndo, onRedo, onChange]);

  // 현재 상태
  const state = useMemo(() => history[historyIndex].state, [history, historyIndex]);

  // 상태 업데이트
  const setState = useCallback(
    (newState: T | ((prev: T) => T), description?: string) => {
      setHistory((prevHistory) => {
        const currentState = prevHistory[historyIndex].state;
        const resolvedState =
          typeof newState === "function"
            ? (newState as (prev: T) => T)(currentState)
            : newState;

        // 상태가 변경되지 않았으면 무시
        if (compare(currentState, resolvedState)) {
          return prevHistory;
        }

        // 현재 인덱스 이후의 히스토리 제거 (redo 불가능하게)
        const newHistory = prevHistory.slice(0, historyIndex + 1);

        // 새 상태 추가
        newHistory.push({
          state: resolvedState,
          timestamp: Date.now(),
          description,
        });

        // 최대 길이 제한
        while (newHistory.length > maxHistoryLength) {
          newHistory.shift();
        }

        return newHistory;
      });

      setHistoryIndex((prev) => {
        const newIndex = Math.min(prev + 1, maxHistoryLength - 1);
        return newIndex;
      });

      // onChange 콜백
      const resolvedState =
        typeof newState === "function"
          ? (newState as (prev: T) => T)(history[historyIndex].state)
          : newState;
      onChangeRef.current?.(resolvedState);
    },
    [historyIndex, compare, maxHistoryLength, history]
  );

  // Undo
  const undo = useCallback(() => {
    if (historyIndex <= 0) return;

    const newIndex = historyIndex - 1;
    const entry = history[newIndex];

    setHistoryIndex(newIndex);
    onUndoRef.current?.(entry.state, entry.description);
    onChangeRef.current?.(entry.state);
  }, [historyIndex, history]);

  // Redo
  const redo = useCallback(() => {
    if (historyIndex >= history.length - 1) return;

    const newIndex = historyIndex + 1;
    const entry = history[newIndex];

    setHistoryIndex(newIndex);
    onRedoRef.current?.(entry.state, entry.description);
    onChangeRef.current?.(entry.state);
  }, [historyIndex, history]);

  // 특정 히스토리로 이동
  const goToHistory = useCallback(
    (index: number) => {
      if (index < 0 || index >= history.length) return;
      setHistoryIndex(index);
      onChangeRef.current?.(history[index].state);
    },
    [history]
  );

  // 초기화
  const reset = useCallback(
    (newState?: T) => {
      const resetState = newState ?? initialState;
      setHistory([{ state: resetState, timestamp: Date.now() }]);
      setHistoryIndex(0);
      onChangeRef.current?.(resetState);
    },
    [initialState]
  );

  // 키보드 단축키
  useEffect(() => {
    if (!enableKeyboardShortcuts) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
      const modifier = isMac ? e.metaKey : e.ctrlKey;

      if (modifier && e.key === "z") {
        e.preventDefault();
        if (e.shiftKey) {
          redo();
        } else {
          undo();
        }
      }

      // Windows/Linux: Ctrl + Y for redo
      if (!isMac && e.ctrlKey && e.key === "y") {
        e.preventDefault();
        redo();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [enableKeyboardShortcuts, undo, redo]);

  // 계산된 값들
  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < history.length - 1;
  const undoHistory = useMemo(
    () => history.slice(0, historyIndex),
    [history, historyIndex]
  );
  const redoHistory = useMemo(
    () => history.slice(historyIndex + 1),
    [history, historyIndex]
  );

  return {
    state,
    setState,
    undo,
    redo,
    canUndo,
    canRedo,
    reset,
    history,
    historyIndex,
    goToHistory,
    undoHistory,
    redoHistory,
  };
}

/**
 * Undo/Redo 상태 표시 컴포넌트용 훅
 *
 * @example
 * ```tsx
 * const { undoLabel, redoLabel } = useUndoRedoLabels(undoHistory, redoHistory);
 * // undoLabel: "실행 취소: 증가"
 * // redoLabel: "다시 실행: 감소"
 * ```
 */
export function useUndoRedoLabels<T>(
  undoHistory: HistoryEntry<T>[],
  redoHistory: HistoryEntry<T>[]
): { undoLabel: string; redoLabel: string } {
  const undoLabel = useMemo(() => {
    if (undoHistory.length === 0) return "실행 취소";
    const lastEntry = undoHistory[undoHistory.length - 1];
    return lastEntry.description
      ? `실행 취소: ${lastEntry.description}`
      : "실행 취소";
  }, [undoHistory]);

  const redoLabel = useMemo(() => {
    if (redoHistory.length === 0) return "다시 실행";
    const firstEntry = redoHistory[0];
    return firstEntry.description
      ? `다시 실행: ${firstEntry.description}`
      : "다시 실행";
  }, [redoHistory]);

  return { undoLabel, redoLabel };
}

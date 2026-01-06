/**
 * QueryStateWrapper 유틸리티 함수 단위 테스트
 *
 * extractQueryState, combineQueryStates 함수를 테스트합니다.
 * React 컴포넌트 테스트는 E2E 테스트에서 수행합니다.
 */

import { describe, it, expect } from "vitest";
import {
  extractQueryState,
  combineQueryStates,
  type QueryState,
} from "@/components/ui/QueryStateWrapper";

describe("extractQueryState", () => {
  it("query 객체에서 QueryState를 추출한다", () => {
    const query = {
      isLoading: false,
      error: null,
      data: [1, 2, 3],
    };

    const state = extractQueryState(query);

    expect(state.isLoading).toBe(false);
    expect(state.error).toBeNull();
    expect(state.isEmpty).toBe(false);
  });

  it("로딩 상태를 올바르게 추출한다", () => {
    const query = {
      isLoading: true,
      error: null,
      data: undefined,
    };

    const state = extractQueryState(query);

    expect(state.isLoading).toBe(true);
    expect(state.error).toBeNull();
  });

  it("에러 상태를 올바르게 추출한다", () => {
    const testError = new Error("Test error");
    const query = {
      isLoading: false,
      error: testError,
      data: undefined,
    };

    const state = extractQueryState(query);

    expect(state.isLoading).toBe(false);
    expect(state.error).toBe(testError);
  });

  it("빈 배열은 isEmpty=true로 처리한다", () => {
    const query = {
      isLoading: false,
      error: null,
      data: [],
    };

    const state = extractQueryState(query);

    expect(state.isEmpty).toBe(true);
  });

  it("undefined 데이터는 isEmpty=true로 처리한다", () => {
    const query = {
      isLoading: false,
      error: null,
      data: undefined,
    };

    const state = extractQueryState(query);

    expect(state.isEmpty).toBe(true);
  });

  it("null 데이터는 isEmpty=true로 처리한다", () => {
    const query = {
      isLoading: false,
      error: null,
      data: null,
    };

    const state = extractQueryState(query);

    expect(state.isEmpty).toBe(true);
  });

  it("비어있지 않은 배열은 isEmpty=false로 처리한다", () => {
    const query = {
      isLoading: false,
      error: null,
      data: [1],
    };

    const state = extractQueryState(query);

    expect(state.isEmpty).toBe(false);
  });

  it("객체 데이터는 isEmpty=false로 처리한다", () => {
    const query = {
      isLoading: false,
      error: null,
      data: { id: 1 },
    };

    const state = extractQueryState(query);

    expect(state.isEmpty).toBe(false);
  });

  it("커스텀 isEmpty 함수를 사용할 수 있다", () => {
    const query = {
      isLoading: false,
      error: null,
      data: { items: [] },
    };

    const state = extractQueryState(
      query,
      (data) => data?.items?.length === 0
    );

    expect(state.isEmpty).toBe(true);
  });

  it("커스텀 isEmpty 함수로 중첩 데이터를 검사할 수 있다", () => {
    const query = {
      isLoading: false,
      error: null,
      data: { items: [1, 2, 3] },
    };

    const state = extractQueryState(
      query,
      (data) => data?.items?.length === 0
    );

    expect(state.isEmpty).toBe(false);
  });
});

describe("combineQueryStates", () => {
  describe("isLoading 결합", () => {
    it("모든 상태가 로딩이 아니면 isLoading=false", () => {
      const states: QueryState[] = [
        { isLoading: false, error: null, isEmpty: false },
        { isLoading: false, error: null, isEmpty: false },
        { isLoading: false, error: null, isEmpty: false },
      ];

      const combined = combineQueryStates(...states);

      expect(combined.isLoading).toBe(false);
    });

    it("하나라도 로딩 중이면 isLoading=true", () => {
      const states: QueryState[] = [
        { isLoading: false, error: null, isEmpty: false },
        { isLoading: true, error: null, isEmpty: false },
        { isLoading: false, error: null, isEmpty: false },
      ];

      const combined = combineQueryStates(...states);

      expect(combined.isLoading).toBe(true);
    });

    it("모든 상태가 로딩 중이면 isLoading=true", () => {
      const states: QueryState[] = [
        { isLoading: true, error: null, isEmpty: false },
        { isLoading: true, error: null, isEmpty: false },
      ];

      const combined = combineQueryStates(...states);

      expect(combined.isLoading).toBe(true);
    });
  });

  describe("error 결합", () => {
    it("에러가 없으면 error=null", () => {
      const states: QueryState[] = [
        { isLoading: false, error: null, isEmpty: false },
        { isLoading: false, error: null, isEmpty: false },
      ];

      const combined = combineQueryStates(...states);

      expect(combined.error).toBeNull();
    });

    it("하나라도 에러가 있으면 첫 번째 에러를 반환", () => {
      const firstError = new Error("First error");
      const secondError = new Error("Second error");

      const states: QueryState[] = [
        { isLoading: false, error: firstError, isEmpty: false },
        { isLoading: false, error: secondError, isEmpty: false },
      ];

      const combined = combineQueryStates(...states);

      expect(combined.error).toBe(firstError);
    });

    it("에러가 중간에 있어도 해당 에러를 반환", () => {
      const testError = new Error("Test error");

      const states: QueryState[] = [
        { isLoading: false, error: null, isEmpty: false },
        { isLoading: false, error: testError, isEmpty: false },
        { isLoading: false, error: null, isEmpty: false },
      ];

      const combined = combineQueryStates(...states);

      expect(combined.error).toBe(testError);
    });
  });

  describe("isEmpty 결합", () => {
    it("모든 상태가 empty일 때만 isEmpty=true", () => {
      const states: QueryState[] = [
        { isLoading: false, error: null, isEmpty: true },
        { isLoading: false, error: null, isEmpty: true },
        { isLoading: false, error: null, isEmpty: true },
      ];

      const combined = combineQueryStates(...states);

      expect(combined.isEmpty).toBe(true);
    });

    it("하나라도 데이터가 있으면 isEmpty=false", () => {
      const states: QueryState[] = [
        { isLoading: false, error: null, isEmpty: true },
        { isLoading: false, error: null, isEmpty: false },
        { isLoading: false, error: null, isEmpty: true },
      ];

      const combined = combineQueryStates(...states);

      expect(combined.isEmpty).toBe(false);
    });

    it("모든 상태가 데이터가 있으면 isEmpty=false", () => {
      const states: QueryState[] = [
        { isLoading: false, error: null, isEmpty: false },
        { isLoading: false, error: null, isEmpty: false },
      ];

      const combined = combineQueryStates(...states);

      expect(combined.isEmpty).toBe(false);
    });
  });

  describe("복합 상태", () => {
    it("로딩과 에러가 동시에 있으면 둘 다 반환", () => {
      const testError = new Error("Test error");

      const states: QueryState[] = [
        { isLoading: true, error: null, isEmpty: false },
        { isLoading: false, error: testError, isEmpty: false },
      ];

      const combined = combineQueryStates(...states);

      expect(combined.isLoading).toBe(true);
      expect(combined.error).toBe(testError);
    });

    it("단일 상태도 올바르게 처리", () => {
      const state: QueryState = { isLoading: true, error: null, isEmpty: true };

      const combined = combineQueryStates(state);

      expect(combined.isLoading).toBe(true);
      expect(combined.error).toBeNull();
      expect(combined.isEmpty).toBe(true);
    });

    it("빈 배열도 처리 (모두 false/null)", () => {
      const combined = combineQueryStates();

      expect(combined.isLoading).toBe(false);
      expect(combined.error).toBeNull();
      expect(combined.isEmpty).toBe(true);
    });
  });
});

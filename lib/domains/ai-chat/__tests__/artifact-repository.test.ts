import { describe, expect, it } from "vitest";
import {
  computePropsHash,
  insertEditedVersion,
} from "../artifact-repository";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

describe("computePropsHash", () => {
  it("같은 내용이면 같은 hash", () => {
    const a = { grade: 2, subject: "수학", score: 92 };
    const b = { grade: 2, subject: "수학", score: 92 };
    expect(computePropsHash(a)).toBe(computePropsHash(b));
  });

  it("객체 키 순서 차이에 독립", () => {
    const a = { grade: 2, subject: "수학", score: 92 };
    const b = { subject: "수학", score: 92, grade: 2 };
    expect(computePropsHash(a)).toBe(computePropsHash(b));
  });

  it("중첩 객체 키 순서도 정규화", () => {
    const a = { outer: { x: 1, y: 2 } };
    const b = { outer: { y: 2, x: 1 } };
    expect(computePropsHash(a)).toBe(computePropsHash(b));
  });

  it("값이 다르면 다른 hash", () => {
    expect(computePropsHash({ n: 1 })).not.toBe(computePropsHash({ n: 2 }));
  });

  it("null·undefined·string 도 안정적", () => {
    expect(computePropsHash(null)).toBe(computePropsHash(null));
    expect(computePropsHash("a")).not.toBe(computePropsHash("b"));
  });

  it("배열 순서는 유지 (의미 있는 순서)", () => {
    expect(computePropsHash([1, 2, 3])).not.toBe(computePropsHash([3, 2, 1]));
  });

  it("빈 객체·배열 구분", () => {
    expect(computePropsHash({})).not.toBe(computePropsHash([]));
  });

  it("hash 는 sha-256 길이 (64 hex)", () => {
    expect(computePropsHash({ a: 1 })).toMatch(/^[0-9a-f]{64}$/);
  });
});

/**
 * Phase C-3: insertEditedVersion fake supabase 기반 단위 테스트.
 *
 * 각 from(table) 호출마다 table 별 응답을 순서대로 반환한다. query 체인 메서드는
 * 모두 self 를 반환하고, 최종 maybeSingle / insert / update 는 미리 주입된 결과를 resolve.
 */
type FakeResponse<T> = { data: T | null; error: { message: string } | null };

/**
 * supabase-js builder 는 chainable + awaitable (thenable). 모든 메서드가 같은
 * thenable 을 반환하고, await 시 주입된 finalResponse 로 resolve.
 */
function makeThenable(finalResponse: FakeResponse<unknown>) {
  const self: Record<string, unknown> = {};
  const chain = (..._args: unknown[]) => self;
  for (const fn of [
    "select",
    "eq",
    "is",
    "order",
    "limit",
    "update",
    "insert",
    "maybeSingle",
    "single",
  ]) {
    (self as Record<string, unknown>)[fn] = chain;
  }
  (self as Record<string, unknown>).then = (
    resolve: (v: FakeResponse<unknown>) => void,
  ) => resolve(finalResponse);
  return self;
}

function makeFakeSupabase(config: {
  artifactLookup: FakeResponse<{ id: string }>;
  latestLookup: FakeResponse<{ version_no: number; props_hash: string }>;
  versionInsert?: FakeResponse<null>;
  pointerUpdate?: FakeResponse<null>;
}): SupabaseClient<Database> {
  let fromCallCount = 0;
  const fromImpl = (_table: string) => {
    fromCallCount += 1;
    // 순서: 1) artifact lookup, 2) latest lookup, 3) version insert, 4) pointer update
    if (fromCallCount === 1) return makeThenable(config.artifactLookup);
    if (fromCallCount === 2) return makeThenable(config.latestLookup);
    if (fromCallCount === 3)
      return makeThenable(config.versionInsert ?? { data: null, error: null });
    return makeThenable(
      config.pointerUpdate ?? { data: null, error: null },
    );
  };

  return { from: fromImpl } as unknown as SupabaseClient<Database>;
}

describe("insertEditedVersion", () => {
  it("정상 경로: v1 기반 편집 → v2 생성", async () => {
    const supabase = makeFakeSupabase({
      artifactLookup: { data: { id: "art-1" }, error: null },
      latestLookup: { data: { version_no: 1, props_hash: "other" }, error: null },
      versionInsert: { data: null, error: null },
      pointerUpdate: { data: null, error: null },
    });

    const result = await insertEditedVersion(
      { artifactId: "art-1", editedByUserId: "user-1", props: { n: 2 } },
      supabase,
    );

    expect(result.artifactId).toBe("art-1");
    expect(result.versionNo).toBe(2);
    expect(result.versionInserted).toBe(true);
  });

  it("동일 hash: 버전 INSERT skip", async () => {
    const hash = computePropsHash({ n: 1 });
    const supabase = makeFakeSupabase({
      artifactLookup: { data: { id: "art-1" }, error: null },
      latestLookup: { data: { version_no: 3, props_hash: hash }, error: null },
    });

    const result = await insertEditedVersion(
      { artifactId: "art-1", editedByUserId: "user-1", props: { n: 1 } },
      supabase,
    );

    expect(result.versionNo).toBe(3);
    expect(result.versionInserted).toBe(false);
  });

  it("artifact 없음: 에러 throw", async () => {
    const supabase = makeFakeSupabase({
      artifactLookup: { data: null, error: null },
      latestLookup: { data: null, error: null },
    });

    await expect(
      insertEditedVersion(
        { artifactId: "art-missing", editedByUserId: "user-1", props: {} },
        supabase,
      ),
    ).rejects.toThrow(/not found/);
  });

  it("version insert 실패 시 에러 전파", async () => {
    const supabase = makeFakeSupabase({
      artifactLookup: { data: { id: "art-1" }, error: null },
      latestLookup: { data: { version_no: 1, props_hash: "h" }, error: null },
      versionInsert: { data: null, error: { message: "unique violation" } },
    });

    await expect(
      insertEditedVersion(
        { artifactId: "art-1", editedByUserId: "user-1", props: { n: 9 } },
        supabase,
      ),
    ).rejects.toThrow(/edited version insert/);
  });

  it("latest 버전 없으면 v1 생성", async () => {
    const supabase = makeFakeSupabase({
      artifactLookup: { data: { id: "art-1" }, error: null },
      latestLookup: { data: null, error: null },
      versionInsert: { data: null, error: null },
      pointerUpdate: { data: null, error: null },
    });

    const result = await insertEditedVersion(
      { artifactId: "art-1", editedByUserId: "user-1", props: { n: 1 } },
      supabase,
    );

    expect(result.versionNo).toBe(1);
    expect(result.versionInserted).toBe(true);
  });
});

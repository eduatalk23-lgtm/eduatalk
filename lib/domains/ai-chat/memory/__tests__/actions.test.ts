/**
 * Phase D-3 Sprint 2: Memory Panel 서버 액션 단위 테스트.
 *
 * 경로 커버:
 *  - auth 가드 (미로그인)
 *  - updateExplicitMemory: 길이 경계 + kind 검증 + embedding + update + revalidate
 *  - deleteMemory: 래핑 + revalidate
 *  - toggleMemoryPin: 래핑 + revalidate
 */

import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth/getCurrentUser", () => ({
  getCurrentUser: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(),
}));
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));
vi.mock("../embedding", () => ({
  createMemoryEmbedding: vi.fn(),
}));
vi.mock("../repository", () => ({
  updateMemoryContent: vi.fn(),
  togglePinMemoryById: vi.fn(),
  deleteMemoryById: vi.fn(),
}));

import {
  updateExplicitMemory,
  deleteMemory,
  toggleMemoryPin,
} from "../actions";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { createMemoryEmbedding } from "../embedding";
import {
  updateMemoryContent,
  togglePinMemoryById,
  deleteMemoryById,
} from "../repository";

type SelectResult = { data: unknown; error: { message: string } | null };

/** `.from(...).select(...).eq(...).maybeSingle()` 체인을 지정 응답으로 고정. */
function makeSupabaseForSelect(response: SelectResult) {
  const chain: Record<string, unknown> = {};
  const ret = () => chain;
  chain.select = ret;
  chain.eq = ret;
  chain.maybeSingle = async () => response;
  return {
    from: () => chain,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("updateExplicitMemory", () => {
  it("미로그인 시 로그인 요구 에러", async () => {
    vi.mocked(getCurrentUser).mockResolvedValueOnce(null);
    const result = await updateExplicitMemory({ id: "m-1", content: "x".repeat(20) });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/로그인/);
    expect(createSupabaseServerClient).not.toHaveBeenCalled();
  });

  it("content 5자 미만이면 DB 호출 없이 거부", async () => {
    vi.mocked(getCurrentUser).mockResolvedValueOnce({ userId: "u-1" } as never);
    vi.mocked(createSupabaseServerClient).mockResolvedValueOnce({} as never);
    const result = await updateExplicitMemory({ id: "m-1", content: "하이" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/최소/);
    expect(createMemoryEmbedding).not.toHaveBeenCalled();
    expect(updateMemoryContent).not.toHaveBeenCalled();
  });

  it("content 4000자 초과면 거부", async () => {
    vi.mocked(getCurrentUser).mockResolvedValueOnce({ userId: "u-1" } as never);
    vi.mocked(createSupabaseServerClient).mockResolvedValueOnce({} as never);
    const result = await updateExplicitMemory({
      id: "m-1",
      content: "가".repeat(4001),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/최대/);
    expect(createMemoryEmbedding).not.toHaveBeenCalled();
  });

  it("존재하지 않는 기억이면 접근 권한 에러", async () => {
    vi.mocked(getCurrentUser).mockResolvedValueOnce({ userId: "u-1" } as never);
    vi.mocked(createSupabaseServerClient).mockResolvedValueOnce(
      makeSupabaseForSelect({ data: null, error: null }) as never,
    );
    const result = await updateExplicitMemory({
      id: "m-1",
      content: "충분히 긴 내용",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/찾을 수 없|권한/);
    expect(createMemoryEmbedding).not.toHaveBeenCalled();
  });

  it("kind 가 explicit 이 아니면 편집 불가 에러", async () => {
    vi.mocked(getCurrentUser).mockResolvedValueOnce({ userId: "u-1" } as never);
    vi.mocked(createSupabaseServerClient).mockResolvedValueOnce(
      makeSupabaseForSelect({
        data: { kind: "turn" },
        error: null,
      }) as never,
    );
    const result = await updateExplicitMemory({
      id: "m-1",
      content: "충분히 긴 내용",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/자동 생성/);
    expect(createMemoryEmbedding).not.toHaveBeenCalled();
    expect(updateMemoryContent).not.toHaveBeenCalled();
  });

  it("SELECT 에러 그대로 전파", async () => {
    vi.mocked(getCurrentUser).mockResolvedValueOnce({ userId: "u-1" } as never);
    vi.mocked(createSupabaseServerClient).mockResolvedValueOnce(
      makeSupabaseForSelect({
        data: null,
        error: { message: "db down" },
      }) as never,
    );
    const result = await updateExplicitMemory({
      id: "m-1",
      content: "충분히 긴 내용",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("db down");
  });

  it("embedding 실패 시 사용자 친화 에러", async () => {
    vi.mocked(getCurrentUser).mockResolvedValueOnce({ userId: "u-1" } as never);
    vi.mocked(createSupabaseServerClient).mockResolvedValueOnce(
      makeSupabaseForSelect({
        data: { kind: "explicit" },
        error: null,
      }) as never,
    );
    vi.mocked(createMemoryEmbedding).mockResolvedValueOnce(null);
    const result = await updateExplicitMemory({
      id: "m-1",
      content: "충분히 긴 내용",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/임베딩/);
    expect(updateMemoryContent).not.toHaveBeenCalled();
  });

  it("성공 경로: embedding → update → revalidate", async () => {
    vi.mocked(getCurrentUser).mockResolvedValueOnce({ userId: "u-1" } as never);
    vi.mocked(createSupabaseServerClient).mockResolvedValueOnce(
      makeSupabaseForSelect({
        data: { kind: "explicit" },
        error: null,
      }) as never,
    );
    vi.mocked(createMemoryEmbedding).mockResolvedValueOnce([0.1, 0.2, 0.3]);
    vi.mocked(updateMemoryContent).mockResolvedValueOnce({ ok: true });

    const result = await updateExplicitMemory({
      id: "m-1",
      content: "  수정된 기억 내용  ",
    });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.id).toBe("m-1");
    // trim 된 content 로 embedding 호출
    expect(createMemoryEmbedding).toHaveBeenCalledWith("수정된 기억 내용");
    // update 호출 시 embedding + trim 된 content 전달
    expect(updateMemoryContent).toHaveBeenCalledWith(expect.anything(), {
      id: "m-1",
      content: "수정된 기억 내용",
      embedding: [0.1, 0.2, 0.3],
    });
    expect(revalidatePath).toHaveBeenCalledWith("/ai-chat/memory");
  });

  it("update 실패 시 revalidate 호출 안 함", async () => {
    vi.mocked(getCurrentUser).mockResolvedValueOnce({ userId: "u-1" } as never);
    vi.mocked(createSupabaseServerClient).mockResolvedValueOnce(
      makeSupabaseForSelect({
        data: { kind: "explicit" },
        error: null,
      }) as never,
    );
    vi.mocked(createMemoryEmbedding).mockResolvedValueOnce([0]);
    vi.mocked(updateMemoryContent).mockResolvedValueOnce({
      ok: false,
      error: "rls",
    });

    const result = await updateExplicitMemory({
      id: "m-1",
      content: "충분히 긴 내용",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("rls");
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

describe("deleteMemory", () => {
  it("미로그인 시 에러", async () => {
    vi.mocked(getCurrentUser).mockResolvedValueOnce(null);
    const result = await deleteMemory({ id: "m-1" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/로그인/);
  });

  it("성공 시 repository 호출 + revalidate", async () => {
    vi.mocked(getCurrentUser).mockResolvedValueOnce({ userId: "u-1" } as never);
    vi.mocked(createSupabaseServerClient).mockResolvedValueOnce({} as never);
    vi.mocked(deleteMemoryById).mockResolvedValueOnce({ ok: true });

    const result = await deleteMemory({ id: "m-1" });
    expect(result.ok).toBe(true);
    expect(deleteMemoryById).toHaveBeenCalledWith(expect.anything(), "m-1");
    expect(revalidatePath).toHaveBeenCalledWith("/ai-chat/memory");
  });

  it("repository 실패 시 error 전파 + revalidate 안 함", async () => {
    vi.mocked(getCurrentUser).mockResolvedValueOnce({ userId: "u-1" } as never);
    vi.mocked(createSupabaseServerClient).mockResolvedValueOnce({} as never);
    vi.mocked(deleteMemoryById).mockResolvedValueOnce({
      ok: false,
      error: "permission denied",
    });

    const result = await deleteMemory({ id: "m-1" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("permission denied");
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

describe("toggleMemoryPin", () => {
  it("미로그인 시 에러", async () => {
    vi.mocked(getCurrentUser).mockResolvedValueOnce(null);
    const result = await toggleMemoryPin({ id: "m-1", pinned: true });
    expect(result.ok).toBe(false);
  });

  it("성공 시 pinned 상태 포함 반환", async () => {
    vi.mocked(getCurrentUser).mockResolvedValueOnce({ userId: "u-1" } as never);
    vi.mocked(createSupabaseServerClient).mockResolvedValueOnce({} as never);
    vi.mocked(togglePinMemoryById).mockResolvedValueOnce({ ok: true });

    const result = await toggleMemoryPin({ id: "m-1", pinned: true });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.id).toBe("m-1");
      expect(result.pinned).toBe(true);
    }
    expect(togglePinMemoryById).toHaveBeenCalledWith(expect.anything(), {
      id: "m-1",
      pinned: true,
    });
    expect(revalidatePath).toHaveBeenCalledWith("/ai-chat/memory");
  });

  it("repository 실패 전파", async () => {
    vi.mocked(getCurrentUser).mockResolvedValueOnce({ userId: "u-1" } as never);
    vi.mocked(createSupabaseServerClient).mockResolvedValueOnce({} as never);
    vi.mocked(togglePinMemoryById).mockResolvedValueOnce({
      ok: false,
      error: "rls",
    });

    const result = await toggleMemoryPin({ id: "m-1", pinned: false });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("rls");
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

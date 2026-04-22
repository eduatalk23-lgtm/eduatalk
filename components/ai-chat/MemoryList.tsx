"use client";

/**
 * Phase D-3 Sprint 2 — 편집 가능 Memory 카드 리스트.
 *
 * 입력: 서버에서 enrich 된 `MemoryListItem[]` (학생명·대화 제목 포함).
 * 기능:
 *  - kind 필터 칩 (전체·자동 turn·요약 summary·수동 explicit)
 *    → router.push 로 /ai-chat/memory?kind=... 재진입 (서버 재조회)
 *  - 카드: kind 뱃지 + 내용(300자 초과 시 펼치기) + 학생·대화 라벨 + 상대 시간
 *  - Pin 토글 (useOptimistic) + Delete (confirm) — 전 kind 공통
 *  - Edit 버튼 + 인라인 에디터는 후속 커밋 (explicit 전용, updateExplicitMemory 연결).
 */

import { useOptimistic, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Pin,
  PinOff,
  MessageSquare,
  User as UserIcon,
  BookMarked,
  ScrollText,
  Trash2,
  Pencil,
  Check,
  X,
} from "lucide-react";

import { cn } from "@/lib/cn";
import type { MemoryKind } from "@/lib/domains/ai-chat/memory/types";
import {
  deleteMemory,
  toggleMemoryPin,
  updateExplicitMemory,
} from "@/lib/domains/ai-chat/memory/actions";

export type MemoryListItem = {
  id: string;
  kind: MemoryKind;
  content: string;
  pinned: boolean;
  createdAt: string;
  conversationId: string | null;
  conversationTitle: string | null;
  subjectStudentId: string | null;
  subjectStudentName: string | null;
};

type Props = {
  items: MemoryListItem[];
  /** 현재 URL 에서 선택된 kind. null 이면 '전체'. */
  activeKind: MemoryKind | null;
  /**
   * 학생 필터 3 상태:
   *  - undefined: 필터 없음 (전체)
   *  - null: 학생 미지정 기억만
   *  - uuid: 특정 학생 문맥만
   */
  activeStudentFilter: string | null | undefined;
  /** 서버 조회 실패 시 메시지(UI에 safely 표시). */
  loadError: string | null;
  /** kind 별 총 count (현 필터와 무관한 owner 전체 기준). */
  counts: {
    total: number;
    turn: number;
    summary: number;
    explicit: number;
  };
  /** 학생 필터 드롭다운 옵션 (사용자가 기억을 보유한 학생들). */
  studentOptions: Array<{ id: string; name: string }>;
};

type FilterOption = {
  key: MemoryKind | null;
  label: string;
};

const FILTER_OPTIONS: FilterOption[] = [
  { key: null, label: "전체" },
  { key: "turn", label: "자동 (대화)" },
  { key: "summary", label: "요약" },
  { key: "explicit", label: "직접 추가" },
];

const STUDENT_FILTER_ALL = "";
const STUDENT_FILTER_NONE = "__none__";

const KIND_LABEL: Record<MemoryKind, string> = {
  turn: "대화 단위",
  summary: "요약",
  explicit: "직접 추가",
};

const KIND_ICON: Record<MemoryKind, typeof MessageSquare> = {
  turn: MessageSquare,
  summary: ScrollText,
  explicit: BookMarked,
};

/**
 * 한국어 상대 시간. 과한 정확성 대신 채팅 UX 느낌에 맞춤.
 */
function formatRelativeKo(iso: string): string {
  const date = new Date(iso);
  const diffMs = Date.now() - date.getTime();
  const sec = Math.floor(diffMs / 1000);
  if (sec < 60) return "방금";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}분 전`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}시간 전`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}일 전`;
  return date.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

const CONTENT_PREVIEW_LIMIT = 300;
/** updateExplicitMemory 서버 검증과 일치. 클라이언트에서 선제 echo. */
const EDIT_MIN_LEN = 5;
const EDIT_MAX_LEN = 4000;

export function MemoryList({
  items,
  activeKind,
  activeStudentFilter,
  loadError,
  counts,
  studentOptions,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  /** key 에 null 을 주면 파라미터 제거. */
  const pushWithParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(searchParams.toString());
    if (value === null) {
      next.delete(key);
    } else {
      next.set(key, value);
    }
    const query = next.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  };

  const selectKind = (kind: MemoryKind | null) =>
    pushWithParam("kind", kind === null ? null : kind);

  const selectStudent = (raw: string) => {
    if (raw === STUDENT_FILTER_ALL) pushWithParam("student", null);
    else if (raw === STUDENT_FILTER_NONE) pushWithParam("student", "none");
    else pushWithParam("student", raw);
  };

  const hasItems = items.length > 0;

  const countForKind = (key: MemoryKind | null): number =>
    key === null ? counts.total : counts[key];

  const studentSelectValue =
    activeStudentFilter === undefined
      ? STUDENT_FILTER_ALL
      : activeStudentFilter === null
        ? STUDENT_FILTER_NONE
        : activeStudentFilter;

  return (
    <div className="flex flex-col gap-4">
      {/* 필터 칩 — kind */}
      <div
        role="tablist"
        aria-label="기억 종류 필터"
        className="flex flex-wrap gap-2"
      >
        {FILTER_OPTIONS.map((opt) => {
          const isActive = (activeKind ?? null) === opt.key;
          const n = countForKind(opt.key);
          return (
            <button
              key={opt.label}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => selectKind(opt.key)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                isActive
                  ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
                  : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300 hover:text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:border-zinc-600 dark:hover:text-zinc-100",
              )}
            >
              <span>{opt.label}</span>
              <span
                className={cn(
                  "tabular-nums text-[10px]",
                  isActive ? "opacity-80" : "opacity-60",
                )}
              >
                {n}
              </span>
            </button>
          );
        })}
      </div>

      {/* 학생 필터 드롭다운 — 학생 옵션이 하나도 없으면 생략 */}
      {studentOptions.length > 0 ? (
        <label className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-300">
          <span>학생</span>
          <select
            value={studentSelectValue}
            onChange={(e) => selectStudent(e.target.value)}
            className={cn(
              "rounded-md border px-2 py-1 text-xs",
              "border-zinc-200 bg-white text-zinc-900",
              "dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100",
              "focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500",
            )}
          >
            <option value={STUDENT_FILTER_ALL}>전체 학생</option>
            <option value={STUDENT_FILTER_NONE}>학생 미지정</option>
            {studentOptions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      {loadError ? (
        <div
          role="alert"
          className="rounded-lg border border-error-200 bg-error-50 px-4 py-3 text-sm text-error-700 dark:border-error-900/60 dark:bg-error-900/30 dark:text-error-300"
        >
          기억을 불러오지 못했습니다: {loadError}
        </div>
      ) : null}

      <div className="text-xs text-zinc-500 dark:text-zinc-400">
        {hasItems
          ? `${items.length}건 표시`
          : "조건에 맞는 기억이 없습니다."}
      </div>

      <ul className="flex flex-col gap-3">
        {items.map((m) => (
          <MemoryCard key={m.id} item={m} />
        ))}
      </ul>
    </div>
  );
}

function MemoryCard({ item }: { item: MemoryListItem }) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [optimisticPinned, setOptimisticPinned] = useOptimistic(item.pinned);

  // 편집 모드 상태. explicit 기억에서만 활성화 가능.
  const [isEditing, setIsEditing] = useState(false);
  const [editDraft, setEditDraft] = useState(item.content);

  const Icon = KIND_ICON[item.kind];
  const over = item.content.length > CONTENT_PREVIEW_LIMIT;
  const preview = over
    ? item.content.slice(0, CONTENT_PREVIEW_LIMIT) + "…"
    : item.content;

  const canEdit = item.kind === "explicit";
  const trimmedDraft = editDraft.trim();
  const draftLen = trimmedDraft.length;
  const draftInvalid = draftLen < EDIT_MIN_LEN || draftLen > EDIT_MAX_LEN;
  const draftUnchanged = trimmedDraft === item.content.trim();

  const handleTogglePin = () => {
    const next = !optimisticPinned;
    startTransition(async () => {
      setOptimisticPinned(next);
      const result = await toggleMemoryPin({ id: item.id, pinned: next });
      if (!result.ok) {
        // 실패 시 useOptimistic 가 다음 렌더에서 원본 값으로 자동 복구.
        alert(`고정 상태 변경에 실패했습니다: ${result.error}`);
        return;
      }
      router.refresh();
    });
  };

  const handleDelete = () => {
    if (!confirm("이 기억을 삭제할까요? 되돌릴 수 없습니다.")) return;
    startTransition(async () => {
      const result = await deleteMemory({ id: item.id });
      if (!result.ok) {
        alert(`삭제에 실패했습니다: ${result.error}`);
        return;
      }
      router.refresh();
    });
  };

  const handleStartEdit = () => {
    setEditDraft(item.content);
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setEditDraft(item.content);
    setIsEditing(false);
  };

  const handleSaveEdit = () => {
    if (draftInvalid || draftUnchanged) return;
    startTransition(async () => {
      const result = await updateExplicitMemory({
        id: item.id,
        content: trimmedDraft,
      });
      if (!result.ok) {
        alert(`저장에 실패했습니다: ${result.error}`);
        return;
      }
      setIsEditing(false);
      router.refresh();
    });
  };

  return (
    <li className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
        <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
          <Icon size={12} />
          {KIND_LABEL[item.kind]}
        </span>
        {optimisticPinned ? (
          <span
            className="inline-flex items-center gap-1 text-warning-600 dark:text-warning-400"
            title="고정됨"
          >
            <Pin size={12} />
            고정
          </span>
        ) : null}
        <span className="ml-auto">{formatRelativeKo(item.createdAt)}</span>

        {/* 액션 버튼 묶음 */}
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={handleTogglePin}
            disabled={isPending || isEditing}
            title={optimisticPinned ? "고정 해제" : "고정"}
            aria-label={optimisticPinned ? "고정 해제" : "고정"}
            className={cn(
              "inline-flex h-7 w-7 items-center justify-center rounded-md transition-colors",
              "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900",
              "dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100",
              "disabled:cursor-not-allowed disabled:opacity-50",
              optimisticPinned &&
                "text-warning-600 dark:text-warning-400",
            )}
          >
            {optimisticPinned ? <PinOff size={14} /> : <Pin size={14} />}
          </button>
          {canEdit ? (
            <button
              type="button"
              onClick={handleStartEdit}
              disabled={isPending || isEditing}
              title="편집"
              aria-label="기억 편집"
              className={cn(
                "inline-flex h-7 w-7 items-center justify-center rounded-md transition-colors",
                "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900",
                "dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100",
                "disabled:cursor-not-allowed disabled:opacity-50",
              )}
            >
              <Pencil size={14} />
            </button>
          ) : null}
          <button
            type="button"
            onClick={handleDelete}
            disabled={isPending || isEditing}
            title="삭제"
            aria-label="기억 삭제"
            className={cn(
              "inline-flex h-7 w-7 items-center justify-center rounded-md transition-colors",
              "text-zinc-500 hover:bg-error-50 hover:text-error-600",
              "dark:text-zinc-400 dark:hover:bg-error-900/30 dark:hover:text-error-400",
              "disabled:cursor-not-allowed disabled:opacity-50",
            )}
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {isEditing ? (
        <div className="mt-2 flex flex-col gap-2">
          <textarea
            value={editDraft}
            onChange={(e) => setEditDraft(e.target.value)}
            disabled={isPending}
            rows={Math.min(12, Math.max(4, editDraft.split("\n").length + 1))}
            className={cn(
              "w-full resize-y rounded-lg border px-3 py-2 text-sm leading-6",
              "border-zinc-300 bg-white text-zinc-900",
              "focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500",
              "dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100",
              "dark:focus:border-zinc-500",
              "disabled:cursor-not-allowed disabled:opacity-60",
            )}
            aria-label="기억 내용 편집"
          />
          <div className="flex items-center justify-between text-[11px]">
            <span
              className={cn(
                "text-zinc-500 dark:text-zinc-400",
                draftLen > EDIT_MAX_LEN &&
                  "text-error-600 dark:text-error-400",
              )}
            >
              {draftLen} / {EDIT_MAX_LEN}자
              {draftLen < EDIT_MIN_LEN ? ` (최소 ${EDIT_MIN_LEN}자)` : ""}
            </span>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={handleCancelEdit}
                disabled={isPending}
                className={cn(
                  "inline-flex items-center gap-1 rounded-md px-2 py-1 font-medium transition-colors",
                  "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900",
                  "dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100",
                  "disabled:cursor-not-allowed disabled:opacity-50",
                )}
              >
                <X size={12} />
                취소
              </button>
              <button
                type="button"
                onClick={handleSaveEdit}
                disabled={isPending || draftInvalid || draftUnchanged}
                className={cn(
                  "inline-flex items-center gap-1 rounded-md px-2 py-1 font-medium transition-colors",
                  "bg-zinc-900 text-white hover:bg-zinc-700",
                  "dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300",
                  "disabled:cursor-not-allowed disabled:opacity-50",
                )}
              >
                <Check size={12} />
                저장
              </button>
            </div>
          </div>
        </div>
      ) : (
        <>
          <p
            className={cn(
              "mt-2 whitespace-pre-wrap text-sm leading-6 text-zinc-800 dark:text-zinc-200",
            )}
          >
            {expanded || !over ? item.content : preview}
          </p>

          {over ? (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="mt-1 text-xs font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
            >
              {expanded ? "접기" : "더 보기"}
            </button>
          ) : null}
        </>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-500 dark:text-zinc-400">
        {item.subjectStudentName ? (
          <span className="inline-flex items-center gap-1">
            <UserIcon size={12} />
            {item.subjectStudentName}
          </span>
        ) : null}
        {item.conversationId ? (
          <Link
            href={`/ai-chat?id=${item.conversationId}`}
            className="inline-flex items-center gap-1 rounded hover:text-zinc-900 dark:hover:text-zinc-100"
          >
            <MessageSquare size={12} />
            {item.conversationTitle?.trim() || "대화 열기"}
          </Link>
        ) : null}
      </div>
    </li>
  );
}

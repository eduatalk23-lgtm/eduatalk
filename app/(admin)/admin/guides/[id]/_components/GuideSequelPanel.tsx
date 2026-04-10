"use client";

import { useQuery, queryOptions } from "@tanstack/react-query";
import Link from "next/link";
import { ArrowRight, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/cn";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { DIFFICULTY_LABELS, type DifficultyLevel } from "@/lib/domains/guide/types";

interface SequelLink {
  id: string;
  title: string;
  difficulty_level: string | null;
  confidence: number;
  direction: "prev" | "next";
}

function sequelQueryOptions(guideId: string) {
  return queryOptions({
    queryKey: ["guide", "sequels", guideId],
    queryFn: async (): Promise<SequelLink[]> => {
      const supabase = createSupabaseBrowserClient();
      const [{ data: forward }, { data: backward }] = await Promise.all([
        supabase
          .from("exploration_guide_sequels")
          .select("to_guide_id, confidence, to_guide:exploration_guides!exploration_guide_sequels_to_guide_id_fkey(id, title, difficulty_level)")
          .eq("from_guide_id", guideId)
          .gte("confidence", 0.5)
          .order("confidence", { ascending: false })
          .limit(5),
        supabase
          .from("exploration_guide_sequels")
          .select("from_guide_id, confidence, from_guide:exploration_guides!exploration_guide_sequels_from_guide_id_fkey(id, title, difficulty_level)")
          .eq("to_guide_id", guideId)
          .gte("confidence", 0.5)
          .order("confidence", { ascending: false })
          .limit(5),
      ]);

      const links: SequelLink[] = [];
      for (const row of forward ?? []) {
        const g = row.to_guide as unknown as { id: string; title: string; difficulty_level: string | null };
        if (g) links.push({ id: g.id, title: g.title, difficulty_level: g.difficulty_level, confidence: row.confidence, direction: "next" });
      }
      for (const row of backward ?? []) {
        const g = row.from_guide as unknown as { id: string; title: string; difficulty_level: string | null };
        if (g) links.push({ id: g.id, title: g.title, difficulty_level: g.difficulty_level, confidence: row.confidence, direction: "prev" });
      }
      return links;
    },
    staleTime: 60_000,
    enabled: !!guideId,
  });
}

const DIFF_COLORS: Record<string, string> = {
  basic: "text-green-600 dark:text-green-400",
  intermediate: "text-yellow-600 dark:text-yellow-400",
  advanced: "text-red-600 dark:text-red-400",
};

export function GuideSequelPanel({ guideId }: { guideId: string }) {
  const { data: links } = useQuery(sequelQueryOptions(guideId));

  if (!links || links.length === 0) return null;

  const prev = links.filter((l) => l.direction === "prev");
  const next = links.filter((l) => l.direction === "next");

  return (
    <div className="rounded-xl border border-secondary-200 dark:border-secondary-700 p-4 mt-4">
      <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3">
        사슬 관계 (선후 가이드)
      </h3>
      <div className="space-y-2">
        {prev.length > 0 && (
          <div>
            <p className="text-xs text-[var(--text-secondary)] mb-1">이전 단계</p>
            {prev.map((l) => (
              <SequelItem key={l.id} link={l} />
            ))}
          </div>
        )}
        {next.length > 0 && (
          <div>
            <p className="text-xs text-[var(--text-secondary)] mb-1">다음 단계</p>
            {next.map((l) => (
              <SequelItem key={l.id} link={l} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function SequelItem({ link }: { link: SequelLink }) {
  const Icon = link.direction === "next" ? ArrowRight : ArrowLeft;
  const diffLabel = link.difficulty_level
    ? DIFFICULTY_LABELS[link.difficulty_level as DifficultyLevel]
    : null;

  return (
    <Link
      href={`/admin/guides/${link.id}`}
      className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-secondary-50 dark:hover:bg-secondary-800 transition-colors group"
    >
      <Icon className="w-3.5 h-3.5 text-[var(--text-secondary)] shrink-0" />
      {diffLabel && (
        <span className={cn("text-xs font-medium shrink-0", DIFF_COLORS[link.difficulty_level!] ?? "")}>
          {diffLabel}
        </span>
      )}
      <span className="text-sm text-[var(--text-primary)] truncate group-hover:text-primary-600 dark:group-hover:text-primary-400">
        {link.title}
      </span>
      <span className="text-[11px] text-[var(--text-secondary)] ml-auto shrink-0">
        {(link.confidence * 100).toFixed(0)}%
      </span>
    </Link>
  );
}

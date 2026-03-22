"use client";

import { useState, useEffect, useTransition } from "react";
import { AlertTriangle, ChevronDown, Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/cn";
import { updateStudentInfo } from "@/lib/domains/student/actions/management";
import { getSubClassifications } from "@/lib/domains/student/actions/classification";
import type { SubClassificationOption } from "@/lib/domains/student/actions/classification";
import { CAREER_FIELD_OPTIONS } from "@/lib/utils/studentProfile";
import { TIER1_TO_MAJORS, type CareerTier1Code } from "@/lib/constants/career-classification";

interface CareerSetupBannerProps {
  studentId: string;
  tenantId: string;
  onComplete: () => void;
}

export function CareerSetupBanner({ studentId, tenantId, onComplete }: CareerSetupBannerProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [tier1, setTier1] = useState<CareerTier1Code | "">("");
  const [tier2, setTier2] = useState("");
  const [tier3, setTier3] = useState<number | "">("");
  const [subOptions, setSubOptions] = useState<SubClassificationOption[]>([]);
  const [isPending, startTransition] = useTransition();
  const [isSaving, setIsSaving] = useState(false);

  // Tier2 options based on Tier1
  const tier2Options = tier1 ? TIER1_TO_MAJORS[tier1] ?? [] : [];

  // Fetch sub-classifications when tier2 changes
  useEffect(() => {
    if (!tier2) {
      setSubOptions([]);
      setTier3("");
      return;
    }
    startTransition(async () => {
      const options = await getSubClassifications(tier2);
      setSubOptions(options);
      setTier3("");
    });
  }, [tier2]);

  const canSave = !!tier1 && !!tier2;

  async function handleSave() {
    if (!canSave) return;
    setIsSaving(true);
    try {
      const result = await updateStudentInfo(studentId, {
        career: {
          desired_career_field: tier1,
          target_major: tier2,
          target_sub_classification_id: tier3 || null,
        },
      });
      if (result.success) {
        onComplete();
      }
    } finally {
      setIsSaving(false);
    }
  }

  if (!isExpanded) {
    return (
      <div className="mb-4 flex items-center gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 dark:border-amber-700 dark:bg-amber-950/30">
        <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
        <p className="flex-1 text-sm text-amber-800 dark:text-amber-200">
          진로 방향이 설정되지 않았습니다. 교과이수적합도, 세특 가이드, 수강 계획 추천을 사용하려면 진로를 설정하세요.
        </p>
        <button
          onClick={() => setIsExpanded(true)}
          className="shrink-0 rounded-md bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-700"
        >
          세팅 완료하기
        </button>
      </div>
    );
  }

  return (
    <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-950/30">
      <div className="mb-3 flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
        <span className="text-sm font-medium text-amber-800 dark:text-amber-200">진로 방향 설정</span>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        {/* Tier 1: 대계열 */}
        <div className="min-w-[140px] flex-1">
          <label className="mb-1 block text-xs text-[var(--text-tertiary)]">대계열</label>
          <select
            value={tier1}
            onChange={(e) => {
              setTier1(e.target.value as CareerTier1Code | "");
              setTier2("");
              setTier3("");
            }}
            className="w-full rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-800"
          >
            <option value="">선택</option>
            {CAREER_FIELD_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        {/* Tier 2: 전공방향 */}
        <div className="min-w-[160px] flex-1">
          <label className="mb-1 block text-xs text-[var(--text-tertiary)]">전공방향</label>
          <select
            value={tier2}
            onChange={(e) => { setTier2(e.target.value); setTier3(""); }}
            disabled={!tier1}
            className={cn(
              "w-full rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-800",
              !tier1 && "opacity-50",
            )}
          >
            <option value="">선택</option>
            {tier2Options.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>

        {/* Tier 3: 소분류 */}
        <div className="min-w-[200px] flex-1">
          <label className="mb-1 block text-xs text-[var(--text-tertiary)]">소분류 (선택)</label>
          <select
            value={tier3}
            onChange={(e) => setTier3(e.target.value ? Number(e.target.value) : "")}
            disabled={!tier2 || isPending}
            className={cn(
              "w-full rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-800",
              (!tier2 || isPending) && "opacity-50",
            )}
          >
            <option value="">{isPending ? "로딩 중..." : "선택 안함"}</option>
            {subOptions.map((o) => (
              <option key={o.id} value={o.id}>{o.mid_name} &gt; {o.sub_name}</option>
            ))}
          </select>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <button
            onClick={handleSave}
            disabled={!canSave || isSaving}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-4 py-1.5 text-sm font-medium text-white",
              canSave && !isSaving ? "bg-amber-600 hover:bg-amber-700" : "bg-gray-400 cursor-not-allowed",
            )}
          >
            {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
            저장
          </button>
          <button
            onClick={() => setIsExpanded(false)}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-[var(--text-secondary)] hover:bg-gray-100 dark:border-gray-600 dark:hover:bg-gray-800"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}

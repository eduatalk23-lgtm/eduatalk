"use client";

import { useState, useEffect, useTransition } from "react";
import { AlertTriangle, Pencil, Check, Loader2, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { updateStudentInfo } from "@/lib/domains/student/actions/management";
import { getSubClassifications } from "@/lib/domains/student/actions/classification";
import type { SubClassificationOption } from "@/lib/domains/student/actions/classification";
import { CAREER_FIELD_OPTIONS } from "@/lib/utils/studentProfile";
import { TIER1_TO_MAJORS, type CareerTier1Code } from "@/lib/constants/career-classification";
import SchoolSelect from "@/components/ui/SchoolSelect";

interface CareerProfilePanelProps {
  studentId: string;
  tenantId: string;
  currentCareerField?: string | null;
  currentTargetMajor?: string | null;
  currentSubClassificationName?: string | null;
  desiredUniversities?: Array<{ id: string; name: string; rank: number }>;
  onUpdate: () => void;
}

export function CareerProfilePanel({
  studentId,
  currentCareerField,
  currentTargetMajor,
  currentSubClassificationName,
  desiredUniversities,
  onUpdate,
}: CareerProfilePanelProps) {
  const [isEditing, setIsEditing] = useState(false);

  // ─── 편집 폼 상태 ─────────────────────────────
  const [tier1, setTier1] = useState<CareerTier1Code | "">("");
  const [tier2, setTier2] = useState("");
  const [tier3, setTier3] = useState<number | "">("");
  const [subOptions, setSubOptions] = useState<SubClassificationOption[]>([]);
  const [univIds, setUnivIds] = useState<[string, string, string]>(["", "", ""]);

  const [isPending, startTransition] = useTransition();
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const tier2Options = tier1 ? TIER1_TO_MAJORS[tier1] ?? [] : [];

  // 편집 모드 진입 시 현재 값으로 초기화
  useEffect(() => {
    if (isEditing) {
      setTier1((currentCareerField as CareerTier1Code | null) ?? "");
      setTier2(currentTargetMajor ?? "");
      setTier3("");
      setSaveError(null);
      // 희망대학 초기화
      const ids = desiredUniversities?.map((u) => u.id) ?? [];
      setUnivIds([ids[0] ?? "", ids[1] ?? "", ids[2] ?? ""]);
    }
  }, [isEditing, currentCareerField, currentTargetMajor, desiredUniversities]);

  // tier2 변경 시 소분류 옵션 로드
  useEffect(() => {
    if (!isEditing) return;
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
  }, [tier2, isEditing]);

  const canSave = !!tier1 && !!tier2;

  async function handleSave() {
    if (!canSave) return;
    setIsSaving(true);
    setSaveError(null);
    try {
      const filteredUnivIds = univIds.filter(Boolean);
      const result = await updateStudentInfo(studentId, {
        career: {
          desired_career_field: tier1,
          target_major: tier2,
          target_sub_classification_id: tier3 || null,
          ...(filteredUnivIds.length > 0 && { desired_university_ids: filteredUnivIds }),
        },
      });
      if (result.success) {
        setIsEditing(false);
        onUpdate();
      } else {
        setSaveError(result.error ?? "저장에 실패했습니다.");
      }
    } catch {
      setSaveError("네트워크 오류가 발생했습니다.");
    } finally {
      setIsSaving(false);
    }
  }

  // ─── 미설정 상태 (경고 배너 + 설정 폼) ──────────
  if (!currentTargetMajor) {
    if (!isEditing) {
      return (
        <div className="mb-4 flex items-center gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 dark:border-amber-700 dark:bg-amber-950/30">
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
          <p className="flex-1 text-sm text-amber-800 dark:text-amber-200">
            진로 방향이 설정되지 않았습니다. 교과이수적합도, 세특 가이드, 수강 계획 추천을 사용하려면 진로를 설정하세요.
          </p>
          <button
            onClick={() => setIsEditing(true)}
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
        <EditForm
          tier1={tier1} setTier1={(v) => { setTier1(v); setTier2(""); setTier3(""); }}
          tier2={tier2} setTier2={(v) => { setTier2(v); setTier3(""); }}
          tier3={tier3} setTier3={setTier3}
          tier2Options={tier2Options}
          subOptions={subOptions}
          isPending={isPending}
          univIds={univIds}
          setUnivIds={setUnivIds}
          studentId={studentId}
          saveError={saveError}
          canSave={canSave}
          isSaving={isSaving}
          onSave={handleSave}
          onCancel={() => setIsEditing(false)}
        />
      </div>
    );
  }

  // ─── 설정 완료 상태 (요약 카드 또는 편집 폼) ────
  if (!isEditing) {
    return (
      <div className="mb-4 rounded-lg border border-[var(--border-secondary)] bg-[var(--surface-secondary)] px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm">
            {currentCareerField && (
              <span className="flex items-center gap-1">
                <span className="text-xs text-[var(--text-tertiary)]">진로계열</span>
                <span className="font-medium text-[var(--text-primary)]">{currentCareerField}</span>
              </span>
            )}
            <span className="flex items-center gap-1">
              <span className="text-xs text-[var(--text-tertiary)]">전공방향</span>
              <span className="font-medium text-[var(--text-primary)]">{currentTargetMajor}</span>
            </span>
            {currentSubClassificationName && (
              <span className="flex items-center gap-1">
                <span className="text-xs text-[var(--text-tertiary)]">소분류</span>
                <span className="text-[var(--text-secondary)]">{currentSubClassificationName}</span>
              </span>
            )}
            {desiredUniversities && desiredUniversities.length > 0 && (
              <span className="flex items-center gap-1.5">
                <span className="text-xs text-[var(--text-tertiary)]">희망대학</span>
                {desiredUniversities.map((u) => (
                  <span
                    key={u.id}
                    className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300"
                  >
                    {u.rank}순위 {u.name}
                  </span>
                ))}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={() => setIsEditing(true)}
            className="shrink-0 flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] transition-colors"
          >
            <Pencil className="h-3 w-3" />
            편집
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-4 rounded-lg border border-[var(--border-secondary)] bg-[var(--surface-secondary)] p-4">
      <div className="mb-3 flex items-center gap-2">
        <Pencil className="h-4 w-4 text-[var(--text-secondary)]" />
        <span className="text-sm font-medium text-[var(--text-primary)]">진로 방향 편집</span>
      </div>
      <EditForm
        tier1={tier1} setTier1={(v) => { setTier1(v); setTier2(""); setTier3(""); }}
        tier2={tier2} setTier2={(v) => { setTier2(v); setTier3(""); }}
        tier3={tier3} setTier3={setTier3}
        tier2Options={tier2Options}
        subOptions={subOptions}
        isPending={isPending}
        univIds={univIds}
        setUnivIds={setUnivIds}
        studentId={studentId}
        saveError={saveError}
        canSave={canSave}
        isSaving={isSaving}
        onSave={handleSave}
        onCancel={() => setIsEditing(false)}
      />
    </div>
  );
}

// ─── 내부 편집 폼 컴포넌트 ────────────────────────

interface EditFormProps {
  tier1: CareerTier1Code | "";
  setTier1: (v: CareerTier1Code | "") => void;
  tier2: string;
  setTier2: (v: string) => void;
  tier3: number | "";
  setTier3: (v: number | "") => void;
  tier2Options: string[];
  subOptions: SubClassificationOption[];
  isPending: boolean;
  univIds: [string, string, string];
  setUnivIds: (ids: [string, string, string]) => void;
  studentId: string;
  saveError: string | null;
  canSave: boolean;
  isSaving: boolean;
  onSave: () => void;
  onCancel: () => void;
}

function EditForm({
  tier1, setTier1,
  tier2, setTier2,
  tier3, setTier3,
  tier2Options, subOptions, isPending,
  univIds, setUnivIds,
  saveError, canSave, isSaving, onSave, onCancel,
}: EditFormProps) {
  return (
    <div className="space-y-3">
      {/* 진로 3단계 선택 */}
      <div className="flex flex-wrap items-end gap-3">
        {/* Tier 1: 대계열 */}
        <div className="min-w-[140px] flex-1">
          <label className="mb-1 block text-xs text-[var(--text-tertiary)]">대계열</label>
          <select
            value={tier1}
            onChange={(e) => setTier1(e.target.value as CareerTier1Code | "")}
            className="w-full rounded-md border border-border bg-white px-3 py-1.5 text-sm dark:border-border dark:bg-bg-secondary"
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
            onChange={(e) => setTier2(e.target.value)}
            disabled={!tier1}
            className={cn(
              "w-full rounded-md border border-border bg-white px-3 py-1.5 text-sm dark:border-border dark:bg-bg-secondary",
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
              "w-full rounded-md border border-border bg-white px-3 py-1.5 text-sm dark:border-border dark:bg-bg-secondary",
              (!tier2 || isPending) && "opacity-50",
            )}
          >
            <option value="">{isPending ? "로딩 중..." : "선택 안함"}</option>
            {subOptions.map((o) => (
              <option key={o.id} value={o.id}>{o.mid_name} &gt; {o.sub_name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* 희망대학 3슬롯 */}
      <div>
        <label className="mb-1.5 block text-xs text-[var(--text-tertiary)]">희망대학 (선택, 최대 3개)</label>
        <div className="flex flex-col gap-2 sm:flex-row">
          {([0, 1, 2] as const).map((idx) => (
            <div key={idx} className="flex-1">
              <div className="mb-0.5 text-3xs text-[var(--text-placeholder)]">{idx + 1}순위</div>
              <SchoolSelect
                type="대학교"
                value={univIds[idx]}
                onChange={(v) => {
                  const next: [string, string, string] = [...univIds] as [string, string, string];
                  next[idx] = v;
                  setUnivIds(next);
                }}
                placeholder={`${idx + 1}순위 대학 검색`}
              />
            </div>
          ))}
        </div>
      </div>

      {/* 에러 메시지 */}
      {saveError && (
        <p className="text-xs text-red-600 dark:text-red-400">{saveError}</p>
      )}

      {/* 저장/취소 버튼 */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onSave}
          disabled={!canSave || isSaving}
          className={cn(
            "flex items-center gap-1.5 rounded-md px-4 py-1.5 text-sm font-medium text-white",
            canSave && !isSaving ? "bg-indigo-600 hover:bg-indigo-700" : "bg-gray-400 cursor-not-allowed",
          )}
        >
          {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
          저장
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm text-[var(--text-secondary)] hover:bg-bg-tertiary dark:border-border dark:hover:bg-gray-800"
        >
          <X className="h-3.5 w-3.5" />
          취소
        </button>
      </div>
    </div>
  );
}

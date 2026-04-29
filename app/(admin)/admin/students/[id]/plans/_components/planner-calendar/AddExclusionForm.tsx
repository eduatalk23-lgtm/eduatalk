"use client";

import { useState } from "react";
import { Plus } from "lucide-react";

interface AddExclusionFormProps {
  periodStart: string;
  periodEnd: string;
  onAdd: (date: string, exclusionType: string, reason?: string) => void;
  isLoading?: boolean;
}

const EXCLUSION_TYPES = [
  { value: "휴가", label: "휴가" },
  { value: "개인사정", label: "개인사정" },
  { value: "휴일지정", label: "휴일지정" },
  { value: "기타", label: "기타" },
];

export default function AddExclusionForm({
  periodStart,
  periodEnd,
  onAdd,
  isLoading = false,
}: AddExclusionFormProps) {
  const [date, setDate] = useState("");
  const [exclusionType, setExclusionType] = useState("휴가");
  const [reason, setReason] = useState("");

  const handleSubmit = () => {
    if (!date) return;
    onAdd(date, exclusionType, reason || undefined);
    setDate("");
    setReason("");
  };

  return (
    <div className="flex flex-wrap items-end gap-2">
      <div className="flex flex-col gap-1">
        <label htmlFor="exclusion-date" className="text-xs text-[var(--text-tertiary)]">날짜</label>
        <input
          id="exclusion-date"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          min={periodStart}
          max={periodEnd}
          className="rounded-md border border-[rgb(var(--color-secondary-200))] bg-[var(--background)] px-2 py-1.5 text-sm"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="exclusion-type" className="text-xs text-[var(--text-tertiary)]">유형</label>
        <select
          id="exclusion-type"
          value={exclusionType}
          onChange={(e) => setExclusionType(e.target.value)}
          className="rounded-md border border-[rgb(var(--color-secondary-200))] bg-[var(--background)] px-2 py-1.5 text-sm"
        >
          {EXCLUSION_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="exclusion-reason" className="text-xs text-[var(--text-tertiary)]">사유 (선택)</label>
        <input
          id="exclusion-reason"
          type="text"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="사유 입력"
          className="rounded-md border border-[rgb(var(--color-secondary-200))] bg-[var(--background)] px-2 py-1.5 text-sm"
        />
      </div>
      <button
        onClick={handleSubmit}
        disabled={!date || isLoading}
        className="flex items-center gap-1 rounded-md bg-[rgb(var(--color-error-500))] px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-[rgb(var(--color-error-600))] disabled:opacity-50"
      >
        <Plus className="h-3.5 w-3.5" />
        제외일 추가
      </button>
    </div>
  );
}

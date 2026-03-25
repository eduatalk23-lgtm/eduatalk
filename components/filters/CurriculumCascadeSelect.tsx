"use client";

import { useMemo } from "react";
import { cn } from "@/lib/cn";
import type { CurriculumUnit } from "@/lib/domains/guide/types";

// ── Placeholder 맵 ──

const PLACEHOLDERS = {
  form: {
    year: "교육과정",
    areaEnabled: "교과",
    areaDisabled: "교육과정 먼저",
    subjectEnabled: "과목",
    subjectDisabled: "교과 먼저",
    majorEnabled: "대단원",
    majorDisabled: "과목 먼저",
    majorEmpty: "단원 없음",
    minor: "소단원",
  },
  filter: {
    year: "전체 교육과정",
    areaEnabled: "전체 교과",
    areaDisabled: "교육과정 먼저 선택",
    subjectEnabled: "전체 과목",
    subjectDisabled: "교과 먼저 선택",
    majorEnabled: "전체 대단원",
    majorDisabled: "과목 먼저 선택",
    majorEmpty: "단원 정보 없음",
    minor: "전체 소단원",
  },
} as const;

// ── Select 스타일 ──

const selectBase = cn(
  "px-3 py-2 rounded-lg border text-sm",
  "border-secondary-200 dark:border-secondary-700",
  "bg-white dark:bg-secondary-900 text-[var(--text-primary)]",
  "focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500",
  "disabled:opacity-40 disabled:cursor-not-allowed",
);

// ── Types ──

interface GroupedSubjectGroup {
  groupName: string;
  subjects: Array<{ id: string; name: string }>;
}

export interface CurriculumCascadeSelectProps {
  /** placeholder 스타일: form = 짧은 라벨, filter = "전체" 접두어 */
  placeholderStyle?: "form" | "filter";
  /** 셀렉트 사이 › 분리자 표시 */
  showSeparators?: boolean;

  // Data
  yearOptions: string[];
  groupedSubjects: GroupedSubjectGroup[];
  majorUnits: CurriculumUnit[];
  minorUnits: CurriculumUnit[];

  // Controlled values
  curriculumYear: string;
  onCurriculumYearChange: (v: string) => void;
  subjectArea: string;
  onSubjectAreaChange: (v: string) => void;
  subjectSelect: string;
  onSubjectSelectChange: (v: string) => void;
  unitMajor: string;
  onUnitMajorChange: (v: string) => void;
  unitMinor: string;
  onUnitMinorChange: (v: string) => void;

  /** 컨테이너 추가 className */
  className?: string;
}

// ── Component ──

export default function CurriculumCascadeSelect({
  placeholderStyle = "form",
  showSeparators = false,
  yearOptions,
  groupedSubjects,
  majorUnits,
  minorUnits,
  curriculumYear,
  onCurriculumYearChange,
  subjectArea,
  onSubjectAreaChange,
  subjectSelect,
  onSubjectSelectChange,
  unitMajor,
  onUnitMajorChange,
  unitMinor,
  onUnitMinorChange,
  className,
}: CurriculumCascadeSelectProps) {
  const ph = PLACEHOLDERS[placeholderStyle];

  // ── 파생 옵션 ──
  const areaOptions = useMemo(
    () => groupedSubjects.map((g) => g.groupName).sort(),
    [groupedSubjects],
  );

  const subjectOptions = useMemo(() => {
    if (!subjectArea) return [];
    const group = groupedSubjects.find((g) => g.groupName === subjectArea);
    return (group?.subjects ?? []).map((s) => s.name).sort();
  }, [groupedSubjects, subjectArea]);

  // ── Cascade 리셋 핸들러 ──
  const handleYearChange = (v: string) => {
    onCurriculumYearChange(v);
    onUnitMajorChange("");
    onUnitMinorChange("");
  };

  const handleAreaChange = (v: string) => {
    onSubjectAreaChange(v);
    onSubjectSelectChange("");
    onUnitMajorChange("");
    onUnitMinorChange("");
  };

  const handleSubjectChange = (v: string) => {
    onSubjectSelectChange(v);
    onUnitMajorChange("");
    onUnitMinorChange("");
  };

  const handleMajorChange = (v: string) => {
    onUnitMajorChange(v);
    onUnitMinorChange("");
  };

  const selCls = selectBase;

  // ── 개별 셀렉트 렌더 ──
  const yearSelect = (
    <select
      value={curriculumYear}
      onChange={(e) => handleYearChange(e.target.value)}
      className={selCls}
    >
      <option value="">{ph.year}</option>
      {yearOptions.map((y) => (
        <option key={y} value={y}>
          {y} 개정
        </option>
      ))}
    </select>
  );

  const areaSelect = (
    <select
      value={subjectArea}
      onChange={(e) => handleAreaChange(e.target.value)}
      disabled={!curriculumYear}
      className={selCls}
    >
      <option value="">
        {curriculumYear ? ph.areaEnabled : ph.areaDisabled}
      </option>
      {areaOptions.map((a) => (
        <option key={a} value={a}>
          {a}
        </option>
      ))}
    </select>
  );

  const subjectSelectEl = (
    <select
      value={subjectSelect}
      onChange={(e) => handleSubjectChange(e.target.value)}
      disabled={!subjectArea}
      className={selCls}
    >
      <option value="">
        {subjectArea ? ph.subjectEnabled : ph.subjectDisabled}
      </option>
      {subjectOptions.map((s) => (
        <option key={s} value={s}>
          {s}
        </option>
      ))}
    </select>
  );

  const majorSelect = (
    <select
      value={unitMajor}
      onChange={(e) => handleMajorChange(e.target.value)}
      disabled={!subjectSelect || majorUnits.length === 0}
      className={selCls}
    >
      <option value="">
        {!subjectSelect
          ? ph.majorDisabled
          : majorUnits.length === 0
            ? ph.majorEmpty
            : ph.majorEnabled}
      </option>
      {majorUnits.map((u) => (
        <option key={u.id} value={u.unit_name}>
          {u.unit_name}
        </option>
      ))}
    </select>
  );

  const showMinor = unitMajor && minorUnits.length > 0;

  const minorSelect = showMinor ? (
    <select
      value={unitMinor}
      onChange={(e) => onUnitMinorChange(e.target.value)}
      className={selCls}
    >
      <option value="">{ph.minor}</option>
      {minorUnits.map((u) => (
        <option key={u.id} value={u.unit_name}>
          {u.unit_name}
        </option>
      ))}
    </select>
  ) : null;

  // ── 분리자 ──
  const sep = showSeparators ? (
    <span className="text-secondary-300 dark:text-secondary-600">›</span>
  ) : null;

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      {yearSelect}
      {sep}
      {areaSelect}
      {sep}
      {subjectSelectEl}
      {sep}
      {majorSelect}
      {showMinor && (
        <>
          {sep}
          {minorSelect}
        </>
      )}
    </div>
  );
}

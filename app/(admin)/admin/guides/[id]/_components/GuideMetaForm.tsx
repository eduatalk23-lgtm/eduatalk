"use client";

import { cn } from "@/lib/cn";
import type { GuideType, GuideStatus, CareerField } from "@/lib/domains/guide/types";
import {
  GUIDE_TYPES,
  GUIDE_TYPE_LABELS,
  GUIDE_STATUSES,
  GUIDE_STATUS_LABELS,
} from "@/lib/domains/guide/types";

interface GuideMetaFormProps {
  title: string;
  onTitleChange: (v: string) => void;
  guideType: GuideType;
  onGuideTypeChange: (v: GuideType) => void;
  status: GuideStatus;
  onStatusChange: (v: GuideStatus) => void;
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
  bookTitle: string;
  onBookTitleChange: (v: string) => void;
  bookAuthor: string;
  onBookAuthorChange: (v: string) => void;
  bookPublisher: string;
  onBookPublisherChange: (v: string) => void;
  bookYear: number | undefined;
  onBookYearChange: (v: number | undefined) => void;
  // 매핑
  allSubjects: Array<{ id: string; name: string }>;
  groupedSubjects?: Array<{ groupName: string; subjects: Array<{ id: string; name: string }> }>;
  selectedSubjectIds: string[];
  onSubjectIdsChange: (ids: string[]) => void;
  careerFields: CareerField[];
  selectedCareerFieldIds: number[];
  onCareerFieldIdsChange: (ids: number[]) => void;
}

const inputClass = cn(
  "w-full px-3 py-2 rounded-lg border text-sm",
  "border-secondary-200 dark:border-secondary-700",
  "bg-white dark:bg-secondary-900",
  "text-[var(--text-primary)]",
  "focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500",
);

const labelClass = "block text-sm font-medium text-[var(--text-secondary)] mb-1";

export function GuideMetaForm(props: GuideMetaFormProps) {
  const isReading = props.guideType === "reading";

  return (
    <div className="rounded-xl border border-secondary-200 dark:border-secondary-700 bg-white dark:bg-secondary-900 p-5 space-y-5">
      <h2 className="text-sm font-semibold text-[var(--text-heading)]">
        기본 정보
      </h2>

      {/* 제목 */}
      <div>
        <label className={labelClass}>
          제목 <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={props.title}
          onChange={(e) => props.onTitleChange(e.target.value)}
          placeholder="가이드 제목을 입력하세요"
          className={inputClass}
        />
      </div>

      {/* 유형 + 상태 */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>유형</label>
          <select
            value={props.guideType}
            onChange={(e) => props.onGuideTypeChange(e.target.value as GuideType)}
            className={inputClass}
          >
            {GUIDE_TYPES.map((t) => (
              <option key={t} value={t}>
                {GUIDE_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>상태</label>
          <select
            value={props.status}
            onChange={(e) => props.onStatusChange(e.target.value as GuideStatus)}
            className={inputClass}
          >
            {GUIDE_STATUSES.map((s) => (
              <option key={s} value={s}>
                {GUIDE_STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 교육과정 체계 */}
      <div className="rounded-lg bg-secondary-50 dark:bg-secondary-800/30 px-3 py-2.5 space-y-2">
        <span className="text-xs font-medium text-[var(--text-secondary)]">교육과정 체계</span>
        {(props.curriculumYear || props.subjectArea || props.subjectSelect || props.unitMajor || props.unitMinor) ? (
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            {props.curriculumYear && (
              <span className="px-2 py-0.5 rounded font-medium bg-secondary-200 text-secondary-700 dark:bg-secondary-700 dark:text-secondary-300">
                {props.curriculumYear} 개정
              </span>
            )}
            {props.subjectArea && (
              <>
                <span className="text-[var(--text-secondary)]">›</span>
                <span className="px-2 py-0.5 rounded font-medium bg-secondary-100 text-secondary-600 dark:bg-secondary-800 dark:text-secondary-400">
                  {props.subjectArea}
                </span>
              </>
            )}
            {props.subjectSelect && (
              <>
                <span className="text-[var(--text-secondary)]">›</span>
                <span className="px-2 py-0.5 rounded font-medium bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                  {props.subjectSelect}
                </span>
              </>
            )}
            {props.unitMajor && (
              <>
                <span className="text-[var(--text-secondary)]">›</span>
                <span className="px-2 py-0.5 rounded font-medium bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                  {props.unitMajor}
                </span>
              </>
            )}
            {props.unitMinor && (
              <>
                <span className="text-[var(--text-secondary)]">›</span>
                <span className="px-2 py-0.5 rounded font-medium bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
                  {props.unitMinor}
                </span>
              </>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-xs text-[var(--text-secondary)]">
              교육과정 정보가 설정되지 않았습니다
            </p>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
              <input
                type="text"
                value={props.curriculumYear}
                onChange={(e) => props.onCurriculumYearChange(e.target.value)}
                placeholder="교육과정 연도"
                className={cn(inputClass, "text-xs")}
              />
              <input
                type="text"
                value={props.subjectArea}
                onChange={(e) => props.onSubjectAreaChange(e.target.value)}
                placeholder="교과"
                className={cn(inputClass, "text-xs")}
              />
              <input
                type="text"
                value={props.subjectSelect}
                onChange={(e) => props.onSubjectSelectChange(e.target.value)}
                placeholder="과목"
                className={cn(inputClass, "text-xs")}
              />
              <input
                type="text"
                value={props.unitMajor}
                onChange={(e) => props.onUnitMajorChange(e.target.value)}
                placeholder="대단원"
                className={cn(inputClass, "text-xs")}
              />
              <input
                type="text"
                value={props.unitMinor}
                onChange={(e) => props.onUnitMinorChange(e.target.value)}
                placeholder="소단원"
                className={cn(inputClass, "text-xs")}
              />
            </div>
          </div>
        )}
      </div>
      {/* 독서 정보 — reading 타입일 때만 */}
      {isReading && (
        <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-900/10 p-4 space-y-3">
          <h3 className="text-sm font-medium text-amber-800 dark:text-amber-300">
            도서 정보
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="col-span-2">
              <label className={labelClass}>도서명</label>
              <input
                type="text"
                value={props.bookTitle}
                onChange={(e) => props.onBookTitleChange(e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>저자</label>
              <input
                type="text"
                value={props.bookAuthor}
                onChange={(e) => props.onBookAuthorChange(e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>출판사</label>
              <input
                type="text"
                value={props.bookPublisher}
                onChange={(e) => props.onBookPublisherChange(e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>출판 연도</label>
              <input
                type="number"
                value={props.bookYear ?? ""}
                onChange={(e) =>
                  props.onBookYearChange(
                    e.target.value ? parseInt(e.target.value) : undefined,
                  )
                }
                className={inputClass}
              />
            </div>
          </div>
        </div>
      )}

      {/* 과목 매핑 (교과별 그룹핑) */}
      <div>
        <label className={labelClass}>과목 매핑</label>
        <div className="rounded-lg border border-secondary-200 dark:border-secondary-700 bg-secondary-50 dark:bg-secondary-800/30 p-2 max-h-60 overflow-y-auto space-y-2">
          {(props.groupedSubjects ?? [{ groupName: "전체", subjects: props.allSubjects }]).map((group) => (
            <div key={group.groupName}>
              <p className="text-[10px] font-semibold text-[var(--text-secondary)] px-1 pb-1">
                {group.groupName}
              </p>
              <div className="flex flex-wrap gap-1">
                {group.subjects.map((subject) => {
                  const selected = props.selectedSubjectIds.includes(subject.id);
                  return (
                    <button
                      key={subject.id}
                      type="button"
                      onClick={() => {
                        props.onSubjectIdsChange(
                          selected
                            ? props.selectedSubjectIds.filter((id) => id !== subject.id)
                            : [...props.selectedSubjectIds, subject.id],
                        );
                      }}
                      className={cn(
                        "px-2 py-0.5 rounded-full text-xs font-medium transition-colors",
                        selected
                          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 ring-1 ring-emerald-300 dark:ring-emerald-600"
                          : "bg-secondary-100 text-secondary-500 dark:bg-secondary-800 dark:text-secondary-400 hover:bg-secondary-200 dark:hover:bg-secondary-700",
                      )}
                    >
                      {subject.name}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        {props.selectedSubjectIds.length > 0 && (
          <p className="text-xs text-[var(--text-secondary)] pt-1">
            {props.selectedSubjectIds.length}개 과목 선택됨
          </p>
        )}
      </div>

      {/* 계열 매핑 */}
      <div>
        <label className={labelClass}>계열 매핑</label>
        <div className="flex flex-wrap gap-1.5">
          {props.careerFields.map((cf) => {
            const selected = props.selectedCareerFieldIds.includes(cf.id);
            return (
              <button
                key={cf.id}
                type="button"
                onClick={() => {
                  props.onCareerFieldIdsChange(
                    selected
                      ? props.selectedCareerFieldIds.filter((id) => id !== cf.id)
                      : [...props.selectedCareerFieldIds, cf.id],
                  );
                }}
                className={cn(
                  "px-2.5 py-1 rounded-full text-xs font-medium transition-colors",
                  selected
                    ? "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 ring-1 ring-blue-300 dark:ring-blue-600"
                    : "bg-secondary-100 text-secondary-500 dark:bg-secondary-800 dark:text-secondary-400 hover:bg-secondary-200 dark:hover:bg-secondary-700",
                )}
              >
                {cf.name_kor}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

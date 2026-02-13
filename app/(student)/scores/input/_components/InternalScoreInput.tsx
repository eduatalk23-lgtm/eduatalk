"use client";

import React, { useState, useMemo, useTransition, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { SubjectGroup, SubjectType } from "@/lib/data/subjects";
import type { InternalScoreInputForm } from "@/lib/types/scoreInput";
import { calculateSchoolYear } from "@/lib/utils/schoolYear";
import { createInternalScoresBatch } from "@/lib/domains/score/actions";
import { useToast } from "@/components/ui/ToastProvider";
import { useBeforeUnload } from "@/lib/hooks/useBeforeUnload";
import { cn } from "@/lib/cn";
import FormField, { FormSelect } from "@/components/molecules/FormField";
import { Card, CardHeader, CardContent } from "@/components/molecules/Card";
import Button from "@/components/atoms/Button";
import { StickySaveButton } from "@/components/ui/StickySaveButton";
import {
  computeScoreAnalysis,
  determineSubjectCategory,
  determineGradeSystem,
  type ScoreComputationResult,
} from "@/lib/domains/score/computation";
import ScoreConfidenceChart from "@/components/score/ScoreConfidenceChart";

type InternalScoreInputProps = {
  studentId: string;
  tenantId: string;
  curriculumRevisionId: string;
  curriculumYear?: number | null;
  subjectGroups: (SubjectGroup & {
    subjects: Array<{
      id: string;
      subject_group_id: string;
      name: string;
      subject_type_id?: string | null;
      subject_type?: string | null;
    }>;
  })[];
  subjectTypes: SubjectType[];
  onSuccess?: () => void;
};

type ScoreRow = InternalScoreInputForm & {
  id: string;
  isAchievementOnly: boolean;
  showRatioDetail: boolean;
};

const ACHIEVEMENT_LEVELS = ["A", "B", "C", "D", "E"] as const;

export default function InternalScoreInput({
  studentId,
  tenantId,
  curriculumRevisionId,
  curriculumYear,
  subjectGroups,
  subjectTypes,
  onSuccess,
}: InternalScoreInputProps) {
  const router = useRouter();
  const { showSuccess, showError } = useToast();
  const [grade, setGrade] = useState<number>(1);
  const [semester, setSemester] = useState<number>(1);
  const [scores, setScores] = useState<ScoreRow[]>([]);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [changedRowIds, setChangedRowIds] = useState<Set<string>>(new Set());
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useBeforeUnload(hasUnsavedChanges);

  useEffect(() => {
    if (scores.length > 0) {
      setHasUnsavedChanges(true);
    }
  }, [scores]);

  const addScoreRow = () => {
    const newRow: ScoreRow = {
      id: `temp-${Date.now()}`,
      subject_group_id: "",
      subject_id: "",
      subject_type_id: "",
      grade,
      semester,
      credit_hours: 4,
      rank_grade: 1,
      raw_score: null,
      avg_score: null,
      std_dev: null,
      total_students: null,
      achievement_level: null,
      achievement_ratio_a: null,
      achievement_ratio_b: null,
      achievement_ratio_c: null,
      achievement_ratio_d: null,
      achievement_ratio_e: null,
      class_rank: null,
      isAchievementOnly: false,
      showRatioDetail: false,
    };
    setScores([...scores, newRow]);
  };

  const removeScoreRow = (id: string) => {
    setScores(scores.filter((row) => row.id !== id));
  };

  const updateScoreField = <K extends keyof ScoreRow>(
    id: string,
    field: K,
    value: ScoreRow[K]
  ) => {
    setScores(
      scores.map((row) => (row.id === id ? { ...row, [field]: value } : row))
    );

    setChangedRowIds((prev) => new Set(prev).add(id));

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    setSaveStatus("idle");
    saveTimeoutRef.current = setTimeout(() => {
      handleAutoSave(id);
    }, 2000);
  };

  const handleSubjectTypeChange = (id: string, typeId: string) => {
    const selectedType = subjectTypes.find((t) => t.id === typeId);
    const isAchievement = selectedType?.is_achievement_only ?? false;

    setScores(
      scores.map((row) => {
        if (row.id !== id) return row;
        return {
          ...row,
          subject_type_id: typeId,
          isAchievementOnly: isAchievement,
          ...(isAchievement
            ? { rank_grade: null, class_rank: null }
            : { achievement_level: null }),
        };
      })
    );

    setChangedRowIds((prev) => new Set(prev).add(id));
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    setSaveStatus("idle");
    saveTimeoutRef.current = setTimeout(() => handleAutoSave(id), 2000);
  };

  const isRowValid = useCallback((row: ScoreRow): boolean => {
    if (!row.subject_group_id || !row.subject_id || !row.subject_type_id || row.credit_hours <= 0) {
      return false;
    }
    if (row.isAchievementOnly) {
      return !!row.achievement_level;
    }
    return row.rank_grade !== null && row.rank_grade >= 1 && row.rank_grade <= 9;
  }, []);

  const handleAutoSave = async (rowId: string) => {
    const row = scores.find((r) => r.id === rowId);
    if (!row) return;

    if (!isRowValid(row)) return;

    setSaveStatus("saving");

    try {
      const formData = new FormData();
      formData.append("student_id", studentId);
      formData.append("tenant_id", tenantId);
      formData.append("curriculum_revision_id", curriculumRevisionId);
      formData.append("school_year", calculateSchoolYear().toString());
      formData.append("scores", JSON.stringify([
        (() => {
          const { id, isAchievementOnly, showRatioDetail, ...scoreData } = row;
          return scoreData;
        })()
      ]));

      const result = await createInternalScoresBatch(formData);

      if (!result.success) {
        throw new Error("자동 저장에 실패했습니다.");
      }

      setChangedRowIds((prev) => {
        const next = new Set(prev);
        next.delete(rowId);
        return next;
      });

      setSaveStatus("saved");

      setTimeout(() => {
        setSaveStatus("idle");
      }, 3000);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "자동 저장 중 오류가 발생했습니다.";
      setError(errorMessage);
      setSaveStatus("idle");
    }
  };

  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  const handleSubjectGroupChange = (id: string, subjectGroupId: string) => {
    setScores(
      scores.map((row) =>
        row.id === id
          ? { ...row, subject_group_id: subjectGroupId, subject_id: "" }
          : row
      )
    );

    setChangedRowIds((prev) => new Set(prev).add(id));

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    setSaveStatus("idle");
    saveTimeoutRef.current = setTimeout(() => {
      handleAutoSave(id);
    }, 2000);
  };

  const getSubjectsForGroup = (subjectGroupId: string) => {
    const group = subjectGroups.find((g) => g.id === subjectGroupId);
    return group?.subjects || [];
  };

  const handleSubmit = () => {
    setError(null);

    if (scores.length === 0) {
      setError("최소 1개 이상의 성적을 입력하세요.");
      return;
    }

    for (const score of scores) {
      if (
        !score.subject_group_id ||
        !score.subject_id ||
        !score.subject_type_id
      ) {
        setError("교과군, 과목, 과목구분은 필수 항목입니다.");
        return;
      }
      if (score.credit_hours <= 0) {
        setError("학점수는 0보다 커야 합니다.");
        return;
      }
      if (score.isAchievementOnly) {
        if (!score.achievement_level) {
          setError("성취평가제 과목은 성취도(A~E)를 선택해주세요.");
          return;
        }
      } else {
        if (score.rank_grade === null || score.rank_grade < 1 || score.rank_grade > 9) {
          setError("석차등급은 1~9 사이여야 합니다.");
          return;
        }
      }
    }

    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.append("student_id", studentId);
        formData.append("tenant_id", tenantId);
        formData.append("curriculum_revision_id", curriculumRevisionId);
        formData.append("school_year", calculateSchoolYear().toString());
        formData.append("scores", JSON.stringify(
          scores.map((s) => {
            const { id, isAchievementOnly, showRatioDetail, ...scoreData } = s;
            return scoreData;
          })
        ));

        const result = await createInternalScoresBatch(formData);

        if (!result.success) {
          throw new Error("성적 저장에 실패했습니다.");
        }

        const savedCount = scores.length;
        showSuccess(`${savedCount}건의 성적이 저장되었습니다.`);
        setHasUnsavedChanges(false);

        if (onSuccess) {
          onSuccess();
        } else {
          router.push("/scores/dashboard/unified");
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.";
        setError(errorMessage);
        showError(errorMessage);
      }
    });
  };

  // Select options
  const gradeOptions = [
    { value: "1", label: "1학년" },
    { value: "2", label: "2학년" },
    { value: "3", label: "3학년" },
  ];

  const semesterOptions = [
    { value: "1", label: "1학기" },
    { value: "2", label: "2학기" },
  ];

  const subjectGroupOptions = subjectGroups.map((g) => ({
    value: g.id,
    label: g.name,
  }));

  const subjectTypeOptions = subjectTypes.map((t) => ({
    value: t.id,
    label: t.name,
  }));

  const achievementOptions = ACHIEVEMENT_LEVELS.map((level) => ({
    value: level,
    label: level,
  }));

  const gradeSystem = determineGradeSystem(curriculumYear);

  return (
    <div className="flex flex-col gap-6">
      {/* 자동저장 상태 표시 */}
      {saveStatus !== "idle" && (
        <div className={cn(
          "flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm",
          saveStatus === "saving"
            ? "bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300"
            : "bg-success-50 dark:bg-success-900/20 text-success-700 dark:text-success-300"
        )}>
          {saveStatus === "saving" ? (
            <>
              <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary-600 border-t-transparent" />
              <span>자동 저장 중...</span>
            </>
          ) : (
            <>
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span>저장 완료</span>
            </>
          )}
        </div>
      )}

      {/* 기본 정보 카드 */}
      <Card padding="md">
        <div className="flex flex-col gap-4">
          <CardHeader title="기본 정보" />
          <CardContent>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormSelect
                label="학년"
                required
                selectSize="md"
                options={gradeOptions}
                value={String(grade)}
                onChange={(e) => setGrade(Number(e.target.value))}
              />
              <FormSelect
                label="학기"
                required
                selectSize="md"
                options={semesterOptions}
                value={String(semester)}
                onChange={(e) => setSemester(Number(e.target.value))}
              />
            </div>
          </CardContent>
        </div>
      </Card>

      {/* 과목 카드 목록 */}
      {scores.length === 0 ? (
        <Card padding="lg">
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <div className="rounded-full bg-secondary-100 dark:bg-secondary-800 p-3">
              <svg className="h-6 w-6 text-secondary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
            </div>
            <p className="text-body-2 text-[var(--text-secondary)]">
              아래 버튼을 클릭하여 과목을 추가하세요.
            </p>
          </div>
        </Card>
      ) : (
        scores.map((row, index) => (
          <ScoreCard
            key={row.id}
            row={row}
            index={index}
            subjectGroupOptions={subjectGroupOptions}
            subjectTypeOptions={subjectTypeOptions}
            achievementOptions={achievementOptions}
            getSubjectsForGroup={getSubjectsForGroup}
            onUpdateField={updateScoreField}
            onSubjectGroupChange={handleSubjectGroupChange}
            onSubjectTypeChange={handleSubjectTypeChange}
            onRemove={removeScoreRow}
            gradeSystem={gradeSystem}
            subjectTypes={subjectTypes}
          />
        ))
      )}

      {/* 과목 추가 버튼 */}
      <Button
        type="button"
        variant="outline"
        size="lg"
        fullWidth
        onClick={addScoreRow}
      >
        + 과목 추가
      </Button>

      {/* 에러 메시지 */}
      {error && (
        <Card variant="error" padding="md">
          <p className="text-body-2 text-error-700 dark:text-error-300">{error}</p>
        </Card>
      )}

      {/* 하단 저장 바 */}
      <StickySaveButton
        hasChanges={scores.length > 0 && hasUnsavedChanges}
        isSaving={isPending}
        onSubmit={handleSubmit}
        onCancel={() => router.back()}
        submitLabel="저장하기"
        cancelLabel="취소"
        disabled={scores.length === 0}
      />
    </div>
  );
}

// ============================================
// ScoreCard 내부 컴포넌트
// ============================================

type ScoreCardProps = {
  row: ScoreRow;
  index: number;
  subjectGroupOptions: Array<{ value: string; label: string }>;
  subjectTypeOptions: Array<{ value: string; label: string }>;
  achievementOptions: Array<{ value: string; label: string }>;
  getSubjectsForGroup: (groupId: string) => Array<{ id: string; name: string }>;
  onUpdateField: <K extends keyof ScoreRow>(id: string, field: K, value: ScoreRow[K]) => void;
  onSubjectGroupChange: (id: string, groupId: string) => void;
  onSubjectTypeChange: (id: string, typeId: string) => void;
  onRemove: (id: string) => void;
  gradeSystem: 5 | 9;
  subjectTypes: SubjectType[];
};

function ScoreCard({
  row,
  index,
  subjectGroupOptions,
  subjectTypeOptions,
  achievementOptions,
  getSubjectsForGroup,
  onUpdateField,
  onSubjectGroupChange,
  onSubjectTypeChange,
  onRemove,
  gradeSystem,
  subjectTypes,
}: ScoreCardProps) {
  const subjects = getSubjectsForGroup(row.subject_group_id);
  const subjectOptions = subjects.map((s) => ({ value: s.id, label: s.name }));

  const computed: ScoreComputationResult | null = useMemo(() => {
    const rawScore = row.raw_score ?? null;
    if (rawScore === null) return null;

    const selectedType = subjectTypes.find((t) => t.id === row.subject_type_id);
    const isAchievementOnly = selectedType?.is_achievement_only ?? false;
    const rankGrade = row.rank_grade ?? null;
    const stdDev = row.std_dev ?? null;

    return computeScoreAnalysis({
      rawScore,
      avgScore: row.avg_score ?? null,
      stdDev,
      rankGrade,
      achievementLevel: row.achievement_level ?? null,
      ratioA: row.achievement_ratio_a ?? null,
      ratioB: row.achievement_ratio_b ?? null,
      ratioC: row.achievement_ratio_c ?? null,
      ratioD: row.achievement_ratio_d ?? null,
      ratioE: row.achievement_ratio_e ?? null,
      totalStudents: row.total_students ?? null,
      classRank: row.class_rank ?? null,
      subjectCategory: determineSubjectCategory(isAchievementOnly, rankGrade, stdDev),
      gradeSystem,
    });
  }, [
    row.raw_score, row.avg_score, row.std_dev, row.rank_grade,
    row.achievement_level, row.achievement_ratio_a, row.achievement_ratio_b,
    row.achievement_ratio_c, row.achievement_ratio_d, row.achievement_ratio_e,
    row.total_students, row.class_rank, row.subject_type_id,
    gradeSystem, subjectTypes,
  ]);

  const hasComputedValues = computed && (
    computed.estimatedPercentile !== null ||
    computed.convertedGrade9 !== null ||
    computed.adjustedGrade !== null ||
    computed.estimatedStdDev !== null
  );

  return (
    <Card padding="none">
      <div className="flex flex-col">
        {/* 카드 헤더 */}
        <div className="flex items-center justify-between border-b border-secondary-100 dark:border-secondary-800 px-6 py-4">
          <h3 className="text-body-1 font-semibold text-[var(--text-primary)]">
            과목 {index + 1}
          </h3>
          <Button
            type="button"
            variant="ghost"
            size="xs"
            onClick={() => onRemove(row.id)}
            aria-label={`과목 ${index + 1} 삭제`}
          >
            <svg className="h-4 w-4 text-error-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </Button>
        </div>

        {/* 필드 그리드 */}
        <div className="p-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {/* Row 1: 교과군, 과목, 과목구분 */}
            <FormSelect
              label="교과군"
              required
              selectSize="sm"
              placeholder="선택"
              options={subjectGroupOptions}
              value={row.subject_group_id}
              onChange={(e) => onSubjectGroupChange(row.id, e.target.value)}
            />
            <FormSelect
              label="과목"
              required
              selectSize="sm"
              placeholder="선택"
              options={subjectOptions}
              value={row.subject_id}
              onChange={(e) => onUpdateField(row.id, "subject_id", e.target.value)}
              disabled={!row.subject_group_id}
            />
            <FormSelect
              label="과목구분"
              required
              selectSize="sm"
              placeholder="선택"
              options={subjectTypeOptions}
              value={row.subject_type_id}
              onChange={(e) => onSubjectTypeChange(row.id, e.target.value)}
            />

            {/* Row 2: 학점, 석차등급, 성취도 */}
            <FormField
              label="학점"
              required
              inputSize="sm"
              type="number"
              min="1"
              step="1"
              value={row.credit_hours}
              onChange={(e) => onUpdateField(row.id, "credit_hours", Number(e.target.value))}
            />
            <FormField
              label="석차등급"
              required={!row.isAchievementOnly}
              inputSize="sm"
              type="number"
              min="1"
              max="9"
              step="1"
              value={row.rank_grade ?? ""}
              onChange={(e) =>
                onUpdateField(row.id, "rank_grade", e.target.value ? Number(e.target.value) : null)
              }
              disabled={row.isAchievementOnly}
              placeholder={row.isAchievementOnly ? "-" : "1~9"}
            />
            <FormSelect
              label="성취도"
              required={row.isAchievementOnly}
              selectSize="sm"
              placeholder="-"
              options={achievementOptions}
              value={row.achievement_level ?? ""}
              onChange={(e) =>
                onUpdateField(row.id, "achievement_level", e.target.value || null)
              }
            />

            {/* Row 3: 원점수, 과목평균, 표준편차 */}
            <FormField
              label="원점수"
              inputSize="sm"
              type="number"
              step="0.1"
              placeholder="85.5"
              value={row.raw_score ?? ""}
              onChange={(e) =>
                onUpdateField(row.id, "raw_score", e.target.value ? Number(e.target.value) : null)
              }
            />
            <FormField
              label="과목평균"
              inputSize="sm"
              type="number"
              step="0.1"
              placeholder="78.2"
              value={row.avg_score ?? ""}
              onChange={(e) =>
                onUpdateField(row.id, "avg_score", e.target.value ? Number(e.target.value) : null)
              }
              disabled={row.isAchievementOnly}
            />
            <FormField
              label="표준편차"
              inputSize="sm"
              type="number"
              step="0.1"
              placeholder="12.5"
              value={row.std_dev ?? ""}
              onChange={(e) =>
                onUpdateField(row.id, "std_dev", e.target.value ? Number(e.target.value) : null)
              }
              disabled={row.isAchievementOnly}
            />

            {/* Row 4: 수강자수, 석차 */}
            <FormField
              label="수강자수"
              inputSize="sm"
              type="number"
              step="1"
              placeholder="30"
              value={row.total_students ?? ""}
              onChange={(e) =>
                onUpdateField(row.id, "total_students", e.target.value ? Number(e.target.value) : null)
              }
            />
            <FormField
              label="석차"
              inputSize="sm"
              type="number"
              min="1"
              step="1"
              value={row.class_rank ?? ""}
              onChange={(e) =>
                onUpdateField(row.id, "class_rank", e.target.value ? Number(e.target.value) : null)
              }
              disabled={row.isAchievementOnly}
              placeholder={row.isAchievementOnly ? "-" : ""}
            />
          </div>

          {/* 성취도비율 접이식 영역 */}
          <div className="mt-4 border-t border-secondary-100 dark:border-secondary-800 pt-4">
            <button
              type="button"
              onClick={() => onUpdateField(row.id, "showRatioDetail", !row.showRatioDetail)}
              className="flex items-center gap-1.5 text-body-2 font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
            >
              <svg
                className={cn(
                  "h-3.5 w-3.5 transition-transform duration-200",
                  row.showRatioDetail && "rotate-90"
                )}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              성취도비율 (%)
            </button>

            {row.showRatioDetail && (
              <div className="mt-3 flex flex-wrap gap-3">
                {(["a", "b", "c", "d", "e"] as const).map((level) => {
                  const fieldKey = `achievement_ratio_${level}` as keyof ScoreRow;
                  return (
                    <FormField
                      key={level}
                      label={level.toUpperCase()}
                      inputSize="sm"
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      placeholder="0"
                      value={(row[fieldKey] as number | null) ?? ""}
                      onChange={(e) =>
                        onUpdateField(
                          row.id,
                          fieldKey,
                          e.target.value ? Number(e.target.value) : null
                        )
                      }
                      className="w-20"
                    />
                  );
                })}
              </div>
            )}
          </div>

          {/* 산출 결과 미리보기 */}
          {hasComputedValues && (() => {
            const is5Grade = gradeSystem === 5;
            const isStdDevInput = row.std_dev !== null && row.std_dev !== undefined;
            const isCareer = row.std_dev === null || row.std_dev === undefined;
            return (
              <div className="mt-4 border-t border-secondary-100 dark:border-secondary-800 pt-3">
                <p className="mb-2 text-xs font-medium text-[var(--text-secondary)]">산출 결과</p>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {computed.estimatedPercentile !== null && (
                    <div>
                      <span className="text-xs text-secondary-500">{is5Grade ? "추정 백분위" : "백분위"}</span>
                      <p className="text-sm font-medium text-[var(--text-primary)]">
                        상위 {(computed.estimatedPercentile * 100).toFixed(1)}%
                      </p>
                    </div>
                  )}
                  {is5Grade && computed.convertedGrade9 !== null && (
                    <div>
                      <span className="text-xs text-secondary-500">9등급 환산 (추정)</span>
                      <p className="text-sm font-medium text-[var(--text-primary)]">
                        {computed.convertedGrade9}등급
                      </p>
                    </div>
                  )}
                  {computed.adjustedGrade !== null && (
                    <div>
                      <span className="text-xs text-secondary-500">
                        {isCareer ? "변환석차등급" : "조정등급"}
                      </span>
                      <p className="text-xs text-secondary-400">
                        {isCareer ? "성취도비율 기반" : "MIN(Z등급, 석차등급)"}
                      </p>
                      <p className="text-sm font-medium text-[var(--text-primary)]">
                        {computed.adjustedGrade}등급
                      </p>
                    </div>
                  )}
                  {!isStdDevInput && computed.estimatedStdDev !== null && (
                    <div>
                      <span className="text-xs text-secondary-500">추정 표준편차</span>
                      <p className="text-sm font-medium text-[var(--text-primary)]">
                        {computed.estimatedStdDev.toFixed(2)}
                      </p>
                    </div>
                  )}
                </div>
                {computed.meta && computed.estimatedPercentile != null && (
                  <ScoreConfidenceChart
                    percentile={computed.estimatedPercentile}
                    gradeSystem={gradeSystem}
                    meta={computed.meta}
                    convertedGrade9={computed.convertedGrade9}
                    achievement={
                      row.achievement_level &&
                      row.achievement_ratio_a != null &&
                      row.achievement_ratio_b != null &&
                      row.achievement_ratio_c != null &&
                      row.achievement_ratio_d != null &&
                      row.achievement_ratio_e != null &&
                      row.raw_score != null
                        ? {
                            ratioA: row.achievement_ratio_a,
                            ratioB: row.achievement_ratio_b,
                            ratioC: row.achievement_ratio_c,
                            ratioD: row.achievement_ratio_d,
                            ratioE: row.achievement_ratio_e,
                            level: row.achievement_level,
                            rawScore: row.raw_score,
                          }
                        : null
                    }
                  />
                )}
              </div>
            );
          })()}
        </div>
      </div>
    </Card>
  );
}

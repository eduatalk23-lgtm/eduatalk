"use client";

import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Sparkles,
  Loader2,
  Copy,
  Pencil,
  ClipboardCheck,
  Search,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { useToast } from "@/components/ui/ToastProvider";
import {
  guideCareerFieldsQueryOptions,
  allSubjectsQueryOptions,
  cmsGuideListQueryOptions,
} from "@/lib/query-options/explorationGuide";
import {
  GUIDE_TYPES,
  GUIDE_TYPE_LABELS,
} from "@/lib/domains/guide/types";
import type { GuideType } from "@/lib/domains/guide/types";
import { generateGuideAction } from "@/lib/domains/guide/llm/actions/generateGuide";
import { reviewGuideAction } from "@/lib/domains/guide/llm/actions/reviewGuide";
import type { GeneratedGuideOutput } from "@/lib/domains/guide/llm/types";
import type { ReviewResult } from "@/lib/domains/guide/llm/actions/reviewGuide";
import { GuidePreview } from "../../[id]/_components/GuidePreview";

type Step = "input" | "preview";
type SourceMode = "keyword" | "clone_variant";

export function GuideGeneratorClient() {
  const router = useRouter();
  const toast = useToast();

  // 참조 데이터
  const { data: careerFieldsRes } = useQuery(guideCareerFieldsQueryOptions());
  const { data: subjectsRes } = useQuery(allSubjectsQueryOptions());
  const careerFields = careerFieldsRes?.success ? careerFieldsRes.data ?? [] : [];
  const allSubjects = subjectsRes?.success ? subjectsRes.data ?? [] : [];

  // 위자드 상태
  const [step, setStep] = useState<Step>("input");
  const [sourceMode, setSourceMode] = useState<SourceMode>("keyword");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isReviewing, setIsReviewing] = useState(false);

  // 키워드 입력
  const [keyword, setKeyword] = useState("");
  const [guideType, setGuideType] = useState<GuideType>("topic_exploration");
  const [targetSubject, setTargetSubject] = useState("");
  const [targetCareerField, setTargetCareerField] = useState("");
  const [additionalContext, setAdditionalContext] = useState("");

  // 클론 입력
  const [sourceGuideSearch, setSourceGuideSearch] = useState("");
  const [sourceGuideId, setSourceGuideId] = useState("");
  const [sourceGuideTitle, setSourceGuideTitle] = useState("");
  const [cloneTargetSubject, setCloneTargetSubject] = useState("");
  const [cloneTargetCareer, setCloneTargetCareer] = useState("");
  const [variationNote, setVariationNote] = useState("");

  // 결과
  const [generatedGuideId, setGeneratedGuideId] = useState<string | null>(null);
  const [preview, setPreview] = useState<GeneratedGuideOutput | null>(null);
  const [reviewResult, setReviewResult] = useState<ReviewResult | null>(null);

  // 가이드 검색 (클론용)
  const { data: searchRes } = useQuery({
    ...cmsGuideListQueryOptions({
      searchQuery: sourceGuideSearch || undefined,
      page: 1,
      pageSize: 10,
    }),
    enabled: sourceMode === "clone_variant" && sourceGuideSearch.length >= 2,
  });
  const searchResults = searchRes?.success ? searchRes.data?.data ?? [] : [];

  const handleGenerate = useCallback(async () => {
    setIsGenerating(true);
    try {
      const result = await generateGuideAction(
        sourceMode === "keyword"
          ? {
              source: "keyword",
              keyword: {
                keyword,
                guideType,
                targetSubject: targetSubject || undefined,
                targetCareerField: targetCareerField || undefined,
                additionalContext: additionalContext || undefined,
              },
            }
          : {
              source: "clone_variant",
              clone: {
                sourceGuideId,
                targetSubject: cloneTargetSubject || undefined,
                targetCareerField: cloneTargetCareer || undefined,
                variationNote: variationNote || undefined,
              },
            },
      );

      if (result.success && result.data) {
        setGeneratedGuideId(result.data.guideId);
        setPreview(result.data.preview);
        setStep("preview");
        toast.showSuccess("가이드가 생성되었습니다!");
      } else {
        toast.showError(!result.success ? result.error ?? "생성 실패" : "생성 실패");
      }
    } catch {
      toast.showError("AI 가이드 생성에 실패했습니다.");
    } finally {
      setIsGenerating(false);
    }
  }, [
    sourceMode, keyword, guideType, targetSubject, targetCareerField,
    additionalContext, sourceGuideId, cloneTargetSubject, cloneTargetCareer,
    variationNote, toast,
  ]);

  const handleReview = useCallback(async () => {
    if (!generatedGuideId) return;
    setIsReviewing(true);
    try {
      const result = await reviewGuideAction(generatedGuideId);
      if (result.success && result.data) {
        setReviewResult(result.data);
        toast.showSuccess(`AI 리뷰 완료: ${result.data.score}점`);
      } else {
        toast.showError(!result.success ? result.error ?? "리뷰 실패" : "리뷰 실패");
      }
    } catch {
      toast.showError("AI 리뷰에 실패했습니다.");
    } finally {
      setIsReviewing(false);
    }
  }, [generatedGuideId, toast]);

  const canGenerate =
    sourceMode === "keyword"
      ? keyword.trim().length > 0
      : sourceGuideId.length > 0;

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center gap-3">
        <Link
          href="/admin/guides"
          className="p-2 rounded-lg hover:bg-secondary-100 dark:hover:bg-secondary-800 transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-[var(--text-secondary)]" />
        </Link>
        <div>
          <h1 className="text-lg font-bold text-[var(--text-heading)]">
            AI 가이드 생성
          </h1>
          <p className="text-xs text-[var(--text-secondary)]">
            Gemini AI로 탐구 가이드를 자동 생성합니다
          </p>
        </div>
      </div>

      {step === "input" ? (
        <div className="space-y-6">
          {/* 소스 모드 토글 */}
          <div className="flex gap-2">
            <SourceButton
              active={sourceMode === "keyword"}
              onClick={() => setSourceMode("keyword")}
              icon={<Sparkles className="w-4 h-4" />}
              label="키워드 생성"
              description="주제/키워드로 새 가이드 생성"
            />
            <SourceButton
              active={sourceMode === "clone_variant"}
              onClick={() => setSourceMode("clone_variant")}
              icon={<Copy className="w-4 h-4" />}
              label="기존 가이드 변형"
              description="기존 가이드를 다른 관점으로 변형"
            />
          </div>

          {/* 입력 폼 */}
          <div className="rounded-xl border border-secondary-200 dark:border-secondary-700 bg-white dark:bg-secondary-900 p-6 space-y-4">
            {sourceMode === "keyword" ? (
              <>
                {/* 키워드 */}
                <FormField label="키워드/주제" required>
                  <input
                    type="text"
                    value={keyword}
                    onChange={(e) => setKeyword(e.target.value)}
                    placeholder="예: CRISPR 유전자 편집, 양자컴퓨터, 기후변화와 해수면 상승"
                    className={inputClass}
                  />
                </FormField>

                {/* 가이드 유형 */}
                <FormField label="가이드 유형">
                  <select
                    value={guideType}
                    onChange={(e) => setGuideType(e.target.value as GuideType)}
                    className={inputClass}
                  >
                    {GUIDE_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {GUIDE_TYPE_LABELS[t]}
                      </option>
                    ))}
                  </select>
                </FormField>

                {/* 과목/계열 */}
                <div className="grid grid-cols-2 gap-4">
                  <FormField label="관련 과목">
                    <select
                      value={targetSubject}
                      onChange={(e) => setTargetSubject(e.target.value)}
                      className={inputClass}
                    >
                      <option value="">선택 안함</option>
                      {allSubjects.map((s) => (
                        <option key={s.id} value={s.name}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </FormField>
                  <FormField label="관련 계열">
                    <select
                      value={targetCareerField}
                      onChange={(e) => setTargetCareerField(e.target.value)}
                      className={inputClass}
                    >
                      <option value="">선택 안함</option>
                      {careerFields.map((c) => (
                        <option key={c.id} value={c.name_kor}>
                          {c.name_kor}
                        </option>
                      ))}
                    </select>
                  </FormField>
                </div>

                {/* 추가 맥락 */}
                <FormField label="추가 요청사항" optional>
                  <textarea
                    value={additionalContext}
                    onChange={(e) => setAdditionalContext(e.target.value)}
                    rows={3}
                    placeholder="특정 관점, 강조할 내용, 난이도 등..."
                    className={cn(inputClass, "resize-none")}
                  />
                </FormField>
              </>
            ) : (
              <>
                {/* 원본 가이드 검색 */}
                <FormField label="원본 가이드" required>
                  {sourceGuideId ? (
                    <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-primary-300 bg-primary-50 dark:bg-primary-900/20 dark:border-primary-600">
                      <span className="flex-1 text-sm text-[var(--text-primary)] truncate">
                        {sourceGuideTitle}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setSourceGuideId("");
                          setSourceGuideTitle("");
                        }}
                        className="text-xs text-primary-600 hover:underline"
                      >
                        변경
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="relative">
                        <input
                          type="text"
                          value={sourceGuideSearch}
                          onChange={(e) => setSourceGuideSearch(e.target.value)}
                          placeholder="가이드 제목 검색..."
                          className={inputClass}
                        />
                        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-secondary-400" />
                      </div>
                      {searchResults.length > 0 && (
                        <div className="border border-secondary-200 dark:border-secondary-700 rounded-lg max-h-48 overflow-y-auto">
                          {searchResults.map((g) => (
                            <button
                              key={g.id}
                              type="button"
                              onClick={() => {
                                setSourceGuideId(g.id);
                                setSourceGuideTitle(g.title);
                                setSourceGuideSearch("");
                              }}
                              className="w-full text-left px-3 py-2 text-sm hover:bg-secondary-50 dark:hover:bg-secondary-800 border-b border-secondary-100 dark:border-secondary-800 last:border-b-0"
                            >
                              <span className="text-[var(--text-primary)]">{g.title}</span>
                              {g.book_title && (
                                <span className="text-xs text-[var(--text-secondary)] ml-2">
                                  ({g.book_title})
                                </span>
                              )}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </FormField>

                {/* 변형 대상 */}
                <div className="grid grid-cols-2 gap-4">
                  <FormField label="대상 과목">
                    <select
                      value={cloneTargetSubject}
                      onChange={(e) => setCloneTargetSubject(e.target.value)}
                      className={inputClass}
                    >
                      <option value="">선택 안함</option>
                      {allSubjects.map((s) => (
                        <option key={s.id} value={s.name}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </FormField>
                  <FormField label="대상 계열">
                    <select
                      value={cloneTargetCareer}
                      onChange={(e) => setCloneTargetCareer(e.target.value)}
                      className={inputClass}
                    >
                      <option value="">선택 안함</option>
                      {careerFields.map((c) => (
                        <option key={c.id} value={c.name_kor}>
                          {c.name_kor}
                        </option>
                      ))}
                    </select>
                  </FormField>
                </div>

                <FormField label="변형 방향" optional>
                  <textarea
                    value={variationNote}
                    onChange={(e) => setVariationNote(e.target.value)}
                    rows={2}
                    placeholder="어떤 관점에서 변형할지 설명..."
                    className={cn(inputClass, "resize-none")}
                  />
                </FormField>
              </>
            )}
          </div>

          {/* 생성 버튼 */}
          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleGenerate}
              disabled={!canGenerate || isGenerating}
              className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-primary-500 text-white text-sm font-medium hover:bg-primary-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  생성 중... (15~30초)
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  AI 가이드 생성
                </>
              )}
            </button>
          </div>
        </div>
      ) : (
        /* Step 2: Preview */
        <div className="space-y-6">
          {preview && (
            <GuidePreview
              title={preview.title}
              guideType={preview.guideType}
              bookTitle={preview.bookTitle ?? ""}
              bookAuthor={preview.bookAuthor ?? ""}
              bookPublisher={preview.bookPublisher ?? ""}
              motivation={preview.motivation}
              theorySections={preview.theorySections.map((s) => ({
                ...s,
                content_format: "html" as const,
              }))}
              reflection={preview.reflection}
              impression={preview.impression}
              summary={preview.summary}
              followUp={preview.followUp}
              bookDescription={preview.bookDescription ?? ""}
              contentFormat="html"
            />
          )}

          {/* AI 리뷰 결과 */}
          {reviewResult && (
            <div className="rounded-xl border border-secondary-200 dark:border-secondary-700 bg-white dark:bg-secondary-900 p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-[var(--text-heading)]">
                  AI 리뷰 결과
                </h3>
                <span
                  className={cn(
                    "px-2.5 py-1 rounded-full text-xs font-medium",
                    reviewResult.score >= 80
                      ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                      : reviewResult.score >= 60
                        ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300"
                        : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
                  )}
                >
                  {reviewResult.score}점
                </span>
              </div>

              {/* 차원별 점수 */}
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(reviewResult.review.dimensions).map(
                  ([key, value]) => (
                    <div
                      key={key}
                      className="flex items-center justify-between px-3 py-1.5 rounded bg-secondary-50 dark:bg-secondary-800/50"
                    >
                      <span className="text-xs text-[var(--text-secondary)]">
                        {DIMENSION_LABELS[key] ?? key}
                      </span>
                      <span className="text-xs font-medium text-[var(--text-primary)]">
                        {value}
                      </span>
                    </div>
                  ),
                )}
              </div>

              {/* 강점 */}
              {reviewResult.review.strengths.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-green-600 dark:text-green-400">
                    강점
                  </p>
                  <ul className="list-disc list-inside text-xs text-[var(--text-secondary)] space-y-0.5">
                    {reviewResult.review.strengths.map((s, i) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* 피드백 */}
              {reviewResult.review.feedback.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-yellow-600 dark:text-yellow-400">
                    개선 제안
                  </p>
                  <ul className="list-disc list-inside text-xs text-[var(--text-secondary)] space-y-0.5">
                    {reviewResult.review.feedback.map((f, i) => (
                      <li key={i}>{f}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* 액션 버튼 */}
          <div className="flex items-center gap-3 justify-end">
            <button
              type="button"
              onClick={() => {
                setStep("input");
                setPreview(null);
                setGeneratedGuideId(null);
                setReviewResult(null);
              }}
              className="px-4 py-2 rounded-lg border border-secondary-200 dark:border-secondary-700 text-sm text-[var(--text-secondary)] hover:bg-secondary-50 dark:hover:bg-secondary-800 transition-colors"
            >
              다시 생성
            </button>
            <button
              type="button"
              onClick={handleReview}
              disabled={isReviewing || !!reviewResult}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-secondary-200 dark:border-secondary-700 text-sm font-medium text-[var(--text-primary)] hover:bg-secondary-50 dark:hover:bg-secondary-800 transition-colors disabled:opacity-50"
            >
              {isReviewing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  리뷰 중...
                </>
              ) : (
                <>
                  <ClipboardCheck className="w-4 h-4" />
                  AI 리뷰
                </>
              )}
            </button>
            <button
              type="button"
              onClick={() => {
                if (generatedGuideId) {
                  router.push(`/admin/guides/${generatedGuideId}`);
                }
              }}
              disabled={!generatedGuideId}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary-500 text-white text-sm font-medium hover:bg-primary-600 transition-colors disabled:opacity-50"
            >
              <Pencil className="w-4 h-4" />
              편집기에서 수정
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// 서브 컴포넌트
// ============================================================

const inputClass = cn(
  "w-full px-3 py-2 rounded-lg border text-sm",
  "border-secondary-200 dark:border-secondary-700",
  "bg-white dark:bg-secondary-900",
  "text-[var(--text-primary)]",
  "placeholder:text-secondary-400",
  "focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500",
);

function SourceButton({
  active,
  onClick,
  icon,
  label,
  description,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  description: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex-1 flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-colors",
        active
          ? "border-primary-500 bg-primary-50 dark:bg-primary-900/20 dark:border-primary-600"
          : "border-secondary-200 dark:border-secondary-700 hover:bg-secondary-50 dark:hover:bg-secondary-800",
      )}
    >
      <div
        className={cn(
          "p-2 rounded-lg",
          active
            ? "bg-primary-100 text-primary-600 dark:bg-primary-800/50 dark:text-primary-300"
            : "bg-secondary-100 text-secondary-500 dark:bg-secondary-800 dark:text-secondary-400",
        )}
      >
        {icon}
      </div>
      <div>
        <p className="text-sm font-medium text-[var(--text-heading)]">{label}</p>
        <p className="text-xs text-[var(--text-secondary)]">{description}</p>
      </div>
    </button>
  );
}

function FormField({
  label,
  required,
  optional,
  children,
}: {
  label: string;
  required?: boolean;
  optional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-[var(--text-heading)] mb-1.5">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
        {optional && (
          <span className="text-xs font-normal text-[var(--text-secondary)] ml-1">
            (선택)
          </span>
        )}
      </label>
      {children}
    </div>
  );
}

const DIMENSION_LABELS: Record<string, string> = {
  academicDepth: "학술적 깊이",
  studentAccessibility: "학생 접근성",
  structuralCompleteness: "구조적 완성도",
  practicalRelevance: "실용적 연관성",
};

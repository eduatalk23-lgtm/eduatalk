"use client";

import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
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
  cmsGuideListQueryOptions,
  titleAutocompleteQueryOptions,
  similarGuideCountQueryOptions,
  studentCareerQueryOptions,
  popularGuidesQueryOptions,
  groupedSubjectsQueryOptions,
  filterRecommendQueryOptions,
  curriculumUnitsQueryOptions,
} from "@/lib/query-options/explorationGuide";
import { studentSearchQueryOptions } from "@/lib/query-options/students";
import { useDebounce } from "@/lib/hooks/useDebounce";
import {
  GUIDE_TYPES,
  GUIDE_TYPE_LABELS,
} from "@/lib/domains/guide/types";
import type { GuideType } from "@/lib/domains/guide/types";
import { generateGuideAction } from "@/lib/domains/guide/llm/actions/generateGuide";
import { reviewGuideAction } from "@/lib/domains/guide/llm/actions/reviewGuide";
import {
  suggestTopicsAction,
  fetchSuggestedTopicsAction,
} from "@/lib/domains/guide/llm/actions/suggestTopics";
import type { SuggestedTopic } from "@/lib/domains/guide/types";
import type { GeneratedGuideOutput, SuggestedTopicsOutput } from "@/lib/domains/guide/llm/types";
import type { ModelTier } from "@/lib/domains/plan/llm/types";
import type { ReviewResult } from "@/lib/domains/guide/llm/actions/reviewGuide";
import { GuidePreview } from "../../[id]/_components/GuidePreview";

type Step = "input" | "preview";
type SourceMode = "keyword" | "clone_variant";

export function GuideGeneratorClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();

  // URL 쿼리 파라미터에서 프리필 데이터 추출 (주제 관리 페이지에서 전달)
  const prefill = useMemo(() => {
    const keyword = searchParams.get("keyword");
    if (!keyword) return null;
    return {
      keyword,
      guideType: (searchParams.get("guideType") ?? "topic_exploration") as GuideType,
      subject: searchParams.get("subject"),
      careerField: searchParams.get("careerField"),
      curriculumYear: searchParams.get("curriculumYear")
        ? Number(searchParams.get("curriculumYear"))
        : null,
      subjectGroup: searchParams.get("subjectGroup"),
      majorUnit: searchParams.get("majorUnit"),
      minorUnit: searchParams.get("minorUnit"),
      topicId: searchParams.get("topicId"),
    };
  }, [searchParams]);

  // 참조 데이터
  const { data: careerFieldsRes } = useQuery(guideCareerFieldsQueryOptions());
  const careerFields = careerFieldsRes?.success ? careerFieldsRes.data ?? [] : [];

  // 개정교육과정 선택 (기본값: 2022)
  const [curriculumYear, setCurriculumYear] = useState<number>(
    prefill?.curriculumYear ?? 2022,
  );
  const curriculumRevisionId =
    curriculumYear === 2022
      ? "7606fee5-6405-4410-8ff8-e9ec12ff07e2"
      : "487cc4d6-62ec-41d6-ba4a-6009b0a08f9e";

  const { data: groupedSubjectsRes } = useQuery(
    groupedSubjectsQueryOptions(curriculumRevisionId),
  );
  const groupedSubjects = groupedSubjectsRes?.success
    ? groupedSubjectsRes.data ?? []
    : [];

  // 위자드 상태
  const [step, setStep] = useState<Step>("input");
  const [sourceMode, setSourceMode] = useState<SourceMode>("keyword");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isReviewing, setIsReviewing] = useState(false);

  // 키워드 입력 (prefill로 초기값 세팅)
  const [keyword, setKeyword] = useState(prefill?.keyword ?? "");
  const [guideType, setGuideType] = useState<GuideType>(
    prefill?.guideType ?? "topic_exploration",
  );
  const [targetSubjectGroup, setTargetSubjectGroup] = useState(
    prefill?.subjectGroup ?? "",
  );
  const [targetSubject, setTargetSubject] = useState(
    prefill?.subject ?? "",
  );
  const [targetMajorUnit, setTargetMajorUnit] = useState(
    prefill?.majorUnit ?? "",
  );
  const [targetMinorUnit, setTargetMinorUnit] = useState(
    prefill?.minorUnit ?? "",
  );
  const [targetCareerField, setTargetCareerField] = useState(
    prefill?.careerField ?? "",
  );
  const [additionalContext, setAdditionalContext] = useState("");
  const [modelTier, setModelTier] = useState<ModelTier>("fast");

  // 캐스케이드 필터: 교과 → 과목
  const filteredSubjects = targetSubjectGroup
    ? groupedSubjects.find((g) => g.groupName === targetSubjectGroup)?.subjects ?? []
    : [];


  // AI 주제 추천 상태
  const [aiTopics, setAiTopics] = useState<SuggestedTopicsOutput["topics"]>([]);
  const [isLoadingTopics, setIsLoadingTopics] = useState(false);

  // 축적된 주제 상태
  const [savedTopics, setSavedTopics] = useState<SuggestedTopic[]>([]);
  const [isLoadingSaved, setIsLoadingSaved] = useState(false);

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

  // Phase 2: 학생 선택 + 진로 기반 인기 주제
  const [studentSearch, setStudentSearch] = useState("");
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [selectedStudentName, setSelectedStudentName] = useState("");
  const [showStudentDropdown, setShowStudentDropdown] = useState(false);
  const studentDropdownRef = useRef<HTMLDivElement>(null);

  const debouncedStudentSearch = useDebounce(studentSearch, 300);
  const { data: studentSearchRes } = useQuery({
    ...studentSearchQueryOptions(debouncedStudentSearch),
    enabled: debouncedStudentSearch.length >= 1,
  });
  const studentResults =
    studentSearchRes?.success ? studentSearchRes.students ?? [] : [];

  const { data: careerInfoRes } = useQuery(
    studentCareerQueryOptions(selectedStudentId),
  );
  const careerInfo = careerInfoRes?.success ? careerInfoRes.data : null;

  const { data: popularRes } = useQuery(
    popularGuidesQueryOptions(careerInfo?.target_major ?? ""),
  );
  const popularGuides = popularRes?.success ? popularRes.data ?? [] : [];

  // 학생 드롭다운 외부 클릭 닫기
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        studentDropdownRef.current &&
        !studentDropdownRef.current.contains(e.target as Node)
      ) {
        setShowStudentDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // 교육과정 단원 칩 (과목 선택 시)
  const { data: curriculumRes } = useQuery(
    curriculumUnitsQueryOptions(targetSubject),
  );
  const curriculumUnits = curriculumRes?.success
    ? curriculumRes.data ?? []
    : [];

  // 캐스케이드 필터: 과목 → 대단원
  const majorUnits = curriculumUnits.filter((u) => u.unit_type === "major");

  // 캐스케이드 필터: 대단원 → 소단원 (ID 기반)
  const selectedMajor = majorUnits.find((u) => u.unit_name === targetMajorUnit);
  const selectedMajorId = selectedMajor?.id;
  const minorUnits = selectedMajorId
    ? curriculumUnits.filter(
        (u) => u.unit_type === "minor" && u.parent_unit_id === selectedMajorId,
      )
    : [];

  // 키워드 추천: 자동완성 상태
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const autocompleteRef = useRef<HTMLDivElement>(null);

  // 조건 기반 추천: 과목명 → subjectId 변환
  const selectedSubjectId = (() => {
    if (!targetSubject) return undefined;
    for (const g of groupedSubjects) {
      const found = g.subjects.find((s) => s.name === targetSubject);
      if (found) return found.id;
    }
    return undefined;
  })();

  // 조건 기반 추천: 계열명 → careerFieldId 변환
  const selectedCareerFieldId = (() => {
    if (!targetCareerField) return undefined;
    const found = careerFields.find((c) => c.name_kor === targetCareerField);
    return found?.id;
  })();

  // 조건 기반 추천 쿼리 (유형+과목+계열 조합, 300ms 디바운스)
  const debouncedFilters = useDebounce(
    { guideType, subjectId: selectedSubjectId, careerFieldId: selectedCareerFieldId },
    300,
  );
  const { data: filterRecommendRes } = useQuery(
    filterRecommendQueryOptions(debouncedFilters),
  );
  const filterRecommendations = filterRecommendRes?.success
    ? filterRecommendRes.data ?? []
    : [];

  // 키워드 추천: 자동완성 (300ms 디바운스)
  const debouncedKeyword = useDebounce(keyword, 300);
  const { data: autocompleteRes } = useQuery(
    titleAutocompleteQueryOptions(debouncedKeyword),
  );
  const autocompleteSuggestions = autocompleteRes?.success
    ? autocompleteRes.data ?? []
    : [];


  // 키워드 추천: 유사 가이드 개수 (500ms 디바운스)
  const debouncedKeywordForCount = useDebounce(keyword, 500);
  const { data: similarCountRes } = useQuery(
    similarGuideCountQueryOptions(debouncedKeywordForCount),
  );
  const similarCount = similarCountRes?.success
    ? similarCountRes.data ?? 0
    : 0;

  // 자동완성 외부 클릭 닫기
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        autocompleteRef.current &&
        !autocompleteRef.current.contains(e.target as Node)
      ) {
        setShowAutocomplete(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleGenerate = useCallback(async () => {
    setIsGenerating(true);
    try {
      // 교육과정 체계 맥락을 additionalContext에 자동 주입
      const curriculumContext = [
        targetMajorUnit && `대단원: ${targetMajorUnit}`,
        targetMinorUnit && `소단원: ${targetMinorUnit}`,
      ].filter(Boolean).join(", ");

      const fullContext = [
        curriculumContext && `[교육과정 체계] ${curriculumYear} 개정 > ${targetSubjectGroup || ""} > ${targetSubject || ""} > ${curriculumContext}`,
        additionalContext,
      ].filter(Boolean).join("\n\n");

      const result = await generateGuideAction(
        sourceMode === "keyword"
          ? {
              source: "keyword",
              curriculumYear: String(curriculumYear),
              subjectArea: targetSubjectGroup || undefined,
              subjectSelect: targetSubject || undefined,
              unitMajor: targetMajorUnit || undefined,
              unitMinor: targetMinorUnit || undefined,
              modelTier,
              keyword: {
                keyword,
                guideType,
                targetSubject: targetSubject || undefined,
                targetCareerField: targetCareerField || undefined,
                additionalContext: fullContext || undefined,
              },
            }
          : {
              source: "clone_variant",
              curriculumYear: String(curriculumYear),
              subjectArea: targetSubjectGroup || undefined,
              subjectSelect: targetSubject || undefined,
              unitMajor: targetMajorUnit || undefined,
              unitMinor: targetMinorUnit || undefined,
              modelTier,
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
    variationNote, toast, modelTier, curriculumYear, targetSubjectGroup,
    targetMajorUnit, targetMinorUnit,
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
          href={prefill ? "/admin/guides/topics" : "/admin/guides"}
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

      {/* 주제에서 전달된 프리필 안내 */}
      {prefill && step === "input" && (
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-700">
          <Sparkles className="w-4 h-4 text-primary-500 shrink-0" />
          <p className="text-sm text-primary-700 dark:text-primary-300">
            <span className="font-medium">&quot;{prefill.keyword}&quot;</span> 주제가 자동으로 입력되었습니다. 필요 시 수정 후 생성하세요.
          </p>
        </div>
      )}

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
            {/* 학생 연결 (선택) — 키워드/클론 공통 */}
            <FormField label="학생 연결" optional>
              {selectedStudentId ? (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-primary-300 bg-primary-50 dark:bg-primary-900/20 dark:border-primary-600">
                  <span className="flex-1 text-sm text-[var(--text-primary)] inline-flex items-center gap-2">
                    {selectedStudentName}
                    {careerInfo?.target_major && (
                      <span className="text-xs text-[var(--text-secondary)]">
                        ({careerInfo.target_major})
                      </span>
                    )}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedStudentId("");
                      setSelectedStudentName("");
                      setStudentSearch("");
                    }}
                    className="text-xs text-primary-600 hover:underline"
                  >
                    해제
                  </button>
                </div>
              ) : (
                <div className="relative" ref={studentDropdownRef}>
                  <input
                    type="text"
                    value={studentSearch}
                    onChange={(e) => {
                      setStudentSearch(e.target.value);
                      setShowStudentDropdown(true);
                    }}
                    onFocus={() => {
                      if (studentSearch.length >= 1)
                        setShowStudentDropdown(true);
                    }}
                    placeholder="학생 이름으로 검색..."
                    className={inputClass}
                  />
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-secondary-400" />

                  {showStudentDropdown && studentResults.length > 0 && (
                    <div className="absolute z-20 w-full top-full border border-secondary-200 dark:border-secondary-700 rounded-lg bg-white dark:bg-secondary-900 shadow-lg max-h-48 overflow-y-auto">
                      {studentResults.map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => {
                            setSelectedStudentId(s.id);
                            setSelectedStudentName(s.name ?? "이름 없음");
                            setStudentSearch("");
                            setShowStudentDropdown(false);
                          }}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-secondary-50 dark:hover:bg-secondary-800 border-b border-secondary-100 dark:border-secondary-800 last:border-b-0 flex items-center gap-2"
                        >
                          <span className="flex-1 text-[var(--text-primary)]">
                            {s.name ?? "이름 없음"}
                          </span>
                          <span className="text-[10px] text-[var(--text-secondary)]">
                            {s.grade}학년
                            {s.school_name && ` · ${s.school_name}`}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </FormField>

            {/* 인기 주제 칩 (학생의 진로 기반) */}
            {selectedStudentId && careerInfo?.target_major && popularGuides.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs text-[var(--text-secondary)]">
                  🎯 {careerInfo.target_major} 계열 인기 주제
                </p>
                <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto">
                  {popularGuides.map((g) => (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => setKeyword(g.title)}
                      className={cn(
                        "px-2.5 py-1 rounded-full text-xs transition-colors",
                        "border border-secondary-200 dark:border-secondary-700",
                        "hover:bg-primary-50 hover:border-primary-300 hover:text-primary-700",
                        "dark:hover:bg-primary-900/20 dark:hover:border-primary-600 dark:hover:text-primary-300",
                        keyword === g.title
                          ? "bg-primary-100 border-primary-400 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300"
                          : "text-[var(--text-secondary)]",
                      )}
                    >
                      <span className="inline-flex items-center gap-1">
                        {g.title}
                        {g.assignment_count > 0 && (
                          <span className="text-[10px] opacity-70">
                            {g.assignment_count}회
                          </span>
                        )}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 진로 미설정 안내 */}
            {selectedStudentId && careerInfo && !careerInfo.target_major && (
              <p className="text-xs text-warning-600 dark:text-warning-400">
                선택한 학생의 진로(목표 계열)가 설정되지 않았습니다
              </p>
            )}

            {sourceMode === "keyword" ? (
              <>
                {/* ── 교육과정 체계 (캐스케이드) ── */}
                <div className="rounded-lg border border-secondary-200 dark:border-secondary-700 bg-secondary-50/50 dark:bg-secondary-800/20 p-4 space-y-3">
                  <p className="text-xs font-semibold text-[var(--text-heading)]">교육과정 체계</p>

                  {/* 1단계: 교육과정 → 교과 */}
                  <div className="grid grid-cols-2 gap-3">
                    <FormField label="교육과정">
                      <select
                        value={curriculumYear}
                        onChange={(e) => {
                          setCurriculumYear(Number(e.target.value));
                          setTargetSubjectGroup("");
                          setTargetSubject("");
                          setTargetMajorUnit("");
                          setTargetMinorUnit("");
                        }}
                        className={inputClass}
                      >
                        <option value={2022}>2022 개정</option>
                        <option value={2015}>2015 개정</option>
                      </select>
                    </FormField>
                    <FormField label="교과">
                      <select
                        value={targetSubjectGroup}
                        onChange={(e) => {
                          setTargetSubjectGroup(e.target.value);
                          setTargetSubject("");
                          setTargetMajorUnit("");
                          setTargetMinorUnit("");
                        }}
                        className={inputClass}
                      >
                        <option value="">선택 안함</option>
                        {groupedSubjects.map((g) => (
                          <option key={g.groupName} value={g.groupName}>
                            {g.groupName}
                          </option>
                        ))}
                      </select>
                    </FormField>
                  </div>

                  {/* 2단계: 과목 → 대단원 */}
                  <div className="grid grid-cols-2 gap-3">
                    <FormField label="과목">
                      <select
                        value={targetSubject}
                        onChange={(e) => {
                          setTargetSubject(e.target.value);
                          setTargetMajorUnit("");
                          setTargetMinorUnit("");
                        }}
                        className={inputClass}
                        disabled={!targetSubjectGroup}
                      >
                        <option value="">
                          {targetSubjectGroup ? "선택 안함" : "교과를 먼저 선택"}
                        </option>
                        {filteredSubjects.map((s) => (
                          <option key={s.id} value={s.name}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                    </FormField>
                    <FormField label="대단원">
                      <select
                        value={targetMajorUnit}
                        onChange={(e) => {
                          setTargetMajorUnit(e.target.value);
                          setTargetMinorUnit("");
                        }}
                        className={inputClass}
                        disabled={!targetSubject || majorUnits.length === 0}
                      >
                        <option value="">
                          {!targetSubject
                            ? "과목을 먼저 선택"
                            : majorUnits.length === 0
                              ? "단원 정보 없음"
                              : "선택 안함"}
                        </option>
                        {majorUnits.map((u) => (
                          <option key={u.id} value={u.unit_name}>
                            {u.unit_name}
                          </option>
                        ))}
                      </select>
                    </FormField>
                  </div>

                  {/* 3단계: 소단원 (대단원 선택 시에만) */}
                  {targetMajorUnit && minorUnits.length > 0 && (
                    <FormField label="소단원">
                      <select
                        value={targetMinorUnit}
                        onChange={(e) => {
                          setTargetMinorUnit(e.target.value);
                          if (e.target.value) setKeyword(e.target.value);
                        }}
                        className={inputClass}
                      >
                        <option value="">선택 안함</option>
                        {minorUnits.map((u) => (
                          <option key={u.id} value={u.unit_name}>
                            {u.unit_name}
                          </option>
                        ))}
                      </select>
                    </FormField>
                  )}
                </div>

                {/* ── 가이드 설정 ── */}
                <div className="grid grid-cols-2 gap-4">
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

                {/* 조건 기반 추천 주제 칩 */}
                {filterRecommendations.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-xs text-[var(--text-secondary)]">
                      추천 주제 ({filterRecommendations.length}건) — 클릭하여 키워드로 사용
                    </p>
                    <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto">
                      {filterRecommendations.map((g) => (
                        <button
                          key={g.id}
                          type="button"
                          onClick={() => setKeyword(g.title)}
                          className={cn(
                            "px-2.5 py-1 rounded-full text-xs transition-colors",
                            "border border-secondary-200 dark:border-secondary-700",
                            "hover:bg-primary-50 hover:border-primary-300 hover:text-primary-700",
                            "dark:hover:bg-primary-900/20 dark:hover:border-primary-600 dark:hover:text-primary-300",
                            keyword === g.title
                              ? "bg-primary-100 border-primary-400 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300"
                              : "text-[var(--text-secondary)]",
                          )}
                        >
                          {g.title}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* 주제 추천 버튼 2개 */}
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={async () => {
                      setIsLoadingSaved(true);
                      const result = await fetchSuggestedTopicsAction({
                        guideType,
                        subjectName: targetSubject || undefined,
                        careerField: targetCareerField || undefined,
                        curriculumYear,
                        targetMajor: careerInfo?.target_major || undefined,
                      });
                      if (result.success && result.data) {
                        setSavedTopics(result.data);
                      }
                      setIsLoadingSaved(false);
                    }}
                    disabled={isLoadingSaved}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-secondary-300 dark:border-secondary-600 text-xs font-medium text-[var(--text-primary)] hover:bg-secondary-50 dark:hover:bg-secondary-800 transition-colors disabled:opacity-50"
                  >
                    {isLoadingSaved ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Search className="w-3.5 h-3.5" />
                    )}
                    축적된 주제
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      setIsLoadingTopics(true);
                      const result = await suggestTopicsAction({
                        guideType,
                        subject: targetSubject || undefined,
                        careerField: targetCareerField || undefined,
                        targetMajor: careerInfo?.target_major || undefined,
                        curriculumYear,
                        subjectGroup: targetSubjectGroup || undefined,
                        majorUnit: targetMajorUnit || undefined,
                        minorUnit: targetMinorUnit || undefined,
                        modelTier,
                        existingTitles: [
                          ...filterRecommendations.map((g) => g.title),
                          ...savedTopics.map((t) => t.title),
                        ],
                      });
                      if (result.success && result.data) {
                        setAiTopics(result.data.topics);
                        // 축적 주제도 새로고침
                        const saved = await fetchSuggestedTopicsAction({
                          guideType,
                          subjectName: targetSubject || undefined,
                          careerField: targetCareerField || undefined,
                        });
                        if (saved.success && saved.data) {
                          setSavedTopics(saved.data);
                        }
                      } else {
                        toast.showError(
                          !result.success
                            ? result.error ?? "AI 추천 실패"
                            : "AI 추천 실패",
                        );
                      }
                      setIsLoadingTopics(false);
                    }}
                    disabled={isLoadingTopics}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-primary-300 dark:border-primary-600 text-xs font-medium text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors disabled:opacity-50"
                  >
                    {isLoadingTopics ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="w-3.5 h-3.5" />
                    )}
                    AI 새 주제 추천
                  </button>
                </div>

                {/* 축적된 주제 칩 */}
                {savedTopics.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-xs text-[var(--text-secondary)]">
                      축적된 주제 ({savedTopics.length}건)
                    </p>
                    <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto">
                      {savedTopics.map((topic) => (
                        <button
                          key={topic.id}
                          type="button"
                          onClick={() => {
                            setKeyword(topic.title);
                            // 주제의 교육과정 체계 정보를 폼에 반영
                            if (topic.subject_group) setTargetSubjectGroup(topic.subject_group);
                            if (topic.subject_name) setTargetSubject(topic.subject_name);
                            if (topic.major_unit) setTargetMajorUnit(topic.major_unit);
                            if (topic.minor_unit) setTargetMinorUnit(topic.minor_unit);
                            if (topic.career_field) setTargetCareerField(topic.career_field);
                            // used_count는 generateGuideAction 서버에서 일괄 증가
                          }}
                          title={topic.reason ?? undefined}
                          className={cn(
                            "px-2.5 py-1.5 rounded-lg text-xs transition-colors text-left",
                            "border border-secondary-200 dark:border-secondary-700",
                            "hover:bg-secondary-50 hover:border-secondary-400",
                            "dark:hover:bg-secondary-800 dark:hover:border-secondary-500",
                            keyword === topic.title
                              ? "bg-primary-100 border-primary-400 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300"
                              : "text-[var(--text-primary)]",
                          )}
                        >
                          <span className="inline-flex items-center gap-1.5">
                            {topic.ai_model_version && (
                              <span className="shrink-0 px-1 py-0.5 rounded text-[9px] font-semibold bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
                                AI
                              </span>
                            )}
                            <span className="font-medium">{topic.title}</span>
                            {topic.guide_created_count > 0 && (
                              <span className="text-[10px] text-green-600 dark:text-green-400">
                                {topic.guide_created_count}건
                              </span>
                            )}
                            {topic.used_count > 0 && (
                              <span className="text-[10px] opacity-60">
                                {topic.used_count}회
                              </span>
                            )}
                          </span>
                          {topic.related_subjects.length > 0 && (
                            <span className="block text-[10px] text-[var(--text-secondary)]">
                              {topic.related_subjects.join(" · ")}
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* AI 새 추천 결과 칩 */}
                {aiTopics.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-xs text-[var(--text-secondary)]">
                      AI 새 추천 ({aiTopics.length}건) — DB에 자동 저장됨
                    </p>
                    <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto">
                      {aiTopics.map((topic, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => setKeyword(topic.title)}
                          title={`${topic.reason}\n연계: ${topic.relatedSubjects.join(", ")}`}
                          className={cn(
                            "px-2.5 py-1.5 rounded-lg text-xs transition-colors text-left",
                            "border border-primary-200 dark:border-primary-700",
                            "hover:bg-primary-50 hover:border-primary-400",
                            "dark:hover:bg-primary-900/20 dark:hover:border-primary-500",
                            keyword === topic.title
                              ? "bg-primary-100 border-primary-400 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300"
                              : "text-[var(--text-primary)]",
                          )}
                        >
                          <span className="block font-medium">{topic.title}</span>
                          <span className="block text-[10px] text-[var(--text-secondary)]">
                            {topic.relatedSubjects.join(" · ")}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* 키워드 + 자동완성 + 중복 경고 */}
                <FormField label="키워드/주제" required>
                  <div className="relative" ref={autocompleteRef}>
                    <input
                      type="text"
                      value={keyword}
                      onChange={(e) => {
                        setKeyword(e.target.value);
                        setShowAutocomplete(true);
                      }}
                      onFocus={() => {
                        if (keyword.trim().length >= 2)
                          setShowAutocomplete(true);
                      }}
                      placeholder="위 추천 주제를 클릭하거나 직접 입력하세요"
                      className={inputClass}
                    />

                    {/* 자동완성 드롭다운 */}
                    {showAutocomplete &&
                      autocompleteSuggestions.length > 0 &&
                      keyword.trim().length >= 2 && (
                        <div className="absolute z-20 w-full top-full border border-secondary-200 dark:border-secondary-700 rounded-lg bg-white dark:bg-secondary-900 shadow-lg max-h-48 overflow-y-auto">
                          {autocompleteSuggestions.map((g) => (
                            <button
                              key={g.id}
                              type="button"
                              onClick={() => {
                                setKeyword(g.title);
                                setShowAutocomplete(false);
                              }}
                              className="w-full text-left px-3 py-2 text-sm hover:bg-secondary-50 dark:hover:bg-secondary-800 border-b border-secondary-100 dark:border-secondary-800 last:border-b-0 flex items-center gap-2"
                            >
                              <span className="flex-1 text-[var(--text-primary)] truncate">
                                {g.title}
                              </span>
                              <span
                                className={cn(
                                  "shrink-0 px-1.5 py-0.5 rounded text-[10px] font-medium",
                                  "bg-secondary-100 text-secondary-600 dark:bg-secondary-800 dark:text-secondary-400",
                                )}
                              >
                                {GUIDE_TYPE_LABELS[g.guide_type as GuideType] ??
                                  g.guide_type}
                              </span>
                            </button>
                          ))}
                        </div>
                      )}

                    {/* 유사 가이드 중복 경고 */}
                    {debouncedKeywordForCount.trim().length >= 2 &&
                      similarCount > 0 && (
                        <p className="pt-1.5 text-xs text-warning-600 dark:text-warning-400">
                          이 주제의 기존 가이드: {similarCount}개
                        </p>
                      )}
                  </div>
                </FormField>

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
                                <span className="text-xs text-[var(--text-secondary)] ps-2">
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
                      {groupedSubjects.map((group) => (
                        <optgroup key={group.groupName} label={group.groupName}>
                          {group.subjects.map((s) => (
                            <option key={s.id} value={s.name}>
                              {s.name}
                            </option>
                          ))}
                        </optgroup>
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

          {/* 모델 선택 + 생성 버튼 */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs text-[var(--text-secondary)]">AI 모델:</span>
              <div className="inline-flex rounded-lg border border-secondary-200 dark:border-secondary-700 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setModelTier("fast")}
                  className={cn(
                    "px-3 py-1.5 text-xs font-medium transition-colors",
                    modelTier === "fast"
                      ? "bg-primary-500 text-white"
                      : "bg-white dark:bg-secondary-900 text-[var(--text-secondary)] hover:bg-secondary-50 dark:hover:bg-secondary-800",
                  )}
                >
                  Flash (빠름)
                </button>
                <button
                  type="button"
                  onClick={() => setModelTier("advanced")}
                  className={cn(
                    "px-3 py-1.5 text-xs font-medium transition-colors border-l border-secondary-200 dark:border-secondary-700",
                    modelTier === "advanced"
                      ? "bg-info-500 text-white"
                      : "bg-white dark:bg-secondary-900 text-[var(--text-secondary)] hover:bg-secondary-50 dark:hover:bg-secondary-800",
                  )}
                >
                  Pro (고품질)
                </button>
              </div>
              {modelTier === "advanced" && (
                <span className="text-[10px] text-info-600 dark:text-info-400">
                  Thinking 모드 · 크레딧 차감
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={handleGenerate}
              disabled={!canGenerate || isGenerating}
              className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-primary-500 text-white text-sm font-medium hover:bg-primary-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  생성 중...{modelTier === "advanced" ? " (30~60초)" : " (15~30초)"}
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

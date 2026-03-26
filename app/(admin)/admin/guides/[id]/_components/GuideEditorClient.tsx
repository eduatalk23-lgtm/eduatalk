"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Save, Trash2, Loader2, Eye, EyeOff, CopyPlus, Sparkles, Download, Share2 } from "lucide-react";
import { cn } from "@/lib/cn";
import { useToast } from "@/components/ui/ToastProvider";
import {
  cmsGuideDetailQueryOptions,
  guideCareerFieldsQueryOptions,
  allSubjectsQueryOptions,
  groupedSubjectsQueryOptions,
  allCurriculumUnitsQueryOptions,
  explorationGuideKeys,
} from "@/lib/query-options/explorationGuide";
import {
  createGuideAction,
  updateGuideAction,
  deleteGuideAction,
  uploadGuideImageAction,
  saveAsNewVersionAction,
  revertToVersionAction,
  getLatestVersionIdAction,
} from "@/lib/domains/guide/actions/crud";
import { generateGuideImageAction } from "@/lib/domains/guide/actions/ai-image";
import type { AspectRatio } from "@/lib/domains/guide/actions/ai-image";
import { AiImageDialog } from "@/components/editor/AiImageDialog";
import type {
  GuideType,
  GuideStatus,
  GuideUpsertInput,
  GuideContentInput,
  TheorySection,
  ContentSection,
} from "@/lib/domains/guide/types";
import { resolveContentSections } from "@/lib/domains/guide/section-config";
import {
  GUIDE_TYPES,
  GUIDE_TYPE_LABELS,
  GUIDE_STATUSES,
  GUIDE_STATUS_LABELS,
  CURRICULUM_REVISION_IDS,
} from "@/lib/domains/guide/types";
import { GuideMetaForm } from "./GuideMetaForm";
import { GuideContentEditor } from "./GuideContentEditor";
import { GuidePreview } from "./GuidePreview";
import { GuideVersionHistory } from "./GuideVersionHistory";
import { improveGuideAction } from "@/lib/domains/guide/llm/actions/improveGuide";
import { createShareLinkAction } from "@/lib/domains/guide/actions/share";
import { GuideExportModal } from "./GuideExportModal";
import { GuideSharePanel } from "./GuideSharePanel";

interface GuideEditorClientProps {
  /** 편집 시 guideId, 생성 시 undefined */
  guideId?: string;
}

const REVIEW_DIMENSION_LABELS: Record<string, string> = {
  academicDepth: "학술적 깊이",
  studentAccessibility: "학생 접근성",
  structuralCompleteness: "구조적 완성도",
  practicalRelevance: "실용적 연관성",
};

export function GuideEditorClient({ guideId }: GuideEditorClientProps) {
  const router = useRouter();
  const toast = useToast();
  const queryClient = useQueryClient();
  const isNew = !guideId;

  // 교육과정 연도 (groupedSubjects 쿼리에 필요하므로 먼저 선언)
  const [curriculumYear, setCurriculumYear] = useState("");
  const curriculumRevisionId = curriculumYear
    ? CURRICULUM_REVISION_IDS[curriculumYear] ?? ""
    : "";

  // 데이터 로딩
  const { data: guideRes, isLoading: loadingGuide } = useQuery({
    ...cmsGuideDetailQueryOptions(guideId ?? ""),
    enabled: !!guideId,
  });
  const { data: careerFieldsRes } = useQuery(guideCareerFieldsQueryOptions());
  const { data: subjectsRes } = useQuery(allSubjectsQueryOptions());
  const { data: groupedSubjectsRes } = useQuery(
    groupedSubjectsQueryOptions(curriculumRevisionId || undefined),
  );
  const { data: curriculumUnitsRes } = useQuery(allCurriculumUnitsQueryOptions());

  const careerFields = careerFieldsRes?.success ? careerFieldsRes.data ?? [] : [];
  const allSubjects = subjectsRes?.success ? subjectsRes.data ?? [] : [];
  const groupedSubjects = groupedSubjectsRes?.success ? groupedSubjectsRes.data ?? [] : [];
  const allCurriculumUnits = curriculumUnitsRes?.success ? curriculumUnitsRes.data ?? [] : [];
  const guide = guideRes?.success ? guideRes.data : null;

  // 메타 상태
  const [title, setTitle] = useState("");
  const [guideType, setGuideType] = useState<GuideType>("topic_exploration");
  const [status, setStatus] = useState<GuideStatus>("draft");
  const [subjectArea, setSubjectArea] = useState("");
  const [subjectSelect, setSubjectSelect] = useState("");
  const [unitMajor, setUnitMajor] = useState("");
  const [unitMinor, setUnitMinor] = useState("");

  // 교육과정 단원 파생 (CurriculumCascadeSelect용)
  const curriculumYearOptions = useMemo(
    () => [...new Set(allCurriculumUnits.map((u) => u.curriculum_year))].sort(),
    [allCurriculumUnits],
  );
  const majorUnits = useMemo(() => {
    if (!subjectSelect) return [];
    return allCurriculumUnits.filter(
      (u) =>
        u.subject_name === subjectSelect &&
        u.unit_type === "major" &&
        (!curriculumYear || u.curriculum_year === curriculumYear),
    );
  }, [allCurriculumUnits, subjectSelect, curriculumYear]);
  const selectedMajorUnit = useMemo(
    () => majorUnits.find((u) => u.unit_name === unitMajor),
    [majorUnits, unitMajor],
  );
  const minorUnits = useMemo(() => {
    if (!selectedMajorUnit) return [];
    return allCurriculumUnits.filter((u) => u.parent_unit_id === selectedMajorUnit.id);
  }, [allCurriculumUnits, selectedMajorUnit]);
  const [bookTitle, setBookTitle] = useState("");
  const [bookAuthor, setBookAuthor] = useState("");
  const [bookPublisher, setBookPublisher] = useState("");
  const [bookYear, setBookYear] = useState<number | undefined>();

  // 매핑 상태
  const [selectedSubjectIds, setSelectedSubjectIds] = useState<string[]>([]);
  const [selectedCareerFieldIds, setSelectedCareerFieldIds] = useState<number[]>([]);

  // 본문 상태
  const [motivation, setMotivation] = useState("");
  const [theorySections, setTheorySections] = useState<TheorySection[]>([]);
  const [reflection, setReflection] = useState("");
  const [impression, setImpression] = useState("");
  const [summary, setSummary] = useState("");
  const [followUp, setFollowUp] = useState("");
  const [bookDescription, setBookDescription] = useState("");
  const [setekExamples, setSetekExamples] = useState<string[]>([]);
  /** 유형 확장/선택 섹션 데이터 (type_extension + optional 키) */
  const [extraSections, setExtraSections] = useState<ContentSection[]>([]);

  // UI 상태
  const [saving, setSaving] = useState(false);
  const [improving, setImproving] = useState(false);
  const [showPreview, setShowPreview] = useState(!isNew);

  // 내보내기/공유 상태
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exportMode, setExportMode] = useState<"download" | "share">("download");
  const [exporting, setExporting] = useState(false);

  // AI 이미지 다이얼로그 상태
  const [aiDialogOpen, setAiDialogOpen] = useState(false);
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  const aiResolveRef = useRef<((url: string | null) => void) | null>(null);

  // 가이드 데이터 → 폼 초기화
  useEffect(() => {
    if (!guide) return;
    setTitle(guide.title);
    setGuideType(guide.guide_type);
    setStatus(guide.status);
    setCurriculumYear(guide.curriculum_year ?? "");
    setSubjectArea(guide.subject_area ?? "");
    setSubjectSelect(guide.subject_select ?? "");
    setUnitMajor(guide.unit_major ?? "");
    setUnitMinor(guide.unit_minor ?? "");
    setBookTitle(guide.book_title ?? "");
    setBookAuthor(guide.book_author ?? "");
    setBookPublisher(guide.book_publisher ?? "");
    setBookYear(guide.book_year ?? undefined);
    setSelectedSubjectIds(guide.subjects.map((s) => s.id));
    setSelectedCareerFieldIds(guide.career_fields.map((c) => c.id));

    if (guide.content) {
      setMotivation(guide.content.motivation ?? "");
      setTheorySections(guide.content.theory_sections ?? []);
      setReflection(guide.content.reflection ?? "");
      setImpression(guide.content.impression ?? "");
      setSummary(guide.content.summary ?? "");
      setFollowUp(guide.content.follow_up ?? "");
      setBookDescription(guide.content.book_description ?? "");
      setSetekExamples(guide.content.setek_examples ?? []);

      // type_extension/optional 섹션 (레거시 필드에 매핑되지 않는 키들)
      const resolved = resolveContentSections(
        guide.guide_type as GuideType,
        guide.content,
      );
      const coreKeys = new Set([
        "motivation", "content_sections", "reflection", "impression",
        "summary", "follow_up", "book_description", "setek_examples",
      ]);
      setExtraSections(resolved.filter((s) => !coreKeys.has(s.key)));
    }
  }, [guide]);

  // plain text → html 변환 (기존 imported 콘텐츠)
  const toHtml = useCallback((text: string, format?: string) => {
    if (!text) return "";
    if (format === "html" || text.startsWith("<")) return text;
    // plain text: 줄바꿈 → <p> 변환
    return text
      .split("\n")
      .filter((line) => line.trim())
      .map((line) => `<p>${line}</p>`)
      .join("");
  }, []);

  const getContentFormat = () =>
    guide?.content_format === "html" || isNew ? "html" : guide?.content_format;

  // 이미지 업로드
  const handleImageInsert = useCallback(async (): Promise<string | null> => {
    return new Promise((resolve) => {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "image/jpeg,image/png,image/webp,image/gif";
      input.onchange = async () => {
        const file = input.files?.[0];
        if (!file) {
          resolve(null);
          return;
        }
        try {
          const formData = new FormData();
          formData.append("file", file);
          const targetId = guideId ?? "temp-" + Date.now();
          const result = await uploadGuideImageAction(targetId, formData);
          if (result.success && result.data) {
            resolve(result.data);
          } else {
            toast.showError(result.success ? "업로드 실패" : result.error ?? "업로드 실패");
            resolve(null);
          }
        } catch {
          toast.showError("이미지 업로드에 실패했습니다.");
          resolve(null);
        }
      };
      input.click();
    });
  }, [guideId, toast]);

  // AI 이미지 생성 — Promise 패턴 (handleImageInsert와 동일 구조)
  const handleAiImageInsert = useCallback((): Promise<string | null> => {
    return new Promise((resolve) => {
      aiResolveRef.current = resolve;
      setAiDialogOpen(true);
    });
  }, []);

  const handleAiGenerate = useCallback(
    async (prompt: string, aspectRatio: AspectRatio) => {
      setIsGeneratingAi(true);
      try {
        const targetId = guideId ?? "temp-" + Date.now();
        const result = await generateGuideImageAction({
          guideId: targetId,
          prompt,
          aspectRatio,
        });

        if (result.success && result.data) {
          aiResolveRef.current?.(result.data.url);
          aiResolveRef.current = null;
          setAiDialogOpen(false);
        } else {
          toast.showError(!result.success ? result.error ?? "생성 실패" : "생성 실패");
        }
      } catch {
        toast.showError("AI 이미지 생성에 실패했습니다.");
      } finally {
        setIsGeneratingAi(false);
      }
    },
    [guideId, toast],
  );

  const handleAiDialogOpenChange = useCallback(
    (open: boolean) => {
      if (!open && !isGeneratingAi) {
        aiResolveRef.current?.(null);
        aiResolveRef.current = null;
      }
      setAiDialogOpen(open);
    },
    [isGeneratingAi],
  );

  // 저장
  const handleSave = useCallback(async () => {
    if (!title.trim()) {
      toast.showError("제목을 입력해주세요.");
      return;
    }

    setSaving(true);
    try {
      const meta: GuideUpsertInput = {
        guideType,
        title: title.trim(),
        status,
        curriculumYear: curriculumYear || undefined,
        subjectArea: subjectArea || undefined,
        subjectSelect: subjectSelect || undefined,
        unitMajor: unitMajor || undefined,
        unitMinor: unitMinor || undefined,
        bookTitle: bookTitle || undefined,
        bookAuthor: bookAuthor || undefined,
        bookPublisher: bookPublisher || undefined,
        bookYear: bookYear || undefined,
        contentFormat: "html",
      };

      // content_sections 조합: core 레거시 필드 + extra 섹션
      const allContentSections: ContentSection[] = [];
      if (motivation) allContentSections.push({ key: "motivation", label: "탐구 동기", content: motivation, content_format: "html" });
      for (const ts of theorySections) {
        allContentSections.push({ key: "content_sections", label: ts.title, content: ts.content, content_format: "html", order: ts.order });
      }
      // type_extension + optional 섹션
      for (const es of extraSections) {
        if (es.content || es.items?.length) allContentSections.push(es);
      }
      if (reflection) allContentSections.push({ key: "reflection", label: "탐구 고찰 및 제언", content: reflection, content_format: "html" });
      if (impression) allContentSections.push({ key: "impression", label: "느낀점", content: impression, content_format: "html" });
      if (summary) allContentSections.push({ key: "summary", label: "탐구 요약", content: summary, content_format: "html" });
      if (followUp) allContentSections.push({ key: "follow_up", label: "후속 탐구", content: followUp, content_format: "html" });
      if (bookDescription) allContentSections.push({ key: "book_description", label: "도서 소개", content: bookDescription, content_format: "html" });
      if (setekExamples.length > 0) allContentSections.push({ key: "setek_examples", label: "세특 예시", content: "", content_format: "plain", items: setekExamples });

      const content: GuideContentInput = {
        motivation: motivation || undefined,
        theorySections: theorySections.length > 0 ? theorySections : undefined,
        reflection: reflection || undefined,
        impression: impression || undefined,
        summary: summary || undefined,
        followUp: followUp || undefined,
        bookDescription: bookDescription || undefined,
        setekExamples: setekExamples.length > 0 ? setekExamples : undefined,
        contentSections: allContentSections.length > 0 ? allContentSections : undefined,
      };

      let result;
      if (isNew) {
        result = await createGuideAction({
          meta,
          content,
          subjectIds: selectedSubjectIds,
          careerFieldIds: selectedCareerFieldIds,
        });
      } else {
        result = await updateGuideAction({
          guideId: guideId!,
          meta,
          content,
          subjectIds: selectedSubjectIds,
          careerFieldIds: selectedCareerFieldIds,
        });
      }

      if (result.success) {
        toast.showSuccess(isNew ? "가이드가 생성되었습니다." : "가이드가 저장되었습니다.");
        // 캐시 무효화
        queryClient.invalidateQueries({
          queryKey: explorationGuideKeys.all,
        });
        if (isNew && result.data) {
          router.push(`/admin/guides/${result.data.id}`);
        }
      } else {
        toast.showError(result.error ?? "저장에 실패했습니다.");
      }
    } catch {
      toast.showError("저장 중 오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  }, [
    title, guideType, status, curriculumYear, subjectSelect, unitMajor, unitMinor,
    bookTitle, bookAuthor, bookPublisher, bookYear,
    motivation, theorySections, reflection, impression, summary, followUp,
    bookDescription, setekExamples,
    selectedSubjectIds, selectedCareerFieldIds,
    isNew, guideId, router, toast, queryClient,
  ]);

  // 새 버전으로 저장
  const handleSaveAsNewVersion = useCallback(async () => {
    if (!guideId) return;
    if (!window.confirm("현재 내용을 새 버전으로 저장하시겠습니까?")) return;

    setSaving(true);
    try {
      // 먼저 현재 변경사항 저장
      await handleSave();

      const result = await saveAsNewVersionAction(guideId);
      if (result.success && result.data) {
        toast.showSuccess(`v${result.data.version} 버전이 생성되었습니다.`);
        queryClient.invalidateQueries({
          queryKey: explorationGuideKeys.all,
        });
        router.push(`/admin/guides/${result.data.id}`);
      } else {
        toast.showError(!result.success ? result.error ?? "버전 생성 실패" : "버전 생성 실패");
      }
    } catch {
      toast.showError("새 버전 생성 중 오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  }, [guideId, handleSave, router, toast, queryClient]);

  // 되돌리기
  const handleRevert = useCallback(
    async (targetVersionId: string, targetVersion: number) => {
      if (!window.confirm(`v${targetVersion} 버전으로 되돌리시겠습니까? 현재 내용을 기반으로 새 버전이 생성됩니다.`)) return;

      setSaving(true);
      try {
        const result = await revertToVersionAction(targetVersionId);
        if (result.success && result.data) {
          toast.showSuccess(`v${result.data.version} 버전으로 되돌렸습니다.`);
          queryClient.invalidateQueries({
            queryKey: explorationGuideKeys.all,
          });
          router.push(`/admin/guides/${result.data.id}`);
        } else {
          toast.showError(!result.success ? result.error ?? "되돌리기 실패" : "되돌리기 실패");
        }
      } catch {
        toast.showError("버전 되돌리기 중 오류가 발생했습니다.");
      } finally {
        setSaving(false);
      }
    },
    [router, toast, queryClient],
  );

  // 삭제
  const handleDelete = useCallback(async () => {
    if (!guideId) return;
    if (!window.confirm("정말 이 가이드를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.")) {
      return;
    }

    setSaving(true);
    try {
      const result = await deleteGuideAction(guideId);
      if (result.success) {
        toast.showSuccess("가이드가 삭제되었습니다.");
        queryClient.invalidateQueries({
          queryKey: explorationGuideKeys.all,
        });
        router.push("/admin/guides");
      } else {
        toast.showError(result.error ?? "삭제에 실패했습니다.");
      }
    } catch {
      toast.showError("삭제 중 오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  }, [guideId, router, toast, queryClient]);

  // 내보내기/공유 핸들러
  const handleExportConfirm = useCallback(
    async (
      selectedKeys: string[],
      options: {
        format?: "pdf" | "docx";
        includeBookInfo: boolean;
        includeRelatedPapers: boolean;
        includeRelatedBooks: boolean;
      },
    ) => {
      if (exportMode === "download") {
        // PDF/DOCX 다운로드
        if (!guide) return;
        setExporting(true);
        try {
          const { exportGuideAsPdf, exportGuideAsDocx } = await import(
            "@/lib/domains/guide/export/guide-export"
          );
          const exportOptions = {
            selectedSectionKeys: selectedKeys,
            includeBookInfo: options.includeBookInfo,
            includeRelatedPapers: options.includeRelatedPapers,
            includeRelatedBooks: options.includeRelatedBooks,
          };
          if (options.format === "docx") {
            await exportGuideAsDocx(guide, exportOptions);
          } else {
            await exportGuideAsPdf(guide, exportOptions);
          }
          toast.showSuccess(`${options.format === "docx" ? "Word" : "PDF"} 파일이 다운로드되었습니다.`);
          setExportModalOpen(false);
        } catch {
          toast.showError("내보내기 중 오류가 발생했습니다.");
        } finally {
          setExporting(false);
        }
      } else {
        // 공유 링크 생성
        if (!guideId) return;
        setExporting(true);
        try {
          const result = await createShareLinkAction(guideId, selectedKeys);
          if (result.success && result.data) {
            const url = `${window.location.origin}/shared/guide/${result.data.share_token}`;
            await navigator.clipboard.writeText(url);
            toast.showSuccess("공유 링크가 생성되어 클립보드에 복사되었습니다.");
            queryClient.invalidateQueries({
              queryKey: [...explorationGuideKeys.all, "shares", guideId],
            });
            setExportModalOpen(false);
          } else {
            toast.showError(!result.success ? result.error ?? "공유 링크 생성에 실패했습니다." : "공유 링크 생성에 실패했습니다.");
          }
        } catch {
          toast.showError("공유 링크 생성 중 오류가 발생했습니다.");
        } finally {
          setExporting(false);
        }
      }
    },
    [exportMode, guide, guideId, toast, queryClient],
  );

  if (!isNew && loadingGuide) {
    return (
      <div className="flex items-center justify-center py-24 text-sm text-[var(--text-secondary)]">
        <Loader2 className="w-5 h-5 animate-spin mr-2" />
        가이드를 불러오는 중...
      </div>
    );
  }

  if (!isNew && !loadingGuide && !guide) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <p className="text-sm text-[var(--text-secondary)]">
          가이드를 찾을 수 없습니다.
        </p>
        <Link
          href="/admin/guides"
          className="text-sm text-primary-500 hover:underline"
        >
          목록으로 돌아가기
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/admin/guides"
            className="p-2 rounded-lg hover:bg-secondary-100 dark:hover:bg-secondary-800 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-[var(--text-secondary)]" />
          </Link>
          <h1 className="text-lg font-bold text-[var(--text-heading)]">
            {isNew ? "새 가이드 작성" : showPreview ? "가이드 미리보기" : "가이드 편집"}
          </h1>
          {!isNew && guide && guide.version > 1 && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-secondary-100 dark:bg-secondary-800 text-[var(--text-secondary)]">
              v{guide.version}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* 내보내기/공유 — 미리보기/편집 모드 공통 (기존 가이드만) */}
          {!isNew && (
            <button
              type="button"
              onClick={() => {
                setExportMode("download");
                setExportModalOpen(true);
              }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-secondary-200 dark:border-secondary-700 text-[var(--text-secondary)] text-sm hover:bg-secondary-50 dark:hover:bg-secondary-800 transition-colors"
            >
              <Download className="w-4 h-4" />
              내보내기
            </button>
          )}
          {!isNew && (
            <button
              type="button"
              onClick={() => {
                setExportMode("share");
                setExportModalOpen(true);
              }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-secondary-200 dark:border-secondary-700 text-[var(--text-secondary)] text-sm hover:bg-secondary-50 dark:hover:bg-secondary-800 transition-colors"
            >
              <Share2 className="w-4 h-4" />
              공유
            </button>
          )}
          {showPreview ? (
            /* 미리보기 모드: 편집 버튼 */
            <button
              type="button"
              onClick={() => setShowPreview(false)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary-500 text-white text-sm font-medium hover:bg-primary-600 transition-colors"
            >
              <EyeOff className="w-4 h-4" />
              편집
            </button>
          ) : (
            /* 편집 모드: 전체 액션 버튼 */
            <>
              <button
                type="button"
                onClick={() => setShowPreview(true)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-secondary-200 dark:border-secondary-700 text-[var(--text-secondary)] text-sm hover:bg-secondary-50 dark:hover:bg-secondary-800 transition-colors"
              >
                <Eye className="w-4 h-4" />
                미리보기
              </button>
              {!isNew && (
                <button
                  type="button"
                  onClick={handleSaveAsNewVersion}
                  disabled={saving}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-secondary-200 dark:border-secondary-700 text-[var(--text-secondary)] text-sm hover:bg-secondary-50 dark:hover:bg-secondary-800 transition-colors disabled:opacity-50"
                >
                  <CopyPlus className="w-4 h-4" />
                  새 버전
                </button>
              )}
              {!isNew && (
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={saving}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-red-200 text-red-600 text-sm hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50"
                >
                  <Trash2 className="w-4 h-4" />
                  삭제
                </button>
              )}
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary-500 text-white text-sm font-medium hover:bg-primary-600 transition-colors disabled:opacity-50"
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                {saving ? "저장 중..." : "저장"}
              </button>
            </>
          )}
        </div>
      </div>

      {showPreview ? (
        <GuidePreview
          title={title}
          guideType={guideType}
          bookTitle={bookTitle}
          bookAuthor={bookAuthor}
          bookPublisher={bookPublisher}
          motivation={motivation}
          theorySections={theorySections}
          reflection={reflection}
          impression={impression}
          summary={summary}
          followUp={followUp}
          bookDescription={bookDescription}
          contentFormat={getContentFormat()}
          curriculumYear={curriculumYear}
          subjectArea={subjectArea}
          subjectSelect={subjectSelect}
          unitMajor={unitMajor}
          unitMinor={unitMinor}
        />
      ) : (
        <div className="space-y-6">
          {/* 메타 폼 */}
          <GuideMetaForm
            title={title}
            onTitleChange={setTitle}
            guideType={guideType}
            onGuideTypeChange={setGuideType}
            status={status}
            onStatusChange={setStatus}
            curriculumYear={curriculumYear}
            onCurriculumYearChange={setCurriculumYear}
            subjectArea={subjectArea}
            onSubjectAreaChange={setSubjectArea}
            subjectSelect={subjectSelect}
            onSubjectSelectChange={setSubjectSelect}
            unitMajor={unitMajor}
            onUnitMajorChange={setUnitMajor}
            unitMinor={unitMinor}
            onUnitMinorChange={setUnitMinor}
            yearOptions={curriculumYearOptions}
            groupedSubjects={groupedSubjects}
            majorUnits={majorUnits}
            minorUnits={minorUnits}
            bookTitle={bookTitle}
            onBookTitleChange={setBookTitle}
            bookAuthor={bookAuthor}
            onBookAuthorChange={setBookAuthor}
            bookPublisher={bookPublisher}
            onBookPublisherChange={setBookPublisher}
            bookYear={bookYear}
            onBookYearChange={setBookYear}
            allSubjects={allSubjects}
            selectedSubjectIds={selectedSubjectIds}
            onSubjectIdsChange={setSelectedSubjectIds}
            careerFields={careerFields}
            selectedCareerFieldIds={selectedCareerFieldIds}
            onCareerFieldIdsChange={setSelectedCareerFieldIds}
          />

          {/* 본문 편집 */}
          <GuideContentEditor
            guideType={guideType}
            motivation={motivation}
            onMotivationChange={setMotivation}
            theorySections={theorySections}
            onTheorySectionsChange={setTheorySections}
            reflection={reflection}
            onReflectionChange={setReflection}
            impression={impression}
            onImpressionChange={setImpression}
            summary={summary}
            onSummaryChange={setSummary}
            followUp={followUp}
            onFollowUpChange={setFollowUp}
            bookDescription={bookDescription}
            onBookDescriptionChange={setBookDescription}
            setekExamples={setekExamples}
            onSetekExamplesChange={setSetekExamples}
            extraSections={extraSections}
            onExtraSectionsChange={setExtraSections}
            contentFormat={getContentFormat()}
            toHtml={toHtml}
            onImageInsert={handleImageInsert}
            onAiImageInsert={handleAiImageInsert}
          />
        </div>
      )}

      {/* 이전 버전 안내 (is_latest=false) */}
      {!isNew && guide && !guide.is_latest && (
        <div className="rounded-xl border border-warning-200 dark:border-warning-700 bg-warning-50 dark:bg-warning-900/10 p-4 flex items-center gap-3">
          <span className="text-warning-600 dark:text-warning-400 text-sm">
            이 버전(v{guide.version})은 최신 버전이 아닙니다.
          </span>
          <button
            type="button"
            onClick={async () => {
              const res = await getLatestVersionIdAction(guide.id);
              if (res.success && res.data) {
                router.push(`/admin/guides/${res.data}`);
              }
            }}
            className="text-xs font-medium text-primary-600 hover:underline"
          >
            최신 버전으로 이동 →
          </button>
        </div>
      )}

      {/* AI 리뷰 실행 (리뷰 결과 없을 때 + 최신 버전만) */}
      {!isNew && guide && !guide.review_result && guide.is_latest && (
        <div className="rounded-xl border border-secondary-200 dark:border-secondary-700 bg-white dark:bg-secondary-900 p-5">
          <button
            type="button"
            onClick={async () => {
              if (!guideId) return;
              setImproving(true);
              try {
                const { reviewGuideAction } = await import(
                  "@/lib/domains/guide/llm/actions/reviewGuide"
                );
                const result = await reviewGuideAction(guideId);
                if (result.success) {
                  toast.showSuccess(`AI 리뷰 완료: ${result.data?.score}점`);
                  queryClient.invalidateQueries({
                    queryKey: explorationGuideKeys.cmsDetail(guideId),
                  });
                } else {
                  toast.showError(!result.success ? result.error ?? "리뷰 실패" : "리뷰 실패");
                }
              } catch {
                toast.showError("AI 리뷰 중 오류가 발생했습니다.");
              } finally {
                setImproving(false);
              }
            }}
            disabled={improving}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium border border-primary-300 dark:border-primary-600 text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors disabled:opacity-50"
          >
            {improving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                AI 리뷰 중... (10~20초)
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                AI 품질 리뷰 실행
              </>
            )}
          </button>
          <p className="text-[10px] text-[var(--text-secondary)] text-center pt-1.5">
            가이드 품질을 4가지 차원(학술적 깊이, 학생 접근성, 구조적 완성도, 실용적 연관성)으로 평가합니다
          </p>
        </div>
      )}

      {/* AI 리뷰 결과 (저장된 결과가 있을 때 — 모든 버전에서 표시) */}
      {!isNew && guide?.review_result && (
        <div className="rounded-xl border border-secondary-200 dark:border-secondary-700 bg-white dark:bg-secondary-900 p-5 space-y-4">
          {/* 헤더 */}
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-[var(--text-heading)]">
              AI 리뷰 결과
            </h3>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-[var(--text-secondary)]">
                {new Date(guide.review_result.reviewedAt).toLocaleDateString("ko-KR")}
              </span>
              <span
                className={cn(
                  "px-2.5 py-1 rounded-full text-xs font-medium",
                  (guide.quality_score ?? 0) >= 80
                    ? "bg-success-100 text-success-700 dark:bg-success-900/30 dark:text-success-300"
                    : (guide.quality_score ?? 0) >= 60
                      ? "bg-warning-100 text-warning-700 dark:bg-warning-900/30 dark:text-warning-300"
                      : "bg-error-100 text-error-700 dark:bg-error-900/30 dark:text-error-300",
                )}
              >
                {guide.quality_score}점
              </span>
            </div>
          </div>

          {/* 차원별 점수 */}
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(guide.review_result.dimensions).map(([key, value]) => (
              <div
                key={key}
                className="flex items-center justify-between px-3 py-1.5 rounded bg-secondary-50 dark:bg-secondary-800/50"
              >
                <span className="text-xs text-[var(--text-secondary)]">
                  {REVIEW_DIMENSION_LABELS[key] ?? key}
                </span>
                <span className="text-xs font-medium text-[var(--text-primary)]">
                  {value as number}
                </span>
              </div>
            ))}
          </div>

          {/* 강점 */}
          {guide.review_result.strengths.length > 0 && (
            <div>
              <p className="text-xs font-medium text-success-600 dark:text-success-400">강점</p>
              <ul className="list-disc list-inside text-xs text-[var(--text-secondary)] space-y-0.5">
                {guide.review_result.strengths.map((s: string, i: number) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </div>
          )}

          {/* 개선 제안 */}
          {guide.review_result.feedback.length > 0 && (
            <div>
              <p className="text-xs font-medium text-warning-600 dark:text-warning-400">개선 제안</p>
              <ul className="list-disc list-inside text-xs text-[var(--text-secondary)] space-y-0.5">
                {guide.review_result.feedback.map((f: string, i: number) => (
                  <li key={i}>{f}</li>
                ))}
              </ul>
            </div>
          )}

          {/* AI 개선 액션 버튼 (최신 버전만) */}
          {guide.is_latest && (
          <div className="border-t border-secondary-200 dark:border-secondary-700 pt-4">
            <button
              type="button"
              onClick={async () => {
                if (!guideId) return;
                setImproving(true);
                try {
                  const result = await improveGuideAction(guideId);
                  if (result.success && result.data?.guideId) {
                    toast.showSuccess("개선된 가이드가 새 버전으로 생성되었습니다.");
                    queryClient.invalidateQueries({
                      queryKey: explorationGuideKeys.cmsDetail(result.data.guideId),
                    });
                    router.push(`/admin/guides/${result.data.guideId}`);
                  } else {
                    toast.showError(!result.success ? result.error ?? "개선 실패" : "개선 실패");
                  }
                } catch (error) {
                  const msg = error instanceof Error ? error.message : "";
                  if (msg.includes("quota") || msg.includes("429")) {
                    toast.showError("AI 할당량 초과. 내일 다시 시도해주세요.");
                  } else {
                    toast.showError("AI 개선 중 오류가 발생했습니다.");
                  }
                } finally {
                  setImproving(false);
                }
              }}
              disabled={improving}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium bg-primary-500 text-white hover:bg-primary-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {improving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  리뷰 반영 개선 중... (15~30초)
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  AI 리뷰 피드백 반영하여 개선된 버전 생성
                </>
              )}
            </button>
            <p className="text-[10px] text-[var(--text-secondary)] text-center pt-1.5">
              위 개선 제안을 반영한 새 버전이 생성됩니다. 원본은 유지됩니다.
            </p>
          </div>
          )}
        </div>
      )}

      {/* 버전 히스토리 (편집 모드에서만, v2 이상) */}
      {!isNew && guide && guide.version > 1 && (
        <GuideVersionHistory
          guideId={guideId!}
          currentVersion={guide.version}
          onRevert={handleRevert}
          reverting={saving}
        />
      )}

      {/* 공유 링크 관리 패널 */}
      {!isNew && guideId && (
        <GuideSharePanel
          guideId={guideId}
          onCreateNew={() => {
            setExportMode("share");
            setExportModalOpen(true);
          }}
        />
      )}

      {/* 내보내기/공유 모달 */}
      <GuideExportModal
        open={exportModalOpen}
        onOpenChange={setExportModalOpen}
        guideType={guideType}
        mode={exportMode}
        onConfirm={handleExportConfirm}
        isLoading={exporting}
        hasBookInfo={!!bookTitle}
        hasRelatedPapers={
          !!(guide?.content?.related_papers && guide.content.related_papers.length > 0)
        }
        hasRelatedBooks={
          !!(guide?.content?.related_books && guide.content.related_books.length > 0)
        }
      />

      {/* AI 이미지 생성 다이얼로그 */}
      <AiImageDialog
        open={aiDialogOpen}
        onOpenChange={handleAiDialogOpenChange}
        onGenerate={handleAiGenerate}
        isGenerating={isGeneratingAi}
      />
    </div>
  );
}

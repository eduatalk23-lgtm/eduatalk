"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Save, Trash2, Loader2, CopyPlus, Sparkles, Download, Share2, Eye, X } from "lucide-react";
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
  deleteGuideAction,
  uploadGuideImageAction,
  saveAsNewVersionAction,
  saveWithNewVersionAction,
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
  DifficultyLevel,
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
import type { ModelTier } from "@/lib/domains/plan/llm/types";
import { createShareLinkAction } from "@/lib/domains/guide/actions/share";
import { GuideExportModal } from "./GuideExportModal";
import { GuideSharePanel } from "./GuideSharePanel";
import { VersionCommitDialog } from "./VersionCommitDialog";

interface GuideEditorClientProps {
  /** 편집 시 guideId, 생성 시 undefined */
  guideId?: string;
}

const REVIEW_DIMENSION_LABELS: Record<string, string> = {
  academicDepth: "학술적 깊이",
  studentAccessibility: "학생 접근성",
  structuralCompleteness: "구조적 완성도",
  practicalRelevance: "실용적 연관성",
  outlineQuality: "탐구 로드맵 품질",
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
  const [difficultyLevel, setDifficultyLevel] = useState<DifficultyLevel | null>(null);
  const [difficultyAuto, setDifficultyAuto] = useState(true);

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

  // 미리보기용 실시간 contentSections 조합
  const previewContentSections = useMemo<ContentSection[]>(() => {
    const all: ContentSection[] = [];
    if (motivation) all.push({ key: "motivation", label: "탐구 동기", content: motivation, content_format: "html" });
    for (const ts of theorySections) {
      all.push({ key: "content_sections", label: ts.title, content: ts.content, content_format: "html", order: ts.order, outline: ts.outline });
    }
    for (const es of extraSections) {
      if (es.content || es.items?.length) all.push(es);
    }
    if (reflection) all.push({ key: "reflection", label: "탐구 고찰 및 제언", content: reflection, content_format: "html" });
    if (impression) all.push({ key: "impression", label: "느낀점", content: impression, content_format: "html" });
    if (summary) all.push({ key: "summary", label: "탐구 요약", content: summary, content_format: "html" });
    if (followUp) all.push({ key: "follow_up", label: "후속 탐구", content: followUp, content_format: "html" });
    if (bookDescription) all.push({ key: "book_description", label: "도서 소개", content: bookDescription, content_format: "html" });
    if (setekExamples.length > 0) all.push({ key: "setek_examples", label: "세특 예시", content: "", content_format: "plain", items: setekExamples });
    return all;
  }, [motivation, theorySections, extraSections, reflection, impression, summary, followUp, bookDescription, setekExamples]);

  // UI 상태
  const [isDirty, setIsDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [improving, setImproving] = useState(false);
  const [improveModelTier, setImproveModelTier] = useState<ModelTier>("fast");
  // 보기/편집 모드 (기존 가이드: 보기 기본, 신규: 편집 기본)
  const [mode, setMode] = useState<"view" | "edit">(isNew ? "edit" : "view");
  const [previewOpen, setPreviewOpen] = useState(false);

  // 사이드 패널: body 스크롤 잠금 + Escape 키 닫기
  useEffect(() => {
    if (!previewOpen) return;
    document.body.style.overflow = "hidden";
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPreviewOpen(false);
    };
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", handleEscape);
    };
  }, [previewOpen]);

  // 커밋 다이얼로그 상태
  const [commitDialogOpen, setCommitDialogOpen] = useState(false);

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
    setDifficultyLevel(guide.difficulty_level ?? null);
    setDifficultyAuto(guide.difficulty_auto ?? true);

    if (guide.content) {
      // content_sections 우선, 없으면 레거시 fallback
      const resolved = resolveContentSections(
        guide.guide_type as GuideType,
        guide.content,
      );

      // 레거시 필드 hydrate (content_sections가 없는 기존 가이드 호환)
      setMotivation(guide.content.motivation ?? "");
      setTheorySections(guide.content.theory_sections ?? []);
      setReflection(guide.content.reflection ?? "");
      setImpression(guide.content.impression ?? "");
      setSummary(guide.content.summary ?? "");
      setFollowUp(guide.content.follow_up ?? "");
      setBookDescription(guide.content.book_description ?? "");

      // setek_examples: content_sections items 우선 → 레거시 fallback
      // ⚠️ AI가 items가 아닌 content에 생성할 수 있으므로 빈 배열 체크 필요
      const resolvedSetek = resolved.find((s) => s.key === "setek_examples");
      const setekItems = resolvedSetek?.items?.length
        ? resolvedSetek.items
        : (guide.content.setek_examples ?? []);
      setSetekExamples(setekItems);

      // type_extension/optional 섹션 (레거시 필드에 매핑되지 않는 키들)
      const coreKeys = new Set([
        "motivation", "content_sections", "reflection", "impression",
        "summary", "follow_up", "book_description", "setek_examples",
      ]);
      setExtraSections(resolved.filter((s) => !coreKeys.has(s.key)));
    }
    // 초기화 후 dirty 리셋
    setIsDirty(false);
    hydratedRef.current = true;
  }, [guide]);

  // 폼 변경 감지 → isDirty 설정 (초기 hydrate 이후에만)
  const hydratedRef = useRef(false);
  useEffect(() => {
    if (!hydratedRef.current) return;
    setIsDirty(true);
  }, [title, guideType, status, motivation, theorySections, reflection, impression, summary, followUp, bookDescription, setekExamples, extraSections, bookTitle, bookAuthor, bookPublisher]); // eslint-disable-line react-hooks/exhaustive-deps

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

  // 메타/콘텐츠 조립 헬퍼
  const buildMetaAndContent = useCallback(() => {
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
      difficultyLevel: difficultyLevel ?? undefined,
      difficultyAuto,
    };

    const allContentSections: ContentSection[] = [];
    if (motivation) allContentSections.push({ key: "motivation", label: "탐구 동기", content: motivation, content_format: "html" });
    for (const ts of theorySections) {
      allContentSections.push({ key: "content_sections", label: ts.title, content: ts.content, content_format: "html", order: ts.order, outline: ts.outline });
    }
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

    return { meta, content };
  }, [
    title, guideType, status, curriculumYear, subjectArea, subjectSelect, unitMajor, unitMinor,
    bookTitle, bookAuthor, bookPublisher, bookYear,
    motivation, theorySections, reflection, impression, summary, followUp,
    bookDescription, setekExamples, extraSections,
    difficultyLevel, difficultyAuto,
  ]);

  // 저장 버튼 클릭: 새 가이드면 바로 생성, 기존 가이드면 커밋 다이얼로그 열기
  const handleSave = useCallback(async (): Promise<boolean> => {
    if (!title.trim()) {
      toast.showError("제목을 입력해주세요.");
      return false;
    }

    if (isNew) {
      // 첫 생성 (v1) — 커밋 메시지 불필요
      setSaving(true);
      try {
        const { meta, content } = buildMetaAndContent();
        const result = await createGuideAction({
          meta,
          content,
          subjectIds: selectedSubjectIds,
          careerFieldIds: selectedCareerFieldIds,
        });
        if (result.success && result.data) {
          setIsDirty(false);
          toast.showSuccess("가이드가 생성되었습니다.");
          queryClient.invalidateQueries({ queryKey: explorationGuideKeys.all });
          router.push(`/admin/guides/${result.data.id}`);
          return true;
        } else {
          toast.showError(!result.success ? result.error ?? "생성에 실패했습니다." : "생성에 실패했습니다.");
          return false;
        }
      } catch {
        toast.showError("저장 중 오류가 발생했습니다.");
        return false;
      } finally {
        setSaving(false);
      }
    } else {
      // 기존 가이드 → 커밋 다이얼로그 열기
      setCommitDialogOpen(true);
      return true;
    }
  }, [title, isNew, buildMetaAndContent, selectedSubjectIds, selectedCareerFieldIds, router, toast, queryClient]);

  // 커밋 메시지 확인 후 새 버전으로 저장
  const handleCommitSave = useCallback(async (versionMessage: string) => {
    if (!guideId) return;

    setSaving(true);
    try {
      const { meta, content } = buildMetaAndContent();
      const result = await saveWithNewVersionAction({
        sourceGuideId: guideId,
        meta,
        content,
        subjectIds: selectedSubjectIds,
        careerFieldIds: selectedCareerFieldIds,
        versionMessage,
      });

      if (result.success && result.data) {
        setIsDirty(false);
        setCommitDialogOpen(false);
        toast.showSuccess(`v${result.data.version} 버전이 저장되었습니다.`);
        queryClient.invalidateQueries({ queryKey: explorationGuideKeys.all });
        router.push(`/admin/guides/${result.data.id}`);
      } else {
        toast.showError(!result.success ? result.error ?? "저장에 실패했습니다." : "저장에 실패했습니다.");
      }
    } catch {
      toast.showError("저장 중 오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  }, [guideId, buildMetaAndContent, selectedSubjectIds, selectedCareerFieldIds, router, toast, queryClient]);

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
        toast.showError(!result.success ? result.error ?? "삭제에 실패했습니다." : "삭제에 실패했습니다.");
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
      // 미저장 상태에서 내보내기/공유 시 경고
      if (isDirty) {
        if (!confirm("저장되지 않은 변경사항은 내보내기/공유에 반영되지 않습니다. 계속하시겠습니까?")) return;
      }

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
    [exportMode, guide, guideId, toast, queryClient, isDirty],
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

  // AI 생성 중/실패 상태 — 자동 갱신 (3초 폴링)
  const isAiGenerating = guide?.status === "ai_generating";
  const isAiFailed = guide?.status === "ai_failed";

  useEffect(() => {
    if (!isAiGenerating) return;
    const interval = setInterval(() => {
      queryClient.invalidateQueries({ queryKey: ["cms-guide-detail", guideId] });
    }, 3000);
    return () => clearInterval(interval);
  }, [isAiGenerating, queryClient, guideId]);

  return (
    <div className="space-y-6">
      {/* AI 생성 상태 배너 */}
      {isAiGenerating && (
        <div className="flex items-center gap-3 rounded-lg border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950/30 p-4">
          <Loader2 className="w-5 h-5 animate-spin text-indigo-600 dark:text-indigo-400 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-indigo-900 dark:text-indigo-200">AI 가이드 생성 중...</p>
            <p className="text-xs text-indigo-600 dark:text-indigo-400 mt-0.5">보통 1~3분 소요됩니다. 이 페이지를 닫아도 생성은 계속 진행됩니다.</p>
          </div>
        </div>
      )}
      {isAiFailed && (
        <div className="flex items-center gap-3 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30 p-4">
          <div>
            <p className="text-sm font-medium text-red-900 dark:text-red-200">AI 생성 실패</p>
            <p className="text-xs text-red-600 dark:text-red-400 mt-0.5">가이드 생성 중 오류가 발생했습니다. 다시 시도해 주세요.</p>
          </div>
        </div>
      )}

      {/* 헤더 — sticky */}
      <div className="sticky top-0 z-20 -mx-4 px-4 py-3 bg-white/95 dark:bg-secondary-950/95 backdrop-blur-sm border-b border-transparent [&:not(:first-child)]:border-secondary-200 dark:[&:not(:first-child)]:border-secondary-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              if (mode === "edit" && isDirty && !confirm("저장하지 않은 변경사항이 있습니다. 나가시겠습니까?")) return;
              if (mode === "edit" && !isNew) {
                setMode("view");
                return;
              }
              router.push("/admin/guides");
            }}
            className="p-2 rounded-lg hover:bg-secondary-100 dark:hover:bg-secondary-800 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-[var(--text-secondary)]" />
          </button>
          <h1 className="text-lg font-bold text-[var(--text-heading)]">
            {isNew ? "새 가이드 작성" : mode === "view" ? (title || "가이드") : "가이드 편집"}
          </h1>
          {!isNew && guide && guide.version > 1 && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-secondary-100 dark:bg-secondary-800 text-[var(--text-secondary)]">
              v{guide.version}
            </span>
          )}
          {mode === "edit" && isDirty && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 font-medium">
              미저장
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {mode === "view" ? (
            <>
              {/* 보기 모드 액션들 */}
              <button
                type="button"
                onClick={() => {
                  setExportMode("download");
                  setExportModalOpen(true);
                }}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-secondary-200 dark:border-secondary-700 text-[var(--text-secondary)] text-sm hover:bg-secondary-50 dark:hover:bg-secondary-800 transition-colors"
              >
                <Download className="w-4 h-4" />
                <span className="hidden sm:inline">내보내기</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setExportMode("share");
                  setExportModalOpen(true);
                }}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-secondary-200 dark:border-secondary-700 text-[var(--text-secondary)] text-sm hover:bg-secondary-50 dark:hover:bg-secondary-800 transition-colors"
              >
                <Share2 className="w-4 h-4" />
                <span className="hidden sm:inline">공유</span>
              </button>
              <button
                type="button"
                onClick={() => setMode("edit")}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary-500 text-white text-sm font-medium hover:bg-primary-600 transition-colors"
              >
                <Sparkles className="w-4 h-4" />
                편집
              </button>
            </>
          ) : (
            <>
              {/* 편집 모드 액션들 */}
              {/* 미리보기 사이드 패널 토글 */}
              <button
                type="button"
                onClick={() => setPreviewOpen((v) => !v)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm transition-colors",
                  previewOpen
                    ? "border-primary-400 bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400"
                    : "border-secondary-200 dark:border-secondary-700 text-[var(--text-secondary)] hover:bg-secondary-50 dark:hover:bg-secondary-800",
                )}
              >
                <Eye className="w-4 h-4" />
                <span className="hidden sm:inline">미리보기</span>
              </button>
              {/* 새 버전 (기존 가이드만) */}
              {!isNew && (
                <button
                  type="button"
                  onClick={() => {
                    if (!window.confirm("현재 내용을 새 버전으로 복제하시겠습니까?")) return;
                    if (!guideId) return;
                    setSaving(true);
                    saveAsNewVersionAction(guideId, "현재 상태 복제").then((result) => {
                      if (result.success && result.data) {
                        toast.showSuccess(`v${result.data.version} 버전이 생성되었습니다.`);
                        queryClient.invalidateQueries({ queryKey: explorationGuideKeys.all });
                        router.push(`/admin/guides/${result.data.id}`);
                      } else {
                        toast.showError(!result.success ? result.error ?? "버전 생성 실패" : "버전 생성 실패");
                      }
                    }).catch(() => toast.showError("새 버전 생성 중 오류가 발생했습니다."))
                    .finally(() => setSaving(false));
                  }}
                  disabled={saving}
                  className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-lg border border-secondary-200 dark:border-secondary-700 text-[var(--text-secondary)] text-sm hover:bg-secondary-50 dark:hover:bg-secondary-800 transition-colors disabled:opacity-50"
                >
                  <CopyPlus className="w-4 h-4" />
                  새 버전
                </button>
              )}
              {/* 구분선 */}
              {!isNew && (
                <div className="w-px h-6 bg-secondary-200 dark:bg-secondary-700 mx-0.5 hidden sm:block" />
              )}
              {/* 삭제 (기존 가이드만) */}
              {!isNew && (
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={saving}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-red-200 text-red-600 text-sm hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50"
                >
                  <Trash2 className="w-4 h-4" />
                  <span className="hidden sm:inline">삭제</span>
                </button>
              )}
              {/* 저장 */}
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

      {/* 보기 모드: 전체 너비 미리보기 */}
      {mode === "view" && (
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
          contentSections={previewContentSections}
          showAdminSections
          curriculumYear={curriculumYear}
          subjectArea={subjectArea}
          subjectSelect={subjectSelect}
          unitMajor={unitMajor}
          unitMinor={unitMinor}
        />
      )}

      {/* 편집 모드: 폼 + 사이드 패널 미리보기 */}
      {mode === "edit" && (
        <>
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
              difficultyLevel={difficultyLevel}
              onDifficultyLevelChange={(v) => {
                setDifficultyLevel(v);
                setDifficultyAuto(false);
                setIsDirty(true);
              }}
              difficultyAuto={difficultyAuto}
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

          {/* 미리보기 사이드 패널 */}
          {previewOpen && (
            <div
              className="fixed inset-0 z-40 bg-black/20 dark:bg-black/40"
              onClick={() => setPreviewOpen(false)}
            />
          )}
          <aside
            role="dialog"
            aria-label="미리보기"
            className={cn(
              "fixed inset-y-0 right-0 z-50 w-full md:w-[66vw] md:max-w-4xl bg-white dark:bg-secondary-900 border-l border-secondary-200 dark:border-secondary-700 shadow-2xl transition-transform duration-300 ease-in-out flex flex-col",
              previewOpen ? "translate-x-0" : "translate-x-full",
            )}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-secondary-200 dark:border-secondary-700 shrink-0">
              <h2 className="text-sm font-semibold text-[var(--text-heading)]">미리보기</h2>
              <button
                type="button"
                onClick={() => setPreviewOpen(false)}
                aria-label="미리보기 닫기"
                className="p-1.5 rounded-lg hover:bg-secondary-100 dark:hover:bg-secondary-800 transition-colors"
              >
                <X className="w-4 h-4 text-[var(--text-secondary)]" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto overscroll-contain p-4 sm:p-6">
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
                contentSections={previewContentSections}
                showAdminSections
                curriculumYear={curriculumYear}
                subjectArea={subjectArea}
                subjectSelect={subjectSelect}
                unitMajor={unitMajor}
                unitMinor={unitMinor}
              />
            </div>
          </aside>
        </>
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
            가이드 품질을 5가지 차원(학술적 깊이, 학생 접근성, 구조적 완성도, 실용적 연관성, 탐구 로드맵 품질)으로 평가합니다
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
          <div className="border-t border-secondary-200 dark:border-secondary-700 pt-4 space-y-2">
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
                  리뷰 반영 개선 + URL 검증 중... (60~90초)
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  AI 리뷰 피드백 반영하여 개선된 버전 생성
                </>
              )}
            </button>
            <p className="text-[10px] text-[var(--text-secondary)] text-center">
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
        availableSectionKeys={previewContentSections
          .filter((s) => s.content || (s.items && s.items.length > 0))
          .map((s) => s.key)}
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

      {/* 커밋 메시지 다이얼로그 */}
      <VersionCommitDialog
        open={commitDialogOpen}
        saving={saving}
        onConfirm={handleCommitSave}
        onCancel={() => setCommitDialogOpen(false)}
      />
    </div>
  );
}

"use client";

import { useState, useEffect, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Save, Trash2, Loader2, Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/cn";
import { useToast } from "@/components/ui/ToastProvider";
import {
  cmsGuideDetailQueryOptions,
  guideCareerFieldsQueryOptions,
  allSubjectsQueryOptions,
  explorationGuideKeys,
} from "@/lib/query-options/explorationGuide";
import {
  createGuideAction,
  updateGuideAction,
  deleteGuideAction,
  uploadGuideImageAction,
} from "@/lib/domains/guide/actions/crud";
import type {
  GuideType,
  GuideStatus,
  GuideUpsertInput,
  GuideContentInput,
  TheorySection,
} from "@/lib/domains/guide/types";
import {
  GUIDE_TYPES,
  GUIDE_TYPE_LABELS,
  GUIDE_STATUSES,
  GUIDE_STATUS_LABELS,
} from "@/lib/domains/guide/types";
import { GuideMetaForm } from "./GuideMetaForm";
import { GuideContentEditor } from "./GuideContentEditor";
import { GuidePreview } from "./GuidePreview";

interface GuideEditorClientProps {
  /** 편집 시 guideId, 생성 시 undefined */
  guideId?: string;
}

export function GuideEditorClient({ guideId }: GuideEditorClientProps) {
  const router = useRouter();
  const toast = useToast();
  const queryClient = useQueryClient();
  const isNew = !guideId;

  // 데이터 로딩
  const { data: guideRes, isLoading: loadingGuide } = useQuery({
    ...cmsGuideDetailQueryOptions(guideId ?? ""),
    enabled: !!guideId,
  });
  const { data: careerFieldsRes } = useQuery(guideCareerFieldsQueryOptions());
  const { data: subjectsRes } = useQuery(allSubjectsQueryOptions());

  const careerFields = careerFieldsRes?.success ? careerFieldsRes.data ?? [] : [];
  const allSubjects = subjectsRes?.success ? subjectsRes.data ?? [] : [];
  const guide = guideRes?.success ? guideRes.data : null;

  // 메타 상태
  const [title, setTitle] = useState("");
  const [guideType, setGuideType] = useState<GuideType>("topic_exploration");
  const [status, setStatus] = useState<GuideStatus>("draft");
  const [curriculumYear, setCurriculumYear] = useState("");
  const [subjectSelect, setSubjectSelect] = useState("");
  const [unitMajor, setUnitMajor] = useState("");
  const [unitMinor, setUnitMinor] = useState("");
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

  // UI 상태
  const [saving, setSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  // 가이드 데이터 → 폼 초기화
  useEffect(() => {
    if (!guide) return;
    setTitle(guide.title);
    setGuideType(guide.guide_type);
    setStatus(guide.status);
    setCurriculumYear(guide.curriculum_year ?? "");
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
        subjectSelect: subjectSelect || undefined,
        unitMajor: unitMajor || undefined,
        unitMinor: unitMinor || undefined,
        bookTitle: bookTitle || undefined,
        bookAuthor: bookAuthor || undefined,
        bookPublisher: bookPublisher || undefined,
        bookYear: bookYear || undefined,
        contentFormat: "html",
      };

      const content: GuideContentInput = {
        motivation: motivation || undefined,
        theorySections: theorySections.length > 0 ? theorySections : undefined,
        reflection: reflection || undefined,
        impression: impression || undefined,
        summary: summary || undefined,
        followUp: followUp || undefined,
        bookDescription: bookDescription || undefined,
        setekExamples: setekExamples.length > 0 ? setekExamples : undefined,
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
            {isNew ? "새 가이드 작성" : "가이드 편집"}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowPreview((p) => !p)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm transition-colors",
              showPreview
                ? "border-primary-300 bg-primary-50 text-primary-700 dark:border-primary-600 dark:bg-primary-900/30 dark:text-primary-300"
                : "border-secondary-200 dark:border-secondary-700 text-[var(--text-secondary)] hover:bg-secondary-50 dark:hover:bg-secondary-800",
            )}
          >
            {showPreview ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            {showPreview ? "편집" : "미리보기"}
          </button>
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
            subjectSelect={subjectSelect}
            onSubjectSelectChange={setSubjectSelect}
            unitMajor={unitMajor}
            onUnitMajorChange={setUnitMajor}
            unitMinor={unitMinor}
            onUnitMinorChange={setUnitMinor}
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
            contentFormat={getContentFormat()}
            toHtml={toHtml}
            onImageInsert={handleImageInsert}
          />
        </div>
      )}
    </div>
  );
}

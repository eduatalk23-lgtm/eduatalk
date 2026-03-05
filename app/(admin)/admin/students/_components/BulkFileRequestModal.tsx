"use client";

import { useEffect, useState, useTransition } from "react";
import { Bookmark, CheckCircle, AlertCircle } from "lucide-react";
import Button from "@/components/atoms/Button";
import { Dialog } from "@/components/ui/Dialog";
import { cn } from "@/lib/cn";
import {
  FILE_CATEGORIES,
  FILE_CATEGORY_LABELS,
  MIME_TYPE_GROUPS,
  type FileCategory,
  type RequestTemplate,
  type MimeTypeGroupKey,
} from "@/lib/domains/drive/types";
import {
  bulkCreateFileRequestsAction,
  getRequestTemplatesAction,
} from "@/lib/domains/drive/actions/workflow";

interface StudentInfo {
  id: string;
  name: string | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
  selectedStudents: StudentInfo[];
}

type Step = "settings" | "result";

interface BulkResult {
  total: number;
  succeeded: number;
  failed: number;
  errors: Array<{ studentId: string; error: string }>;
}

export function BulkFileRequestModal({ open, onClose, selectedStudents }: Props) {
  const [step, setStep] = useState<Step>("settings");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<FileCategory>("transcript");
  const [selectedMimeGroups, setSelectedMimeGroups] = useState<Set<MimeTypeGroupKey>>(new Set());
  const [deadline, setDeadline] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<BulkResult | null>(null);
  const [isPending, startTransition] = useTransition();
  const [templates, setTemplates] = useState<RequestTemplate[]>([]);

  useEffect(() => {
    if (open) getRequestTemplatesAction().then(setTemplates);
  }, [open]);

  function applyTemplate(tmpl: RequestTemplate) {
    setTitle(tmpl.title);
    setDescription(tmpl.description ?? "");
    setCategory(tmpl.category);
    const mimeGroups = new Set<MimeTypeGroupKey>();
    if (tmpl.allowed_mime_types) {
      const mimeSet = new Set(tmpl.allowed_mime_types);
      for (const [key, group] of Object.entries(MIME_TYPE_GROUPS)) {
        if (group.types.every((t) => mimeSet.has(t))) {
          mimeGroups.add(key as MimeTypeGroupKey);
        }
      }
    }
    setSelectedMimeGroups(mimeGroups);
    if (tmpl.deadline_days) {
      const d = new Date();
      d.setDate(d.getDate() + tmpl.deadline_days);
      setDeadline(d.toISOString().slice(0, 10));
    } else {
      setDeadline("");
    }
  }

  function reset() {
    setStep("settings");
    setTitle("");
    setDescription("");
    setCategory("transcript");
    setSelectedMimeGroups(new Set());
    setDeadline("");
    setError(null);
    setResult(null);
  }

  function handleClose() {
    if (isPending) return;
    reset();
    onClose();
  }

  function toggleMimeGroup(key: MimeTypeGroupKey) {
    setSelectedMimeGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  function handleSubmit() {
    if (!title.trim()) {
      setError("제목을 입력하세요.");
      return;
    }

    const allowedMimeTypes =
      selectedMimeGroups.size > 0
        ? Array.from(selectedMimeGroups).flatMap(
            (key) => [...MIME_TYPE_GROUPS[key].types]
          )
        : undefined;

    startTransition(async () => {
      const res = await bulkCreateFileRequestsAction({
        studentIds: selectedStudents.map((s) => s.id),
        title: title.trim(),
        description: description.trim() || undefined,
        category,
        allowedMimeTypes,
        deadline: deadline || undefined,
      });

      if (!res.success) {
        setError(res.error ?? "요청 생성에 실패했습니다.");
        return;
      }

      setResult(res.result!);
      setStep("result");
    });
  }

  const stepTitle = step === "settings" ? "일괄 파일 요청" : "요청 결과";
  const stepDescription =
    step === "settings"
      ? `${selectedStudents.length}명의 학생에게 파일 요청을 생성합니다.`
      : undefined;

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => !isOpen && handleClose()}
      title={stepTitle}
      description={stepDescription}
      size="md"
      showCloseButton={!isPending}
    >
      {step === "settings" && (
        <div className="flex flex-col gap-4">
          {/* 선택된 학생 미리보기 */}
          <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-3">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
              선택된 학생 ({selectedStudents.length}명)
            </p>
            <div className="flex flex-wrap gap-1.5 max-h-20 overflow-y-auto">
              {selectedStudents.map((s) => (
                <span
                  key={s.id}
                  className="px-2 py-0.5 text-xs rounded-full bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
                >
                  {s.name ?? "이름 없음"}
                </span>
              ))}
            </div>
          </div>

          {/* 템플릿 */}
          {templates.length > 0 && (
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1.5">템플릿</label>
              <div className="flex flex-wrap gap-1.5">
                {templates.map((tmpl) => (
                  <button
                    key={tmpl.id}
                    type="button"
                    onClick={() => applyTemplate(tmpl)}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-full border border-gray-300 dark:border-gray-600 text-xs text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 hover:border-indigo-400 transition-colors"
                  >
                    <Bookmark className="w-3 h-3" />
                    {tmpl.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          <input
            type="text"
            placeholder="요청 제목 (예: 생기부 제출)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
          />

          <textarea
            placeholder="설명 (선택)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm resize-none"
          />

          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                카테고리
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as FileCategory)}
                className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
              >
                {FILE_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {FILE_CATEGORY_LABELS[cat]}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex-1">
              <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                기한 (선택)
              </label>
              <input
                type="date"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
              />
            </div>
          </div>

          {/* MIME 타입 제한 */}
          <div>
            <label className="block text-xs text-gray-600 dark:text-gray-400 mb-2">
              허용 파일 형식 (선택하지 않으면 전체 허용)
            </label>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(MIME_TYPE_GROUPS) as MimeTypeGroupKey[]).map(
                (key) => (
                  <label
                    key={key}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm cursor-pointer transition-colors",
                      selectedMimeGroups.has(key)
                        ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300"
                        : "border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700"
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={selectedMimeGroups.has(key)}
                      onChange={() => toggleMimeGroup(key)}
                      className="sr-only"
                    />
                    {MIME_TYPE_GROUPS[key].label}
                  </label>
                )
              )}
            </div>
          </div>

          {error && <p className="text-xs text-red-600">{error}</p>}

          <div className="flex gap-2 justify-end pt-2">
            <Button size="sm" variant="secondary" onClick={handleClose}>
              취소
            </Button>
            <Button size="sm" onClick={handleSubmit} isLoading={isPending}>
              {selectedStudents.length}명에게 요청 생성
            </Button>
          </div>
        </div>
      )}

      {step === "result" && result && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3 p-4 rounded-lg bg-green-50 dark:bg-green-900/20">
            <CheckCircle className="w-6 h-6 text-green-600 dark:text-green-400" />
            <div>
              <p className="text-sm font-medium text-green-800 dark:text-green-300">
                {result.succeeded}건 성공
              </p>
              <p className="text-xs text-green-600 dark:text-green-400">
                전체 {result.total}건 중 {result.succeeded}건 생성 완료
              </p>
            </div>
          </div>

          {result.failed > 0 && (
            <div className="rounded-lg border border-red-200 dark:border-red-800 p-3">
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400" />
                <span className="text-sm font-medium text-red-700 dark:text-red-300">
                  {result.failed}건 실패
                </span>
              </div>
              <div className="flex flex-col gap-1 max-h-32 overflow-y-auto">
                {result.errors.map((err, i) => {
                  const student = selectedStudents.find((s) => s.id === err.studentId);
                  return (
                    <p key={i} className="text-xs text-red-600 dark:text-red-400">
                      {student?.name ?? err.studentId}: {err.error}
                    </p>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex justify-end pt-2">
            <Button size="sm" onClick={handleClose}>
              닫기
            </Button>
          </div>
        </div>
      )}
    </Dialog>
  );
}

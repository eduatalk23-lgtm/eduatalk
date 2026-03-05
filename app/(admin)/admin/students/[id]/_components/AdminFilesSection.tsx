"use client";

/**
 * 관리자 - 학생 파일 관리 섹션
 * 워크플로우 요청 생성/관리 + 전체 파일 조회
 */

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import {
  Bookmark,
  Check,
  ChevronDown,
  ChevronUp,
  Download,
  Eye,
  FileText,
  HardDrive,
  Plus,
  Search,
  Send,
  Trash2,
  X,
  XCircle,
} from "lucide-react";
import Button from "@/components/atoms/Button";
import { cn } from "@/lib/cn";
import {
  getDriveFilesAction,
  getStudentDriveQuotaAction,
  deleteDriveFileAction,
} from "@/lib/domains/drive/actions/files";
import {
  createFileRequestAction,
  getFileRequestsAction,
  approveSubmissionAction,
  rejectSubmissionAction,
  deleteFileRequestAction,
  getRequestTemplatesAction,
  createRequestTemplateAction,
  deleteRequestTemplateAction,
} from "@/lib/domains/drive/actions/workflow";
import {
  DEFAULT_FILE_CATEGORIES,
  FILE_CATEGORY_LABELS,
  MIME_TYPE_GROUPS,
  getCategoryLabel,
  type CustomFileCategory,
  type DriveFile,
  type FileCategory,
  type FileDistribution,
  type DistributionTracking,
  type FileRequest,
  type FileRequestStatus,
  type RequestTemplate,
  type MimeTypeGroupKey,
} from "@/lib/domains/drive/types";
import { getCustomCategoriesAction } from "@/lib/domains/drive/actions/categories";
import {
  uploadAndDistributeAction,
  revokeDistributionAction,
  getDistributionTrackingAction,
  getStudentDistributionsAdminAction,
} from "@/lib/domains/drive/actions/distribution";
import { formatStorageSize } from "@/lib/domains/drive/quota";
import { formatFileSize, getFileTypeLabel, sanitizeFileName } from "@/lib/domains/drive/validation";
import { downloadFilesAsZip, type BulkDownloadProgress } from "@/lib/domains/drive/bulk-download";
import { getAttachmentExpiryInfo } from "@/lib/domains/chat/attachmentExpiry";

// =============================================================================
// Main Component
// =============================================================================

export function AdminFilesSection({ studentId }: { studentId: string }) {
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const [requests, setRequests] = useState<FileRequest[]>([]);
  const [filesByRequest, setFilesByRequest] = useState<
    Record<string, DriveFile[]>
  >({});
  const [distributions, setDistributions] = useState<FileDistribution[]>([]);
  const [distFiles, setDistFiles] = useState<Record<string, DriveFile>>({});
  const [quota, setQuota] = useState<{ usedBytes: number; totalBytes: number } | null>(null);
  const [customCategories, setCustomCategories] = useState<CustomFileCategory[]>([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showDistributeForm, setShowDistributeForm] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [filterCategory, setFilterCategory] = useState<FileCategory | "all">("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [isPending, startTransition] = useTransition();
  const [downloadProgress, setDownloadProgress] = useState<BulkDownloadProgress | null>(null);

  const loadData = useCallback(() => {
    startTransition(async () => {
      const [fileResult, requestResult, quotaResult, distResult, cats] = await Promise.all([
        getDriveFilesAction(studentId),
        getFileRequestsAction(studentId),
        getStudentDriveQuotaAction(studentId),
        getStudentDistributionsAdminAction(studentId),
        getCustomCategoriesAction(),
      ]);
      setFiles(fileResult.files);
      setSignedUrls(fileResult.signedUrls);
      setRequests(requestResult.requests);
      setFilesByRequest(requestResult.filesByRequest);
      setQuota(quotaResult);
      setDistributions(distResult.distributions);
      setDistFiles(distResult.files);
      setCustomCategories(cats);
    });
  }, [studentId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // 전체 카테고리 목록 (기본 + 커스텀)
  const allCategories: Array<{ key: string; label: string }> = [
    ...DEFAULT_FILE_CATEGORIES.map((key) => ({
      key,
      label: FILE_CATEGORY_LABELS[key] ?? key,
    })),
    ...customCategories.map((c) => ({ key: c.key, label: c.label })),
  ];

  // rejected는 재제출이 필요하므로 active에 유지
  const activeRequests = requests.filter((r) => r.status !== "approved");
  const completedRequests = requests.filter((r) => r.status === "approved");

  const filteredFiles = files.filter((file) => {
    if (filterCategory !== "all" && file.category !== filterCategory) return false;
    if (searchTerm && !file.original_name.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="flex flex-col gap-6">
      {/* 스토리지 사용량 */}
      {quota && (
        <div className="flex items-center gap-3 text-sm text-gray-600">
          <HardDrive className="w-4 h-4" />
          <span>
            사용량: {formatStorageSize(quota.usedBytes)} /{" "}
            {formatStorageSize(quota.totalBytes)}
          </span>
        </div>
      )}

      {/* 워크플로우 관리 */}
      <section className="rounded-lg border border-gray-200 bg-white p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold">파일 제출 요청</h3>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setShowCreateForm(true)}
          >
            <Plus className="w-3.5 h-3.5 mr-1" />
            요청 생성
          </Button>
        </div>

        {showCreateForm && (
          <CreateRequestForm
            studentId={studentId}
            allCategories={allCategories}
            onCreated={() => {
              setShowCreateForm(false);
              loadData();
            }}
            onCancel={() => setShowCreateForm(false)}
          />
        )}

        {activeRequests.length === 0 && !showCreateForm ? (
          <p className="text-sm text-gray-400 py-4 text-center">
            진행 중인 요청이 없습니다.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {activeRequests.map((req) => (
              <AdminRequestCard
                key={req.id}
                request={req}
                files={filesByRequest[req.id] ?? []}
                signedUrls={signedUrls}
                onUpdate={loadData}
              />
            ))}
          </div>
        )}

        {/* 이력 보기 */}
        {completedRequests.length > 0 && (
          <div className="mt-4 border-t border-gray-100 pt-3">
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700"
            >
              {showHistory ? (
                <ChevronUp className="w-3.5 h-3.5" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5" />
              )}
              이력 보기 ({completedRequests.length}건)
            </button>
            {showHistory && (
              <div className="flex flex-col gap-3 mt-3">
                {completedRequests.map((req) => (
                  <AdminRequestCard
                    key={req.id}
                    request={req}
                    files={filesByRequest[req.id] ?? []}
                    signedUrls={signedUrls}
                    onUpdate={loadData}
                    readOnly
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </section>

      {/* 자료 배포 */}
      <section className="rounded-lg border border-gray-200 bg-white p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold">자료 배포</h3>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setShowDistributeForm(true)}
          >
            <Send className="w-3.5 h-3.5 mr-1" />
            배포하기
          </Button>
        </div>

        {showDistributeForm && (
          <DistributeForm
            studentId={studentId}
            onDistributed={() => {
              setShowDistributeForm(false);
              loadData();
            }}
            onCancel={() => setShowDistributeForm(false)}
          />
        )}

        {distributions.length === 0 && !showDistributeForm ? (
          <p className="text-sm text-gray-400 py-4 text-center">
            배포된 자료가 없습니다.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {distributions.map((dist) => (
              <AdminDistributionCard
                key={dist.id}
                distribution={dist}
                file={distFiles[dist.file_id]}
                onRevoke={loadData}
              />
            ))}
          </div>
        )}
      </section>

      {/* 전체 파일 목록 */}
      <section className="rounded-lg border border-gray-200 bg-white p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold">전체 파일</h3>
          {filteredFiles.length > 0 && (
            <button
              disabled={!!downloadProgress}
              onClick={async () => {
                setDownloadProgress({ total: filteredFiles.length, completed: 0, failed: 0 });
                await downloadFilesAsZip(
                  filteredFiles,
                  signedUrls,
                  `파일_${new Date().toISOString().slice(0, 10)}.zip`,
                  setDownloadProgress,
                );
                setTimeout(() => setDownloadProgress(null), 2000);
              }}
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-md border",
                downloadProgress
                  ? "border-gray-200 text-gray-400 cursor-not-allowed"
                  : "border-gray-300 text-gray-600 hover:bg-gray-50",
              )}
            >
              <Download className="w-3.5 h-3.5" />
              {downloadProgress
                ? `${downloadProgress.completed}/${downloadProgress.total}`
                : `전체 다운로드 (${filteredFiles.length})`}
            </button>
          )}
        </div>

        {/* 카테고리 필터 + 검색 */}
        <div className="flex flex-col gap-3 mb-4">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setFilterCategory("all")}
              className={cn(
                "px-2.5 py-1 text-xs rounded-full border",
                filterCategory === "all"
                  ? "bg-indigo-600 text-white border-indigo-600"
                  : "border-gray-300 text-gray-600 hover:bg-gray-50"
              )}
            >
              전체
            </button>
            {allCategories.map((cat) => (
              <button
                key={cat.key}
                onClick={() => setFilterCategory(cat.key)}
                className={cn(
                  "px-2.5 py-1 text-xs rounded-full border",
                  filterCategory === cat.key
                    ? "bg-indigo-600 text-white border-indigo-600"
                    : "border-gray-300 text-gray-600 hover:bg-gray-50"
                )}
              >
                {cat.label}
              </button>
            ))}
          </div>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input
              type="text"
              placeholder="파일명 검색..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-sm rounded-md border border-gray-300"
            />
          </div>
        </div>

        {isPending ? (
          <p className="text-sm text-gray-400 py-4 text-center">로딩 중...</p>
        ) : filteredFiles.length === 0 ? (
          <p className="text-sm text-gray-400 py-4 text-center">
            파일이 없습니다.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {filteredFiles.map((file) => {
              const expiry = getAttachmentExpiryInfo(file.created_at);
              return (
                <div
                  key={file.id}
                  className="flex items-center gap-3 rounded-lg border border-gray-100 p-3 hover:bg-gray-50"
                >
                  <FileText className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate">{file.original_name}</p>
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <span>{getCategoryLabel(file.category, customCategories)}</span>
                      <span>·</span>
                      <span>{formatFileSize(file.size_bytes)}</span>
                      <span>·</span>
                      <span>
                        {file.uploaded_by_role === "student"
                          ? "학생"
                          : file.uploaded_by_role === "parent"
                            ? "학부모"
                            : "관리자"}
                      </span>
                      <span>·</span>
                      <span>{getFileTypeLabel(file.mime_type)}</span>
                    </div>
                  </div>
                  {expiry.level !== "safe" && (
                    <span
                      className={cn(
                        "px-2 py-0.5 text-xs rounded-full",
                        expiry.level === "critical"
                          ? "bg-red-100 text-red-700"
                          : "bg-yellow-100 text-yellow-700"
                      )}
                    >
                      {expiry.label}
                    </span>
                  )}
                  {signedUrls[file.id] && (
                    <a
                      href={signedUrls[file.id]}
                      download={sanitizeFileName(file.original_name)}
                      className="p-1.5 rounded hover:bg-gray-200"
                    >
                      <Download className="w-4 h-4 text-gray-500" />
                    </a>
                  )}
                  <button
                    onClick={async () => {
                      if (!confirm("삭제하시겠습니까?")) return;
                      const result = await deleteDriveFileAction(file.id);
                      if (!result.success) {
                        alert(result.error ?? "삭제에 실패했습니다.");
                      }
                      loadData();
                    }}
                    className="p-1.5 rounded hover:bg-red-50"
                  >
                    <Trash2 className="w-4 h-4 text-gray-400" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

// =============================================================================
// Create Request Form
// =============================================================================

function CreateRequestForm({
  studentId,
  allCategories,
  onCreated,
  onCancel,
}: {
  studentId: string;
  allCategories: Array<{ key: string; label: string }>;
  onCreated: () => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<FileCategory>("transcript");
  const [deadline, setDeadline] = useState("");
  const [selectedMimeGroups, setSelectedMimeGroups] = useState<Set<MimeTypeGroupKey>>(new Set());
  const [addToCalendar, setAddToCalendar] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Template support
  const [templates, setTemplates] = useState<RequestTemplate[]>([]);
  const [showSaveTemplate, setShowSaveTemplate] = useState(false);
  const [templateName, setTemplateName] = useState("");

  useEffect(() => {
    getRequestTemplatesAction().then(setTemplates);
  }, []);

  function applyTemplate(tmpl: RequestTemplate) {
    setTitle(tmpl.title);
    setDescription(tmpl.description ?? "");
    setCategory(tmpl.category);

    // Resolve MIME groups from template's allowed_mime_types
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

    // Calculate deadline from deadline_days
    if (tmpl.deadline_days) {
      const d = new Date();
      d.setDate(d.getDate() + tmpl.deadline_days);
      setDeadline(d.toISOString().slice(0, 10));
    } else {
      setDeadline("");
    }
  }

  async function handleSaveTemplate() {
    if (!templateName.trim() || !title.trim()) return;
    const allowedMimeTypes =
      selectedMimeGroups.size > 0
        ? Array.from(selectedMimeGroups).flatMap((key) => [...MIME_TYPE_GROUPS[key].types])
        : undefined;

    const result = await createRequestTemplateAction({
      name: templateName.trim(),
      title: title.trim(),
      description: description.trim() || undefined,
      category,
      allowedMimeTypes,
      deadlineDays: deadline
        ? Math.max(1, Math.ceil((new Date(deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
        : undefined,
    });

    if (result.success && result.template) {
      setTemplates((prev) => [...prev, result.template!]);
      setShowSaveTemplate(false);
      setTemplateName("");
    }
  }

  function toggleMimeGroup(key: MimeTypeGroupKey) {
    setSelectedMimeGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
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
      const result = await createFileRequestAction({
        studentId,
        title: title.trim(),
        description: description.trim() || undefined,
        category,
        allowedMimeTypes,
        deadline: deadline || undefined,
        addToCalendar: deadline ? addToCalendar : false,
      });

      if (!result.success) {
        setError(result.error ?? "요청 생성에 실패했습니다.");
        return;
      }
      onCreated();
    });
  }

  return (
    <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 mb-4">
      <div className="flex flex-col gap-3">
        {/* 템플릿 선택 */}
        {templates.length > 0 && (
          <div>
            <label className="block text-xs text-gray-600 mb-1.5">템플릿</label>
            <div className="flex flex-wrap gap-1.5">
              {templates.map((tmpl) => (
                <button
                  key={tmpl.id}
                  type="button"
                  onClick={() => applyTemplate(tmpl)}
                  className="group flex items-center gap-1 px-2.5 py-1 rounded-full border border-gray-300 text-xs text-gray-600 hover:bg-white hover:border-indigo-400 transition-colors"
                >
                  <Bookmark className="w-3 h-3" />
                  {tmpl.name}
                  <button
                    onClick={async (e) => {
                      e.stopPropagation();
                      if (!confirm(`"${tmpl.name}" 템플릿을 삭제하시겠습니까?`)) return;
                      const ok = await deleteRequestTemplateAction(tmpl.id);
                      if (ok.success) setTemplates((prev) => prev.filter((t) => t.id !== tmpl.id));
                    }}
                    className="ml-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="w-3 h-3 text-gray-400 hover:text-red-500" />
                  </button>
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
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
        <textarea
          placeholder="설명 (선택)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm resize-none"
        />
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="block text-xs text-gray-600 mb-1">카테고리</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            >
              {allCategories.map((cat) => (
                <option key={cat.key} value={cat.key}>
                  {cat.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1">
            <label className="block text-xs text-gray-600 mb-1">
              기한 (선택)
            </label>
            <input
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
        </div>
        {/* 캘린더 연동 */}
        {deadline && (
          <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
            <input
              type="checkbox"
              checked={addToCalendar}
              onChange={(e) => setAddToCalendar(e.target.checked)}
              className="rounded border-gray-300"
            />
            학생 캘린더에 마감일 이벤트 추가
          </label>
        )}
        {/* MIME 타입 제한 */}
        <div>
          <label className="block text-xs text-gray-600 mb-1.5">
            허용 파일 형식 (선택하지 않으면 전체 허용)
          </label>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(MIME_TYPE_GROUPS) as MimeTypeGroupKey[]).map((key) => (
              <label
                key={key}
                className={cn(
                  "flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs cursor-pointer transition-colors",
                  selectedMimeGroups.has(key)
                    ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                    : "border-gray-300 text-gray-600 hover:bg-gray-50"
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
            ))}
          </div>
        </div>
        {error && <p className="text-xs text-red-600">{error}</p>}
        <div className="flex gap-2 justify-end">
          {/* 템플릿 저장 */}
          {showSaveTemplate ? (
            <div className="flex items-center gap-1.5 mr-auto">
              <input
                type="text"
                placeholder="템플릿 이름"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                className="rounded-md border border-gray-300 px-2 py-1 text-xs w-32"
              />
              <Button size="sm" variant="secondary" onClick={handleSaveTemplate} disabled={!templateName.trim() || !title.trim()}>
                저장
              </Button>
              <button onClick={() => setShowSaveTemplate(false)} className="p-1">
                <X className="w-3.5 h-3.5 text-gray-400" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowSaveTemplate(true)}
              className="flex items-center gap-1 text-xs text-gray-500 hover:text-indigo-600 mr-auto"
            >
              <Bookmark className="w-3.5 h-3.5" />
              템플릿으로 저장
            </button>
          )}
          <Button size="sm" variant="secondary" onClick={onCancel}>
            취소
          </Button>
          <Button size="sm" onClick={handleSubmit} isLoading={isPending}>
            요청 생성
          </Button>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Admin Request Card (with approve/reject)
// =============================================================================

// =============================================================================
// Distribute Form (single student)
// =============================================================================

function DistributeForm({
  studentId,
  onDistributed,
  onCancel,
}: {
  studentId: string;
  onDistributed: () => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<FileCategory>("transcript");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleSubmit() {
    if (!title.trim()) {
      setError("제목을 입력하세요.");
      return;
    }
    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      setError("파일을 선택하세요.");
      return;
    }

    startTransition(async () => {
      const formData = new FormData();
      formData.append("file", file);

      const result = await uploadAndDistributeAction(formData, {
        studentIds: [studentId],
        title: title.trim(),
        description: description.trim() || undefined,
        category,
      });

      if (!result.success) {
        setError(result.error ?? "배포에 실패했습니다.");
        return;
      }
      onDistributed();
    });
  }

  return (
    <div className="rounded-lg border border-green-200 bg-green-50 p-4 mb-4">
      <div className="flex flex-col gap-3">
        <input
          type="text"
          placeholder="배포 제목 (예: 3월 학습자료)"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
        <textarea
          placeholder="설명 (선택)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm resize-none"
        />
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="block text-xs text-gray-600 mb-1">카테고리</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            >
              {DEFAULT_FILE_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {FILE_CATEGORY_LABELS[cat]}
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1">
            <label className="block text-xs text-gray-600 mb-1">파일</label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,application/pdf,.hwp,.doc,.docx"
              className="w-full text-sm"
            />
          </div>
        </div>
        {error && <p className="text-xs text-red-600">{error}</p>}
        <div className="flex gap-2 justify-end">
          <Button size="sm" variant="secondary" onClick={onCancel}>
            취소
          </Button>
          <Button size="sm" onClick={handleSubmit} isLoading={isPending}>
            배포
          </Button>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Admin Distribution Card (with tracking + revoke)
// =============================================================================

function AdminDistributionCard({
  distribution,
  file,
  onRevoke,
}: {
  distribution: FileDistribution;
  file?: DriveFile;
  onRevoke: () => void;
}) {
  const [tracking, setTracking] = useState<DistributionTracking[] | null>(null);
  const [showTracking, setShowTracking] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleRevoke() {
    if (!confirm("배포를 취소하시겠습니까?")) return;
    startTransition(async () => {
      await revokeDistributionAction(distribution.id);
      onRevoke();
    });
  }

  function handleShowTracking() {
    if (showTracking) {
      setShowTracking(false);
      return;
    }
    startTransition(async () => {
      const data = await getDistributionTrackingAction(distribution.file_id);
      setTracking(data);
      setShowTracking(true);
    });
  }

  return (
    <div className="rounded-lg border border-gray-200 p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-medium">{distribution.title}</h4>
          {distribution.description && (
            <p className="text-xs text-gray-500 mt-0.5">{distribution.description}</p>
          )}
          <div className="flex items-center gap-2 text-xs text-gray-400 mt-1">
            {file && <span>{file.original_name}</span>}
            <span>·</span>
            <span>
              {new Date(distribution.created_at).toLocaleDateString("ko-KR")}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={handleShowTracking}
            className="p-1.5 rounded hover:bg-gray-100"
            title="열람 현황"
          >
            <Eye className="w-3.5 h-3.5 text-gray-400" />
          </button>
          <button
            onClick={handleRevoke}
            disabled={isPending}
            className="p-1.5 rounded hover:bg-red-50"
            title="배포 취소"
          >
            <Trash2 className="w-3.5 h-3.5 text-gray-400" />
          </button>
        </div>
      </div>

      {showTracking && tracking && (
        <div className="mt-2 border-t border-gray-100 pt-2">
          <p className="text-xs font-medium text-gray-500 mb-1">열람 현황</p>
          {tracking.map((t) => (
            <div key={t.distribution_id} className="flex items-center gap-2 text-xs py-0.5">
              <span className="text-gray-700">{t.student_name}</span>
              <span className={t.viewed_at ? "text-green-600" : "text-gray-400"}>
                {t.viewed_at ? "열람" : "미열람"}
              </span>
              <span className={t.downloaded_at ? "text-blue-600" : "text-gray-400"}>
                {t.downloaded_at ? "다운로드" : "-"}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Admin Request Card (with approve/reject)
// =============================================================================

function AdminRequestCard({
  request,
  files,
  signedUrls,
  onUpdate,
  readOnly = false,
}: {
  request: FileRequest;
  files: DriveFile[];
  signedUrls: Record<string, string>;
  onUpdate: () => void;
  readOnly?: boolean;
}) {
  const [rejectReason, setRejectReason] = useState("");
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [isPending, startTransition] = useTransition();

  const statusLabels: Record<FileRequestStatus, string> = {
    pending: "대기",
    overdue: "기한초과",
    submitted: "제출됨",
    approved: "승인됨",
    rejected: "반려됨",
  };

  const statusColors: Record<FileRequestStatus, string> = {
    pending: "bg-yellow-100 text-yellow-700",
    overdue: "bg-red-100 text-red-700",
    submitted: "bg-blue-100 text-blue-700",
    approved: "bg-green-100 text-green-700",
    rejected: "bg-red-100 text-red-700",
  };

  function handleApprove(fileId: string) {
    startTransition(async () => {
      await approveSubmissionAction(request.id, fileId);
      onUpdate();
    });
  }

  function handleReject() {
    if (!rejectReason.trim()) return;
    startTransition(async () => {
      await rejectSubmissionAction(request.id, rejectReason.trim());
      setShowRejectForm(false);
      onUpdate();
    });
  }

  function handleDelete() {
    if (!confirm("요청을 삭제하시겠습니까?")) return;
    startTransition(async () => {
      await deleteFileRequestAction(request.id);
      onUpdate();
    });
  }

  return (
    <div className="rounded-lg border border-gray-200 p-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span
              className={cn(
                "px-2 py-0.5 text-xs font-medium rounded-full",
                statusColors[request.status]
              )}
            >
              {statusLabels[request.status]}
            </span>
            <span className="text-xs text-gray-500">
              {FILE_CATEGORY_LABELS[request.category]}
            </span>
          </div>
          <h4 className="text-sm font-medium">{request.title}</h4>
          {request.description && (
            <p className="text-xs text-gray-500 mt-0.5">
              {request.description}
            </p>
          )}
        </div>
        {!readOnly && (
          <button
            onClick={handleDelete}
            className="p-1 rounded hover:bg-red-50"
            title="요청 삭제"
          >
            <Trash2 className="w-3.5 h-3.5 text-gray-400" />
          </button>
        )}
      </div>

      {/* 제출 파일 목록 (submitted 상태) */}
      {files.length > 0 && (
        <div className="mt-3 flex flex-col gap-1.5">
          {files.map((file) => (
            <div
              key={file.id}
              className="flex items-center gap-2 bg-gray-50 rounded px-2.5 py-1.5"
            >
              <FileText className="w-3.5 h-3.5 text-gray-400" />
              <span className="text-xs truncate flex-1">
                {file.original_name}
              </span>
              <span className="text-xs text-gray-400">
                v{file.version_number}
              </span>
              <span className="text-xs text-gray-400">
                {file.uploaded_by_role === "parent" ? "학부모" : "학생"}
              </span>
              {signedUrls[file.id] && (
                <a
                  href={signedUrls[file.id]}
                  download={sanitizeFileName(file.original_name)}
                  className="p-0.5 rounded hover:bg-gray-200"
                >
                  <Download className="w-3.5 h-3.5 text-gray-500" />
                </a>
              )}
              {!readOnly && request.status === "submitted" && (
                <button
                  onClick={() => handleApprove(file.id)}
                  disabled={isPending}
                  className="p-0.5 rounded hover:bg-green-100"
                  title="이 버전 승인"
                >
                  <Check className="w-3.5 h-3.5 text-green-600" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* 승인/반려 버튼 (submitted 상태) */}
      {!readOnly && request.status === "submitted" && !showRejectForm && (
        <div className="mt-3 flex gap-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setShowRejectForm(true)}
          >
            <XCircle className="w-3.5 h-3.5 mr-1" />
            반려
          </Button>
        </div>
      )}

      {/* 반려 사유 입력 */}
      {showRejectForm && (
        <div className="mt-3 flex gap-2">
          <input
            type="text"
            placeholder="반려 사유를 입력하세요"
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            className="flex-1 rounded-md border border-gray-300 px-3 py-1.5 text-sm"
          />
          <Button
            size="sm"
            variant="secondary"
            onClick={handleReject}
            isLoading={isPending}
          >
            확인
          </Button>
          <button
            onClick={() => setShowRejectForm(false)}
            className="p-1.5 rounded hover:bg-gray-100"
          >
            <X className="w-4 h-4 text-gray-400" />
          </button>
        </div>
      )}

      {/* 반려 사유 표시 */}
      {request.status === "rejected" && request.rejection_reason && (
        <p className="mt-2 text-xs text-red-600 bg-red-50 rounded px-2 py-1">
          반려 사유: {request.rejection_reason}
        </p>
      )}
    </div>
  );
}

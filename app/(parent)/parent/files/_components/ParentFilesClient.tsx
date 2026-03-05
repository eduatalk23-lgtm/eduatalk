"use client";

/**
 * 학부모 파일 클라이언트 컴포넌트
 * 자녀의 워크플로우 요청 열람 + 파일 제출, 드라이브 파일 열람 (업로드/삭제 불가)
 */

import { useCallback, useEffect, useState, useTransition } from "react";
import { Download, HardDrive, Filter } from "lucide-react";
import { cn } from "@/lib/cn";
import {
  getDriveFilesAction,
  getStudentDriveQuotaAction,
} from "@/lib/domains/drive/actions/files";
import { getFileRequestsAction } from "@/lib/domains/drive/actions/workflow";
import { getMyDistributionsAction } from "@/lib/domains/drive/actions/distribution";
import {
  FILE_CATEGORIES,
  FILE_CATEGORY_LABELS,
  type DriveFile,
  type FileCategory,
  type FileRequest,
  type DistributionWithFile,
} from "@/lib/domains/drive/types";
import { formatStorageSize, type DriveQuotaInfo } from "@/lib/domains/drive/quota";
import { FileCard } from "@/components/drive/FileCard";
import { WorkflowRequestCard } from "@/components/drive/WorkflowRequestCard";
import { DistributionCard } from "@/components/drive/DistributionCard";
import { downloadFilesAsZip, type BulkDownloadProgress } from "@/lib/domains/drive/bulk-download";

export function ParentFilesClient({ studentId }: { studentId: string }) {
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const [requests, setRequests] = useState<FileRequest[]>([]);
  const [filesByRequest, setFilesByRequest] = useState<
    Record<string, DriveFile[]>
  >({});
  const [distributions, setDistributions] = useState<DistributionWithFile[]>([]);
  const [distSignedUrls, setDistSignedUrls] = useState<Record<string, string>>({});
  const [quota, setQuota] = useState<DriveQuotaInfo | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<FileCategory | "all">(
    "all"
  );
  const [isPending, startTransition] = useTransition();
  const [downloadProgress, setDownloadProgress] = useState<BulkDownloadProgress | null>(null);

  // studentId 변경 시 stale 데이터 초기화
  useEffect(() => {
    setFiles([]);
    setSignedUrls({});
    setRequests([]);
    setFilesByRequest({});
    setDistributions([]);
    setDistSignedUrls({});
    setQuota(null);
    setCategoryFilter("all");
  }, [studentId]);

  const loadData = useCallback(() => {
    if (!studentId) return;
    startTransition(async () => {
      const filter =
        categoryFilter !== "all" ? { category: categoryFilter } : undefined;
      const [fileResult, requestResult, quotaResult, distResult] = await Promise.all([
        getDriveFilesAction(studentId, filter),
        getFileRequestsAction(studentId),
        getStudentDriveQuotaAction(studentId),
        getMyDistributionsAction(studentId),
      ]);
      setFiles(fileResult.files);
      setSignedUrls(fileResult.signedUrls);
      setRequests(requestResult.requests);
      setFilesByRequest(requestResult.filesByRequest);
      setQuota(quotaResult);
      setDistributions(distResult.distributions);
      setDistSignedUrls(distResult.signedUrls);
    });
  }, [studentId, categoryFilter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const activeRequests = requests.filter(
    (r) => r.status === "pending" || r.status === "overdue" || r.status === "submitted"
  );
  const completedRequests = requests.filter(
    (r) => r.status === "approved" || r.status === "rejected"
  );

  return (
    <div className="flex flex-col gap-6 pt-6">
      {/* 헤더 */}
      <div className="flex items-center gap-2">
        <HardDrive className="w-5 h-5 text-gray-600 dark:text-gray-400" />
        <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          자녀 파일
        </h1>
      </div>

      {/* 스토리지 사용량 */}
      {quota && (
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-3 bg-gray-50 dark:bg-gray-800">
          <div className="flex items-center justify-between text-sm mb-1.5">
            <span className="text-gray-600 dark:text-gray-400">사용량</span>
            <span className="font-medium text-gray-900 dark:text-gray-100">
              {formatStorageSize(quota.usedBytes)} /{" "}
              {formatStorageSize(quota.totalBytes)}
            </span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
            <div
              className={cn(
                "h-2 rounded-full transition-all",
                quota.usagePercent > 90
                  ? "bg-red-500"
                  : quota.usagePercent > 70
                    ? "bg-yellow-500"
                    : "bg-blue-500"
              )}
              style={{ width: `${Math.min(quota.usagePercent, 100)}%` }}
            />
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            파일은 7일 후 자동 삭제됩니다. 필요한 파일은 미리 다운로드하세요.
          </p>
        </div>
      )}

      {/* 워크플로우 요청 (진행 중) */}
      {activeRequests.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
            파일 제출 요청
          </h2>
          <div className="flex flex-col gap-3">
            {activeRequests.map((req) => (
              <WorkflowRequestCard
                key={req.id}
                request={req}
                files={filesByRequest[req.id] ?? []}
                studentId={studentId}
                onUpdate={loadData}
              />
            ))}
          </div>
        </section>
      )}

      {/* 배포 자료 */}
      {distributions.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
            배포 자료
          </h2>
          <div className="flex flex-col gap-3">
            {distributions.map((dist) => (
              <DistributionCard
                key={dist.id}
                distribution={dist}
                signedUrl={distSignedUrls[dist.file_id]}
              />
            ))}
          </div>
        </section>
      )}

      {/* 카테고리 필터 */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <Filter className="w-4 h-4 text-gray-400" />
          <div className="flex gap-1.5">
            <button
              onClick={() => setCategoryFilter("all")}
              disabled={isPending}
              className={cn(
                "px-3 py-1 text-sm rounded-full border transition-colors disabled:opacity-50",
                categoryFilter === "all"
                  ? "bg-gray-900 text-white border-gray-900 dark:bg-gray-100 dark:text-gray-900 dark:border-gray-100"
                  : "bg-white text-gray-600 border-gray-300 hover:border-gray-400 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-600"
              )}
            >
              전체
            </button>
            {FILE_CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setCategoryFilter(cat)}
                disabled={isPending}
                className={cn(
                  "px-3 py-1 text-sm rounded-full border transition-colors disabled:opacity-50",
                  categoryFilter === cat
                    ? "bg-gray-900 text-white border-gray-900 dark:bg-gray-100 dark:text-gray-900 dark:border-gray-100"
                    : "bg-white text-gray-600 border-gray-300 hover:border-gray-400 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-600"
                )}
              >
                {FILE_CATEGORY_LABELS[cat]}
              </button>
            ))}
          </div>
        </div>

        {/* 일괄 다운로드 */}
        {files.length > 0 && (
          <div className="flex justify-end mb-2">
            <button
              disabled={!!downloadProgress}
              onClick={async () => {
                setDownloadProgress({ total: files.length, completed: 0, failed: 0 });
                await downloadFilesAsZip(
                  files,
                  signedUrls,
                  `자녀파일_${new Date().toISOString().slice(0, 10)}.zip`,
                  setDownloadProgress,
                );
                setTimeout(() => setDownloadProgress(null), 2000);
              }}
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-md border",
                downloadProgress
                  ? "border-gray-200 text-gray-400 cursor-not-allowed dark:border-gray-700 dark:text-gray-500"
                  : "border-gray-300 text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-700",
              )}
            >
              <Download className="w-3.5 h-3.5" />
              {downloadProgress
                ? `${downloadProgress.completed}/${downloadProgress.total}`
                : `전체 다운로드 (${files.length})`}
            </button>
          </div>
        )}

        {/* 파일 목록 (읽기 전용) */}
        {isPending ? (
          <div className="flex items-center justify-center py-12 text-gray-400">
            로딩 중...
          </div>
        ) : files.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-gray-400">
            <HardDrive className="w-10 h-10 mb-2" />
            <p className="text-sm">파일이 없습니다.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {files.map((file) => (
              <FileCard
                key={file.id}
                file={file}
                signedUrl={signedUrls[file.id]}
                readOnly
              />
            ))}
          </div>
        )}
      </section>

      {/* 완료된 요청 */}
      {completedRequests.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-3">
            완료된 요청
          </h2>
          <div className="flex flex-col gap-3 opacity-70">
            {completedRequests.map((req) => (
              <WorkflowRequestCard
                key={req.id}
                request={req}
                files={filesByRequest[req.id] ?? []}
                studentId={studentId}
                onUpdate={loadData}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

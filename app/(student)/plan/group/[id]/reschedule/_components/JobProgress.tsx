/**
 * 재조정 Job 진행 상황 UI 컴포넌트
 * 
 * 비동기 재조정 작업의 진행 상황을 실시간으로 표시합니다.
 */

"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getRescheduleJobStatus } from "@/lib/reschedule/jobQueue";
import { useToast } from "@/components/ui/ToastProvider";
import type { RescheduleJob } from "@/lib/reschedule/jobQueue";
import { ProgressBar } from "@/components/atoms/ProgressBar";

type JobProgressProps = {
  jobId: string;
  groupId: string;
};

export function JobProgress({ jobId, groupId }: JobProgressProps) {
  const router = useRouter();
  const toast = useToast();
  const [job, setJob] = useState<RescheduleJob | null>(null);
  const [loading, setLoading] = useState(true);
  const [polling, setPolling] = useState(true);

  useEffect(() => {
    if (!polling) return;

    const pollJobStatus = async () => {
      try {
        const status = await getRescheduleJobStatus(jobId);
        setJob(status);
        setLoading(false);

        if (status) {
          // 완료 또는 실패 시 폴링 중지
          if (status.status === "completed" || status.status === "failed") {
            setPolling(false);

            if (status.status === "completed") {
              toast.showSuccess("재조정이 완료되었습니다.");
              router.push(`/plan/group/${groupId}`);
            } else {
              toast.showError(status.error || "재조정에 실패했습니다.");
            }
          }
        }
      } catch (error) {
        console.error("[JobProgress] 상태 조회 실패:", error);
        setLoading(false);
        setPolling(false);
      }
    };

    // 초기 조회
    pollJobStatus();

    // 2초마다 폴링 (진행 중인 경우)
    const interval = setInterval(() => {
      if (polling) {
        pollJobStatus();
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [jobId, groupId, polling, router, toast]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex flex-col gap-4 text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
          <p className="text-sm text-gray-600">작업 상태를 확인하는 중...</p>
        </div>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-6 text-center">
        <p className="text-sm text-gray-600">작업 정보를 불러올 수 없습니다.</p>
      </div>
    );
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "pending":
        return "대기 중";
      case "processing":
        return "처리 중";
      case "completed":
        return "완료";
      case "failed":
        return "실패";
      default:
        return status;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "bg-gray-100 text-gray-700";
      case "processing":
        return "bg-blue-100 text-blue-700";
      case "completed":
        return "bg-green-100 text-green-700";
      case "failed":
        return "bg-red-100 text-red-700";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-gray-200 bg-white p-6">
      <div className="flex flex-col gap-1">
        <h3 className="text-lg font-semibold text-gray-900">재조정 진행 상황</h3>
        <p className="text-sm text-gray-600">작업 ID: {jobId}</p>
      </div>

      <div className="flex flex-col gap-4">
        {/* 상태 */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">상태</span>
            <span
              className={`rounded px-2 py-1 text-xs font-medium ${getStatusColor(
                job.status
              )}`}
            >
              {getStatusLabel(job.status)}
            </span>
          </div>
        </div>

        {/* 진행률 */}
        {job.status === "processing" && (
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">진행률</span>
              <span className="text-sm text-gray-600">{job.progress}%</span>
            </div>
            <ProgressBar
              value={job.progress}
              color="blue"
              size="sm"
            />
          </div>
        )}

        {/* 예상 소요 시간 */}
        {job.estimatedDuration && job.status === "processing" && (
          <div className="text-sm text-gray-600">
            예상 소요 시간: 약 {Math.ceil(job.estimatedDuration / 60)}분
          </div>
        )}

        {/* 에러 메시지 */}
        {job.status === "failed" && job.error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4">
            <p className="text-sm text-red-800">{job.error}</p>
          </div>
        )}

        {/* 결과 */}
        {job.status === "completed" && job.result && (
          <div className="flex flex-col gap-1 rounded-lg border border-green-200 bg-green-50 p-4">
            <p className="text-sm font-medium text-green-800">
              재조정 완료
            </p>
            <p className="text-xs text-green-700">
              기존 플랜: {job.result.plans_before_count}개 → 새 플랜:{" "}
              {job.result.plans_after_count}개
            </p>
          </div>
        )}
      </div>
    </div>
  );
}


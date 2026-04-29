"use client";

/**
 * useChatFileUpload - 채팅 파일 업로드 훅
 *
 * 파일 추가/제거/재시도 + 이미지 리사이즈/썸네일 생성 + 업로드 진행률 추적
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useBeforeUnload } from "@/lib/hooks/useBeforeUnload";
import { useToast } from "@/components/ui/ToastProvider";
import {
  registerChatAttachmentAction,
  deleteChatAttachmentAction,
  getChatStorageQuotaAction,
} from "@/lib/domains/chat/actions";
import {
  validateChatFile,
  getAttachmentType,
  sanitizeFileName,
  isImageType,
  isVideoType,
} from "@/lib/domains/chat/fileValidation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  type UploadingAttachment,
  MAX_ATTACHMENTS_PER_MESSAGE,
} from "@/lib/domains/chat/types";
import type { StorageQuotaInfo } from "@/lib/domains/chat/quota";
import { useChatStorageQuota } from "./useChatStorageQuota";

/**
 * 첨부 파일 타입에 맞는 썸네일 Blob 생성 (이미지/동영상)
 * 실패 시 null 반환 — 호출 측에서 generic 아이콘으로 fallback
 */
async function generateAttachmentThumbnail(
  originalFile: File,
  uploadFile: File | Blob
): Promise<Blob | null> {
  if (isImageType(originalFile.type)) {
    try {
      const { generateThumbnail } = await import("@/lib/domains/chat/imageResize");
      const thumb = await generateThumbnail(uploadFile);
      return thumb.blob;
    } catch {
      return null;
    }
  }
  if (isVideoType(originalFile.type)) {
    try {
      const { generateVideoThumbnail } = await import(
        "@/lib/domains/chat/videoThumbnail"
      );
      const thumb = await generateVideoThumbnail(originalFile);
      return thumb.blob;
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * UUID v4 생성 (Secure Context 불필요)
 */
function generateUUID(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export interface UseChatFileUploadOptions {
  roomId: string;
  userId: string;
}

export interface UseChatFileUploadReturn {
  uploadingFiles: UploadingAttachment[];
  addFiles: (files: File[]) => void;
  removeFile: (clientId: string) => void;
  retryUpload: (clientId: string) => void;
  clearFiles: () => void;
  isUploading: boolean;
  /** 사용자 스토리지 쿼터 (마운트 시 1회 + 업로드 완료 후 throttle 갱신) */
  quota: StorageQuotaInfo | null;
}

export function useChatFileUpload({
  roomId,
  userId,
}: UseChatFileUploadOptions): UseChatFileUploadReturn {
  const { showError } = useToast();
  const [uploadingFiles, setUploadingFiles] = useState<UploadingAttachment[]>([]);
  const { quota, refresh: refreshQuota } = useChatStorageQuota();

  // Preview URL 메모리 누수 방지: ref로 최신 상태 추적 + unmount 시 cleanup
  const uploadingFilesRef = useRef<UploadingAttachment[]>([]);
  uploadingFilesRef.current = uploadingFiles;

  useEffect(() => {
    return () => {
      // 컴포넌트 언마운트 시 모든 preview URL 해제
      for (const f of uploadingFilesRef.current) {
        if (f.previewUrl) URL.revokeObjectURL(f.previewUrl);
      }
    };
  }, []);

  // 업로드 진행 중 페이지 이탈 경고
  const isUploading = uploadingFiles.some(
    (f) => f.status === "uploading" || f.status === "pending"
  );
  useBeforeUnload(isUploading, "파일 업로드가 진행 중입니다. 나가시겠습니까?");

  // addFiles 동시 호출 직렬화 (race condition 방지)
  const addFilesLockRef = useRef<Promise<void>>(Promise.resolve());

  /** 단일 파일 업로드 처리 (병렬 실행용) */
  const uploadSingleFile = useCallback(
    async (file: File, clientId: string) => {
      try {
        // 이미지인 경우 리사이즈
        let uploadFile: File | Blob = file;
        let width: number | undefined;
        let height: number | undefined;

        if (isImageType(file.type)) {
          try {
            const { resizeImageIfNeeded } = await import("@/lib/domains/chat/imageResize");
            const resized = await resizeImageIfNeeded(file);
            uploadFile = resized.blob;
            width = resized.width;
            height = resized.height;
          } catch {
            // 리사이즈 실패 시 원본 사용
          }
        }

        // Supabase 세션에서 access_token 획득
        const supabase = createSupabaseBrowserClient();
        const { data: sessionData } = await supabase.auth.getSession();
        const session = sessionData.session;
        if (!session) throw new Error("인증 세션이 만료되었습니다. 새로고침해주세요.");
        const accessToken = session.access_token;

        const safeName = sanitizeFileName(file.name);
        const timestamp = Date.now();
        const storagePath = `${roomId}/${userId}/${timestamp}_${safeName}`;

        // AbortController 생성 + 상태에 저장
        const abortController = new AbortController();
        setUploadingFiles((prev) =>
          prev.map((f) =>
            f.clientId === clientId ? { ...f, abortController } : f
          )
        );

        const { uploadWithProgress } = await import("@/lib/domains/chat/uploadWithProgress");
        const { error: uploadError } = await uploadWithProgress({
          supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL!,
          accessToken,
          bucket: "chat-attachments",
          path: storagePath,
          file: uploadFile,
          onProgress: (progress) => {
            setUploadingFiles((prev) =>
              prev.map((f) =>
                f.clientId === clientId ? { ...f, progress } : f
              )
            );
          },
          signal: abortController.signal,
        });

        if (uploadError) throw uploadError;

        // 이미지/동영상 썸네일 생성 + 업로드 (비치명적)
        let thumbnailPath: string | null = null;
        const thumbBlob = await generateAttachmentThumbnail(file, uploadFile);
        if (thumbBlob) {
          const thumbPath = `${roomId}/${userId}/${timestamp}_thumb_${safeName}.webp`;
          const { error: thumbError } = await supabase.storage
            .from("chat-attachments")
            .upload(thumbPath, thumbBlob, { contentType: "image/webp" });
          if (!thumbError) {
            thumbnailPath = thumbPath;
          }
        }

        // Server Action으로 DB 레코드 등록
        const result = await registerChatAttachmentAction(
          roomId,
          storagePath,
          file.name,
          file.size,
          file.type,
          width,
          height,
          thumbnailPath
        );

        if (!result.success || !result.data) {
          throw new Error(`${file.name}: ${result.error ?? "첨부파일 등록 실패"}`);
        }

        setUploadingFiles((prev) =>
          prev.map((f) =>
            f.clientId === clientId
              ? { ...f, status: "done" as const, progress: 100, result: result.data, abortController: undefined }
              : f
          )
        );

        // 업로드 완료 후 쿼터 갱신 (throttle 내장)
        void refreshQuota();
      } catch (err) {
        // 사용자가 파일 제거로 취소한 경우 state 업데이트 불필요
        if (err instanceof Error && err.message === "업로드가 취소되었습니다.") return;

        console.error("[useChatFileUpload] 첨부파일 업로드 실패:", err);

        setUploadingFiles((prev) =>
          prev.map((f) =>
            f.clientId === clientId
              ? {
                  ...f,
                  status: "error" as const,
                  error: err instanceof Error ? err.message : `${file.name}: 업로드 실패`,
                  abortController: undefined,
                }
              : f
          )
        );
      }
    },
    [roomId, userId, refreshQuota]
  );

  const addFiles = useCallback(
    (files: File[]) => {
      // 직렬화: 이전 addFiles 완료 후 실행 (동시 호출 시 race condition 방지)
      const task = addFilesLockRef.current.then(async () => {
        // 현재 파일 수 기준으로 남은 슬롯 계산 (ref로 최신 상태 참조)
        const currentCount = uploadingFilesRef.current.length;
        const remaining = MAX_ATTACHMENTS_PER_MESSAGE - currentCount;
        if (remaining <= 0) {
          showError(`파일은 최대 ${MAX_ATTACHMENTS_PER_MESSAGE}개까지 첨부할 수 있습니다.`);
          return;
        }
        const limitedFiles = files.slice(0, remaining);

        // 업로드 전 쿼터 사전 체크
        const totalNewSize = limitedFiles.reduce((sum, f) => sum + f.size, 0);
        const quotaResult = await getChatStorageQuotaAction();
        if (quotaResult.success && quotaResult.data) {
          if (quotaResult.data.remainingBytes < totalNewSize) {
            const { formatStorageSize } = await import("@/lib/domains/chat/quota");
            showError(
              `스토리지 용량 부족: 남은 ${formatStorageSize(quotaResult.data.remainingBytes)}`
            );
            return;
          }
        }

        // 1단계: 검증 + 상태 일괄 등록 (동기)
        const validFiles: { file: File; clientId: string }[] = [];
        const newEntries: UploadingAttachment[] = [];

        for (const file of limitedFiles) {
          const validation = validateChatFile(file);
          if (!validation.valid) {
            showError(validation.error ?? "파일 검증 실패");
            continue;
          }

          const clientId = generateUUID();
          const previewUrl = isImageType(file.type) ? URL.createObjectURL(file) : "";
          validFiles.push({ file, clientId });
          newEntries.push({ clientId, file, previewUrl, progress: 0, status: "uploading" });
        }

        if (newEntries.length === 0) return;
        setUploadingFiles((prev) => [...prev, ...newEntries]);

        // 2단계: 모든 파일 병렬 업로드
        await Promise.allSettled(
          validFiles.map(({ file, clientId }) => uploadSingleFile(file, clientId))
        );
      });

      // lock 갱신 (에러 발생해도 다음 호출은 진행되도록)
      addFilesLockRef.current = task.catch(() => {});
    },
    [showError, uploadSingleFile]
  );

  /** 실패한 파일 업로드 재시도 */
  const retryUpload = useCallback(
    (clientId: string) => {
      const target = uploadingFilesRef.current.find(
        (f) => f.clientId === clientId && f.status === "error"
      );
      if (!target) return;

      // 상태 초기화
      setUploadingFiles((prev) =>
        prev.map((f) =>
          f.clientId === clientId
            ? { ...f, status: "uploading" as const, progress: 0, error: undefined }
            : f
        )
      );

      // 재업로드
      uploadSingleFile(target.file, clientId);
    },
    [uploadSingleFile]
  );

  const removeFile = useCallback(
    (clientId: string) => {
      setUploadingFiles((prev) => {
        const file = prev.find((f) => f.clientId === clientId);
        if (file?.previewUrl) URL.revokeObjectURL(file.previewUrl);
        // 진행 중인 업로드 취소
        if (file?.status === "uploading" && file.abortController) {
          file.abortController.abort();
        }
        // 업로드 완료된 파일이면 서버에서도 삭제
        if (file?.status === "done" && file.result) {
          deleteChatAttachmentAction(file.result.id).catch(() => {});
        }
        return prev.filter((f) => f.clientId !== clientId);
      });
    },
    []
  );

  const clearFiles = useCallback(() => setUploadingFiles([]), []);

  return {
    uploadingFiles,
    addFiles,
    removeFile,
    retryUpload,
    clearFiles,
    isUploading,
    quota,
  };
}

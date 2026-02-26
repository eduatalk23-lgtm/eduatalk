"use client";

/**
 * 클라이언트 사이드 이미지 리사이즈
 * 업로드 전 대용량 이미지를 줄여 대역폭 절약 + 업로드 속도 향상
 */

const MAX_DIMENSION = 2048;
const OUTPUT_QUALITY = 0.85;
const THUMBNAIL_MAX_DIMENSION = 300;
const THUMBNAIL_QUALITY = 0.6;

interface ResizeResult {
  blob: Blob;
  width: number;
  height: number;
}

/** 이미지 파일을 최대 크기로 리사이즈 (필요한 경우에만) */
export async function resizeImageIfNeeded(
  file: File,
  maxDimension: number = MAX_DIMENSION
): Promise<ResizeResult> {
  // HEIC는 먼저 변환
  const processedFile = await convertHeicIfNeeded(file);

  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(processedFile);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      const { width, height } = img;

      // 리사이즈 불필요하면 원본 반환
      if (width <= maxDimension && height <= maxDimension) {
        processedFile.arrayBuffer().then((buf) => {
          resolve({
            blob: new Blob([buf], { type: processedFile.type }),
            width,
            height,
          });
        });
        return;
      }

      // 비율 유지하며 축소
      const ratio = Math.min(maxDimension / width, maxDimension / height);
      const newWidth = Math.round(width * ratio);
      const newHeight = Math.round(height * ratio);

      const canvas = document.createElement("canvas");
      canvas.width = newWidth;
      canvas.height = newHeight;

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Canvas context를 생성할 수 없습니다."));
        return;
      }

      ctx.drawImage(img, 0, 0, newWidth, newHeight);

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error("이미지 변환에 실패했습니다."));
            return;
          }
          resolve({ blob, width: newWidth, height: newHeight });
        },
        "image/webp",
        OUTPUT_QUALITY
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("이미지를 불러올 수 없습니다."));
    };

    img.src = objectUrl;
  });
}

/** 채팅 목록용 작은 썸네일 생성 (300px, WebP 0.6) */
export async function generateThumbnail(
  source: File | Blob,
  maxDimension: number = THUMBNAIL_MAX_DIMENSION
): Promise<ResizeResult> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(source);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const { width, height } = img;

      const ratio = Math.min(maxDimension / width, maxDimension / height, 1);
      const newWidth = Math.round(width * ratio);
      const newHeight = Math.round(height * ratio);

      const canvas = document.createElement("canvas");
      canvas.width = newWidth;
      canvas.height = newHeight;

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Canvas context를 생성할 수 없습니다."));
        return;
      }

      ctx.drawImage(img, 0, 0, newWidth, newHeight);

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error("썸네일 생성에 실패했습니다."));
            return;
          }
          resolve({ blob, width: newWidth, height: newHeight });
        },
        "image/webp",
        THUMBNAIL_QUALITY
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("이미지를 불러올 수 없습니다."));
    };

    img.src = objectUrl;
  });
}

/** HEIC/HEIF 파일을 JPEG로 변환 (iOS 카메라 촬영 포맷) */
export async function convertHeicIfNeeded(file: File): Promise<File> {
  const isHeic =
    file.type === "image/heic" ||
    file.type === "image/heif" ||
    file.name.toLowerCase().endsWith(".heic") ||
    file.name.toLowerCase().endsWith(".heif");

  if (!isHeic) return file;

  try {
    const heic2any = (await import("heic2any")).default;
    const blob = await heic2any({
      blob: file,
      toType: "image/jpeg",
      quality: 0.9,
    });

    const result = Array.isArray(blob) ? blob[0] : blob;
    const newName = file.name.replace(/\.heic$/i, ".jpg").replace(/\.heif$/i, ".jpg");
    return new File([result], newName, { type: "image/jpeg" });
  } catch {
    // 변환 실패 시 원본 그대로 반환 (서버에서 처리 시도)
    return file;
  }
}

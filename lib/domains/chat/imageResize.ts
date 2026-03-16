"use client";

/**
 * 클라이언트 사이드 이미지 리사이즈
 * 업로드 전 대용량 이미지를 줄여 대역폭 절약 + 업로드 속도 향상
 *
 * Web Worker (OffscreenCanvas) 우선 사용 → 미지원 시 메인 스레드 fallback
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

// ============================================
// Worker 관리 (싱글턴, lazy init)
// ============================================

let resizeWorker: Worker | null = null;
let workerSupported: boolean | null = null;

function getWorkerSupported(): boolean {
  if (workerSupported !== null) return workerSupported;
  try {
    workerSupported =
      typeof Worker !== "undefined" &&
      typeof OffscreenCanvas !== "undefined";
  } catch {
    workerSupported = false;
  }
  return workerSupported;
}

function getResizeWorker(): Worker | null {
  if (!getWorkerSupported()) return null;
  if (resizeWorker) return resizeWorker;
  try {
    resizeWorker = new Worker(
      new URL("./imageResize.worker.ts", import.meta.url)
    );
    return resizeWorker;
  } catch {
    workerSupported = false;
    return null;
  }
}

/** Worker를 통한 리사이즈 */
function resizeInWorker(
  file: File | Blob,
  maxDimension: number,
  quality: number,
  outputType: string = "image/webp"
): Promise<ResizeResult> {
  return new Promise((resolve, reject) => {
    const worker = getResizeWorker();
    if (!worker) {
      reject(new Error("Worker 미지원"));
      return;
    }

    // crypto.randomUUID()는 HTTPS에서만 사용 가능, getRandomValues는 HTTP에서도 가능
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
    const id = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;

    const handler = (e: MessageEvent) => {
      if (e.data.id !== id) return;
      worker.removeEventListener("message", handler);
      worker.removeEventListener("error", errorHandler);

      if (e.data.type === "resize-result") {
        resolve({ blob: e.data.blob, width: e.data.width, height: e.data.height });
      } else {
        reject(new Error(e.data.error ?? "Worker 리사이즈 실패"));
      }
    };

    const errorHandler = () => {
      worker.removeEventListener("message", handler);
      worker.removeEventListener("error", errorHandler);
      // Worker 런타임 에러 시 싱글턴 정리 → 다음 호출에서 재생성 시도
      try { worker.terminate(); } catch { /* ignore */ }
      resizeWorker = null;
      reject(new Error("Worker 오류"));
    };

    worker.addEventListener("message", handler);
    worker.addEventListener("error", errorHandler);

    file.arrayBuffer().then((buffer) => {
      // 복사본 전달: Worker 실패 시 메인 스레드 fallback에서 원본 사용 가능
      const copy = buffer.slice(0);
      worker.postMessage(
        {
          type: "resize",
          id,
          imageData: copy,
          mimeType: file instanceof File ? file.type : "image/jpeg",
          maxDimension,
          quality,
          outputType,
        },
        [copy] // Transferable: 복사본만 전달
      );
    }).catch(reject);
  });
}

// ============================================
// 메인 스레드 fallback (기존 Canvas 방식)
// ============================================

function resizeOnMainThread(
  source: File | Blob,
  maxDimension: number,
  quality: number,
  outputType: string = "image/webp"
): Promise<ResizeResult> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(source);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const { width, height } = img;

      if (width <= maxDimension && height <= maxDimension) {
        source.arrayBuffer().then((buf) => {
          resolve({
            blob: new Blob([buf], { type: source instanceof File ? source.type : "image/jpeg" }),
            width,
            height,
          });
        });
        return;
      }

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
        outputType,
        quality
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("이미지를 불러올 수 없습니다."));
    };

    img.src = objectUrl;
  });
}

// ============================================
// 공개 API
// ============================================

/** 이미지 파일을 최대 크기로 리사이즈 (필요한 경우에만) */
export async function resizeImageIfNeeded(
  file: File,
  maxDimension: number = MAX_DIMENSION
): Promise<ResizeResult> {
  // HEIC는 메인 스레드에서 먼저 변환 (heic2any는 DOM 의존)
  const processedFile = await convertHeicIfNeeded(file);

  // Worker 우선 시도 → 실패 시 메인 스레드 fallback
  if (getWorkerSupported()) {
    try {
      return await resizeInWorker(processedFile, maxDimension, OUTPUT_QUALITY);
    } catch {
      // Worker 실패 시 메인 스레드로 fallback
    }
  }

  return resizeOnMainThread(processedFile, maxDimension, OUTPUT_QUALITY);
}

/** 채팅 목록용 작은 썸네일 생성 (300px, WebP 0.6) */
export async function generateThumbnail(
  source: File | Blob,
  maxDimension: number = THUMBNAIL_MAX_DIMENSION
): Promise<ResizeResult> {
  // Worker 우선 시도
  if (getWorkerSupported()) {
    try {
      return await resizeInWorker(source, maxDimension, THUMBNAIL_QUALITY);
    } catch {
      // Worker 실패 시 메인 스레드로 fallback
    }
  }

  return resizeOnMainThread(source, maxDimension, THUMBNAIL_QUALITY);
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

"use client";

/**
 * 클라이언트 사이드 동영상 썸네일 생성
 *
 * HTMLVideoElement 로 첫 프레임 추출 → Canvas → WebP Blob
 * Web Worker 미지원 (video decoding은 main thread 필수)
 *
 * 실패 시 호출 측에서 generic 아이콘으로 fallback (비치명적)
 */

const THUMBNAIL_MAX_DIMENSION = 300;
const THUMBNAIL_QUALITY = 0.7;
/** 첫 프레임이 비어있는 코덱 대비 — 0.1초 시점 캡처 */
const SEEK_TIME_SECONDS = 0.1;
const LOAD_TIMEOUT_MS = 10_000;

interface VideoThumbnailResult {
  blob: Blob;
  width: number;
  height: number;
}

/**
 * 동영상 파일에서 첫 프레임을 WebP 썸네일로 추출
 * @throws 디코딩/시킹 실패 또는 타임아웃
 */
export async function generateVideoThumbnail(
  file: File | Blob
): Promise<VideoThumbnailResult> {
  if (typeof document === "undefined") {
    throw new Error("동영상 썸네일은 브라우저 환경에서만 생성 가능");
  }

  const url = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.preload = "metadata";
  video.crossOrigin = "anonymous";
  video.src = url;

  try {
    // 1. 메타데이터 로드 + 시킹 완료 대기
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("동영상 로딩 타임아웃"));
      }, LOAD_TIMEOUT_MS);

      const cleanup = () => {
        clearTimeout(timeout);
        video.removeEventListener("loadeddata", onLoadedData);
        video.removeEventListener("seeked", onSeeked);
        video.removeEventListener("error", onError);
      };

      const onLoadedData = () => {
        // duration이 SEEK_TIME 보다 짧을 수 있음 — duration 한도로 cap
        const targetTime = Math.min(
          SEEK_TIME_SECONDS,
          Math.max(0, (video.duration || 0) - 0.01)
        );
        video.currentTime = targetTime;
      };

      const onSeeked = () => {
        cleanup();
        resolve();
      };

      const onError = () => {
        cleanup();
        reject(new Error("동영상 디코딩 실패"));
      };

      video.addEventListener("loadeddata", onLoadedData);
      video.addEventListener("seeked", onSeeked);
      video.addEventListener("error", onError);
    });

    // 2. 캔버스에 렌더링
    const sourceWidth = video.videoWidth;
    const sourceHeight = video.videoHeight;
    if (!sourceWidth || !sourceHeight) {
      throw new Error("동영상 해상도 정보 없음");
    }

    const ratio = Math.min(
      THUMBNAIL_MAX_DIMENSION / sourceWidth,
      THUMBNAIL_MAX_DIMENSION / sourceHeight,
      1
    );
    const targetWidth = Math.round(sourceWidth * ratio);
    const targetHeight = Math.round(sourceHeight * ratio);

    const canvas = document.createElement("canvas");
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D context 획득 실패");

    ctx.drawImage(video, 0, 0, targetWidth, targetHeight);

    // 3. WebP Blob 생성
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => {
          if (b) resolve(b);
          else reject(new Error("WebP 변환 실패"));
        },
        "image/webp",
        THUMBNAIL_QUALITY
      );
    });

    return { blob, width: targetWidth, height: targetHeight };
  } finally {
    URL.revokeObjectURL(url);
    video.src = "";
    video.load();
  }
}

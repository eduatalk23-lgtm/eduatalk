/**
 * Web Worker: 이미지 리사이즈 (OffscreenCanvas)
 *
 * 메인 스레드 차단 없이 이미지 리사이즈 수행.
 * OffscreenCanvas + createImageBitmap 사용.
 */

interface ResizeRequest {
  type: "resize";
  id: string;
  imageData: ArrayBuffer;
  mimeType: string;
  maxDimension: number;
  quality: number;
  outputType: string;
}

interface ResizeResponse {
  type: "resize-result";
  id: string;
  blob: Blob;
  width: number;
  height: number;
}

interface ErrorResponse {
  type: "resize-error";
  id: string;
  error: string;
}

self.onmessage = async (e: MessageEvent<ResizeRequest>) => {
  const { id, imageData, maxDimension, quality, outputType } = e.data;

  try {
    // ArrayBuffer → Blob → ImageBitmap (Worker 내에서 디코딩)
    const blob = new Blob([imageData]);
    const bitmap = await createImageBitmap(blob);

    const { width, height } = bitmap;

    // 리사이즈 불필요한 경우
    if (width <= maxDimension && height <= maxDimension) {
      const response: ResizeResponse = {
        type: "resize-result",
        id,
        blob,
        width,
        height,
      };
      self.postMessage(response);
      bitmap.close();
      return;
    }

    // 비율 유지하며 축소
    const ratio = Math.min(maxDimension / width, maxDimension / height);
    const newWidth = Math.round(width * ratio);
    const newHeight = Math.round(height * ratio);

    const canvas = new OffscreenCanvas(newWidth, newHeight);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("OffscreenCanvas context 생성 실패");

    ctx.drawImage(bitmap, 0, 0, newWidth, newHeight);
    bitmap.close();

    const resultBlob = await canvas.convertToBlob({
      type: outputType,
      quality,
    });

    const response: ResizeResponse = {
      type: "resize-result",
      id,
      blob: resultBlob,
      width: newWidth,
      height: newHeight,
    };
    self.postMessage(response);
  } catch (err) {
    const response: ErrorResponse = {
      type: "resize-error",
      id,
      error: err instanceof Error ? err.message : "이미지 리사이즈 실패",
    };
    self.postMessage(response);
  }
};

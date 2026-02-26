"use client";

/**
 * Supabase Storage에 XHR로 파일 업로드 (진행률 콜백 지원)
 *
 * supabase-js의 .upload()는 fetch 기반이라 upload progress를 지원하지 않음.
 * XHR의 xhr.upload.onprogress를 사용하여 실시간 진행률 제공.
 */

interface UploadWithProgressOptions {
  /** Supabase 프로젝트 URL (NEXT_PUBLIC_SUPABASE_URL) */
  supabaseUrl: string;
  /** Supabase auth access token */
  accessToken: string;
  /** Storage 버킷 이름 */
  bucket: string;
  /** 파일 저장 경로 */
  path: string;
  /** 업로드할 파일 */
  file: Blob | File;
  /** 진행률 콜백 (0~100) */
  onProgress: (progress: number) => void;
  /** 취소용 AbortSignal */
  signal?: AbortSignal;
}

interface UploadWithProgressResult {
  error: Error | null;
}

export function uploadWithProgress({
  supabaseUrl,
  accessToken,
  bucket,
  path,
  file,
  onProgress,
  signal,
}: UploadWithProgressOptions): Promise<UploadWithProgressResult> {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();

    // Supabase Storage REST API endpoint
    const url = `${supabaseUrl}/storage/v1/object/${bucket}/${path}`;

    // 진행률 추적
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        const percent = Math.round((e.loaded / e.total) * 100);
        onProgress(Math.min(percent, 99)); // 100%는 완료 시에만
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress(100);
        resolve({ error: null });
      } else {
        let message = `업로드 실패 (${xhr.status})`;
        try {
          const body = JSON.parse(xhr.responseText);
          if (body.message) message = body.message;
          if (body.error) message = body.error;
        } catch {
          // JSON 파싱 실패 시 기본 메시지 사용
        }
        resolve({ error: new Error(message) });
      }
    };

    xhr.onerror = () => {
      resolve({ error: new Error("네트워크 오류로 업로드에 실패했습니다.") });
    };

    xhr.ontimeout = () => {
      resolve({ error: new Error("업로드 시간이 초과되었습니다.") });
    };

    // AbortSignal 연결
    if (signal) {
      signal.addEventListener("abort", () => xhr.abort(), { once: true });
    }

    xhr.onabort = () => {
      resolve({ error: new Error("업로드가 취소되었습니다.") });
    };

    xhr.open("POST", url);
    xhr.timeout = 120_000; // 2분 타임아웃

    // Supabase Storage 필수 헤더
    xhr.setRequestHeader("Authorization", `Bearer ${accessToken}`);
    xhr.setRequestHeader("x-upsert", "false");

    // FormData 구성 (supabase-js 내부 형식과 동일)
    const formData = new FormData();
    formData.append("cacheControl", "3600");
    formData.append("", file);

    xhr.send(formData);
  });
}

/**
 * Client-side bulk download utility
 * Uses JSZip to create a ZIP archive from multiple files
 */

import JSZip from "jszip";
import type { DriveFile } from "./types";
import { sanitizeFileName } from "./validation";

export interface BulkDownloadProgress {
  total: number;
  completed: number;
  failed: number;
  currentFile?: string;
}

/**
 * Download multiple files as a ZIP archive.
 * Fetches each file via its signed URL, adds to ZIP, and triggers browser download.
 */
export async function downloadFilesAsZip(
  files: DriveFile[],
  signedUrls: Record<string, string>,
  zipFileName: string,
  onProgress?: (progress: BulkDownloadProgress) => void,
): Promise<{ success: boolean; downloaded: number; failed: number }> {
  const zip = new JSZip();
  let completed = 0;
  let failed = 0;

  // Track filenames to avoid duplicates in the ZIP
  const usedNames = new Map<string, number>();

  for (const file of files) {
    const url = signedUrls[file.id];
    if (!url) {
      failed++;
      completed++;
      onProgress?.({ total: files.length, completed, failed, currentFile: file.original_name });
      continue;
    }

    onProgress?.({ total: files.length, completed, failed, currentFile: file.original_name });

    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const blob = await response.blob();

      // Deduplicate filenames
      let name = sanitizeFileName(file.original_name);
      const count = usedNames.get(name) ?? 0;
      if (count > 0) {
        const dotIdx = name.lastIndexOf(".");
        const base = dotIdx > 0 ? name.slice(0, dotIdx) : name;
        const ext = dotIdx > 0 ? name.slice(dotIdx) : "";
        name = `${base} (${count})${ext}`;
      }
      usedNames.set(sanitizeFileName(file.original_name), count + 1);

      zip.file(name, blob);
      completed++;
    } catch {
      failed++;
      completed++;
    }

    onProgress?.({ total: files.length, completed, failed });
  }

  if (completed - failed === 0) {
    return { success: false, downloaded: 0, failed };
  }

  // Generate ZIP and trigger download
  const content = await zip.generateAsync({ type: "blob" });
  const url = URL.createObjectURL(content);
  const a = document.createElement("a");
  a.href = url;
  a.download = zipFileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);

  return { success: true, downloaded: completed - failed, failed };
}

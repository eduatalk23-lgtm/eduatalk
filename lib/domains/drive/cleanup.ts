/**
 * Drive File Cleanup Service
 * 만료된 드라이브/워크플로우 파일 자동 정리
 *
 * - 만료일(expires_at) 경과한 파일: Storage + DB 삭제
 * - 워크플로우 SUBMITTED 상태 파일은 expires_at이 미래로 설정되어 있으므로 건너뜀
 */

import * as repo from "./repository";
import * as storage from "./storage";

const BATCH_SIZE = 50;

interface DriveCleanupResult {
  success: boolean;
  expiredDeleted: number;
  storageDeletedCount: number;
  expiredDistributions: number;
  errors: string[];
}

export async function cleanupDriveFiles(): Promise<DriveCleanupResult> {
  const errors: string[] = [];
  let expiredDeleted = 0;
  let totalStorageDeleted = 0;
  let expiredDistributions = 0;

  try {
    // 1. Clean expired distribution rows
    let hasMoreDists = true;
    while (hasMoreDists) {
      const expired = await repo.findExpiredDistributions(BATCH_SIZE);
      if (expired.length === 0) {
        hasMoreDists = false;
        break;
      }
      for (const dist of expired) {
        await repo.deleteDistribution(dist.id);
        expiredDistributions++;
      }
      if (expired.length < BATCH_SIZE) hasMoreDists = false;
    }

    // 2. Clean expired files (includes orphaned distribution source files)
    let hasMore = true;
    while (hasMore) {
      const expired = await repo.findExpiredFiles(BATCH_SIZE);
      if (expired.length === 0) {
        hasMore = false;
        break;
      }

      // Storage 파일 삭제
      const storagePaths = expired.map((f) => f.storage_path);
      const storageOk = await storage.deleteFiles(storagePaths);
      if (!storageOk) {
        errors.push(`Storage delete failed for ${storagePaths.length} files`);
      } else {
        totalStorageDeleted += storagePaths.length;
      }

      // DB 레코드 삭제 (CASCADE로 file_contexts, file_distributions도 함께 삭제)
      const ids = expired.map((f) => f.id);
      await repo.deleteFilesByIds(ids);
      expiredDeleted += ids.length;

      if (expired.length < BATCH_SIZE) hasMore = false;
    }

    return {
      success: errors.length === 0,
      expiredDeleted,
      storageDeletedCount: totalStorageDeleted,
      expiredDistributions,
      errors,
    };
  } catch (err) {
    return {
      success: false,
      expiredDeleted,
      storageDeletedCount: totalStorageDeleted,
      expiredDistributions,
      errors: [
        ...errors,
        err instanceof Error ? err.message : String(err),
      ],
    };
  }
}

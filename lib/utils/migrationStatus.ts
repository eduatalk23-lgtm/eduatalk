/**
 * 마이그레이션 상태 확인 및 캐싱 유틸리티
 * 
 * 데이터베이스 컬럼 존재 여부를 확인하고 캐싱하여 불필요한 재시도를 방지합니다.
 */

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { logError } from "@/lib/errors/handler";

/**
 * 마이그레이션 상태 캐시
 * 컬럼 이름을 키로, 존재 여부를 값으로 저장 (TTL: 5분)
 */
const migrationStatusCache = new Map<
  string,
  { exists: boolean; timestamp: number }
>();

const CACHE_TTL = 5 * 60 * 1000; // 5분

/**
 * 캐시에서 컬럼 존재 여부 확인
 */
function getCachedStatus(columnName: string): boolean | null {
  const cached = migrationStatusCache.get(columnName);
  if (!cached) {
    return null;
  }

  // TTL 체크
  const now = Date.now();
  if (now - cached.timestamp > CACHE_TTL) {
    migrationStatusCache.delete(columnName);
    return null;
  }

  return cached.exists;
}

/**
 * 캐시에 컬럼 존재 여부 저장
 */
function setCachedStatus(columnName: string, exists: boolean): void {
  migrationStatusCache.set(columnName, {
    exists,
    timestamp: Date.now(),
  });
}

/**
 * 특정 테이블의 컬럼 존재 여부 확인
 * 
 * @param tableName 테이블 이름
 * @param columnName 컬럼 이름
 * @returns 컬럼이 존재하면 true, 없으면 false
 */
export async function checkColumnExists(
  tableName: string,
  columnName: string
): Promise<boolean> {
  // 캐시 확인
  const cached = getCachedStatus(`${tableName}.${columnName}`);
  if (cached !== null) {
    return cached;
  }

  const supabase = await createSupabaseServerClient();

  try {
    // 컬럼이 존재하는지 확인하기 위해 실제 쿼리 실행
    // 에러 코드 42703은 컬럼이 없을 때 발생
    const { error } = await supabase
      .from(tableName)
      .select(columnName)
      .limit(1);

    if (error && error.code === "42703") {
      // 컬럼이 없음
      setCachedStatus(`${tableName}.${columnName}`, false);
      return false;
    }

    // 컬럼이 있거나 다른 에러
    if (error) {
      // 다른 에러인 경우 로깅하지만 존재 여부는 알 수 없음
      // 일단 존재한다고 가정하고 캐시하지 않음
      if (process.env.NODE_ENV === "development") {
        logError(error, {
          function: "checkColumnExists",
          level: "warn",
          tableName,
          columnName,
        });
      }
      return true; // 안전하게 존재한다고 가정
    }

    // 에러가 없으면 컬럼이 존재함
    setCachedStatus(`${tableName}.${columnName}`, true);
    return true;
  } catch (error) {
    // 예상치 못한 에러
    logError(error, {
      function: "checkColumnExists",
      tableName,
      columnName,
    });
    return true; // 안전하게 존재한다고 가정
  }
}

/**
 * 여러 컬럼의 존재 여부를 한 번에 확인
 * 
 * @param tableName 테이블 이름
 * @param columnNames 컬럼 이름 배열
 * @returns 컬럼 이름을 키로, 존재 여부를 값으로 하는 Map
 */
export async function checkColumnsExist(
  tableName: string,
  columnNames: string[]
): Promise<Map<string, boolean>> {
  const results = new Map<string, boolean>();

  // 병렬로 확인
  const checks = columnNames.map(async (columnName) => {
    const exists = await checkColumnExists(tableName, columnName);
    results.set(columnName, exists);
  });

  await Promise.all(checks);

  return results;
}

/**
 * 캐시 초기화 (테스트용)
 */
export function clearMigrationStatusCache(): void {
  migrationStatusCache.clear();
}


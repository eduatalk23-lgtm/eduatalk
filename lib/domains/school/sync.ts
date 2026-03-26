/**
 * 대학 데이터 동기화 서비스
 *
 * data.go.kr API → universities / university_campuses 테이블 upsert
 * 관리자가 수동 트리거하거나, 연간 갱신 배치에서 호출.
 */

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  getAllUniversityCodes,
  getPubYears,
  type UniversityCode,
} from "@/lib/services/dataGoKrApi";
import { logActionDebug, logActionError } from "@/lib/logging/actionLogger";

const LOG_CTX = { domain: "school", action: "sync" };

// ============================================================
// 타입
// ============================================================

export type SyncResult = {
  success: boolean;
  error?: string;
  stats: {
    totalFromApi: number;
    inserted: number;
    updated: number;
    skipped: number;
    campusesInserted: number;
    campusesUpdated: number;
  };
  duration: number;
};

// ============================================================
// API 응답 → DB 행 변환
// ============================================================

/** 본분교구분코드 → campus_type 매핑 */
function campusTypeFromCode(clgcpDivCd: string): string {
  switch (clgcpDivCd) {
    case "1":
      return "본교";
    case "2":
      return "분교";
    default:
      return `분교${Number(clgcpDivCd) - 1}`;
  }
}

/** 학교구분(종류) → university_type */
function universityTypeFromName(schlDivNm: string): string {
  // "대학", "전문대학", "대학원", "대학원대학" 등 그대로 사용
  return schlDivNm;
}

// ============================================================
// 동기화 메인 로직
// ============================================================

/**
 * 대학 데이터 전체 동기화
 *
 * 1. 최신 공시년도 조회
 * 2. 전체 대학 코드 가져오기 (페이지네이션 자동)
 * 3. university_code 기준 upsert (universities + university_campuses)
 */
export async function syncUniversities(options?: {
  svyYr?: string;
  dryRun?: boolean;
}): Promise<SyncResult> {
  const startTime = Date.now();

  const stats = {
    totalFromApi: 0,
    inserted: 0,
    updated: 0,
    skipped: 0,
    campusesInserted: 0,
    campusesUpdated: 0,
  };

  try {
    const supabase = createSupabaseAdminClient();
    if (!supabase) {
      throw new Error("Admin client 초기화 실패");
    }

    // 1. 공시년도 결정
    let svyYr = options?.svyYr;
    if (!svyYr) {
      const years = await getPubYears();
      svyYr = years.sort().reverse()[0]; // 최신 연도
      logActionDebug(LOG_CTX, `최신 공시년도: ${svyYr}`);
    }

    // 2. 전체 대학 목록 조회 (API 응답에 코드명이 포함되어 있으므로 코드 매핑 불필요)
    const apiUniversities = await getAllUniversityCodes(svyYr);

    stats.totalFromApi = apiUniversities.length;
    logActionDebug(LOG_CTX, `API에서 ${stats.totalFromApi}개 대학 조회 완료`);

    if (options?.dryRun) {
      return {
        success: true,
        stats,
        duration: Date.now() - startTime,
      };
    }

    // 3. 기존 대학 코드 인덱싱 (university_code → id)
    const { data: existingUnivs } = await supabase
      .from("universities")
      .select("id, university_code");

    const existingMap = new Map<string, number>();
    for (const u of existingUnivs ?? []) {
      if (u.university_code) {
        existingMap.set(u.university_code, u.id as number);
      }
    }

    // 4. 기존 캠퍼스 인덱싱 (university_id + campus_type → id)
    const { data: existingCampuses } = await supabase
      .from("university_campuses")
      .select("id, university_id, campus_type");

    const campusMap = new Map<string, number>();
    for (const c of existingCampuses ?? []) {
      const key = `${c.university_id}_${c.campus_type ?? "본교"}`;
      campusMap.set(key, c.id as number);
    }

    // 5. 대학별 그룹화 (동일 schlKrnNm + 다른 본분교코드 = 같은 대학의 캠퍼스)
    // 하지만 API 응답에서는 각 행이 대학+본분교 조합이므로,
    // schlKrnNm 기준으로 그룹 → 본교를 universities에, 나머지를 campuses에
    const groupedByName = new Map<string, UniversityCode[]>();
    for (const item of apiUniversities) {
      const name = item.schlKrnNm;
      const group = groupedByName.get(name) ?? [];
      group.push(item);
      groupedByName.set(name, group);
    }

    // 6. Upsert 처리
    for (const [, items] of groupedByName) {
      // 본교 우선 정렬 (clgcpDivCd=1이 본교)
      items.sort((a, b) => Number(a.clgcpDivCd) - Number(b.clgcpDivCd));
      const primary = items[0];

      // -- universities 테이블 upsert --
      const universityRow = {
        university_code: primary.schlId,
        name_kor: primary.schlKrnNm,
        establishment_type: primary.estbDivNm || null,
        university_type: universityTypeFromName(primary.schlDivNm) || null,
      };

      const existingId = existingMap.get(primary.schlId);

      let universityId: number;

      if (existingId) {
        // 업데이트
        const { error } = await supabase
          .from("universities")
          .update(universityRow)
          .eq("id", existingId);

        if (error) {
          logActionError(LOG_CTX, `대학 업데이트 실패: ${primary.schlKrnNm}`, { error });
          stats.skipped++;
          continue;
        }
        universityId = existingId;
        stats.updated++;
      } else {
        // 신규 삽입
        const { data, error } = await supabase
          .from("universities")
          .insert(universityRow)
          .select("id")
          .single();

        if (error || !data) {
          logActionError(LOG_CTX, `대학 삽입 실패: ${primary.schlKrnNm}`, { error });
          stats.skipped++;
          continue;
        }
        universityId = data.id as number;
        stats.inserted++;
      }

      // -- university_campuses 테이블 upsert --
      for (const item of items) {
        const campusType = campusTypeFromCode(item.clgcpDivCd);
        const campusRow = {
          university_id: universityId,
          campus_type: campusType,
          campus_name: item.schlFullNm || `${item.schlKrnNm} _ ${item.clgcpDivNm}`,
          region: item.znNm || null,
          campus_status: "기존",
        };

        const campusKey = `${universityId}_${campusType}`;
        const existingCampusId = campusMap.get(campusKey);

        if (existingCampusId) {
          const { error } = await supabase
            .from("university_campuses")
            .update(campusRow)
            .eq("id", existingCampusId);

          if (error) {
            logActionError(LOG_CTX, `캠퍼스 업데이트 실패: ${item.schlFullNm}`, { error });
          } else {
            stats.campusesUpdated++;
          }
        } else {
          const { error } = await supabase
            .from("university_campuses")
            .insert(campusRow);

          if (error) {
            logActionError(LOG_CTX, `캠퍼스 삽입 실패: ${item.schlFullNm}`, { error });
          } else {
            stats.campusesInserted++;
          }
        }
      }
    }

    logActionDebug(LOG_CTX, "동기화 완료", { stats });

    return {
      success: true,
      stats,
      duration: Date.now() - startTime,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logActionError(LOG_CTX, `동기화 실패: ${message}`);

    return {
      success: false,
      error: message,
      stats,
      duration: Date.now() - startTime,
    };
  }
}

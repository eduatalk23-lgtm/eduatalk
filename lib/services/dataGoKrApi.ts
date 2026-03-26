/**
 * 공공데이터포털 (data.go.kr) API 클라이언트
 *
 * 대학알리미 대학공시정보 (BasicInformationService) API 래퍼
 * API 문서: OpenAPI활용가이드_25.한국대학교육협의회(대학공시정보)_v2.00
 *
 * @see https://www.data.go.kr/data/15037507/openapi.do
 */

import { XMLParser } from "fast-xml-parser";

// ============================================================
// 상수
// ============================================================

const API_BASE =
  "http://openapi.academyinfo.go.kr/openapi/service/rest";

const SERVICES = {
  BASIC_INFO: "BasicInformationService",
  STUDENT: "StudentService",
} as const;

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  // 숫자 자동 변환 — 코드 값이 "01" 등 leading zero가 있으므로 비활성화
  parseTagValue: false,
});

// ============================================================
// 타입: API 공통
// ============================================================

type ApiHeader = {
  resultCode: string;
  resultMsg: string;
};

type ApiBody<T> = {
  items: { item: T | T[] } | "" | undefined;
  numOfRows: string;
  pageNo: string;
  totalCount: string;
};

type ApiResponse<T> = {
  response: {
    header: ApiHeader;
    body: ApiBody<T>;
  };
};

/** 페이지네이션 파라미터 */
type PaginationParams = {
  numOfRows?: number;
  pageNo?: number;
};

/** API 호출 결과 (페이지네이션 포함) */
export type DataGoKrResult<T> = {
  items: T[];
  totalCount: number;
  pageNo: number;
  numOfRows: number;
};

// ============================================================
// 타입: BasicInformationService 응답
// ============================================================

/** 공시년도 */
export type PubYear = {
  yearVal: string;
};

/** 대학 검색 결과 */
export type UniversitySearchItem = {
  svyYr: string;
  schlId: string;
  schlKrnNm: string;
  clgcpDivCd: string;
  clgcpDivNm: string;
  schlDivCd: string;
  schlDivNm: string;
  schlFullNm: string;
  znCd: string;
  znNm: string;
  estbDivCd: string;
  estbDivNm: string;
  schlKndCd?: string;
  schlKndNm?: string;
};

/** 대학 코드 */
export type UniversityCode = {
  svyYr: string;
  schlId: string;
  schlKrnNm: string;
  clgcpDivCd: string;
  clgcpDivNm: string;
  schlDivCd: string;
  schlDivNm: string;
  schlFullNm: string;
  znCd: string;
  znNm: string;
  estbDivCd: string;
  estbDivNm: string;
  schlKndCd?: string;
  schlKndNm?: string;
};

/** 코드 항목 (설립유형/지역/학교유형/학교종류 공통) */
export type CodeItem = {
  cdid: string;
  cdnm: string;
  rmk?: string; // 주요지표 코드에만 존재 (단위)
};

// ============================================================
// 타입: 대학 검색 파라미터
// ============================================================

export type UniversitySearchParams = PaginationParams & {
  svyYr: string;
  schlId?: string;
  schlKrnNm?: string;
  clgcpDivCd?: string;
  schlDivCd?: string;
  schlKndCd?: string;
  znCd?: string;
  estbDivCd?: string;
};

export type UniversityCodeParams = PaginationParams & {
  svyYr: string;
  schlId?: string;
  schlKrnNm?: string;
  clgcpDivCd?: string;
  schlDivCd?: string;
  schlKndCd?: string;
  znCd?: string;
  estbDivCd?: string;
};

export type CodeSearchParams = PaginationParams & {
  cdid?: string;
  cdnm?: string;
};

// ============================================================
// 에러
// ============================================================

const ERROR_CODES: Record<string, string> = {
  "1": "애플리케이션 에러",
  "4": "HTTP 에러",
  "12": "해당 오픈 API 서비스가 없거나 폐기됨",
  "20": "서비스 접근 거부",
  "22": "서비스 요청 제한 초과",
  "30": "등록되지 않은 서비스키",
  "31": "서비스키 사용 기간 만료",
  "32": "등록되지 않은 IP",
  "99": "기타 에러",
};

export class DataGoKrApiError extends Error {
  constructor(
    public readonly resultCode: string,
    public readonly resultMsg: string,
  ) {
    const desc = ERROR_CODES[resultCode] ?? "알 수 없는 에러";
    super(`[data.go.kr] ${desc} (code=${resultCode}): ${resultMsg}`);
    this.name = "DataGoKrApiError";
  }
}

// ============================================================
// 내부 헬퍼
// ============================================================

function getApiKey(): string {
  const key = process.env.DATA_GO_KR_API_KEY;
  if (!key) {
    throw new Error(
      "[data.go.kr] DATA_GO_KR_API_KEY 환경변수가 설정되지 않았습니다.",
    );
  }
  return key;
}

function buildUrl(
  service: string,
  operation: string,
  params: Record<string, string | number | undefined>,
): string {
  const url = new URL(`${API_BASE}/${service}/${operation}`);
  url.searchParams.set("serviceKey", getApiKey());

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") {
      url.searchParams.set(key, String(value));
    }
  }

  return url.toString();
}

async function fetchApi<T>(
  service: string,
  operation: string,
  params: Record<string, string | number | undefined> = {},
): Promise<DataGoKrResult<T>> {
  const url = buildUrl(service, operation, params);

  const response = await fetch(url, {
    method: "GET",
    headers: { Accept: "application/xml" },
    // Next.js fetch cache — 1시간 캐시 (코드 데이터는 자주 변하지 않음)
    next: { revalidate: 3600 },
  });

  if (!response.ok) {
    throw new Error(
      `[data.go.kr] HTTP ${response.status}: ${response.statusText}`,
    );
  }

  const xmlText = await response.text();
  const parsed = xmlParser.parse(xmlText) as ApiResponse<T>;
  const header = parsed.response.header;

  // resultCode "00" = 정상
  if (header.resultCode !== "00") {
    throw new DataGoKrApiError(header.resultCode, header.resultMsg);
  }

  const body = parsed.response.body;

  // 빈 결과 (XML 파서가 빈 태그를 "" 또는 undefined로 반환)
  const rawItems = body.items && typeof body.items === "object"
    ? body.items.item
    : null;

  if (!rawItems) {
    return {
      items: [],
      totalCount: 0,
      pageNo: Number(body.pageNo) || 1,
      numOfRows: Number(body.numOfRows) || 10,
    };
  }

  // 단건 → 배열 정규화
  const items: T[] = Array.isArray(rawItems) ? rawItems : [rawItems];

  return {
    items,
    totalCount: Number(body.totalCount) || items.length,
    pageNo: Number(body.pageNo) || 1,
    numOfRows: Number(body.numOfRows) || 10,
  };
}

/**
 * 전체 페이지를 순회하며 모든 아이템 수집
 */
async function fetchAllPages<T>(
  service: string,
  operation: string,
  params: Record<string, string | number | undefined> = {},
  pageSize = 500,
): Promise<T[]> {
  const allItems: T[] = [];
  let pageNo = 1;
  let totalCount = Infinity;

  while (allItems.length < totalCount) {
    const result = await fetchApi<T>(service, operation, {
      ...params,
      numOfRows: pageSize,
      pageNo,
    });

    totalCount = result.totalCount;
    allItems.push(...result.items);

    if (result.items.length < pageSize) break;
    pageNo++;
  }

  return allItems;
}

// ============================================================
// 공개 API: BasicInformationService
// ============================================================

/**
 * 공시년도 목록 조회
 */
export async function getPubYears(): Promise<string[]> {
  const result = await fetchApi<PubYear>(
    SERVICES.BASIC_INFO,
    "getComparisonPubYear",
  );
  return result.items.map((item) => item.yearVal);
}

/**
 * 대학 검색 목록 (대학비교통계)
 */
export async function searchUniversities(
  params: UniversitySearchParams,
): Promise<DataGoKrResult<UniversitySearchItem>> {
  return fetchApi<UniversitySearchItem>(
    SERVICES.BASIC_INFO,
    "getComparisonUniversitySearchList",
    params as Record<string, string | number | undefined>,
  );
}

/**
 * 대학 전체 목록 조회 (전 페이지 순회)
 */
export async function getAllUniversities(
  svyYr: string,
): Promise<UniversitySearchItem[]> {
  return fetchAllPages<UniversitySearchItem>(
    SERVICES.BASIC_INFO,
    "getComparisonUniversitySearchList",
    { svyYr },
  );
}

/**
 * 대학 코드 조회
 */
export async function getUniversityCodes(
  params: UniversityCodeParams,
): Promise<DataGoKrResult<UniversityCode>> {
  return fetchApi<UniversityCode>(
    SERVICES.BASIC_INFO,
    "getUniversityCode",
    params as Record<string, string | number | undefined>,
  );
}

/**
 * 전체 대학 코드 조회 (전 페이지 순회)
 */
export async function getAllUniversityCodes(
  svyYr: string,
): Promise<UniversityCode[]> {
  return fetchAllPages<UniversityCode>(
    SERVICES.BASIC_INFO,
    "getUniversityCode",
    { svyYr },
  );
}

/**
 * 설립유형별 코드 조회 (국립/사립 등)
 */
export async function getFoundationCodes(
  params?: CodeSearchParams,
): Promise<CodeItem[]> {
  const result = await fetchApi<CodeItem>(
    SERVICES.BASIC_INFO,
    "getCodeByFound",
    (params ?? {}) as Record<string, string | number | undefined>,
  );
  return result.items;
}

/**
 * 지역별 코드 조회
 */
export async function getRegionCodes(
  params?: CodeSearchParams,
): Promise<CodeItem[]> {
  const result = await fetchApi<CodeItem>(
    SERVICES.BASIC_INFO,
    "getCodeByRegion",
    (params ?? {}) as Record<string, string | number | undefined>,
  );
  return result.items;
}

/**
 * 학교유형별 코드 조회 (대학/전문대/대학원 등)
 */
export async function getSchoolTypeCodes(
  params?: CodeSearchParams,
): Promise<CodeItem[]> {
  const result = await fetchApi<CodeItem>(
    SERVICES.BASIC_INFO,
    "getCodeByType",
    (params ?? {}) as Record<string, string | number | undefined>,
  );
  return result.items;
}

/**
 * 학교종류별 코드 조회
 */
export async function getSchoolKindCodes(
  params?: CodeSearchParams,
): Promise<CodeItem[]> {
  const result = await fetchApi<CodeItem>(
    SERVICES.BASIC_INFO,
    "getCodeByKind",
    (params ?? {}) as Record<string, string | number | undefined>,
  );
  return result.items;
}

/**
 * 주요지표 코드 조회
 */
export async function getKeyIndicatorCodes(
  params?: CodeSearchParams,
): Promise<CodeItem[]> {
  const result = await fetchApi<CodeItem>(
    SERVICES.BASIC_INFO,
    "getKeyIndicatorCode",
    (params ?? {}) as Record<string, string | number | undefined>,
  );
  return result.items;
}

// ============================================================
// 유틸: 연결 테스트
// ============================================================

/**
 * API 연결 테스트 — 공시년도 조회로 키 유효성 확인
 */
export async function testConnection(): Promise<{
  success: boolean;
  message: string;
  years?: string[];
}> {
  try {
    const years = await getPubYears();
    return {
      success: true,
      message: `API 연결 성공 — ${years.length}개 공시년도 확인`,
      years,
    };
  } catch (error) {
    if (error instanceof DataGoKrApiError) {
      return { success: false, message: error.message };
    }
    return {
      success: false,
      message: `연결 실패: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

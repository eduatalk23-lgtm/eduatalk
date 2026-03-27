/**
 * 공공데이터포털 (data.go.kr) API 클라이언트
 *
 * 대학알리미 대학공시정보 API 래퍼
 * - BasicInformationService: 대학 기본 정보 (15037507)
 * - SchoolMajorInfoService: 대학별 학과정보 (15116892)
 *
 * @see https://www.data.go.kr/data/15037507/openapi.do
 * @see https://www.data.go.kr/data/15116892/openapi.do
 */

import { XMLParser } from "fast-xml-parser";

// ============================================================
// 상수
// ============================================================

const API_BASE =
  "http://openapi.academyinfo.go.kr/openapi/service/rest";

const SERVICES = {
  BASIC_INFO: "BasicInformationService",
  SCHOOL_MAJOR: "SchoolMajorInfoService",
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
// 타입: SchoolMajorInfoService 응답
// ============================================================

/** 학과정보 */
export type SchoolMajorInfo = {
  svyYr: string;
  schlNm: string; // 대학명
  schlKndNm: string; // "대학교" | "전문대학" 등
  korMjrNm: string; // 학과명 (한글)
  kediMjrId: string; // KEDI 학과 ID
  stdClftMjrId: string; // 표준분류 학과 ID
  clgNm: string; // 단과대명
  onsfSrsClftNm: string; // 계열명 (인문·사회계열, 자연계열 등)
  dghtDivNm: string; // 주/야간 구분
  lsnTrmNm: string; // 수업연한 ("4년" 등)
  pbnfDgriCrseDivNm: string; // 학위과정 ("학사" 등)
  schlMjrCharNm: string; // 학과 특성 ("일반과정" | "계약학과" 등)
  schlMjrStatNm: string; // 학과 상태 ("운영" | "폐과" 등)
  edcCrseLtrCtnt: string; // 교육과정 ("|"로 구분된 과목 목록)
  pwayEmplLtrCtnt: string; // 진로/취업 경로 ("|"로 구분)
  mjrAreaCd: string; // 지역 코드
  mjrAreaNm: string; // 지역명
  mjrAreaSignguCd: string; // 시군구 코드
  mjrAreaSignguNm: string; // 시군구명
  eschlPscpNum: string; // 재학생 수
  grdtNum: string; // 졸업생 수
  mjrUpdtDtm: string; // 학과 정보 수정일
  lstUpdtDtm: string; // 최종 업데이트일
};

/** 학과정보 검색 파라미터 */
export type SchoolMajorSearchParams = PaginationParams & {
  svyYr: string;
  schlId?: string;
  schlKrnNm?: string;
};

// ============================================================
// 공개 API: SchoolMajorInfoService
// ============================================================

/**
 * 대학별 학과정보 조회
 */
export async function getSchoolMajorInfo(
  params: SchoolMajorSearchParams,
): Promise<DataGoKrResult<SchoolMajorInfo>> {
  return fetchApi<SchoolMajorInfo>(
    SERVICES.SCHOOL_MAJOR,
    "getSchoolMajorInfo",
    params as Record<string, string | number | undefined>,
  );
}

/**
 * 대학별 전체 학과정보 조회 (전 페이지 순회)
 */
export async function getAllSchoolMajors(
  svyYr: string,
  schlKrnNm: string,
): Promise<SchoolMajorInfo[]> {
  return fetchAllPages<SchoolMajorInfo>(
    SERVICES.SCHOOL_MAJOR,
    "getSchoolMajorInfo",
    { svyYr, schlKrnNm },
  );
}

/**
 * 학과 교육과정 파싱 ("|"로 구분된 과목 목록 → 배열)
 */
export function parseCurriculum(edcCrseLtrCtnt: string): string[] {
  if (!edcCrseLtrCtnt) return [];
  return edcCrseLtrCtnt
    .split(/[|？]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * 진로/취업 경로 파싱 ("|"로 구분 → 배열)
 */
export function parseCareerPaths(pwayEmplLtrCtnt: string): string[] {
  if (!pwayEmplLtrCtnt) return [];
  return pwayEmplLtrCtnt
    .split("|")
    .map((s) => s.trim())
    .filter(Boolean);
}

// ============================================================
// 타입: 전국대학별입학정원정보 (tn_pubr_public_univ_mtcltn_api)
// ============================================================

const ADMISSION_QUOTA_BASE =
  "http://api.data.go.kr/openapi/tn_pubr_public_univ_mtcltn_api";

/** 입학정원 정보 */
export type UniversityAdmissionQuota = {
  crtrYr: string; // 기준년도
  schlSeNm: string; // 학교구분 ("대학교" | "전문대학" 등)
  fndnSeNm: string; // 설립구분 ("국립" | "사립" 등)
  ctpvCd: string; // 시도 코드
  ctpvNm: string; // 시도명
  schlNm: string; // 대학명
  mainBranSchlSeNm: string; // 본분교 ("본교" | "캠퍼스" 등)
  mtcltnCnt: string; // 입학정원 합계
  acayAfilMtcltnCnt: string; // 인문계열 정원
  soctyAfilMtcltnCnt: string; // 사회계열 정원
  eduAfilMtcltnCnt: string; // 교육계열 정원
  engrAfilMtcltnCnt: string; // 공학계열 정원
  scienAfilMtcltnCnt: string; // 자연계열 정원
  mdsnAfilMtcltnCnt: string; // 의약계열 정원
  artaphyAfilMtcltnCnt: string; // 예체능계열 정원
  crtrYmd: string; // 기준일자
  insttCode: string; // 제공기관 코드
  insttNm: string; // 제공기관명
};

/** 입학정원 검색 파라미터 */
export type AdmissionQuotaSearchParams = PaginationParams & {
  crtrYr?: string; // 기준년도
  schlSeNm?: string; // 학교구분
  fndnSeNm?: string; // 설립구분
  ctpvNm?: string; // 시도명
  schlNm?: string; // 대학명
};

// ============================================================
// 공개 API: 전국대학별입학정원정보
// ============================================================

/**
 * 입학정원 정보 조회
 * 엔드포인트가 다른 패턴 (api.data.go.kr) — JSON 지원
 */
export async function getAdmissionQuotas(
  params?: AdmissionQuotaSearchParams,
): Promise<DataGoKrResult<UniversityAdmissionQuota>> {
  const url = new URL(ADMISSION_QUOTA_BASE);
  url.searchParams.set("serviceKey", getApiKey());
  url.searchParams.set("type", "json");

  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== "") {
        url.searchParams.set(key, String(value));
      }
    }
  }

  if (!params?.numOfRows) url.searchParams.set("numOfRows", "100");
  if (!params?.pageNo) url.searchParams.set("pageNo", "1");

  const response = await fetch(url.toString(), {
    method: "GET",
    next: { revalidate: 3600 },
  });

  if (!response.ok) {
    throw new Error(
      `[data.go.kr] HTTP ${response.status}: ${response.statusText}`,
    );
  }

  const json = (await response.json()) as {
    response: {
      header: { resultCode: string; resultMsg: string };
      body: {
        items: UniversityAdmissionQuota[];
        totalCount: string;
        numOfRows: string;
        pageNo: string;
      };
    };
  };

  const header = json.response.header;
  if (header.resultCode !== "00") {
    throw new DataGoKrApiError(header.resultCode, header.resultMsg);
  }

  const body = json.response.body;
  const items = body.items ?? [];

  return {
    items: Array.isArray(items) ? items : [items],
    totalCount: Number(body.totalCount) || 0,
    pageNo: Number(body.pageNo) || 1,
    numOfRows: Number(body.numOfRows) || 100,
  };
}

/**
 * 전체 입학정원 조회 (전 페이지 순회)
 */
export async function getAllAdmissionQuotas(
  crtrYr?: string,
): Promise<UniversityAdmissionQuota[]> {
  const allItems: UniversityAdmissionQuota[] = [];
  let pageNo = 1;
  const pageSize = 500;
  let totalCount = Infinity;

  while (allItems.length < totalCount) {
    const result = await getAdmissionQuotas({
      crtrYr,
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

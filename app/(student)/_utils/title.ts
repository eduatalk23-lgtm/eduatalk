// 페이지 Title 매핑
const TITLE_MAP: Record<string, string> = {
  "/dashboard": "대시보드",
  "/contents": "학습 콘텐츠",
  "/contents/books": "책",
  "/contents/books/new": "책 추가",
  "/contents/lectures": "강의",
  "/contents/lectures/new": "강의 추가",
  "/plan": "학습 계획",
  "/scores": "성적",
  "/scores/school": "내신 성적",
  "/scores/mock": "모의고사 성적",
  "/analysis": "학습 분석",
  "/today": "오늘의 학습",
};

/**
 * URL 경로를 기반으로 페이지 제목을 반환합니다.
 * @param pathname - 현재 경로
 * @returns 페이지 제목
 */
export function getPageTitle(pathname: string): string {
  // 정확한 매칭 시도
  if (TITLE_MAP[pathname]) {
    return TITLE_MAP[pathname];
  }

  // 동적 경로 처리 (예: /plan/[id], /contents/books/[id])
  const segments = pathname.split("/").filter(Boolean);

  // /plan/[id] -> "플랜 상세"
  if (segments[0] === "plan" && segments.length === 2 && segments[1] !== "new" && segments[1] !== "edit") {
    return "플랜 상세";
  }

  // /plan/[id]/edit -> "플랜 수정"
  if (segments[0] === "plan" && segments.length === 3 && segments[2] === "edit") {
    return "플랜 수정";
  }

  // /plan/[id]/progress -> "진행률"
  if (segments[0] === "plan" && segments.length === 3 && segments[2] === "progress") {
    return "진행률";
  }


  // /contents/books/[id] -> "책 상세"
  if (segments[0] === "contents" && segments[1] === "books" && segments.length === 3 && segments[2] !== "new") {
    return "책 상세";
  }

  // /contents/books/[id]/edit -> "책 수정"
  if (segments[0] === "contents" && segments[1] === "books" && segments.length === 4 && segments[3] === "edit") {
    return "책 수정";
  }

  // /contents/lectures/[id] -> "강의 상세"
  if (segments[0] === "contents" && segments[1] === "lectures" && segments.length === 3 && segments[2] !== "new") {
    return "강의 상세";
  }

  // /contents/lectures/[id]/edit -> "강의 수정"
  if (segments[0] === "contents" && segments[1] === "lectures" && segments.length === 4 && segments[3] === "edit") {
    return "강의 수정";
  }

  // /scores/school/... -> "내신 성적"
  if (segments[0] === "scores" && segments[1] === "school") {
    return "내신 성적";
  }

  // /scores/mock/... -> "모의고사 성적"
  if (segments[0] === "scores" && segments[1] === "mock") {
    return "모의고사 성적";
  }


  // 기본값: 첫 번째 세그먼트 기반
  if (segments.length > 0) {
    const firstSegment = segments[0];
    const labelMap: Record<string, string> = {
      dashboard: "대시보드",
      contents: "학습 콘텐츠",
      plan: "학습 계획",
      scores: "성적",
      analysis: "학습 분석",
      today: "오늘의 학습",
    };
    return labelMap[firstSegment] || "페이지";
  }

  return "페이지";
}

/**
 * 현재 경로가 섹션 루트인지 확인합니다.
 * 섹션 루트에서는 Back 버튼을 숨깁니다.
 */
export function isSectionRoot(pathname: string): boolean {
  const rootPaths = [
    "/dashboard",
    "/contents",
    "/plan",
    "/scores",
    "/analysis",
    "/today",
    "/scheduler",
    "/blocks",
    "/reports",
  ];

  return rootPaths.includes(pathname);
}


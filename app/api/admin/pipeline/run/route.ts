import { NextResponse } from "next/server";

/**
 * @deprecated 레거시 파이프라인 실행 API.
 * Grade/Synthesis 파이프라인으로 전환 완료. 이 엔드포인트는 지원 중단됨.
 */
export async function POST() {
  return NextResponse.json(
    { error: "레거시 파이프라인은 지원 중단되었습니다. Grade/Synthesis 파이프라인을 사용하세요." },
    { status: 410 }, // Gone
  );
}

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { generateWeeklyReportPdf } from "@/lib/pdf/generateWeeklyReportPdf";
import { getWeekRange } from "@/lib/date/weekRange";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }

    // 주 파라미터 파싱 (YYYY-MM-DD 형식, 해당 날짜가 속한 주)
    const searchParams = request.nextUrl.searchParams;
    const weekParam = searchParams.get("week");

    let weekStart: Date;
    let weekEnd: Date;

    if (weekParam) {
      const weekDate = new Date(weekParam);
      if (isNaN(weekDate.getTime())) {
        return NextResponse.json({ error: "잘못된 날짜 형식입니다." }, { status: 400 });
      }
      const range = getWeekRange(weekDate);
      weekStart = range.weekStart;
      weekEnd = range.weekEnd;
    } else {
      // 기본값: 이번 주
      const range = getWeekRange();
      weekStart = range.weekStart;
      weekEnd = range.weekEnd;
    }

    // PDF 생성
    const pdfBuffer = await generateWeeklyReportPdf(supabase, user.id, {
      start: weekStart,
      end: weekEnd,
    });

    // 파일명 생성
    const startDateStr = weekStart.toISOString().slice(0, 10);
    const endDateStr = weekEnd.toISOString().slice(0, 10);
    const filename = `주간리포트_${startDateStr}_${endDateStr}.pdf`;

    // 응답 반환
    return new NextResponse(pdfBuffer as unknown as BodyInit, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${encodeURIComponent(filename)}"`,
      },
    });
  } catch (error) {
    console.error("[report/weekly/pdf] PDF 생성 실패", error);
    return NextResponse.json(
      { error: "리포트 생성 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요." },
      { status: 500 }
    );
  }
}


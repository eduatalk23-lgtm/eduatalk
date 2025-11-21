import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { generateMonthlyReportPdf } from "@/lib/pdf/generateWeeklyReportPdf";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }

    // 월 파라미터 파싱 (YYYY-MM 형식)
    const searchParams = request.nextUrl.searchParams;
    const monthParam = searchParams.get("month");

    let monthStart: Date;
    let monthEnd: Date;

    if (monthParam) {
      const [year, month] = monthParam.split("-").map(Number);
      if (!year || !month || month < 1 || month > 12) {
        return NextResponse.json({ error: "잘못된 월 형식입니다." }, { status: 400 });
      }
      monthStart = new Date(year, month - 1, 1);
      monthStart.setHours(0, 0, 0, 0);
      monthEnd = new Date(year, month, 0);
      monthEnd.setHours(23, 59, 59, 999);
    } else {
      // 기본값: 이번 달
      const today = new Date();
      monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
      monthStart.setHours(0, 0, 0, 0);
      monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      monthEnd.setHours(23, 59, 59, 999);
    }

    // PDF 생성
    const pdfBuffer = await generateMonthlyReportPdf(supabase, user.id, {
      start: monthStart,
      end: monthEnd,
    });

    // 파일명 생성
    const year = monthStart.getFullYear();
    const month = monthStart.getMonth() + 1;
    const filename = `월간리포트_${year}년${month}월.pdf`;

    // 응답 반환
    return new NextResponse(pdfBuffer as unknown as BodyInit, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${encodeURIComponent(filename)}"`,
      },
    });
  } catch (error) {
    console.error("[report/monthly/pdf] PDF 생성 실패", error);
    return NextResponse.json(
      { error: "리포트 생성 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요." },
      { status: 500 }
    );
  }
}


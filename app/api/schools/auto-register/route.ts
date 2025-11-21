import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * 학교 자동 등록 API
 * POST /api/schools/auto-register
 * 학교 선택 시 DB에 없으면 자동으로 등록
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, type, region } = body;

    if (!name || !type) {
      return NextResponse.json(
        { error: "학교명과 타입은 필수입니다." },
        { status: 400 }
      );
    }

    if (!["중학교", "고등학교", "대학교"].includes(type)) {
      return NextResponse.json(
        { error: "올바른 학교 타입을 선택하세요." },
        { status: 400 }
      );
    }

    const supabase = await createSupabaseServerClient();

    // 중복 확인
    const { data: existing } = await supabase
      .from("schools")
      .select("id, name, type, region")
      .eq("name", name)
      .eq("type", type)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ school: existing });
    }

    // 새로 등록
    const { data: newSchool, error } = await supabase
      .from("schools")
      .insert({
        name,
        type,
        region: region || null,
      })
      .select("id, name, type, region")
      .single();

    if (error) {
      console.error("[api/schools/auto-register] 등록 실패:", error);
      return NextResponse.json(
        { error: "학교 등록에 실패했습니다." },
        { status: 500 }
      );
    }

    return NextResponse.json({ school: newSchool });
  } catch (error) {
    console.error("[api/schools/auto-register] 오류:", error);
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}


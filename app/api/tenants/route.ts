import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getTenantContext } from "@/lib/tenant/getTenantContext";

// POST: 새 tenant 생성
export async function POST(request: NextRequest) {
  try {
    const tenantContext = await getTenantContext();

    // Super Admin만 접근 가능
    if (tenantContext?.role !== "superadmin") {
      return NextResponse.json(
        { error: "권한이 없습니다." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { name, type } = body;

    if (!name) {
      return NextResponse.json(
        { error: "기관명은 필수입니다." },
        { status: 400 }
      );
    }

    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("tenants")
      .insert({
        name,
        type: type || "academy",
      })
      .select()
      .single();

    if (error) {
      console.error("[api] tenant 생성 실패", error);
      return NextResponse.json(
        { error: "기관 생성에 실패했습니다." },
        { status: 500 }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("[api] tenant 생성 오류", error);
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}


import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getTenantContext } from "@/lib/tenant/getTenantContext";

// PUT: tenant 수정
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
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
      .update({
        name,
        type: type || "academy",
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("[api] tenant 수정 실패", error);
      return NextResponse.json(
        { error: "기관 수정에 실패했습니다." },
        { status: 500 }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("[api] tenant 수정 오류", error);
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

// DELETE: tenant 삭제
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const tenantContext = await getTenantContext();

    // Super Admin만 접근 가능
    if (tenantContext?.role !== "superadmin") {
      return NextResponse.json(
        { error: "권한이 없습니다." },
        { status: 403 }
      );
    }

    const supabase = await createSupabaseServerClient();
    const { error } = await supabase
      .from("tenants")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("[api] tenant 삭제 실패", error);
      return NextResponse.json(
        { error: "기관 삭제에 실패했습니다." },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[api] tenant 삭제 오류", error);
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}


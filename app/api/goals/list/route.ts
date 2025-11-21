import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const selectGoals = () =>
      supabase
        .from("student_goals")
        .select("id,title,goal_type,subject")
        .order("created_at", { ascending: false });

    let { data: goals, error } = await selectGoals().eq("student_id", user.id);

    if (error && error.code === "42703") {
      ({ data: goals, error } = await selectGoals());
    }

    if (error) {
      console.error("[api/goals/list] 목표 조회 실패", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ goals: goals || [] });
  } catch (error) {
    console.error("[api/goals/list] 오류", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}


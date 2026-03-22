"use server";

/**
 * 학과 분류 조회 Server Actions
 * department_classification 테이블에서 소분류 목록을 가져온다
 */

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { MAJOR_TO_KEDI_MIDS } from "@/lib/constants/career-classification";

export interface SubClassificationOption {
  id: number;
  mid_name: string;
  sub_name: string;
}

/**
 * target_major(Tier 2) 키에 해당하는 KEDI 소분류 목록 조회
 *
 * @example
 * getSubClassifications("컴퓨터·정보")
 * → [{ id: 123, mid_name: "전기ㆍ전자ㆍ컴퓨터", sub_name: "전산학ㆍ컴퓨터공학" }, ...]
 */
export async function getSubClassifications(
  targetMajor: string,
): Promise<SubClassificationOption[]> {
  const midNames = MAJOR_TO_KEDI_MIDS[targetMajor];
  if (!midNames || midNames.length === 0) return [];

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("department_classifications")
    .select("id, mid_name, sub_name")
    .in("mid_name", midNames)
    .not("sub_name", "is", null)
    .order("mid_name")
    .order("sub_name");

  if (error) return [];
  return (data ?? []) as SubClassificationOption[];
}

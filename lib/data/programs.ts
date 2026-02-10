import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Program } from "@/lib/domains/crm/types";

export async function getProgramsByTenant(
  tenantId: string
): Promise<Program[]> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("programs")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("is_active", true)
    .order("display_order", { ascending: true });

  if (error) {
    console.error("[data/programs] getProgramsByTenant error:", error);
    return [];
  }

  return data ?? [];
}

export async function getProgramById(
  programId: string,
  tenantId: string
): Promise<Program | null> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("programs")
    .select("*")
    .eq("id", programId)
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (error) {
    console.error("[data/programs] getProgramById error:", error);
    return null;
  }

  return data;
}

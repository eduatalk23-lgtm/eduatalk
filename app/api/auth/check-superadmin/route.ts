import { NextResponse } from "next/server";
import { getTenantContext } from "@/lib/tenant/getTenantContext";

export async function GET() {
  const tenantContext = await getTenantContext();
  return NextResponse.json({
    isSuperAdmin: tenantContext?.role === "superadmin",
  });
}


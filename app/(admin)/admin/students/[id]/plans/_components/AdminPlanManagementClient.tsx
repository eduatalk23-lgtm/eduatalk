"use client";

import dynamic from "next/dynamic";
import { AdminPlanManagementSkeleton } from "./AdminPlanManagementSkeleton";
import type { AdminPlanManagementProps } from "./AdminPlanManagement";

const AdminPlanManagementLazy = dynamic(
  () => import("./AdminPlanManagement").then((m) => m.AdminPlanManagement),
  { ssr: false, loading: () => <AdminPlanManagementSkeleton /> },
);

export function AdminPlanManagementClient(props: AdminPlanManagementProps) {
  return <AdminPlanManagementLazy {...props} />;
}

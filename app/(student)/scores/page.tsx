import { redirect } from "next/navigation";

export default async function ScoresPage() {
  // 기본적으로 통합 대시보드로 redirect
  redirect("/scores/dashboard/unified");
}

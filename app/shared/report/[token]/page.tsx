import { notFound } from "next/navigation";
import { fetchSharedReportAction } from "@/lib/domains/student-record/actions/report-share";
import { SharedReportView } from "./_components/SharedReportView";

export default async function SharedReportPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const result = await fetchSharedReportAction(token);

  if (!result.success || !result.data) {
    notFound();
  }

  const { report } = result.data;

  return (
    <SharedReportView report={report} />
  );
}

import { notFound } from "next/navigation";
import { fetchSharedGuideAction } from "@/lib/domains/guide/actions/share";
import { SharedGuideView } from "./_components/SharedGuideView";

export default async function SharedGuidePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const result = await fetchSharedGuideAction(token);

  if (!result.success || !result.data) {
    notFound();
  }

  const { guide, visibleSections } = result.data;

  return (
    <SharedGuideView guide={guide} visibleSections={visibleSections} />
  );
}

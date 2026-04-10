import { ClusterDetailClient } from "./_components/ClusterDetailClient";

export const metadata = { title: "클러스터 상세" };

export default async function ClusterDetailPage({
  params,
}: {
  params: Promise<{ clusterId: string }>;
}) {
  const { clusterId } = await params;
  return <ClusterDetailClient clusterId={clusterId} />;
}

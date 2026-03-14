import { redirect } from "next/navigation";

type InvitePageProps = {
  params: Promise<{ token: string }>;
};

/**
 * 레거시 /invite/[token] → /join/[token] 리다이렉트
 * 기존 team_invitations 토큰은 통합 invitations 테이블로 마이그레이션 완료.
 * /join/[token]에서 모든 역할(admin/consultant/student/parent) 초대를 처리.
 */
export default async function InvitePage({ params }: InvitePageProps) {
  const { token } = await params;
  redirect(`/join/${token}`);
}

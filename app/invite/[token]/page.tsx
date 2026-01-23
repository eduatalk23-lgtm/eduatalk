import { redirect } from "next/navigation";
import { getInvitationByToken } from "@/lib/domains/team/actions/invitations";
import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import { AnimatedBackground } from "@/app/login/_components/AnimatedBackground";
import { GlassCard } from "@/app/login/_components/GlassCard";
import { InviteContent } from "./_components/InviteContent";
import { ExpiredInvitation } from "./_components/ExpiredInvitation";
import { InvalidInvitation } from "./_components/InvalidInvitation";

type InvitePageProps = {
  params: Promise<{ token: string }>;
};

export default async function InvitePage({ params }: InvitePageProps) {
  const { token } = await params;

  // 1. 초대 정보 조회
  const invitation = await getInvitationByToken(token);

  // 2. 초대가 없는 경우
  if (!invitation) {
    return (
      <section className="relative flex min-h-screen w-full items-center justify-center p-4">
        <AnimatedBackground />
        <GlassCard className="w-full max-w-[480px]">
          <InvalidInvitation />
        </GlassCard>
      </section>
    );
  }

  // 3. 만료된 초대
  if (invitation.isExpired || !invitation.isValid) {
    return (
      <section className="relative flex min-h-screen w-full items-center justify-center p-4">
        <AnimatedBackground />
        <GlassCard className="w-full max-w-[480px]">
          <ExpiredInvitation
            status={invitation.status}
            isExpired={invitation.isExpired}
          />
        </GlassCard>
      </section>
    );
  }

  // 4. 현재 사용자 확인
  let currentUser: { userId: string | null; role: string | null } = {
    userId: null,
    role: null,
  };

  try {
    currentUser = await getCurrentUserRole();
  } catch {
    // 로그인 안 된 상태 - 정상적인 케이스
  }

  return (
    <section className="relative flex min-h-screen w-full items-center justify-center p-4">
      <AnimatedBackground />
      <GlassCard className="w-full max-w-[480px]">
        <InviteContent
          invitation={{
            id: invitation.id,
            email: invitation.email,
            role: invitation.role,
            tenantName: invitation.tenantName,
            expiresAt: invitation.expiresAt,
          }}
          token={token}
          isLoggedIn={!!currentUser.userId}
        />
      </GlassCard>
    </section>
  );
}

export const dynamic = "force-dynamic";

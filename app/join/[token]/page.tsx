import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCachedUserRole } from "@/lib/auth/getCurrentUserRole";
import { validateInvitationByToken } from "@/lib/domains/invitation/actions";
import { AnimatedBackground } from "@/app/login/_components/AnimatedBackground";
import { GlassCard } from "@/app/login/_components/GlassCard";
import { JoinContent } from "./_components/JoinContent";
import { InvalidInvitation } from "./_components/InvalidInvitation";

type JoinPageProps = {
  params: Promise<{ token: string }>;
};

export default async function JoinPage({ params }: JoinPageProps) {
  const { token } = await params;

  // 1. 초대 검증
  const result = await validateInvitationByToken(token);

  // 2. 유효하지 않은 초대
  if (!result.success || !result.invitation) {
    return (
      <section className="relative flex min-h-screen w-full items-center justify-center p-4">
        <AnimatedBackground />
        <GlassCard className="w-full max-w-[480px]">
          <InvalidInvitation message={result.error} />
        </GlassCard>
      </section>
    );
  }

  // 3. 현재 사용자 확인
  let currentUserId: string | null = null;
  let currentUserEmail: string | null = null;

  try {
    const { userId } = await getCachedUserRole();
    if (userId) {
      currentUserId = userId;
      const supabase = await createSupabaseServerClient();
      const { data: { user } } = await supabase.auth.getUser();
      currentUserEmail = user?.email ?? null;
    }
  } catch {
    // 로그인 안 된 상태 - 정상
  }

  const inv = result.invitation;

  return (
    <section className="relative flex min-h-screen w-full items-center justify-center p-4">
      <AnimatedBackground />
      <GlassCard className="w-full max-w-[480px]">
        <JoinContent
          invitation={{
            id: inv.id,
            token: inv.token,
            tenantName: inv.tenantName,
            targetRole: inv.targetRole,
            studentName: inv.studentName,
            relation: inv.relation,
            email: inv.email,
            expiresAt: inv.expiresAt,
          }}
          isLoggedIn={!!currentUserId}
          currentUserId={currentUserId}
          currentUserEmail={currentUserEmail}
        />
      </GlassCard>
    </section>
  );
}

export const dynamic = "force-dynamic";

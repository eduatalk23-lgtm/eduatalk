import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { getCachedAuthUser } from "@/lib/auth/cachedGetUser";
import { extractPrimaryProvider } from "@/lib/utils/authProvider";
import PageContainer from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import AccountSettingsClient from "./_components/AccountSettingsClient";

export default async function AccountSettingsPage() {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    redirect("/login");
  }

  // getCachedAuthUser for fields not available on getCurrentUser (identities, timestamps)
  const authUser = await getCachedAuthUser();
  const primaryProvider = extractPrimaryProvider(authUser?.identities);

  return (
    <PageContainer widthType="FORM">
      <div className="flex flex-col gap-6">
        <PageHeader title="계정 관리" />

        <AccountSettingsClient
          email={currentUser.email ?? null}
          provider={primaryProvider}
          lastSignInAt={authUser?.last_sign_in_at ?? null}
          emailConfirmedAt={authUser?.email_confirmed_at ?? null}
        />
      </div>
    </PageContainer>
  );
}

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { extractPrimaryProvider } from "@/lib/utils/authProvider";
import PageContainer from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import AccountSettingsClient from "./_components/AccountSettingsClient";

export default async function AccountSettingsPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    redirect("/login");
  }

  const primaryProvider = extractPrimaryProvider(user.identities);

  return (
    <PageContainer widthType="FORM">
      <div className="flex flex-col gap-6">
        <PageHeader title="계정 관리" />

        <AccountSettingsClient
          email={user.email ?? null}
          provider={primaryProvider}
          lastSignInAt={user.last_sign_in_at ?? null}
          emailConfirmedAt={user.email_confirmed_at ?? null}
        />
      </div>
    </PageContainer>
  );
}

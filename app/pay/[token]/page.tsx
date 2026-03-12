import { validatePaymentLinkToken } from "@/lib/domains/payment/paymentLink/actions";
import { GuestPaymentContent } from "./_components/GuestPaymentContent";
import { GuestPaymentExpired } from "./_components/GuestPaymentExpired";
import { GuestPaymentAlreadyPaid } from "./_components/GuestPaymentAlreadyPaid";

export default async function GuestPaymentPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const result = await validatePaymentLinkToken(token);

  if (!result.valid) {
    if (result.reason === "completed" || result.reason === "payment_completed") {
      return <GuestPaymentAlreadyPaid />;
    }
    return <GuestPaymentExpired reason={result.reason} />;
  }

  return <GuestPaymentContent data={result.data} />;
}

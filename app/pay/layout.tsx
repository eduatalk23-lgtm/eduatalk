import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "수강료 결제",
  description: "학원 수강료를 간편하게 결제하세요",
  robots: { index: false, follow: false },
  openGraph: {
    title: "수강료 결제",
    description: "학원 수강료를 간편하게 결제하세요",
    type: "website",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#111827" },
  ],
};

export default function PayLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-dvh bg-gray-50 pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)] dark:bg-gray-900">
      {children}
    </div>
  );
}

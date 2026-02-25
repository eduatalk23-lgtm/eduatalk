"use client";

import { useState, useCallback } from "react";
import { useIsMobile } from "@/lib/hooks/useIsMobile";
import { StickyHeader } from "./StickyHeader";
import { HeroSection } from "./HeroSection";
import { FeaturesSection } from "./FeaturesSection";
import { HowItWorksSection } from "./HowItWorksSection";
import { PricingSection } from "./PricingSection";
import { SocialProofSection } from "./SocialProofSection";
import { CTASection } from "./CTASection";
import { LandingFooter } from "./LandingFooter";
import { MobileLoginSheet } from "./MobileLoginSheet";

export default function LandingPage() {
  const [sheetOpen, setSheetOpen] = useState(false);
  const isMobile = useIsMobile();

  const scrollToLogin = useCallback(() => {
    const el = document.getElementById("login-card");
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, []);

  const handleLoginClick = useCallback(() => {
    if (isMobile) {
      setSheetOpen(true);
    } else {
      scrollToLogin();
    }
  }, [isMobile, scrollToLogin]);

  return (
    <div className="min-h-screen bg-[#FAFBFC] dark:bg-[#101722]">
      {/* Background decorations */}
      <div className="fixed inset-0 dot-grid pointer-events-none" aria-hidden />
      <div
        className="fixed -top-24 -left-24 w-96 h-96 bg-blue-400/10 gradient-blob rounded-full pointer-events-none animate-blob-1"
        aria-hidden
      />
      <div
        className="fixed top-1/2 -right-24 w-[500px] h-[500px] bg-orange-200/15 gradient-blob rounded-full pointer-events-none animate-blob-2"
        aria-hidden
      />

      <StickyHeader onLoginClick={handleLoginClick} />

      <main>
        <HeroSection onMobileLoginClick={() => setSheetOpen(true)} />
        <FeaturesSection />
        <HowItWorksSection />
        <SocialProofSection />
        <PricingSection />
        <CTASection onCtaClick={handleLoginClick} />
      </main>

      <LandingFooter />

      {/* Mobile bottom sheet */}
      <MobileLoginSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
      />
    </div>
  );
}

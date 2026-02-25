import type { LucideIcon } from "lucide-react";

export interface FeatureCard {
  id: string;
  title: string;
  description: string;
  icon: LucideIcon;
  color: string;       // Tailwind gradient / bg class
  iconBg: string;      // icon wrapper bg
  colSpan: string;     // grid col-span class
  rowSpan?: string;    // grid row-span class
  ctaLabel?: string;   // CTA 텍스트 ("자세히 보기" 등)
  ctaHref?: string;    // CTA 링크 ("#features" 등)
  stats?: { value: string; label: string; color: string }[];
}

export interface SocialLink {
  icon: LucideIcon;
  label: string;
  href: string;
}

export interface Testimonial {
  id: string;
  name: string;
  university: string;
  quote: string;
  rating: number;
  avatarFallback: string;
}

export interface Stat {
  value: string;
  label: string;
}

export interface PillarData {
  id: string;
  name: string;
  tagline: string;
  color: string; // Tailwind bg class
  textColor: string;
}

export interface FooterLinkGroup {
  title: string;
  links: { label: string; href: string }[];
}

export interface TrustBadge {
  icon: LucideIcon;
  text: string;
}

export interface HowItWorksStep {
  id: string;
  step: string;        // "01", "02", "03"
  title: string;
  description: string;
  icon: LucideIcon;
}

export interface PricingPlan {
  id: string;
  name: string;
  price: string;         // "₩0" or "₩19,900" or "문의"
  period?: string;       // "/월"
  description: string;
  includedPlanLabel?: string; // "기본 플랜의 모든 것 +" 등
  features: string[];
  ctaLabel: string;
  highlighted?: boolean; // Pro 카드
  badge?: string;        // "인기"
}

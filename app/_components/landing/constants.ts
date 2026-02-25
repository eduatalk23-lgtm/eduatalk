import {
  Calendar,
  NotebookPen,
  Target,
  Brain,
  Timer,
  Sparkles,
  UserCheck,
  BadgeCheck,
  Users,
  MapPin,
  Phone,
  Mail,
  Instagram,
  Youtube,
  MessageCircle,
  Clock,
  UserCog,
  BarChart3,
} from "lucide-react";
import type {
  FeatureCard,
  Testimonial,
  Stat,
  PillarData,
  FooterLinkGroup,
  TrustBadge,
  SocialLink,
  HowItWorksStep,
  PricingPlan,
} from "./types";

// ── Pillars (모바일 캐러셀용) ──────────────────────────
export const PILLARS: PillarData[] = [
  {
    id: "one-plan",
    name: "One-Plan",
    tagline: "AI가 설계하는 나만의 학습 플랜",
    color: "bg-blue-600",
    textColor: "text-white",
  },
  {
    id: "one-note",
    name: "One-NOTE",
    tagline: "수업 내용을 자동으로 정리",
    color: "bg-indigo-600",
    textColor: "text-white",
  },
  {
    id: "one-pass",
    name: "One-PASS",
    tagline: "출결과 진도를 한번에 관리",
    color: "bg-slate-900",
    textColor: "text-white",
  },
];

// ── Feature Cards (벤토 그리드) ────────────────────────
export const FEATURES: FeatureCard[] = [
  {
    id: "one-plan",
    title: "One-Plan",
    description:
      "AI가 학생의 학습 패턴, 시험 일정, 난이도를 분석하여 최적의 학습 플랜을 자동 생성합니다.",
    icon: Calendar,
    color: "from-blue-500 to-blue-700",
    iconBg: "bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-300",
    colSpan: "col-span-1 lg:col-span-2",
    rowSpan: "row-span-1 lg:row-span-2",
    ctaLabel: "AI 플래너 체험하기",
    ctaHref: "/signup",
    stats: [
      { value: "+15%", label: "학습 효율", color: "text-emerald-600" },
      { value: "85%", label: "목표 달성률", color: "text-blue-600" },
    ],
  },
  {
    id: "one-note",
    title: "One-NOTE",
    description: "수업 내용을 실시간으로 기록하고 AI가 핵심 요약을 자동 생성합니다.",
    icon: NotebookPen,
    color: "from-amber-400 to-amber-600",
    iconBg: "bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-300",
    colSpan: "col-span-1",
    ctaLabel: "노트 기능 보기",
    ctaHref: "/signup",
  },
  {
    id: "one-pass",
    title: "One-PASS",
    description: "QR 기반 출결 관리와 실시간 학습 진도 추적을 한번에 처리합니다.",
    icon: Target,
    color: "from-emerald-400 to-emerald-600",
    iconBg: "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-300",
    colSpan: "col-span-1",
    ctaLabel: "출결 관리 보기",
    ctaHref: "/signup",
  },
  {
    id: "ai-dashboard",
    title: "AI 대시보드",
    description:
      "학습 데이터를 시각화하고 성적 예측과 맞춤 피드백을 제공합니다. 과목별 강약점, 주간 학습 추이, 목표 달성률을 한눈에 확인하세요.",
    icon: Brain,
    color: "from-indigo-500 to-indigo-700",
    iconBg: "bg-indigo-100 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-300",
    colSpan: "col-span-1 lg:col-span-2",
    rowSpan: "row-span-1 lg:row-span-2",
    ctaLabel: "대시보드 미리보기",
    ctaHref: "/signup",
    stats: [
      { value: "97%", label: "예측 정확도", color: "text-indigo-600" },
    ],
  },
  {
    id: "timer",
    title: "학습 타이머",
    description: "집중 시간을 측정하고 최적의 휴식 주기를 알려줍니다.",
    icon: Timer,
    color: "from-rose-400 to-rose-600",
    iconBg: "bg-rose-100 text-rose-600 dark:bg-rose-900/40 dark:text-rose-300",
    colSpan: "col-span-1",
    ctaLabel: "타이머 사용하기",
    ctaHref: "/signup",
  },
  {
    id: "ai-recommend",
    title: "AI 콘텐츠 추천",
    description: "학습 수준에 맞는 교재와 문제를 자동으로 추천합니다.",
    icon: Sparkles,
    color: "from-purple-400 to-purple-600",
    iconBg: "bg-purple-100 text-purple-600 dark:bg-purple-900/40 dark:text-purple-300",
    colSpan: "col-span-1",
    ctaLabel: "추천 받기",
    ctaHref: "/signup",
  },
  {
    id: "parent-dashboard",
    title: "학부모 대시보드",
    description: "자녀의 학습 현황을 실시간으로 확인하고 상담을 예약합니다.",
    icon: UserCheck,
    color: "from-teal-400 to-teal-600",
    iconBg: "bg-teal-100 text-teal-600 dark:bg-teal-900/40 dark:text-teal-300",
    colSpan: "col-span-1",
    ctaLabel: "학부모 등록하기",
    ctaHref: "/signup",
  },
];

// ── Testimonials ───────────────────────────────────────
export const TESTIMONIALS: Testimonial[] = [
  {
    id: "t1",
    name: "김지훈",
    university: "서울대학교 합격",
    quote:
      "TimeLevelUp의 AI 플래너 덕분에 공부 시간 낭비 없이 효율적으로 준비할 수 있었습니다. 매일 자동으로 조정되는 플랜이 정말 좋았어요.",
    rating: 5,
    avatarFallback: "김",
  },
  {
    id: "t2",
    name: "이서연",
    university: "연세대학교 합격",
    quote:
      "성적이 정체되어 있을 때 AI 분석을 통해 약점을 정확히 파악할 수 있었어요. 맞춤 커리큘럼이 진짜 차이를 만들어줬습니다.",
    rating: 5,
    avatarFallback: "이",
  },
  {
    id: "t3",
    name: "박민재",
    university: "고려대학교 합격",
    quote:
      "학원과 자기주도학습을 완벽하게 통합해서 관리할 수 있었어요. 타이머 기능으로 집중력도 확실히 높아졌습니다.",
    rating: 5,
    avatarFallback: "박",
  },
];

// ── Stats ──────────────────────────────────────────────
export const STATS: Stat[] = [
  { value: "13년+", label: "입시 전문 경력" },
  { value: "2,000+", label: "누적 수강생" },
  { value: "97%", label: "만족도" },
  { value: "4.9/5", label: "평균 평점" },
];

// ── Social Links ──────────────────────────────────────
export const SOCIAL_LINKS: SocialLink[] = [
  { icon: Instagram, label: "Instagram", href: "https://instagram.com/timelevelup" },
  { icon: Youtube, label: "YouTube", href: "https://youtube.com/@timelevelup" },
  { icon: MessageCircle, label: "카카오톡", href: "https://pf.kakao.com/timelevelup" },
];

// ── Footer Links ───────────────────────────────────────
export const FOOTER_LINKS: FooterLinkGroup[] = [
  {
    title: "주요 서비스",
    links: [
      { label: "AI 학습 플래너", href: "#features" },
      { label: "이용 방법", href: "#how-it-works" },
      { label: "후기", href: "#testimonials" },
      { label: "요금제", href: "#pricing" },
    ],
  },
  {
    title: "고객 지원",
    links: [
      { label: "자주 묻는 질문", href: "#" },
      { label: "이용 가이드", href: "#how-it-works" },
      { label: "공지사항", href: "#" },
      { label: "개인정보처리방침", href: "#" },
    ],
  },
  {
    title: "문의하기",
    links: [
      { label: "02-1234-5678", href: "tel:02-1234-5678" },
      { label: "support@eduatalk.kr", href: "mailto:support@eduatalk.kr" },
      { label: "서울특별시 강남구", href: "#" },
      { label: "평일 10:00 - 19:00", href: "#" },
    ],
  },
];

// ── Contact Icons (문의하기 라벨→아이콘 매핑) ──────────
export const CONTACT_ICON_MAP: Record<string, typeof Phone> = {
  "02-1234-5678": Phone,
  "support@eduatalk.kr": Mail,
  "서울특별시 강남구": MapPin,
  "평일 10:00 - 19:00": Clock,
};

// ── How It Works Steps ────────────────────────────────
export const HOW_IT_WORKS_STEPS: HowItWorksStep[] = [
  {
    id: "step-1",
    step: "01",
    title: "학습 프로필 설정",
    description: "시험 일정, 과목, 학습 가능 시간을 입력하세요.",
    icon: UserCog,
  },
  {
    id: "step-2",
    step: "02",
    title: "AI 플랜 자동 생성",
    description: "AI가 최적의 학습 스케줄을 자동으로 설계합니다.",
    icon: Brain,
  },
  {
    id: "step-3",
    step: "03",
    title: "실시간 분석 & 조정",
    description: "학습 진행에 따라 플랜이 자동으로 조정됩니다.",
    icon: BarChart3,
  },
];

// ── Pricing Plans ─────────────────────────────────────
export const PRICING_PLANS: PricingPlan[] = [
  {
    id: "free",
    name: "기본",
    price: "₩0",
    period: "/월",
    description: "학습 관리의 첫 걸음",
    features: [
      "AI 플래너 기본",
      "일일 학습 리포트",
      "학습 타이머",
    ],
    ctaLabel: "무료로 시작하기",
  },
  {
    id: "pro",
    name: "프로",
    price: "₩19,900",
    period: "/월",
    description: "본격적인 성적 향상을 위한 플랜",
    includedPlanLabel: "기본 플랜의 모든 것 +",
    features: [
      "AI 맞춤 플래너",
      "성적 예측 분석",
      "학부모 대시보드",
      "AI 콘텐츠 추천",
      "우선 고객 지원",
    ],
    ctaLabel: "프로 시작하기",
    highlighted: true,
    badge: "인기",
  },
  {
    id: "academy",
    name: "학원용",
    price: "문의",
    description: "학원 맞춤 통합 솔루션",
    includedPlanLabel: "프로 플랜의 모든 것 +",
    features: [
      "무제한 학생 관리",
      "맞춤 커리큘럼 설계",
      "QR 출결 관리",
      "API 연동",
      "전담 매니저 배정",
    ],
    ctaLabel: "상담 신청하기",
  },
];

// ── Trust Badges (히어로 하단) ──────────────────────────
export const TRUST_BADGES: TrustBadge[] = [
  { icon: BadgeCheck, text: "13년 입시 전문" },
  { icon: Users, text: "2,000+ 누적 학습자" },
  { icon: Sparkles, text: "독자적 AI 엔진" },
];

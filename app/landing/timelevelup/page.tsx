"use client";

import { useState, useCallback, useRef, useEffect, type FormEvent } from "react";
import Image from "next/image";

/* ──────────────────────────── 상수 ──────────────────────────── */
const IMG = "/landing-timelevelup";

const PARENT_BUBBLES = [
  { img: "memoji.png", text: "학원이라도 보내야\n문제를 풀지 않을까요?" },
  {
    img: "memoji2.png",
    text: "엄마아빠가 알려주는 공부방법은\n잔소리로 생각해서 듣지 않아요",
  },
  {
    img: "memoji3.png",
    text: "우리 애는 정말 열심히 하는데\n왜 성적이 안 오를까요?",
  },
];

const STUDENT_BUBBLES = [
  { img: "memoji4.png", text: "공부방법이요?\n문제 푸는 것 밖에 없는데요?" },
  {
    img: "memoji5.png",
    text: "4~5개 학원도 다니고\n고난도 문제는 많이 푸는데\n시험만 보면 성적이 안 나와요",
  },
  {
    img: "memoji6.png",
    text: "내신이랑 모의고사는\n별개 아닌가요?\n그래서 공부할 시간이 부족해요",
  },
];

const REVIEWS = [
  "review.png",
  "review-1.png",
  "review-2.png",
  "review-3.png",
  "review-4.png",
  "review-5.png",
  "review-6.png",
];

const NOTE_SLIDES_TOP = [
  "note-slide.png",
  "note-slide2.png",
  "note-slide3.png",
];
const NOTE_SLIDES_BOTTOM = [
  "note-slide4.png",
  "note-slide5.png",
  "note-slide6.png",
];

const CAMP_IMAGES = ["camp.png", "camp2.png", "camp3.png"];

/* ──────────────────────────── 유틸 훅 ──────────────────────────── */

/** 뷰포트 진입 시 한 번 animate 트리거 */
function useRevealOnScroll() {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          obs.disconnect();
        }
      },
      { threshold: 0.15 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return { ref, visible };
}

/* ──────────────────────────── 서브 컴포넌트 ──────────────────────────── */

function FadeUp({
  children,
  delay = 0,
  className = "",
  style,
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  const { ref, visible } = useRevealOnScroll();
  return (
    <div
      ref={ref}
      className={`transition-all duration-700 ${
        visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
      } ${className}`}
      style={{ transitionDelay: `${delay}ms`, ...style }}
    >
      {children}
    </div>
  );
}

/** 왼쪽 아래에서 오른쪽 위로 (학부모 버블용) */
function FadeUpRight({
  children,
  delay = 0,
  className = "",
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  const { ref, visible } = useRevealOnScroll();
  return (
    <div
      ref={ref}
      className={`transition-all duration-700 ${className}`}
      style={{
        transitionDelay: `${delay}ms`,
        opacity: visible ? 1 : 0,
        transform: visible ? "translate(0,0)" : "translate(-24px,24px)",
      }}
    >
      {children}
    </div>
  );
}

/** 오른쪽 아래에서 왼쪽 위로 (학생 버블용) */
function FadeUpLeft({
  children,
  delay = 0,
  className = "",
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  const { ref, visible } = useRevealOnScroll();
  return (
    <div
      ref={ref}
      className={`transition-all duration-700 ${className}`}
      style={{
        transitionDelay: `${delay}ms`,
        opacity: visible ? 1 : 0,
        transform: visible ? "translate(0,0)" : "translate(24px,24px)",
      }}
    >
      {children}
    </div>
  );
}

/** 무한 스크롤 행 (좌→우 or 우→좌) */
function InfiniteScrollRow({
  images,
  reverse = false,
  speed = 30,
  itemWidth = "w-[300px]",
}: {
  images: string[];
  reverse?: boolean;
  speed?: number;
  itemWidth?: string;
}) {
  const doubled = [...images, ...images, ...images];
  return (
    <div className="overflow-hidden py-3">
      <div
        className={`flex gap-8 ${reverse ? "animate-scroll-reverse" : "animate-scroll-row"}`}
        style={{ animationDuration: `${speed}s` }}
      >
        {doubled.map((img, i) => (
          <div key={`${img}-${i}`} className={`${itemWidth} flex-shrink-0`}>
            <Image
              src={`${IMG}/${img}`}
              alt="에듀엣톡 타임레벨업"
              width={300}
              height={400}
              className="w-full h-auto rounded-xl shadow-md"
            />
          </div>
        ))}
      </div>
    </div>
  );
}

/** 마르키 텍스트 */
function MarqueeText({
  dark = false,
}: {
  dark?: boolean;
}) {
  const items = Array.from({ length: 20 }, (_, i) => i);
  return (
    <div
      className={`overflow-hidden py-3 ${
        dark
          ? "border-y border-white/30 bg-transparent"
          : "border-y border-[#182D7B] bg-white"
      }`}
    >
      <div className="flex gap-8 animate-marquee whitespace-nowrap">
        {items.map((i) => (
          <span
            key={i}
            className={`text-2xl font-black tracking-tight ${
              dark ? "text-white" : "text-[#182D7B]"
            }`}
            style={{ fontFamily: "Montserrat, sans-serif" }}
          >
            One-Pass
          </span>
        ))}
      </div>
    </div>
  );
}

/** 후기 캐러셀 — centeredSlides + scale 효과 */
function ReviewCarousel() {
  const [active, setActive] = useState(Math.floor(REVIEWS.length / 2));
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const resetAutoPlay = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setActive((prev) => (prev + 1) % REVIEWS.length);
    }, 3500);
  }, []);

  useEffect(() => {
    resetAutoPlay();
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [resetAutoPlay]);

  const go = useCallback(
    (dir: "prev" | "next") => {
      setActive((prev) =>
        dir === "next"
          ? (prev + 1) % REVIEWS.length
          : (prev - 1 + REVIEWS.length) % REVIEWS.length
      );
      resetAutoPlay();
    },
    [resetAutoPlay],
  );

  return (
    <div className="relative">
      {/* Carousel track */}
      <div className="flex items-center justify-center" style={{ height: "clamp(380px, 50vw, 560px)" }}>
        {REVIEWS.map((img, i) => {
          const offset = i - active;
          // wrap around for circular positioning
          const wrapped =
            offset > Math.floor(REVIEWS.length / 2)
              ? offset - REVIEWS.length
              : offset < -Math.floor(REVIEWS.length / 2)
                ? offset + REVIEWS.length
                : offset;
          const isActive = wrapped === 0;
          const isAdjacent = Math.abs(wrapped) === 1;
          const isNear = Math.abs(wrapped) === 2;
          const isVisible = Math.abs(wrapped) <= 3;

          return (
            <div
              key={`review-${i}`}
              className="absolute transition-all duration-500 ease-in-out cursor-pointer"
              style={{
                transform: `translateX(${wrapped * 220}px) scale(${isActive ? 1.1 : 0.9})`,
                zIndex: isActive ? 10 : isAdjacent ? 5 : isNear ? 3 : 1,
                opacity: isActive ? 1 : isAdjacent ? 0.6 : isNear ? 0.35 : isVisible ? 0.15 : 0,
                filter: isActive ? "none" : isAdjacent ? "blur(1px)" : "blur(2px)",
                pointerEvents: isVisible ? "auto" : "none",
              }}
              onClick={() => {
                if (!isActive) {
                  setActive(i);
                  resetAutoPlay();
                }
              }}
            >
              <Image
                src={`${IMG}/${img}`}
                alt="에듀엣톡 타임레벨업 후기"
                width={340}
                height={500}
                className="h-auto"
                style={{
                  width: "clamp(240px, 22vw, 340px)",
                  borderRadius: "32px",
                  border: isActive ? "8px solid #FFF" : "none",
                }}
              />
            </div>
          );
        })}
      </div>
      {/* 네비게이션 */}
      <div className="flex justify-center gap-4 mt-6">
        <button
          onClick={() => go("prev")}
          className="w-14 h-14 rounded-full border border-white bg-[#182D7B] flex items-center justify-center hover:bg-white group transition-colors"
          aria-label="이전"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M15 18L9 12L15 6" stroke="white" strokeWidth="2" strokeLinecap="round" className="group-hover:stroke-[#182D7B]" />
          </svg>
        </button>
        <button
          onClick={() => go("next")}
          className="w-14 h-14 rounded-full border border-white bg-[#182D7B] flex items-center justify-center hover:bg-white group transition-colors"
          aria-label="다음"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M9 6L15 12L9 18" stroke="white" strokeWidth="2" strokeLinecap="round" className="group-hover:stroke-[#182D7B]" />
          </svg>
        </button>
      </div>
    </div>
  );
}

/** 캠프 이미지 자동 슬라이드 */
function CampSlider() {
  const [current, setCurrent] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setCurrent((c) => (c + 1) % CAMP_IMAGES.length), 3000);
    return () => clearInterval(timer);
  }, []);
  return (
    <div className="relative w-full max-w-[600px] overflow-hidden rounded-2xl aspect-[4/5]">
      {CAMP_IMAGES.map((img, i) => (
        <Image
          key={img}
          src={`${IMG}/${img}`}
          alt="에듀엣톡 타임레벨업 학습 캠프"
          fill
          className={`object-cover transition-opacity duration-500 ${
            i === current ? "opacity-100" : "opacity-0"
          }`}
        />
      ))}
    </div>
  );
}

/* ──────────────────────────── 메인 페이지 ──────────────────────────── */

export default function TimeLevelUpLandingPage() {
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [form, setForm] = useState({
    school: "",
    grade: "",
    name: "",
    phone: "",
    desc: "",
    agreed: false,
  });

  const contactRef = useRef<HTMLDivElement>(null);
  const [headerSolid, setHeaderSolid] = useState(false);

  useEffect(() => {
    const onScroll = () => setHeaderSolid(window.scrollY > 60);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const scrollToContact = useCallback(() => {
    contactRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  const handleSubmit = useCallback(
    (e: FormEvent) => {
      e.preventDefault();
      if (!form.school || !form.grade || !form.name) {
        alert("필수 항목을 모두 입력해주세요.");
        return;
      }
      const phone = form.phone.replace(/[^0-9]/g, "");
      if (phone.length !== 11) {
        alert("연락처가 잘못 기재되었습니다. 다시 한 번 확인 부탁드립니다.");
        return;
      }
      if (!form.agreed) {
        alert("개인정보취급방침에 동의해주세요.");
        return;
      }
      alert("상담 신청이 완료되었습니다.");
    },
    [form],
  );

  return (
    <>
      <style>{`
        @keyframes scroll-row { 0%{transform:translateX(0)} 100%{transform:translateX(-33.33%)} }
        @keyframes scroll-reverse { 0%{transform:translateX(-33.33%)} 100%{transform:translateX(0)} }
        @keyframes marquee { 0%{transform:translateX(0)} 100%{transform:translateX(-50%)} }
        @keyframes rotate { 0%{transform:rotate(0deg)} 100%{transform:rotate(360deg)} }
        @keyframes revealArrow {
          from { clip-path: inset(100% 0 0 0); }
          to { clip-path: inset(0 0 0 0); }
        }
        @keyframes ticker-scroll {
          0% { transform: translateY(0); }
          100% { transform: translateY(-50%); }
        }
        .animate-scroll-row { animation: scroll-row linear infinite; }
        .animate-scroll-reverse { animation: scroll-reverse linear infinite; }
        .animate-marquee { animation: marquee 10s linear infinite; }
        .animate-rotate { animation: rotate 8s linear infinite; }
        .animate-reveal-arrow { animation: revealArrow 1s ease-out 0.8s both; }
        .animate-ticker { animation: ticker-scroll 8s linear infinite; }
        .scrollbar-hide::-webkit-scrollbar { display:none; }
        .hover-zoom { transition: transform 0.4s ease; }
        .hover-zoom:hover { transform: scale(1.03); }
      `}</style>

      <div className="w-full overflow-x-hidden bg-white font-[Pretendard,sans-serif]">
        {/* ─── 헤더 (고정) ─── */}
        <header
          className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-4 transition-all duration-300"
          style={{
            backgroundColor: headerSolid ? "rgba(255,255,255,0.95)" : "transparent",
            backdropFilter: headerSolid ? "blur(8px)" : "none",
            boxShadow: headerSolid ? "0 1px 8px rgba(0,0,0,0.08)" : "none",
          }}
        >
          <Image
            src={`${IMG}/logo.png`}
            alt="에듀엣톡"
            width={120}
            height={32}
            className="h-8 w-auto cursor-pointer"
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          />
          <button
            onClick={scrollToContact}
            className="rounded-full bg-[#182D7B] px-6 py-2.5 text-sm font-semibold text-white hover:bg-[#0f1f5c] transition-colors"
          >
            상담 신청
          </button>
        </header>

        {/* ═══════════ Section 1: Hero ═══════════ */}
        <section className="relative w-full min-h-[600px] lg:min-h-[780px] pt-20 overflow-hidden bg-gradient-to-r from-[#394D96] to-[#43509D] flex items-center">
          <div className="relative z-10 mx-auto w-[90%] max-w-[1280px] pb-10">
            <FadeUp>
              <span className="inline-block rounded-full bg-white px-5 py-2 text-lg lg:text-2xl font-bold text-[#182D7B]">
                다른 학생보다 빠르게 대학가는 공부 방법
              </span>
            </FadeUp>
            <FadeUp delay={200}>
              <p
                className="mt-3 text-6xl lg:text-[116px] font-black text-white tracking-tight"
                style={{ fontFamily: "Montserrat, sans-serif" }}
              >
                One-PASS
              </p>
            </FadeUp>
            <p className="mt-4 text-2xl lg:text-5xl text-white font-normal tracking-tight">
              꽉 찬 공부시간으로 타임레벨업!
            </p>
            <Image
              src={`${IMG}/arrow.svg`}
              alt=""
              width={200}
              height={400}
              className="absolute left-[29%] bottom-0 hidden lg:block animate-reveal-arrow"
              aria-hidden
            />
          </div>
          {/* 학생 + 책 이미지 */}
          <Image
            src={`${IMG}/student.png`}
            alt=""
            width={350}
            height={500}
            className="absolute right-[20%] bottom-0 z-[3] hidden lg:block w-[250px] xl:w-[350px]"
          />
          <Image
            src={`${IMG}/book.png`}
            alt=""
            width={488}
            height={400}
            className="absolute right-[5%] bottom-0 hidden lg:block w-[350px] xl:w-[488px]"
          />
        </section>

        {/* ─── One-Plan / One-NOTE / One-PASS 카드 ─── */}
        <section className="relative z-10 -mt-12 lg:-mt-24 flex flex-col items-center">
          <div className="mx-auto flex w-[90%] max-w-[1280px] gap-4 lg:gap-10">
            {[
              { icon: "main-icon.svg", label: "One-Plan" },
              { icon: "main-icon2.svg", label: "One-NOTE" },
              { icon: "main-icon3.svg", label: "One-PASS" },
            ].map(({ icon, label }, i) => (
              <FadeUp
                key={label}
                delay={400 + i * 200}
                className="flex-1 flex items-center justify-center gap-2 rounded-t-2xl bg-white py-6 lg:py-8 text-[#182D7B] font-black text-lg lg:text-3xl shadow-sm"
              >
                <Image src={`${IMG}/${icon}`} alt="" width={40} height={40} className="h-8 w-8 lg:h-10 lg:w-10" />
                <span style={{ fontFamily: "Montserrat, sans-serif" }}>{label}</span>
              </FadeUp>
            ))}
          </div>
          <div className="w-[90%] max-w-[1280px] bg-white py-12 lg:py-20 text-center text-[#182D7B] text-xl lg:text-4xl font-bold tracking-tight">
            1730플랜으로 단권화 학습하고 한 번에 대학 Pass!!
          </div>
        </section>

        {/* ═══════════ Section 2: 고민 버블 ═══════════ */}
        <section className="w-full bg-white px-4 lg:px-[60px]">
          <div className="mx-auto rounded-2xl bg-[#E4ECFB] py-16 lg:py-24 px-4 lg:px-10">
            <FadeUp className="text-center">
              <h2 className="text-2xl lg:text-5xl font-bold text-[#182D7B] leading-tight">
                학원도 보내 보고, 과외도 시켜봤는데...
                <br />
                <span className="font-extrabold">왜 성적은 그대로 일까요?</span>
              </h2>
            </FadeUp>

            <div className="mx-auto mt-12 flex max-w-[1320px] flex-col items-center gap-8 lg:flex-row lg:items-start lg:justify-between">
              {/* 학부모 */}
              <div className="w-full max-w-[500px] space-y-10">
                <div className="rounded-full bg-[#C8D8F5] py-3 text-center text-xl font-semibold text-[#182D7B]">
                  학부모
                </div>
                {PARENT_BUBBLES.map((b, i) => (
                  <FadeUpRight key={i} delay={i * 150}>
                    <div className="relative">
                      <div className="flex items-center gap-4 rounded-2xl bg-white p-5 shadow-lg">
                        <Image src={`${IMG}/${b.img}`} alt="" width={80} height={80} className="h-16 w-16 lg:h-20 lg:w-20 flex-shrink-0" />
                        <p className="text-sm lg:text-base text-gray-700 leading-relaxed whitespace-pre-line">{b.text}</p>
                      </div>
                      {/* 말풍선 꼬리 */}
                      <div
                        style={{
                          position: "absolute",
                          bottom: -10,
                          left: 30,
                          width: 0,
                          height: 0,
                          borderLeft: "12px solid transparent",
                          borderRight: "12px solid transparent",
                          borderTop: "12px solid #fff",
                          filter: "drop-shadow(0 2px 2px rgba(0,0,0,0.06))",
                        }}
                      />
                    </div>
                  </FadeUpRight>
                ))}
              </div>

              {/* 중앙 텍스트 */}
              <p className="hidden lg:block text-3xl font-extrabold text-[#182D7B]/50 py-8 [writing-mode:vertical-lr]">
                이런분들에게 추천합니다
              </p>
              <p className="block lg:hidden text-lg font-extrabold text-[#182D7B]/50 text-center">
                이런분들에게 추천합니다
              </p>

              {/* 학생 */}
              <div className="w-full max-w-[500px] space-y-10">
                <div className="rounded-full bg-[#C8D8F5] py-3 text-center text-xl font-semibold text-[#182D7B]">
                  학생
                </div>
                {STUDENT_BUBBLES.map((b, i) => (
                  <FadeUpLeft key={i} delay={i * 150}>
                    <div className="relative">
                      <div className="flex items-center gap-4 rounded-2xl bg-white p-5 shadow-lg">
                        <Image src={`${IMG}/${b.img}`} alt="" width={80} height={80} className="h-16 w-16 lg:h-20 lg:w-20 flex-shrink-0" />
                        <p className="text-sm lg:text-base text-gray-700 leading-relaxed whitespace-pre-line">{b.text}</p>
                      </div>
                      {/* 말풍선 꼬리 (오른쪽) */}
                      <div
                        style={{
                          position: "absolute",
                          bottom: -10,
                          right: 30,
                          width: 0,
                          height: 0,
                          borderLeft: "12px solid transparent",
                          borderRight: "12px solid transparent",
                          borderTop: "12px solid #fff",
                          filter: "drop-shadow(0 2px 2px rgba(0,0,0,0.06))",
                        }}
                      />
                    </div>
                  </FadeUpLeft>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ═══════════ Section 3: 핵심은 질 ═══════════ */}
        <section className="w-full bg-white px-4 lg:px-[60px] overflow-hidden">
          <div className="mx-auto max-w-[1280px] py-16 lg:py-24 space-y-16">
            <div className="flex flex-col gap-8 lg:flex-row lg:justify-between lg:items-start">
              <FadeUp>
                <h2 className="text-3xl lg:text-5xl font-bold text-[#182D7B] leading-tight">
                  핵심은 &lsquo;양&rsquo;이 아니라
                  <br />
                  <span className="font-extrabold">&lsquo;질&rsquo;입니다!</span>
                </h2>
              </FadeUp>
              <FadeUp delay={200} className="text-base lg:text-xl text-gray-600 leading-relaxed max-w-[600px]">
                <p>
                  <span className="font-semibold">&quot;혼자 할 수 있는 방법&quot;</span>을 배우지
                  못했기 때문에, 학원을 다니고, 과외를 받아도 성적이 오르지 않는
                  것입니다.
                </p>
                <p className="mt-4">
                  공부하는 방법을 알면, 같은 시간을 써도 결과는 다릅니다. 얼마나
                  공부했는지를 보기 전에, 어떻게 공부하는지를 배워야 합니다.
                </p>
                <p className="mt-4">
                  대치동 13년 입시컨설팅의 본질을 담은 특허 출원 공부법 One-pass로
                  학습 루틴을 설계합니다.
                </p>
              </FadeUp>
            </div>
            <div className="flex gap-4 lg:gap-5">
              <div className="flex-1 overflow-hidden rounded-2xl">
                <Image
                  src={`${IMG}/st3-img.png`}
                  alt="에듀엣톡 학습법"
                  width={640}
                  height={400}
                  className="w-full h-auto hover-zoom"
                />
              </div>
              <div className="flex-1 overflow-hidden rounded-2xl">
                <Image
                  src={`${IMG}/st3-img2.png`}
                  alt="에듀엣톡 학습법"
                  width={640}
                  height={400}
                  className="w-full h-auto hover-zoom"
                />
              </div>
            </div>
          </div>
        </section>

        {/* ═══════════ Section 4: 후기 캐러셀 ═══════════ */}
        <section className="w-full px-4 lg:px-[60px]">
          <div className="w-full rounded-2xl bg-[#182D7B] py-16 lg:py-24 overflow-hidden">
            <FadeUp className="text-center mb-12">
              <h2 className="text-3xl lg:text-5xl font-bold text-white leading-tight">
                특허 공부법 One-Pass는
                <br />
                <span className="font-extrabold">결과로 증명합니다</span>
              </h2>
            </FadeUp>
            <ReviewCarousel />
            <p className="mt-8 text-center text-sm text-white/80">
              ※ 실제 이용학생의 후기로 작성되었습니다
            </p>
          </div>
        </section>

        {/* ═══════════ Section 5: 1730 플랜 ═══════════ */}
        <section className="w-full px-4 lg:px-[60px] pt-10 overflow-hidden">
          {/* 상단 배경 */}
          <div className="relative w-full overflow-hidden rounded-2xl">
            <Image
              src={`${IMG}/st5-bg.png`}
              alt=""
              fill
              className="object-cover hidden lg:block"
            />
            <Image
              src={`${IMG}/st5-mo-bg.png`}
              alt=""
              fill
              className="object-cover lg:hidden"
            />
            <div className="relative z-10 flex items-center justify-center py-12 lg:py-16">
              <div className="relative flex h-48 w-48 lg:h-72 lg:w-72 items-center justify-center">
                <Image
                  src={`${IMG}/st5-circle.png`}
                  alt=""
                  fill
                  className="animate-rotate"
                />
                <span className="relative z-10 text-center text-3xl lg:text-5xl font-bold text-white leading-tight">
                  1730
                  <br />
                  플랜
                </span>
              </div>
            </div>
          </div>

          {/* 하단 */}
          <div className="relative flex flex-col items-center gap-8 pb-20 lg:pb-28">
            <Image
              src={`${IMG}/st5-img.png`}
              alt="에듀엣톡 1730플랜"
              width={1000}
              height={400}
              className="w-[90%] lg:w-[80%] h-auto"
            />
            <FadeUp className="rounded-xl bg-[#182D7B] px-6 py-4 text-center text-sm lg:text-2xl text-white leading-relaxed">
              <span className="font-semibold text-yellow-300">D-30day</span> 기준으로
              목표 시험범위 정하고, 학생 스스로가 누적·반복 학습할 수 있는 루틴 플랜
              입니다.
            </FadeUp>
            <Image
              src={`${IMG}/left-person.png`}
              alt=""
              width={310}
              height={400}
              className="absolute left-2 lg:left-12 bottom-0 w-[18%] lg:w-[14%] hidden lg:block"
            />
            <Image
              src={`${IMG}/right-person.png`}
              alt=""
              width={276}
              height={400}
              className="absolute right-2 lg:right-12 bottom-0 w-[15%] lg:w-[12%] hidden lg:block"
            />
          </div>
        </section>

        {/* ═══════════ Section 6: 단권화 학습법 ═══════════ */}
        <section className="w-full px-4 lg:px-[60px]">
          <div className="w-full rounded-2xl bg-[#5C6BC0] py-16 lg:py-24 overflow-hidden">
            <div className="flex flex-col lg:flex-row lg:items-stretch">
              {/* 왼쪽 텍스트 */}
              <div className="px-6 lg:pl-16 lg:w-[45%] flex flex-col gap-6 justify-center">
                <h2 className="text-2xl lg:text-5xl text-white leading-tight">
                  내신과 수능까지 때려잡는
                  <br />
                  <span className="font-extrabold text-3xl lg:text-5xl">
                    단권화 학습법!
                  </span>
                </h2>
                <FadeUp>
                  <Image
                    src={`${IMG}/note.png`}
                    alt="에듀엣톡 단권화 학습법"
                    width={550}
                    height={350}
                    className="w-full h-auto"
                  />
                </FadeUp>
                <p className="text-base lg:text-xl text-white leading-relaxed">
                  기출 문제를 바탕으로 개념·유형·지문을 한 권에 몰아 넣는{" "}
                  <span className="font-bold">단권화 학습법</span>은 내신과 수능에도
                  효과적 입니다.
                </p>
              </div>
              {/* 오른쪽 슬라이드 */}
              <div className="mt-8 lg:mt-0 lg:w-[55%] rounded-l-xl bg-white flex flex-col justify-center overflow-hidden">
                <InfiniteScrollRow images={NOTE_SLIDES_TOP} speed={25} />
                <InfiniteScrollRow images={NOTE_SLIDES_BOTTOM} reverse speed={25} />
              </div>
            </div>
          </div>
        </section>

        {/* ═══════════ Section 7: 13년 학습 솔루션 ═══════════ */}
        <section
          className="relative w-full py-16 lg:py-24 overflow-hidden"
          style={{
            backgroundImage: `url(${IMG}/st9-bg.png)`,
            backgroundPosition: "top center",
            backgroundSize: "100%",
            backgroundRepeat: "no-repeat",
          }}
        >
          <div className="text-center space-y-6">
            <FadeUp>
              <h2 className="text-3xl lg:text-5xl font-bold text-[#182D7B]">
                아무도 따라할 수 없는
                <br />
                <span className="font-extrabold">13년의 학습 솔루션</span>
              </h2>
            </FadeUp>
            <p className="text-base lg:text-xl text-gray-600 leading-relaxed">
              타임레벨업은 에듀엣톡이 다년간의 노하우로,
              <br />
              특허까지 출원한 하나 밖에 없는 학습 솔루션 입니다.
            </p>
          </div>
          <div className="relative mx-auto mt-10 max-w-[1360px] w-[90%] pb-24 lg:pb-32">
            <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between">
              <FadeUp className="lg:w-[55%]">
                <Image
                  src={`${IMG}/st7-img.png`}
                  alt="에듀엣톡 1730 Timetable"
                  width={700}
                  height={500}
                  className="w-full h-auto"
                />
                <span className="mt-4 mx-auto block w-fit rounded-full border border-[#182D7B] px-5 py-2 text-base font-semibold text-[#182D7B]">
                  1730 Timetable
                </span>
              </FadeUp>
              <FadeUp delay={200} className="lg:w-[40%] lg:pt-[10%]">
                <Image
                  src={`${IMG}/st7-img2.png`}
                  alt="에듀엣톡 단권화 학습"
                  width={500}
                  height={500}
                  className="w-full h-auto"
                />
                <span className="mt-4 mx-auto block w-fit rounded-full border border-[#182D7B] px-5 py-2 text-base font-semibold text-[#182D7B]">
                  단권화 학습
                </span>
              </FadeUp>
            </div>
            {/* group.png — absolutely positioned at bottom center between columns */}
            <Image
              src={`${IMG}/group.png`}
              alt=""
              width={514}
              height={300}
              className="absolute bottom-0 left-1/2 w-[35%] max-w-[514px]"
              style={{ transform: "translateX(-50%)" }}
            />
          </div>
        </section>

        {/* ═══════════ Section 8: 학습 캠프 ═══════════ */}
        <section className="w-full bg-[#182D7B] py-16 lg:py-24 overflow-hidden">
          <div className="mx-auto flex max-w-[1280px] w-[90%] flex-col gap-10 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex flex-col gap-8 lg:w-1/2">
              <div>
                <h2 className="text-3xl lg:text-5xl text-white">
                  <span className="font-extrabold">타임레벨업</span> 학습 캠프
                </h2>
                <p className="mt-3 text-base lg:text-lg text-white/80">
                  공부법을 익히고, 자기주도 학습의 루틴을 심어드립니다.
                </p>
              </div>
              <div>
                <div className="flex items-center gap-2 text-white">
                  <Image
                    src={`${IMG}/st8-icon.svg`}
                    alt=""
                    width={40}
                    height={40}
                    className="h-8 w-8"
                  />
                  <span className="text-lg font-semibold">
                    선착순 <span className="text-yellow-300">20명</span> 한정
                  </span>
                </div>
              </div>
              {/* 최근 예약 티커 */}
              <div className="mt-2 overflow-hidden rounded-xl bg-white/10 backdrop-blur-sm p-4" style={{ height: "120px" }}>
                <p className="text-sm font-semibold text-yellow-300 mb-2">최근 예약 현황</p>
                <div className="overflow-hidden" style={{ height: "80px" }}>
                  <div className="animate-ticker">
                    {[
                      "서울 ○○고 2학년 학부모님이 신청하셨습니다.",
                      "경기 ○○고 1학년 학부모님이 신청하셨습니다.",
                      "인천 ○○고 3학년 학부모님이 신청하셨습니다.",
                      "서울 ○○고 1학년 학부모님이 신청하셨습니다.",
                      "대전 ○○고 2학년 학부모님이 신청하셨습니다.",
                      "부산 ○○고 2학년 학부모님이 신청하셨습니다.",
                      "서울 ○○고 2학년 학부모님이 신청하셨습니다.",
                      "경기 ○○고 1학년 학부모님이 신청하셨습니다.",
                      "인천 ○○고 3학년 학부모님이 신청하셨습니다.",
                      "서울 ○○고 1학년 학부모님이 신청하셨습니다.",
                      "대전 ○○고 2학년 학부모님이 신청하셨습니다.",
                      "부산 ○○고 2학년 학부모님이 신청하셨습니다.",
                    ].map((text, i) => (
                      <p key={i} className="text-sm text-white/70 leading-relaxed py-0.5">{text}</p>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <CampSlider />
          </div>

          <FadeUp className="mx-auto mt-12 max-w-[1000px] text-center text-base lg:text-xl text-white leading-relaxed">
            <p>
              대치동 출신 대표 직강을 통한 맞춤형 자기주도 학습캠프
              <br />
              <span className="font-semibold">
                학습 매니저의 일일 점검과 피드백
              </span>
              으로, 자기주도 학습 루틴 형성
            </p>
          </FadeUp>

          <div className="mt-8">
            <MarqueeText dark />
          </div>
        </section>

        {/* ═══════════ Section 9: 캠프 혜택 ═══════════ */}
        <section className="w-full py-16 lg:py-24">
          <FadeUp className="text-center">
            <h2 className="text-3xl lg:text-5xl font-bold text-[#182D7B]">
              타임레벨업
              <br />
              <span className="font-extrabold">캠프 혜택</span>
            </h2>
          </FadeUp>
          <div className="mx-auto mt-12 flex max-w-[1200px] flex-col gap-8 px-6 lg:flex-row lg:justify-center lg:gap-10">
            {[
              {
                icon: "st9-icon.svg",
                text: "개별 맞춤형 timetable 제공\n및 매일 학습 점검",
              },
              {
                icon: "st9-icon2.svg",
                text: "학부모를 위한\n맞춤형 입시 설명회",
              },
              {
                icon: "st9-icon3.svg",
                text: "캠프 참여자 대상\n생기부레벨업 할인 혜택",
              },
            ].map((item, i) => (
              <FadeUp
                key={i}
                delay={i * 150}
                className="flex flex-col items-center justify-center rounded-full bg-gradient-to-b from-[#E4ECFB] to-white text-center shadow-sm flex-1"
                style={{ padding: "clamp(40px, 5vw, 60px)", gap: 20 }}
              >
                <Image
                  src={`${IMG}/${item.icon}`}
                  alt=""
                  width={100}
                  height={100}
                  style={{ width: "clamp(60px, 8vw, 100px)", height: "auto" }}
                />
                <p className="text-sm lg:text-base text-gray-700 leading-relaxed whitespace-pre-line">
                  {item.text}
                </p>
              </FadeUp>
            ))}
          </div>
        </section>

        <MarqueeText />

        {/* ═══════════ Contact: 상담 신청 ═══════════ */}
        <section ref={contactRef} className="w-full bg-[#F4F6FB] py-16 lg:py-24">
          <div className="mx-auto max-w-[800px] px-6">
            <div className="text-center space-y-4 mb-10">
              <h2 className="text-3xl lg:text-5xl font-bold text-[#182D7B]">
                지금 <span className="font-extrabold">상담신청</span> 하시면
              </h2>
              <p className="text-base lg:text-lg text-[#182D7B]">
                <span className="font-semibold rounded-md bg-[#182D7B] text-white px-2 py-1">
                  1730 Timetable 작성법
                </span>
                {" + "}
                <span className="font-semibold rounded-md bg-[#182D7B] text-white px-2 py-1">
                  단권화 노트 학습법(전자책)
                </span>
                을 제공해 드립니다.
              </p>
              <p className="text-lg lg:text-xl text-gray-700 leading-relaxed">
                지금, 공부를 바꿔야 할 시간입니다.
                <br />
                1:1 상담으로 내 아이에게 맞는 학습 전략부터 설계하세요.
              </p>
            </div>

            <FadeUp>
              <form
                onSubmit={handleSubmit}
                className="rounded-2xl bg-white p-6 lg:p-10 shadow-lg space-y-4"
              >
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      학생 학교
                    </label>
                    <input
                      type="text"
                      placeholder="에듀고등학교"
                      value={form.school}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, school: e.target.value }))
                      }
                      className="w-full rounded-lg border border-gray-300 px-4 py-3 text-base focus:border-[#182D7B] focus:ring-1 focus:ring-[#182D7B] outline-none"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      학생 학년
                    </label>
                    <input
                      type="text"
                      placeholder="ex) 1학년"
                      value={form.grade}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, grade: e.target.value }))
                      }
                      className="w-full rounded-lg border border-gray-300 px-4 py-3 text-base focus:border-[#182D7B] focus:ring-1 focus:ring-[#182D7B] outline-none"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      학생 이름
                    </label>
                    <input
                      type="text"
                      placeholder="홍길동"
                      value={form.name}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, name: e.target.value }))
                      }
                      className="w-full rounded-lg border border-gray-300 px-4 py-3 text-base focus:border-[#182D7B] focus:ring-1 focus:ring-[#182D7B] outline-none"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      휴대폰번호
                    </label>
                    <input
                      type="tel"
                      placeholder="'-'없이 입력"
                      maxLength={11}
                      value={form.phone}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          phone: e.target.value.replace(/[^0-9]/g, ""),
                        }))
                      }
                      className="w-full rounded-lg border border-gray-300 px-4 py-3 text-base focus:border-[#182D7B] focus:ring-1 focus:ring-[#182D7B] outline-none"
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    상담 내용
                  </label>
                  <textarea
                    placeholder="상담하실 내용 입력"
                    value={form.desc}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, desc: e.target.value }))
                    }
                    rows={4}
                    className="w-full rounded-lg border border-gray-300 px-4 py-3 text-base focus:border-[#182D7B] focus:ring-1 focus:ring-[#182D7B] outline-none resize-none"
                  />
                </div>
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.agreed}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, agreed: e.target.checked }))
                      }
                      className="h-4 w-4"
                    />
                    개인정보취급방침 동의{" "}
                    <button
                      type="button"
                      onClick={() => setPrivacyOpen(true)}
                      className="font-semibold underline"
                    >
                      약관보기
                    </button>
                  </label>
                  <button
                    type="submit"
                    className="rounded-xl bg-[#182D7B] px-10 py-4 text-lg font-bold text-white hover:bg-[#0f1f5c] transition-colors"
                  >
                    상담 신청
                  </button>
                </div>
              </form>
            </FadeUp>
          </div>
        </section>

        {/* ─── Footer ─── */}
        <footer className="w-full bg-[#111] py-10 px-6">
          <div className="mx-auto flex max-w-[1280px] flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <Image
                src={`${IMG}/footer-logo.png`}
                alt="에듀엣톡"
                width={120}
                height={32}
                className="h-8 w-auto mb-4"
              />
              <div className="text-sm text-gray-400 space-y-1">
                <p>사업자등록번호 : 419-87-02988 | 대표 : 장미희</p>
                <p>
                  주소 : 서울특별시 송파구 법원로128, 비동 1005호
                </p>
                <p>이메일 : eduatalk23@naver.com</p>
                <p className="mt-3 text-gray-500">
                  Copyright &copy; Edu at Talk. ALL RIGHTS RESERVED.
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-400">대표전화</p>
              <p className="text-2xl font-bold text-white">1555-0789</p>
            </div>
          </div>
        </footer>

        {/* ─── 맨 위로 ─── */}
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          className="fixed bottom-6 right-6 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-lg border border-gray-200 hover:bg-gray-50 transition-colors"
          aria-label="맨 위로"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M10 3L4 9M10 3L16 9M10 3V17" stroke="#182D7B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      {/* ─── 개인정보 모달 ─── */}
      {privacyOpen && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60"
          onClick={() => setPrivacyOpen(false)}
        >
          <div
            className="relative w-[90%] max-w-[700px] max-h-[80vh] overflow-y-auto rounded-2xl bg-white p-8"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setPrivacyOpen(false)}
              className="absolute top-4 right-4 text-3xl text-gray-400 hover:text-gray-700"
              aria-label="닫기"
            >
              &times;
            </button>
            <Image src={`${IMG}/logo.png`} alt="에듀엣톡" width={100} height={30} className="h-6 w-auto mb-2" />
            <h3 className="text-xl font-bold mb-4">개인정보처리방침</h3>
            <div className="text-sm text-gray-600 leading-relaxed space-y-3">
              <p>
                에듀엣톡(주)(이하 &quot;회사&quot;라 함)는 회원의 개인정보를 보호하며,
                관련 법령상의 개인정보보호 규정을 준수합니다.
              </p>
              <p className="font-semibold">1. 총칙</p>
              <p>
                가. 개인정보란 생존하는 개인에 관한 정보로서 당해 개인을 식별할 수
                있는 정보를 말합니다.
              </p>
              <p className="font-semibold">2. 수집하는 개인정보 항목 및 이용목적</p>
              <p>
                수집항목: 학교, 학년, 이름, 연락처 / 이용목적: DB수집 및 상담 /
                보유기간: 3년
              </p>
              <p className="font-semibold">개인정보 제3자 제공 동의</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>제공받는 자: 주식회사 라인피알</li>
                <li>이용목적: 홈페이지 DB관리</li>
                <li>제공항목: 휴대전화번호, 성함 등</li>
                <li>보유기간: 홈페이지 운영 기간</li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

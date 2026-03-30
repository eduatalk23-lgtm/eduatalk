"use client";

import { useState, useCallback, type FormEvent } from "react";
import Image from "next/image";

/* ──────────────────────────── 데이터 ──────────────────────────── */

const HERO_IMAGES = [
  { id: 1 },
  { id: 2 },
  { id: 3 },
  { id: 4 },
  { id: 5 },
  { id: 6 },
  { id: 7 },
  { id: 8 },
] as const;

const UNIVERSITY_LOGOS = Array.from({ length: 10 }, (_, i) => ({
  id: i + 1,
  src: `/landing/logo${i + 1}.png`,
  alt: `합격 대학 ${i + 1}`,
}));

const VIDEO_TESTIMONIALS = [
  {
    id: "eKbOG5Adi1M",
    name: "김예원",
    role: "합격생",
    desc: "연세대 교육학부 / 고려대 수학교육과 / 서강대 SCIENCE기반자유전공학부 / 성균관대 수학교육과 / 한양대 수학교육과 합격생",
  },
  {
    id: "B_5aR8whK2o",
    name: "조유미",
    role: "합격생",
    desc: "고려대 심리학과 / 성균관대 심리학과 / 동국대 경찰행정학과 합격생",
  },
  {
    id: "_mmJRDd9FMs",
    name: "김의진",
    role: "합격생",
    desc: "서울대 조경지역시스템공학부 / 서강대 인공지능학과 / 중앙대 소프트웨어학과 합격생",
  },
  {
    id: "z-xwlTszZ78",
    name: "박혜은",
    role: "합격생",
    desc: "카이스트 무학과 / 고려대 화공생명공학 외 3개 대학 합격",
  },
  {
    id: "D1buzTLM_z4",
    name: "유연서",
    role: "합격생",
    desc: "서울대 첨단융합학부 합격생",
  },
  {
    id: "94klnQHUNA4",
    name: "정민재",
    role: "합격생",
    desc: "고려대 전기전자공학과 / 유니스트 합격생",
  },
  {
    id: "bxIVq1ywaPw",
    name: "조연우",
    role: "합격생",
    desc: "이화여대 간호학과 합격생",
  },
  {
    id: "biN4Uaua8rs",
    name: "유연서",
    role: "합격생 어머니",
    desc: "서울대 첨단융합학부 합격생 유연서 학생 학부모 후기 영상",
  },
  {
    id: "tC-XTVPc7qA",
    name: "김의진",
    role: "합격생 어머니",
    desc: "서울대 조경지역시스템공학부 / 서강대 인공지능학과 / 중앙대 소프트웨어학과 합격생 김의진 학생 어머니 후기 영상",
  },
  {
    id: "VAOp-t1EL_g",
    name: "이수아",
    role: "합격생 아버지",
    desc: "서강대 생명과학과 / 경희대 생물학과 합격생 이수아 학생 아버지 후기 영상",
  },
];

const EXTRA_VIDEOS = [
  {
    id: "ehjzJJ_P1Ac",
    name: "김희태",
    role: "합격생",
    desc: "일반고 4.1등급으로 수도권 대학 학생부종합전형 3곳 합격!",
  },
  {
    id: "3KTeGbA-eOI",
    name: "김희태",
    role: "합격생 어머니",
    desc: '"학년이 올라가면서 현실적으로 생각해야 할때 단계별로 조언해주셔 좋은 결과받았어요" 김희태 합격생의 어머니 후기 영상',
  },
];

const GRADE_OPTIONS = [
  "고1",
  "고2",
  "고3",
  "중1",
  "중2",
  "중3(예비고1)",
] as const;

/* ──────────────────────────── 컴포넌트 ──────────────────────────── */

/** 반응형 이미지 섹션 (데스크톱/모바일) */
function ResponsiveImageSection({ id }: { id: number }) {
  return (
    <section className="w-full overflow-hidden">
      {/* 데스크톱 */}
      <Image
        src={`/landing/img${id}.jpg`}
        alt="에듀엣톡 생기부 레벨업"
        width={2000}
        height={800}
        className="hidden w-full h-auto lg:block"
        priority={id <= 2}
      />
      {/* 모바일 */}
      <Image
        src={`/landing/m_img${id}.jpg`}
        alt="에듀엣톡 생기부 레벨업"
        width={750}
        height={800}
        className="block w-full h-auto lg:hidden"
        priority={id <= 2}
      />
    </section>
  );
}

/** YouTube 영상 iframe */
function YouTubeEmbed({
  videoId,
  title,
}: {
  videoId: string;
  title: string;
}) {
  return (
    <div className="relative w-full overflow-hidden rounded-2xl lg:rounded-[40px]" style={{ paddingBottom: "56.25%" }}>
      <iframe
        className="absolute inset-0 w-full h-full"
        src={`https://www.youtube.com/embed/${videoId}`}
        title={title}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        referrerPolicy="strict-origin-when-cross-origin"
        allowFullScreen
      />
    </div>
  );
}

/** 대학 로고 무한 스크롤 캐러셀 */
function LogoCarousel() {
  const doubled = [...UNIVERSITY_LOGOS, ...UNIVERSITY_LOGOS];
  return (
    <div className="relative overflow-hidden">
      <div className="flex gap-8 animate-scroll">
        {doubled.map((logo, i) => (
          <div key={`${logo.id}-${i}`} className="flex-shrink-0 flex items-center justify-center">
            <Image src={logo.src} alt={logo.alt} width={180} height={80} className="h-16 w-auto lg:h-20" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** 개인정보 수집 팝업 */
function PrivacyModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className="relative w-[90%] max-w-[768px] max-h-[80vh] overflow-y-auto rounded-lg bg-white p-8 lg:p-12"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-3xl text-gray-500 hover:text-gray-800"
          aria-label="닫기"
        >
          &times;
        </button>
        <h3 className="mb-4 text-lg font-bold">에듀엣톡 개인정보</h3>
        <div className="text-sm leading-relaxed text-gray-600 space-y-3">
          <p>
            에듀엣톡(주)(이하 &quot;회사&quot;라 함)는 회원의 개인정보를 보호하며,
            &quot;정보통신망 이용촉진 및 정보보호 등에 관한 법률&quot;,
            &quot;개인정보보호법&quot;, &quot;통신비밀보호법&quot; 등 관련 법령상의
            개인정보보호 규정을 준수하고, 관련 법령에 의거한 개인정보취급방침을 아래와
            같이 정하여 이용자 권익 보호에 최선을 다하겠습니다.
          </p>
          <p className="font-semibold">1. 총칙</p>
          <p>
            가. 개인정보란 생존하는 개인에 관한 정보로서 당해 정보에 포함되어 있는
            사항에 의하여 당해 개인을 식별할 수 있는 정보를 말합니다.
          </p>
          <p>
            나. 개인정보처리방침은 법률개정, 정부의 지침변경, 회사의 보안정책 변경
            등의 이유로 변경될 수 있으며, 개인정보처리방침을 개정하는 경우 웹사이트
            등을 통해 공지할 예정입니다.
          </p>
          <p className="font-semibold">2. 수집하는 개인정보 항목 및 이용목적</p>
          <p>
            회사는 본 홈페이지를 통해 개인정보를 제공하신 회원을 대상으로 &quot;1:1상담
            서비스&quot;를 운영하고 있습니다.
          </p>
          <p>가. 수집 정보: 연락처 / 이용목적: DB수집 및 상담 / 보유기간: 3년</p>
          <p className="font-semibold">개인정보 제3자 제공 동의</p>
          <p>
            에듀엣톡은 정보주체의 동의, 법률의 특별한 규정 등 「개인정보보호법」
            제17조 및 제18조에 해당하는 경우에만 개인정보를 제3자에게 제공합니다.
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li>개인정보를 제공받는 자: 주식회사 라인피알</li>
            <li>제공받는 자의 개인정보 이용목적: 홈페이지 DB관리</li>
            <li>제공하는 개인정보 항목: 휴대전화번호, 성함 등</li>
            <li>제공받는 자의 보유·이용 기간: 홈페이지 운영 기간</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

/* ──────────────────────────── 메인 페이지 ──────────────────────────── */

export default function LandingPage() {
  const [grade, setGrade] = useState("");
  const [phone, setPhone] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [mobileQuickOpen, setMobileQuickOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const handleSubmit = useCallback(
    (e: FormEvent) => {
      e.preventDefault();
      if (!grade) {
        alert("학년을 선택해주십시오.");
        return;
      }
      if (!phone) {
        alert("연락처를 입력해주십시오.");
        return;
      }
      if (!agreed) {
        alert("개인정보 수집에 동의하셔야 합니다.");
        return;
      }
      alert("상담 신청이 완료되었습니다.");
    },
    [grade, phone, agreed],
  );

  const handlePhoneInput = useCallback(
    (value: string) => setPhone(value.replace(/[^0-9]/g, "")),
    [],
  );

  /* ──── 상담 폼 (공통) ──── */
  const inputStyle: React.CSSProperties = {
    backgroundColor: "rgba(255,255,255,0.15)",
  };
  const btnH = "h-[42px]"; // 모든 버튼/링크 통일 높이

  const consultForm = (
    <form
      onSubmit={handleSubmit}
      className="w-full rounded-xl"
      style={{ backgroundColor: "rgba(0,0,0,0.45)", backdropFilter: "blur(6px)", padding: 14 }}
    >
      {/* 입력 필드 + 신청 버튼 + 링크 버튼 — 동일 gap */}
      <div className="flex flex-col" style={{ gap: 6 }}>
        <select
          value={grade}
          onChange={(e) => setGrade(e.target.value)}
          className={`w-full ${btnH} rounded-lg border border-white/30 px-3 text-sm text-white outline-none transition-colors focus:border-sky-400 focus:ring-1 focus:ring-sky-400`}
          style={inputStyle}
        >
          <option value="" className="text-gray-800">신청학년</option>
          {GRADE_OPTIONS.map((g) => (
            <option key={g} value={g} className="text-gray-800">
              {g}
            </option>
          ))}
        </select>

        <input
          type="text"
          value={phone}
          onChange={(e) => handlePhoneInput(e.target.value)}
          placeholder="연락처(ex.01012345678)"
          maxLength={11}
          className={`w-full ${btnH} rounded-lg border border-white/30 px-3 text-sm text-white placeholder-white/60 outline-none transition-colors focus:border-sky-400 focus:ring-1 focus:ring-sky-400`}
          style={inputStyle}
        />

        <button
          type="submit"
          className={`w-full ${btnH} rounded-lg text-sm font-bold text-white transition-colors hover:brightness-110`}
          style={{ backgroundColor: "#2563eb" }}
        >
          상담 신청하기
        </button>

        <a
          href="http://pf.kakao.com/_pAshn"
          target="_blank"
          rel="noopener noreferrer"
          className={`flex w-full ${btnH} items-center justify-center gap-1.5 rounded-lg text-sm font-semibold text-gray-900 transition-colors hover:brightness-95`}
          style={{ backgroundColor: "#FEE500" }}
        >
          <svg width="16" height="16" viewBox="0 0 18 18" fill="none"><path d="M9 1C4.58 1 1 3.8 1 7.24c0 2.17 1.43 4.08 3.58 5.17l-.91 3.34c-.08.28.24.5.48.34l3.97-2.62c.29.03.58.05.88.05 4.42 0 8-2.8 8-6.28S13.42 1 9 1z" fill="#3C1E1E"/></svg>
          카카오톡 채널
        </a>

        <a
          href="https://eduatalk.com/eduatalk/main"
          target="_blank"
          rel="noopener noreferrer"
          className={`flex w-full ${btnH} items-center justify-center gap-1.5 rounded-lg text-sm font-semibold text-white transition-colors hover:brightness-110`}
          style={{ backgroundColor: "#334155" }}
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M8 1L1 5.5V14h5v-4h4v4h5V5.5L8 1z" fill="#fff"/></svg>
          홈페이지 바로가기
        </a>

        <a
          href="https://eduatalk.co.kr"
          target="_blank"
          rel="noopener noreferrer"
          className={`flex w-full ${btnH} items-center justify-center gap-1.5 rounded-lg text-sm font-semibold text-white transition-colors hover:brightness-110`}
          style={{ backgroundColor: "#4f46e5" }}
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M8 2v12M2 8h12" stroke="#fff" strokeWidth="2" strokeLinecap="round"/></svg>
          타임레벨업 바로가기
        </a>
      </div>

      {/* 개인정보 동의 */}
      <label className="flex items-center gap-2 cursor-pointer" style={{ marginTop: 10 }}>
        <span
          className="flex flex-shrink-0 items-center justify-center rounded border transition-colors"
          style={{
            width: 18,
            height: 18,
            borderColor: agreed ? "#38bdf8" : "rgba(255,255,255,0.4)",
            backgroundColor: agreed ? "#0ea5e9" : "transparent",
          }}
        >
          {agreed && (
            <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
              <path d="M2.5 6L5 8.5L9.5 3.5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </span>
        <input
          type="checkbox"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
          className="sr-only"
        />
        <button
          type="button"
          onClick={() => setPrivacyOpen(true)}
          className="text-xs text-white/80 underline underline-offset-2 hover:text-white text-left transition-colors"
        >
          개인정보 수집·이용 동의 [자세히]
        </button>
      </label>
    </form>
  );

  return (
    <>
      {/* ─── CSS 키프레임 ─── */}
      <style>{`
        @keyframes scroll {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .animate-scroll {
          animation: scroll 30s linear infinite;
        }
        .animate-scroll:hover {
          animation-play-state: paused;
        }
      `}</style>

      <div className="relative w-full overflow-x-hidden bg-white font-[Pretendard,sans-serif]">
        {/* ═══════════════ 데스크톱: 토글 버튼 (항상 화면 안에 고정) ═══════════════ */}
        <button
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          className="hidden lg:flex fixed top-1/2 z-50 items-center justify-center"
          style={{
            transform: "translateY(-50%)",
            right: sidebarCollapsed ? 0 : 292,
            width: 44,
            height: 44,
            backgroundColor: "#000",
            borderTopLeftRadius: 10,
            borderBottomLeftRadius: 10,
            boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
            transition: "right 0.3s ease",
          }}
          aria-label={sidebarCollapsed ? "상담 폼 펼치기" : "상담 폼 접기"}
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 20 20"
            fill="none"
            style={{
              transform: sidebarCollapsed ? "rotate(0deg)" : "rotate(180deg)",
              transition: "transform 0.3s ease",
            }}
          >
            <path d="M13 4L7 10L13 16" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        {/* ═══════════════ 데스크톱 사이드바 상담 폼 ═══════════════ */}
        <aside
          className="hidden lg:block fixed top-1/2 z-50 w-[280px] overflow-hidden rounded-2xl"
          style={{
            transform: "translateY(-50%)",
            right: sidebarCollapsed ? -290 : 12,
            transition: "right 0.3s ease",
            backgroundImage: "url(/landing/bg3.jpg)",
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        >
          <div className="px-3 pt-4 pb-3">
            <div className="mb-3">
              <Image
                src="/landing/title5.png"
                alt="수시합격 매뉴얼 에듀엣톡 1:1상담"
                width={240}
                height={60}
                className="w-full h-auto"
              />
            </div>
            {consultForm}
          </div>
        </aside>

        {/* ═══════════════ 모바일 하단 CTA ═══════════════ */}
        <div className="fixed bottom-0 left-0 right-0 z-[9999] lg:hidden">
          <button
            onClick={() => setMobileQuickOpen(true)}
            className="w-full"
          >
            <Image
              src="/landing/m_btn_gif.gif"
              alt="상담 신청하기"
              width={750}
              height={80}
              className="w-full h-auto"
              unoptimized
            />
          </button>
        </div>

        {/* 모바일 상담 팝업 */}
        {mobileQuickOpen && (
          <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/50 lg:hidden">
            <div
              className="relative w-[90%] max-w-[400px] overflow-hidden rounded-2xl"
              style={{
                backgroundImage: "url(/landing/bg3.jpg)",
                backgroundSize: "cover",
                backgroundPosition: "center",
              }}
            >
              <button
                onClick={() => setMobileQuickOpen(false)}
                className="absolute top-3 right-4 z-10 flex h-8 w-8 items-center justify-center rounded-full text-white"
                style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
                aria-label="닫기"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M4 4L12 12M12 4L4 12" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </button>
              <div className="px-4 pt-10 pb-4">
                <div className="mb-3">
                  <Image
                    src="/landing/title5.png"
                    alt="수시합격 매뉴얼 에듀엣톡 1:1상담"
                    width={400}
                    height={80}
                    className="w-full h-auto"
                  />
                </div>
                {consultForm}
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════ 히어로 이미지 섹션들 (1~8) ═══════════════ */}
        {HERO_IMAGES.map(({ id }) => (
          <ResponsiveImageSection key={id} id={id} />
        ))}

        {/* ═══════════════ 대학 합격 로고 캐러셀 ═══════════════ */}
        <section
          className="w-full py-16 lg:py-32 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: "url(/landing/bg1.jpg)" }}
        >
          <div className="mx-auto max-w-[1200px] px-5">
            <div className="mb-8 lg:mb-12 text-center">
              <Image
                src="/landing/title1.png"
                alt="에듀엣톡 합격 대학"
                width={600}
                height={80}
                className="mx-auto hidden h-auto lg:block"
              />
              <Image
                src="/landing/m_title1.png"
                alt="에듀엣톡 합격 대학"
                width={400}
                height={60}
                className="mx-auto block h-auto lg:hidden"
              />
            </div>
            <LogoCarousel />
          </div>
        </section>

        {/* ═══════════════ 이미지 9 ═══════════════ */}
        <ResponsiveImageSection id={9} />

        {/* ═══════════════ 합격생 인터뷰 영상 ═══════════════ */}
        <section className="w-full bg-[#f0f4fb] py-12 lg:py-24">
          <div className="mx-auto max-w-[1200px] px-5">
            <div className="mb-8 lg:mb-12 text-center">
              <Image
                src="/landing/title2.png"
                alt="합격생 인터뷰"
                width={600}
                height={80}
                className="mx-auto hidden h-auto lg:block"
              />
              <Image
                src="/landing/m_title2.png"
                alt="합격생 인터뷰"
                width={400}
                height={60}
                className="mx-auto block h-auto px-12 lg:hidden"
              />
            </div>
            <p className="mb-8 text-center text-sm text-gray-500">
              * 실제 합격사례에 의한 영상입니다.
            </p>

            <div className="grid grid-cols-1 gap-8 lg:grid-cols-3 lg:gap-x-6 lg:gap-y-12 lg:px-12">
              {VIDEO_TESTIMONIALS.map((v) => (
                <div key={v.id} className="space-y-4">
                  <YouTubeEmbed videoId={v.id} title={`${v.name} ${v.role} 인터뷰`} />
                  <div className="text-center">
                    <h3 className="text-xl lg:text-2xl">
                      <span className="font-extrabold">{v.name}</span>{" "}
                      {v.role}
                    </h3>
                    <p className="mt-1 text-sm leading-relaxed text-gray-600 lg:text-base">
                      {v.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ═══════════════ 추가 합격생 영상 ═══════════════ */}
        <section className="w-full bg-[#f0f4fb] px-5 pb-12 lg:pb-16">
          <div className="mx-auto max-w-[1100px]">
            <h2 className="mb-3 text-center text-xl font-bold text-gray-800 lg:text-3xl">
              <span>묵묵히 걸어온 노력의 끝,</span>{" "}
              <strong className="text-[#2d5bc2]">합격</strong>으로 증명한 학생
            </h2>
            <p className="mb-8 text-center text-sm text-gray-500">
              * 실제 합격사례에 의한 영상입니다.
            </p>

            <div className="flex flex-col items-center gap-8 rounded-2xl bg-[#d8e1ec] p-6 lg:flex-row lg:justify-center lg:gap-10 lg:p-8">
              {EXTRA_VIDEOS.map((v) => (
                <div key={v.id} className="w-full max-w-[360px]">
                  <div className="overflow-hidden rounded-2xl">
                    <iframe
                      className="aspect-video w-full"
                      src={`https://www.youtube.com/embed/${v.id}`}
                      title={`${v.name} ${v.role} 인터뷰`}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                      allowFullScreen
                    />
                  </div>
                  <div className="mt-3 text-center">
                    <h3 className="text-lg font-bold lg:text-2xl">
                      <strong>{v.name}</strong> {v.role}
                    </h3>
                    <p className="mt-1 text-sm leading-relaxed text-gray-700">
                      {v.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ═══════════════ 대표 소개 영상 ═══════════════ */}
        <section
          className="w-full py-12 lg:py-24 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: "url(/landing/bg2.jpg)" }}
        >
          <div className="mx-auto max-w-[1200px] px-5">
            <div className="mb-8 lg:mb-12 text-center">
              <Image
                src="/landing/title3.png"
                alt="에듀엣톡 대표 소개"
                width={600}
                height={80}
                className="mx-auto hidden h-auto lg:block"
              />
              <Image
                src="/landing/m_title3.png"
                alt="에듀엣톡 대표 소개"
                width={400}
                height={60}
                className="mx-auto block h-auto px-12 lg:hidden"
              />
            </div>

            <YouTubeEmbed videoId="We1-ryJS-cY" title="에듀엣톡 대표 소개" />

            <div className="-mt-4 rounded-b-2xl bg-[#1c6bc5] px-5 pb-8 pt-14 text-center lg:-mt-10 lg:pt-20">
              <Image
                src="/landing/title4.png"
                alt="에듀엣톡 생기부 레벨업"
                width={500}
                height={60}
                className="mx-auto h-auto"
              />
            </div>
          </div>
        </section>

        {/* ═══════════════ 하단 이미지 섹션 (11, 10) ═══════════════ */}
        <ResponsiveImageSection id={11} />
        <ResponsiveImageSection id={10} />

        {/* 모바일 하단 여백 (CTA 바 겹침 방지) */}
        <div className="h-16 lg:hidden" />
      </div>

      {/* ═══════════════ 개인정보 팝업 ═══════════════ */}
      <PrivacyModal open={privacyOpen} onClose={() => setPrivacyOpen(false)} />
    </>
  );
}

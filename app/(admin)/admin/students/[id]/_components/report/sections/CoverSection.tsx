interface CoverSectionProps {
  studentName: string | null;
  schoolName: string | null;
  grade: number;
  className: string | null;
  targetMajor: string | null;
  consultantName: string | null;
  generatedAt: string;
  /** 표지 시각 변형 */
  variant?: "A" | "B" | "C" | "D" | "E";
}

import { GraphicA } from "./GraphicA";

/* ═══════════════════════════════════════════
 * Variant B — 플로우 필드 (Flow Field)
 * 전 페이지를 관통하는 흐름 곡선
 * ═══════════════════════════════════════════ */
function GraphicB() {
  const curves = [
    "M -40 1100 C 150 1020, 300 850, 420 700 S 620 450, 750 300 S 820 100, 840 -20",
    "M -40 1000 C 140 930, 280 780, 400 640 S 590 400, 730 260 S 810 60, 840 -60",
    "M -40 900 C 130 840, 265 710, 385 580 S 565 350, 710 220 S 800 30, 840 -100",
    "M -40 800 C 120 750, 250 640, 370 520 S 540 310, 690 185 S 790 0, 840 -130",
    "M -40 700 C 110 660, 235 570, 355 460 S 520 270, 670 150 S 780 -20, 840 -160",
    "M -40 600 C 100 565, 220 490, 340 400 S 500 230, 650 115 S 770 -40, 840 -190",
    "M -40 500 C 90 475, 205 415, 325 340 S 480 195, 630 85 S 760 -55, 840 -215",
    "M -40 400 C 80 382, 190 335, 310 280 S 460 155, 615 55 S 750 -65, 840 -240",
    "M -40 310 C 72 295, 178 260, 295 220 S 445 118, 600 30 S 740 -75, 840 -260",
    "M -40 220 C 65 210, 165 185, 280 158 S 430 82, 585 5 S 730 -85, 840 -280",
    "M -40 140 C 58 132, 150 115, 268 98 S 415 48, 572 -18 S 722 -92, 840 -295",
  ];

  return (
    <svg className="absolute inset-0 h-full w-full" viewBox="0 0 794 1123" fill="none" preserveAspectRatio="xMidYMid slice">
      {curves.map((d, i) => (
        <path
          key={i}
          d={d}
          stroke="white"
          strokeWidth={i === 2 || i === 6 ? 1.2 : 0.5}
          opacity={0.08 + (i % 3 === 0 ? 0.1 : 0.03)}
          strokeLinecap="round"
        />
      ))}
      {[
        [420, 700, 3.5], [385, 580, 3], [355, 460, 4], [340, 400, 2.5],
        [620, 300, 3], [500, 230, 2], [325, 340, 3], [250, 640, 2],
        [690, 185, 2.5], [150, 850, 2], [580, 400, 2],
      ].map(([cx, cy, r], i) => (
        <circle key={i} cx={cx} cy={cy} r={r} fill="white" opacity={0.22} />
      ))}
      <line x1={420} y1={700} x2={385} y2={580} stroke="white" strokeWidth={0.5} opacity={0.15} />
      <line x1={385} y1={580} x2={355} y2={460} stroke="white" strokeWidth={0.5} opacity={0.15} />
      <line x1={355} y1={460} x2={340} y2={400} stroke="white" strokeWidth={0.5} opacity={0.12} />
      <line x1={620} y1={300} x2={500} y2={230} stroke="white" strokeWidth={0.4} opacity={0.12} />
      <line x1={500} y1={230} x2={355} y2={460} stroke="white" strokeWidth={0.4} opacity={0.1} />
    </svg>
  );
}

/* ═══════════════════════════════════════════
 * Variant C — 테셀레이션 (Hexagonal Tessellation)
 * 전 페이지 육각 격자, 가장자리까지 자연스럽게 페이드
 * ═══════════════════════════════════════════ */
function GraphicC() {
  const hexPath = (cx: number, cy: number, r: number) => {
    const pts = Array.from({ length: 6 }, (_, i) => {
      const a = (Math.PI / 3) * i - Math.PI / 6;
      return `${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`;
    });
    return `M ${pts.join(" L ")} Z`;
  };

  const R = 32;
  const W = 794;
  const H = 1123;
  const hexes: { cx: number; cy: number; opacity: number; filled: boolean }[] = [];
  // 밀도 중심: 우상단 (600, 200)
  const focusX = 600;
  const focusY = 250;
  const maxDist = Math.sqrt(W * W + H * H);

  const cols = Math.ceil(W / (R * 1.75)) + 2;
  const rows = Math.ceil(H / (R * 1.52)) + 2;

  for (let row = -1; row < rows; row++) {
    for (let col = -1; col < cols; col++) {
      const cx = col * R * 1.75 + (row % 2 === 1 ? R * 0.875 : 0);
      const cy = row * R * 1.52;
      const dist = Math.sqrt((cx - focusX) ** 2 + (cy - focusY) ** 2);
      const opacity = Math.max(0, 0.25 - (dist / maxDist) * 0.4);
      if (opacity < 0.04) continue;
      const filled = (row * 7 + col * 13) % 11 < 2;
      hexes.push({ cx, cy, opacity, filled });
    }
  }

  return (
    <svg className="absolute inset-0 h-full w-full" viewBox="0 0 794 1123" fill="none" preserveAspectRatio="xMidYMid slice">
      {hexes.map(({ cx, cy, opacity, filled }, i) => (
        <path
          key={i}
          d={hexPath(cx, cy, R * 0.92)}
          stroke="white"
          strokeWidth={filled ? 0.7 : 0.35}
          opacity={opacity}
          fill={filled ? "white" : "none"}
          fillOpacity={filled ? 0.04 : 0}
        />
      ))}
    </svg>
  );
}

/* ═══════════════════════════════════════════
 * Variant D — 프래그먼트 (Fragmented Geometry)
 * 불완전한 기하 도형의 겹침
 * ═══════════════════════════════════════════ */
function GraphicD() {
  return (
    <svg className="absolute inset-0 h-full w-full" viewBox="0 0 794 1123" fill="none" preserveAspectRatio="xMidYMid slice">
      {/* 큰 원 — 3/4 호 */}
      <path d="M 600 200 A 280 280 0 1 1 320 480" stroke="white" strokeWidth={1} opacity={0.2} strokeLinecap="round" />
      <path d="M 650 650 A 220 220 0 0 1 250 780" stroke="white" strokeWidth={0.7} opacity={0.16} strokeLinecap="round" />
      <path d="M 150 150 A 120 120 0 0 1 350 200" stroke="white" strokeWidth={0.6} opacity={0.14} strokeLinecap="round" />

      <line x1={100} y1={180} x2={700} y2={750} stroke="white" strokeWidth={0.4} opacity={0.14} />
      <line x1={200} y1={100} x2={750} y2={600} stroke="white" strokeWidth={0.3} opacity={0.1} />

      <path d="M 500 300 L 650 650" stroke="white" strokeWidth={0.5} opacity={0.14} />
      <path d="M 650 650 L 350 600" stroke="white" strokeWidth={0.5} opacity={0.14} />

      <path d="M 400 350 L 620 350" stroke="white" strokeWidth={0.4} opacity={0.12} />
      <path d="M 620 350 L 620 600" stroke="white" strokeWidth={0.4} opacity={0.12} />

      {[
        [500, 300, 3.5], [650, 650, 4], [350, 600, 3], [400, 350, 2.5],
        [620, 350, 2.5], [620, 600, 2.5], [300, 480, 3], [550, 500, 2],
        [200, 200, 2], [700, 400, 2],
      ].map(([cx, cy, r], i) => (
        <circle key={i} cx={cx} cy={cy} r={r} fill="white" opacity={0.22} />
      ))}
      <line x1={500} y1={300} x2={400} y2={350} stroke="white" strokeWidth={0.4} opacity={0.14} />
      <line x1={550} y1={500} x2={620} y2={600} stroke="white" strokeWidth={0.4} opacity={0.12} />
      <line x1={300} y1={480} x2={350} y2={600} stroke="white" strokeWidth={0.4} opacity={0.12} />

      <path d="M 180 400 A 50 50 0 0 1 240 380" stroke="white" strokeWidth={0.35} opacity={0.12} />
      <path d="M 680 520 A 35 35 0 0 0 700 560" stroke="white" strokeWidth={0.35} opacity={0.12} />
    </svg>
  );
}

/* ═══════════════════════════════════════════
 * Variant E — 비대칭 호 (이전 버전)
 * ═══════════════════════════════════════════ */
function GraphicE() {
  return (
    <svg className="absolute inset-0 h-full w-full" viewBox="0 0 794 1123" fill="none" preserveAspectRatio="xMidYMid slice">
      {/* 비대칭 호 */}
      <path d="M 780 480 A 350 350 0 1 0 580 820" stroke="white" strokeWidth={0.6} opacity={0.18} />
      <path d="M 450 120 A 300 300 0 0 1 750 480" stroke="white" strokeWidth={1} opacity={0.16} />
      <path d="M 120 680 A 300 300 0 0 0 450 870" stroke="white" strokeWidth={0.5} opacity={0.12} />
      <path d="M 630 280 A 220 220 0 0 1 650 680" stroke="white" strokeWidth={1.2} opacity={0.15} />
      <path d="M 520 250 A 170 170 0 0 1 600 480" stroke="white" strokeWidth={0.7} opacity={0.18} />
      <path d="M 480 420 A 100 100 0 0 1 380 560" stroke="white" strokeWidth={0.5} opacity={0.15} />

      {/* 방사선 */}
      {[
        { deg: 15, inner: 130, outer: 330 },
        { deg: 48, inner: 190, outer: 350 },
        { deg: 85, inner: 150, outer: 260 },
        { deg: 140, inner: 110, outer: 350 },
        { deg: 200, inner: 200, outer: 310 },
        { deg: 260, inner: 130, outer: 300 },
        { deg: 310, inner: 170, outer: 350 },
        { deg: 345, inner: 130, outer: 240 },
      ].map(({ deg, inner, outer }) => {
        const rad = (deg * Math.PI) / 180;
        const cx = 500, cy = 480;
        return (
          <line key={deg}
            x1={cx + inner * Math.cos(rad)} y1={cy + inner * Math.sin(rad)}
            x2={cx + outer * Math.cos(rad)} y2={cy + outer * Math.sin(rad)}
            stroke="white" strokeWidth={0.5} opacity={0.14}
          />
        );
      })}

      {/* 도트 + 연결 */}
      {(() => {
        const pts = [
          { deg: 25, r: 340 }, { deg: 70, r: 300 }, { deg: 130, r: 330 },
          { deg: 290, r: 345 }, { deg: 320, r: 300 }, { deg: 50, r: 230 },
        ];
        const cx = 500, cy = 480;
        const toXY = (d: number, r: number) => ({
          x: cx + r * Math.cos((d * Math.PI) / 180),
          y: cy + r * Math.sin((d * Math.PI) / 180),
        });
        const links: [number, number][] = [[0, 1], [1, 5], [1, 2], [3, 4], [4, 5]];
        return links.map(([a, b], i) => {
          const p1 = toXY(pts[a].deg, pts[a].r);
          const p2 = toXY(pts[b].deg, pts[b].r);
          return (
            <line key={`link${i}`}
              x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y}
              stroke="white" strokeWidth={0.6} opacity={0.15}
            />
          );
        });
      })()}
      {[
        { deg: 25, r: 340, size: 4 }, { deg: 70, r: 300, size: 3 },
        { deg: 130, r: 330, size: 4.5 }, { deg: 185, r: 300, size: 2.5 },
        { deg: 290, r: 345, size: 3.5 }, { deg: 340, r: 230, size: 3.5 },
        { deg: 50, r: 230, size: 2.5 }, { deg: 320, r: 300, size: 3 },
      ].map(({ deg, r, size }, i) => {
        const rad = (deg * Math.PI) / 180;
        return (
          <circle key={i}
            cx={500 + r * Math.cos(rad)} cy={480 + r * Math.sin(rad)}
            r={size} fill="white" opacity={0.22}
          />
        );
      })}

      {/* 틱 마크 */}
      {[20, 55, 90, 115, 160, 210, 275, 330].map((deg) => {
        const rad = (deg * Math.PI) / 180;
        return (
          <line key={deg}
            x1={500 + 340 * Math.cos(rad)} y1={480 + 340 * Math.sin(rad)}
            x2={500 + 360 * Math.cos(rad)} y2={480 + 360 * Math.sin(rad)}
            stroke="white" strokeWidth={0.8} opacity={0.16}
          />
        );
      })}
    </svg>
  );
}

const GRAPHIC_MAP = { A: GraphicA, B: GraphicB, C: GraphicC, D: GraphicD, E: GraphicE };

export function CoverSection({
  studentName,
  schoolName,
  grade,
  className,
  targetMajor,
  consultantName,
  generatedAt,
  variant = "A",
}: CoverSectionProps) {
  const date = new Date(generatedAt);
  const dateStr = `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일`;
  const Graphic = GRAPHIC_MAP[variant];

  return (
    <section className="relative flex h-full flex-col overflow-hidden bg-gradient-to-b from-indigo-700 via-indigo-800 to-[#1e1b4b] print-avoid-break">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute right-0 top-0 h-full w-2/5 bg-gradient-to-l from-white/[0.04] to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 h-1/3 bg-gradient-to-t from-black/[0.12] to-transparent" />
      </div>

      <div className="pointer-events-none absolute inset-0">
        <Graphic />
      </div>

      <div className="relative px-16 pt-20">
        <p className="text-[13px] font-semibold tracking-[0.2em] text-indigo-300">
          수시 컨설팅
        </p>
      </div>

      <div className="relative flex flex-1 flex-col px-16 pt-16">
        <h1 className="font-serif text-[44px] font-bold leading-[1.25] text-white">
          학생부 종합
          <br />
          컨설팅 리포트
        </h1>

        <div className="mt-14 space-y-3">
          <p className="font-serif text-[28px] font-bold leading-[1.3] text-white">
            {studentName ?? "이름 없음"}
          </p>
          <p className="text-[15px] text-indigo-100">
            {schoolName ?? "-"} · {grade}학년
            {className ? ` ${className}반` : ""}
          </p>
          {targetMajor && (
            <p className="text-[14px] text-indigo-200">
              목표 전공 —{" "}
              <span className="font-medium text-white">{targetMajor}</span>
            </p>
          )}
        </div>
      </div>

      <div className="relative mx-16 flex items-end justify-between pb-16">
        <div>
          {consultantName && (
            <>
              <p className="text-[11px] font-medium uppercase tracking-[0.15em] text-indigo-300">
                담당 컨설턴트
              </p>
              <p className="mt-1 text-[14px] font-medium text-white">
                {consultantName}
              </p>
            </>
          )}
        </div>
        <div className="text-right">
          <p className="text-[11px] font-medium uppercase tracking-[0.15em] text-indigo-300">
            발행일
          </p>
          <p className="mt-1 text-[14px] font-medium text-white">
            {dateStr}
          </p>
        </div>
      </div>
    </section>
  );
}

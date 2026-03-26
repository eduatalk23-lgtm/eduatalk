/**
 * Variant A — 등고선 (Topographic Contours)
 * 가우시안 봉우리 2개 + 마칭 스퀘어 알고리즘으로 수학적으로 생성
 * 교차 불가능 — 레벨셋의 수학적 성질
 */

const W = 794, H = 1123;
const COLS = 100, ROWS = 140;
const CW = W / COLS, CH = H / ROWS;

// 주 봉우리 + 보조 언덕/골짜기로 불규칙한 지형 생성
const BUMPS = [
  // 주 봉우리 2개
  { cx: 560, cy: 300, sx: 180, sy: 220, h: 1.0 },
  { cx: 240, cy: 750, sx: 160, sy: 195, h: 0.92 },
  // 보조 언덕 — 크고 강하게 찌그러뜨림
  { cx: 700, cy: 180, sx: 110, sy: 90, h: 0.35 },
  { cx: 440, cy: 430, sx: 85, sy: 120, h: 0.28 },
  { cx: 120, cy: 560, sx: 100, sy: 80, h: 0.22 },
  { cx: 370, cy: 880, sx: 120, sy: 95, h: 0.3 },
  { cx: 720, cy: 620, sx: 75, sy: 110, h: 0.2 },
  { cx: 80, cy: 180, sx: 130, sy: 95, h: 0.18 },
  { cx: 510, cy: 80, sx: 90, sy: 70, h: 0.2 },
  { cx: 670, cy: 920, sx: 95, sy: 85, h: 0.16 },
  { cx: 320, cy: 200, sx: 70, sy: 90, h: 0.15 },
  { cx: 580, cy: 550, sx: 60, sy: 75, h: 0.12 },
  { cx: 150, cy: 950, sx: 110, sy: 80, h: 0.14 },
  { cx: 750, cy: 400, sx: 80, sy: 65, h: 0.13 },
  // 골짜기 (음수) — 등고선을 안쪽으로 밀어넣음
  { cx: 400, cy: 530, sx: 100, sy: 90, h: -0.15 },
  { cx: 140, cy: 400, sx: 80, sy: 90, h: -0.1 },
  { cx: 650, cy: 480, sx: 70, sy: 80, h: -0.08 },
  { cx: 300, cy: 600, sx: 90, sy: 70, h: -0.07 },
];

// 다중 주파수 사인 교란 — 넓은 변형 + 세밀한 울퉁불퉁
function perturb(x: number, y: number): number {
  return 0.05 * Math.sin(x * 0.007 + 0.5) * Math.cos(y * 0.005 + 1.2)
       + 0.04 * Math.sin(x * 0.013 + 2.0) * Math.sin(y * 0.009 + 0.7)
       + 0.03 * Math.cos(x * 0.018 - y * 0.012 + 3.0)
       + 0.02 * Math.sin(x * 0.025 + y * 0.02 + 1.5)
       + 0.015 * Math.cos(x * 0.032 - y * 0.028 + 4.2);
}

function height(x: number, y: number): number {
  let v = 0;
  for (const b of BUMPS) {
    const dx = (x - b.cx) / b.sx;
    const dy = (y - b.cy) / b.sy;
    v += b.h * Math.exp(-(dx * dx + dy * dy));
  }
  return v + perturb(x, y);
}

// 그리드 샘플링
function buildGrid(): number[][] {
  const g: number[][] = [];
  for (let r = 0; r <= ROWS; r++) {
    g[r] = [];
    for (let c = 0; c <= COLS; c++) {
      g[r][c] = height(c * CW, r * CH);
    }
  }
  return g;
}

type Pt = [number, number];
type Seg = [Pt, Pt];

// 마칭 스퀘어
function marchingSquares(grid: number[][], level: number): Seg[] {
  const segs: Seg[] = [];
  const lerp = (a: number, b: number) => Math.max(0, Math.min(1, (level - a) / (b - a)));

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const tl = grid[r][c], tr = grid[r][c + 1];
      const br = grid[r + 1][c + 1], bl = grid[r + 1][c];
      const idx = (tl >= level ? 8 : 0) | (tr >= level ? 4 : 0) | (br >= level ? 2 : 0) | (bl >= level ? 1 : 0);
      if (idx === 0 || idx === 15) continue;

      const x = c * CW, y = r * CH;
      const top: Pt = [x + lerp(tl, tr) * CW, y];
      const right: Pt = [x + CW, y + lerp(tr, br) * CH];
      const bottom: Pt = [x + lerp(bl, br) * CW, y + CH];
      const left: Pt = [x, y + lerp(tl, bl) * CH];

      switch (idx) {
        case 1: case 14: segs.push([left, bottom]); break;
        case 2: case 13: segs.push([bottom, right]); break;
        case 3: case 12: segs.push([left, right]); break;
        case 4: case 11: segs.push([top, right]); break;
        case 6: case 9: segs.push([top, bottom]); break;
        case 7: case 8: segs.push([left, top]); break;
        case 5: segs.push([left, top]); segs.push([bottom, right]); break;
        case 10: segs.push([top, right]); segs.push([left, bottom]); break;
      }
    }
  }
  return segs;
}

// 세그먼트를 체인으로 연결
function chainSegments(segs: Seg[]): Pt[][] {
  if (segs.length === 0) return [];
  const EPS = 0.5;
  const used = new Array(segs.length).fill(false);
  const chains: Pt[][] = [];

  const near = (a: Pt, b: Pt) => Math.abs(a[0] - b[0]) < EPS && Math.abs(a[1] - b[1]) < EPS;

  for (let i = 0; i < segs.length; i++) {
    if (used[i]) continue;
    used[i] = true;
    const chain: Pt[] = [segs[i][0], segs[i][1]];

    let found = true;
    while (found) {
      found = false;
      const tail = chain[chain.length - 1];
      for (let j = 0; j < segs.length; j++) {
        if (used[j]) continue;
        if (near(tail, segs[j][0])) {
          chain.push(segs[j][1]);
          used[j] = true;
          found = true;
          break;
        }
        if (near(tail, segs[j][1])) {
          chain.push(segs[j][0]);
          used[j] = true;
          found = true;
          break;
        }
      }
    }
    // 앞쪽도 연결
    found = true;
    while (found) {
      found = false;
      const head = chain[0];
      for (let j = 0; j < segs.length; j++) {
        if (used[j]) continue;
        if (near(head, segs[j][1])) {
          chain.unshift(segs[j][0]);
          used[j] = true;
          found = true;
          break;
        }
        if (near(head, segs[j][0])) {
          chain.unshift(segs[j][1]);
          used[j] = true;
          found = true;
          break;
        }
      }
    }
    if (chain.length >= 3) chains.push(chain);
  }
  return chains;
}

// 폴리라인을 부드러운 SVG path로 변환 (Catmull-Rom → cubic bezier)
function toSmoothPath(pts: Pt[]): string {
  if (pts.length < 2) return "";
  if (pts.length === 2) return `M ${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)} L ${pts[1][0].toFixed(1)} ${pts[1][1].toFixed(1)}`;

  let d = `M ${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;

  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];

    const cp1x = p1[0] + (p2[0] - p0[0]) / 6;
    const cp1y = p1[1] + (p2[1] - p0[1]) / 6;
    const cp2x = p2[0] - (p3[0] - p1[0]) / 6;
    const cp2y = p2[1] - (p3[1] - p1[1]) / 6;

    d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
  }
  return d;
}

// 레벨별 스타일
const LEVELS = [
  { v: 0.04, w: 0.4, o: 0.1 },
  { v: 0.08, w: 0.45, o: 0.12 },
  { v: 0.14, w: 0.45, o: 0.13 },
  { v: 0.20, w: 0.5, o: 0.14 },
  { v: 0.28, w: 0.5, o: 0.15 },
  { v: 0.36, w: 0.55, o: 0.16 },
  { v: 0.45, w: 0.6, o: 0.18 },
  { v: 0.55, w: 0.65, o: 0.2 },
  { v: 0.65, w: 0.7, o: 0.22 },
  { v: 0.75, w: 0.6, o: 0.18 },
  { v: 0.85, w: 0.5, o: 0.14 },
  { v: 0.92, w: 0.45, o: 0.12 },
];

// 한 번만 계산
// dev에서 HMR 시 캐시 갱신되도록 모듈 레벨 변수 사용
let _cachedPaths: { d: string; w: number; o: number }[] | null = null;
if (typeof window !== "undefined") _cachedPaths = null; // 클라이언트 재계산

function computeContours(): { d: string; w: number; o: number }[] {
  if (_cachedPaths) return _cachedPaths;
  const grid = buildGrid();
  const result: { d: string; w: number; o: number }[] = [];

  for (const { v, w, o } of LEVELS) {
    const segs = marchingSquares(grid, v);
    const chains = chainSegments(segs);
    for (const chain of chains) {
      const d = toSmoothPath(chain);
      if (d) result.push({ d, w, o });
    }
  }
  _cachedPaths = result;
  return result;
}

export function GraphicA() {
  const paths = computeContours();

  return (
    <svg
      className="absolute inset-0 h-full w-full"
      viewBox={`0 0 ${W} ${H}`}
      fill="none"
      preserveAspectRatio="xMidYMid slice"
    >
      {paths.map(({ d, w, o }, i) => (
        <path key={i} d={d} stroke="white" strokeWidth={w} opacity={o} strokeLinecap="round" />
      ))}
    </svg>
  );
}

/**
 * Server-side MIME Type Verification (Magic Bytes)
 *
 * 파일 헤더(magic bytes)를 읽어 실제 파일 타입과
 * 클라이언트가 주장하는 MIME 타입이 일치하는지 검증합니다.
 */

/** magic bytes 시그니처 정의 */
interface MagicSignature {
  bytes: number[];
  offset: number;
  mask?: number[]; // 특정 비트만 비교할 때 사용
}

/** MIME 타입별 시그니처 매핑 */
const MAGIC_SIGNATURES: Record<string, MagicSignature[]> = {
  // 이미지
  "image/jpeg": [{ bytes: [0xff, 0xd8, 0xff], offset: 0 }],
  "image/png": [{ bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], offset: 0 }],
  "image/gif": [
    { bytes: [0x47, 0x49, 0x46, 0x38, 0x37, 0x61], offset: 0 }, // GIF87a
    { bytes: [0x47, 0x49, 0x46, 0x38, 0x39, 0x61], offset: 0 }, // GIF89a
  ],
  "image/webp": [
    { bytes: [0x52, 0x49, 0x46, 0x46], offset: 0 }, // RIFF
    // + bytes 8-11 = WEBP (checked separately)
  ],

  // PDF
  "application/pdf": [{ bytes: [0x25, 0x50, 0x44, 0x46], offset: 0 }], // %PDF

  // ZIP-based (Office documents)
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [
    { bytes: [0x50, 0x4b, 0x03, 0x04], offset: 0 }, // PK..
  ],
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [
    { bytes: [0x50, 0x4b, 0x03, 0x04], offset: 0 },
  ],
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": [
    { bytes: [0x50, 0x4b, 0x03, 0x04], offset: 0 },
  ],

  // Legacy Office / HWP (OLE Compound Document)
  "application/msword": [{ bytes: [0xd0, 0xcf, 0x11, 0xe0], offset: 0 }],
  "application/vnd.ms-excel": [{ bytes: [0xd0, 0xcf, 0x11, 0xe0], offset: 0 }],
  "application/vnd.ms-powerpoint": [{ bytes: [0xd0, 0xcf, 0x11, 0xe0], offset: 0 }],
  "application/haansofthwp": [{ bytes: [0xd0, 0xcf, 0x11, 0xe0], offset: 0 }],
  "application/x-hwp": [{ bytes: [0xd0, 0xcf, 0x11, 0xe0], offset: 0 }],

  // 비디오 (MP4/MOV - ISO Base Media / QuickTime)
  "video/mp4": [{ bytes: [0x66, 0x74, 0x79, 0x70], offset: 4 }],  // ftyp at offset 4
  "video/quicktime": [
    { bytes: [0x66, 0x74, 0x79, 0x70], offset: 4 }, // ftyp
    { bytes: [0x6d, 0x6f, 0x6f, 0x76], offset: 4 }, // moov
  ],

  // 오디오
  "audio/mpeg": [
    { bytes: [0xff, 0xfb], offset: 0 },             // MPEG Audio frame sync
    { bytes: [0xff, 0xf3], offset: 0 },
    { bytes: [0xff, 0xf2], offset: 0 },
    { bytes: [0x49, 0x44, 0x33], offset: 0 },       // ID3 tag
  ],
  "audio/mp4": [{ bytes: [0x66, 0x74, 0x79, 0x70], offset: 4 }],
  "audio/wav": [
    { bytes: [0x52, 0x49, 0x46, 0x46], offset: 0 }, // RIFF
    // + bytes 8-11 = WAVE (checked separately)
  ],
};

// HEIC/HEIF는 ftyp 박스 내 브랜드로 구분
const HEIC_BRANDS = ["heic", "heix", "mif1", "msf1", "hevc", "hevx"];

/** 필요한 최소 헤더 크기 (bytes) */
const HEADER_SIZE = 16;

/**
 * magic bytes로 MIME 타입 유효성 검증
 * @returns true이면 유효, false이면 불일치
 */
export function verifyMimeType(
  headerBytes: Uint8Array,
  claimedMimeType: string
): boolean {
  // text/plain: null byte + 실행 파일 시그니처 차단
  if (claimedMimeType === "text/plain") {
    if (containsNullBytes(headerBytes)) return false;
    // 실행 파일 시그니처 차단 (ELF, MZ/PE, Mach-O, shebang script 등)
    if (matchesExecutableSignature(headerBytes)) return false;
    return true;
  }

  // HEIC/HEIF 특수 처리
  if (claimedMimeType === "image/heic" || claimedMimeType === "image/heif") {
    return verifyHeic(headerBytes);
  }

  // WebP 특수 처리 (RIFF + WEBP)
  if (claimedMimeType === "image/webp") {
    return verifyWebP(headerBytes);
  }

  // WAV 특수 처리 (RIFF + WAVE)
  if (claimedMimeType === "audio/wav") {
    return verifyWav(headerBytes);
  }

  const signatures = MAGIC_SIGNATURES[claimedMimeType];
  if (!signatures) {
    // 알 수 없는 타입은 허용 목록에 없으면 이미 걸러짐
    return true;
  }

  return signatures.some((sig) => matchSignature(headerBytes, sig));
}

function matchSignature(data: Uint8Array, sig: MagicSignature): boolean {
  if (data.length < sig.offset + sig.bytes.length) return false;

  for (let i = 0; i < sig.bytes.length; i++) {
    const actual = sig.mask ? data[sig.offset + i] & sig.mask[i] : data[sig.offset + i];
    const expected = sig.mask ? sig.bytes[i] & sig.mask[i] : sig.bytes[i];
    if (actual !== expected) return false;
  }
  return true;
}

/** 실행 파일 시그니처 감지 (text/plain 위장 방지) */
function matchesExecutableSignature(data: Uint8Array): boolean {
  if (data.length < 4) return false;

  // ELF (Linux 실행 파일)
  if (data[0] === 0x7f && data[1] === 0x45 && data[2] === 0x4c && data[3] === 0x46) return true;

  // MZ (Windows PE/EXE)
  if (data[0] === 0x4d && data[1] === 0x5a) return true;

  // Mach-O (macOS 실행 파일)
  if (
    (data[0] === 0xfe && data[1] === 0xed && data[2] === 0xfa && data[3] === 0xce) || // 32-bit
    (data[0] === 0xfe && data[1] === 0xed && data[2] === 0xfa && data[3] === 0xcf) || // 64-bit
    (data[0] === 0xce && data[1] === 0xfa && data[2] === 0xed && data[3] === 0xfe) || // 32-bit (reversed)
    (data[0] === 0xcf && data[1] === 0xfa && data[2] === 0xed && data[3] === 0xfe)    // 64-bit (reversed)
  ) return true;

  // Java class file
  if (data[0] === 0xca && data[1] === 0xfe && data[2] === 0xba && data[3] === 0xbe) return true;

  // Shebang script (#!)
  if (data[0] === 0x23 && data[1] === 0x21) return true;

  return false;
}

function containsNullBytes(data: Uint8Array): boolean {
  for (let i = 0; i < data.length; i++) {
    if (data[i] === 0x00) return true;
  }
  return false;
}

function verifyHeic(data: Uint8Array): boolean {
  // ftyp at offset 4
  if (data.length < 12) return false;
  const ftyp = String.fromCharCode(data[4], data[5], data[6], data[7]);
  if (ftyp !== "ftyp") return false;

  // 브랜드 체크 (offset 8-11)
  const brand = String.fromCharCode(data[8], data[9], data[10], data[11]);
  return HEIC_BRANDS.includes(brand);
}

function verifyWebP(data: Uint8Array): boolean {
  if (data.length < 12) return false;
  // RIFF at 0 + WEBP at 8
  const riff = data[0] === 0x52 && data[1] === 0x49 && data[2] === 0x46 && data[3] === 0x46;
  const webp = data[8] === 0x57 && data[9] === 0x45 && data[10] === 0x42 && data[11] === 0x50;
  return riff && webp;
}

function verifyWav(data: Uint8Array): boolean {
  if (data.length < 12) return false;
  // RIFF at 0 + WAVE at 8
  const riff = data[0] === 0x52 && data[1] === 0x49 && data[2] === 0x46 && data[3] === 0x46;
  const wave = data[8] === 0x57 && data[9] === 0x41 && data[10] === 0x56 && data[11] === 0x45;
  return riff && wave;
}

/** 필요한 헤더 크기 반환 */
export { HEADER_SIZE };

#!/usr/bin/env npx tsx
/**
 * 합격 생기부(Exemplar) 합성 생성 CLI
 *
 * GCP 무료 크레딧 + Vertex AI (gemini-2.5-pro) 로 한국 학종 합격 생기부를
 * ExemplarParsedData 구조로 합성 생성 → exemplar_records 테이블에 저장.
 *
 * 사용 전 준비:
 *   1) gcloud auth application-default login
 *   2) gcloud config set project <YOUR_GCP_PROJECT_ID>
 *   3) .env.local 에 추가:
 *        GOOGLE_CLOUD_PROJECT=<YOUR_GCP_PROJECT_ID>
 *        GOOGLE_CLOUD_LOCATION=us-central1   (선택, 기본값)
 *        # SUPABASE_SERVICE_ROLE_KEY, NEXT_PUBLIC_SUPABASE_URL 은 이미 있음
 *
 * 사용법:
 *   npx tsx scripts/exemplar-synthetic-generate.ts --dry-run           # 프로필만 출력 (LLM/DB X)
 *   npx tsx scripts/exemplar-synthetic-generate.ts --limit=1           # 1건 실제 생성 + 저장 (비용 $0.03~)
 *   npx tsx scripts/exemplar-synthetic-generate.ts --limit=5 --no-save # 5건 생성하고 DB 저장은 스킵 (프롬프트 품질 검증용)
 *   npx tsx scripts/exemplar-synthetic-generate.ts --limit=30 --delay=5000
 *   npx tsx scripts/exemplar-synthetic-generate.ts --ai-studio         # Vertex 대신 AI Studio API 키 사용 (fallback)
 *
 * 옵션:
 *   --limit=N      생성 건수 (기본 1)
 *   --offset=N     프로필 시드 오프셋 (기본 0, 이어서 생성할 때)
 *   --delay=N      호출 간 딜레이 ms (기본 3000)
 *   --dry-run      LLM·DB 호출 없이 대상 프로필만 출력
 *   --no-save      LLM 호출은 하지만 DB 저장 스킵 (JSON dump 출력)
 *   --ai-studio    @google/genai 를 AI Studio 모드로 (GOOGLE_API_KEY 필요, GCP 크레딧 X)
 *   --model=ID     모델 ID 지정 (기본 gemini-2.5-pro)
 *
 * 출력: scripts/out/exemplar-synthetic/<timestamp>-<idx>-<univ>-<dept>.json
 */

import { config } from "dotenv";
import path from "path";
import fs from "fs";
import { GoogleGenAI, Type } from "@google/genai";

import { importExemplarToDb } from "@/lib/domains/exemplar/import/importer";
import type {
  ExemplarParsedData,
  SchoolCategory,
  CurriculumRevision,
} from "@/lib/domains/exemplar/types";

// ─── env ────────────────────────────────────────────────────────────────────

config({ path: path.resolve(process.cwd(), ".env.local") });

// ─── CLI args ───────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const noSave = args.includes("--no-save");
const useAiStudio = args.includes("--ai-studio");

const getArg = (name: string, fallback: string) => {
  const a = args.find((x) => x.startsWith(`--${name}=`));
  return a ? a.split("=")[1] : fallback;
};

const limit = parseInt(getArg("limit", "1"), 10);
const offset = parseInt(getArg("offset", "0"), 10);
const delayMs = parseInt(getArg("delay", "3000"), 10);
const modelId = getArg("model", "gemini-2.5-pro");

const TENANT_ID =
  process.env.EXEMPLAR_TENANT_ID ?? "00000000-0000-0000-0000-000000000000";

// ─── Profile seeds (10건 초기 시드, 필요 시 확장) ────────────────────────────

interface Profile {
  university: string;
  department: string;
  admissionRound: "early_comprehensive" | "regular_ga" | "regular_na";
  schoolCategory: SchoolCategory;
  schoolName: string;
  curriculum: CurriculumRevision;
  enrollmentYear: number;
  graduationYear: number;
  track: "humanities" | "social" | "natural" | "engineering" | "medical";
  careerField: string;
  profileHint: string;
}

const PROFILES: Profile[] = [
  {
    university: "서울대학교",
    department: "경제학부",
    admissionRound: "early_comprehensive",
    schoolCategory: "일반고",
    schoolName: "가상 일반고 A",
    curriculum: "2022",
    enrollmentYear: 2024,
    graduationYear: 2027,
    track: "social",
    careerField: "경제·금융 정책",
    profileHint:
      "거시경제 관심 + 지역경제 탐구 + 수학/확률통계 강점. 내신 1.1~1.3 상위권.",
  },
  {
    university: "연세대학교",
    department: "화학공학과",
    admissionRound: "early_comprehensive",
    schoolCategory: "자사고",
    schoolName: "가상 자사고 B",
    curriculum: "2015",
    enrollmentYear: 2022,
    graduationYear: 2025,
    track: "engineering",
    careerField: "친환경 에너지·촉매 연구",
    profileHint:
      "탄소중립 관심 + 유기화학·물리화학 심화 + 수학 미적분 우수. 내신 1.3~1.6.",
  },
  {
    university: "고려대학교",
    department: "심리학과",
    admissionRound: "early_comprehensive",
    schoolCategory: "일반고",
    schoolName: "가상 일반고 C",
    curriculum: "2022",
    enrollmentYear: 2024,
    graduationYear: 2027,
    track: "social",
    careerField: "임상심리·아동발달",
    profileHint:
      "청소년 정신건강 관심 + 윤리와 사상 심화 + 통계/생명과학 교차 탐구. 내신 1.4~1.7.",
  },
  {
    university: "성균관대학교",
    department: "소프트웨어학과",
    admissionRound: "early_comprehensive",
    schoolCategory: "일반고",
    schoolName: "가상 일반고 D",
    curriculum: "2015",
    enrollmentYear: 2022,
    graduationYear: 2025,
    track: "engineering",
    careerField: "AI·머신러닝",
    profileHint:
      "정보 교과 A + 자율동아리 알고리즘 + 수학 기하/확률 상 + 영어 1등급. 내신 1.5~1.8.",
  },
  {
    university: "서울대학교",
    department: "의예과",
    admissionRound: "early_comprehensive",
    schoolCategory: "일반고",
    schoolName: "가상 일반고 E",
    curriculum: "2015",
    enrollmentYear: 2022,
    graduationYear: 2025,
    track: "medical",
    careerField: "의과학자·중개연구",
    profileHint:
      "생명과학·화학·물리 전 영역 1등급. 생명 심화 탐구 + 논문 독서. 내신 1.0~1.2.",
  },
  {
    university: "한양대학교",
    department: "기계공학부",
    admissionRound: "early_comprehensive",
    schoolCategory: "일반고",
    schoolName: "가상 일반고 F",
    curriculum: "2022",
    enrollmentYear: 2024,
    graduationYear: 2027,
    track: "engineering",
    careerField: "로보틱스·자율주행",
    profileHint:
      "물리 심화 + 수학 우수 + 로봇 자율동아리 3년. 내신 1.6~2.0.",
  },
  {
    university: "이화여자대학교",
    department: "국어국문학과",
    admissionRound: "early_comprehensive",
    schoolCategory: "일반고",
    schoolName: "가상 일반고 G",
    curriculum: "2015",
    enrollmentYear: 2022,
    graduationYear: 2025,
    track: "humanities",
    careerField: "한국문학 연구·출판",
    profileHint:
      "문학 탐독 + 창작 동아리 + 비교문학 탐구. 내신 1.8~2.1.",
  },
  {
    university: "서강대학교",
    department: "경영학과",
    admissionRound: "early_comprehensive",
    schoolCategory: "일반고",
    schoolName: "가상 일반고 H",
    curriculum: "2022",
    enrollmentYear: 2024,
    graduationYear: 2027,
    track: "social",
    careerField: "ESG 경영·스타트업",
    profileHint:
      "경영·경제 심화 + 교내 창업 프로젝트 + 영어 토론. 내신 1.5~1.8.",
  },
  {
    university: "중앙대학교",
    department: "미디어커뮤니케이션학부",
    admissionRound: "early_comprehensive",
    schoolCategory: "일반고",
    schoolName: "가상 일반고 I",
    curriculum: "2022",
    enrollmentYear: 2024,
    graduationYear: 2027,
    track: "humanities",
    careerField: "저널리즘·디지털미디어",
    profileHint:
      "교지·방송반 활동 + 사회문제 탐구 + 영어 발표. 내신 1.9~2.3.",
  },
  {
    university: "서울대학교",
    department: "생명과학부",
    admissionRound: "early_comprehensive",
    schoolCategory: "과학고",
    schoolName: "가상 과학고 J",
    curriculum: "2015",
    enrollmentYear: 2022,
    graduationYear: 2024,
    track: "natural",
    careerField: "분자생물학·암연구",
    profileHint:
      "생명·화학 R&E 1년 + 논문 리뷰 + 수학 기하 심화. 조기 졸업 과학고생. 내신 (별도 체계).",
  },
  // ─── 확장 프로필 (idx 10~) ────────────────────────────────────────────────
  {
    university: "서울대학교",
    department: "정치외교학부",
    admissionRound: "early_comprehensive",
    schoolCategory: "일반고",
    schoolName: "가상 일반고 K",
    curriculum: "2022",
    enrollmentYear: 2024,
    graduationYear: 2027,
    track: "social",
    careerField: "외교·국제관계",
    profileHint:
      "국제정치 관심 + 모의UN 3년 + 영어·제2외국어 우수. 내신 1.0~1.3.",
  },
  {
    university: "연세대학교",
    department: "경영학과",
    admissionRound: "early_comprehensive",
    schoolCategory: "일반고",
    schoolName: "가상 일반고 L",
    curriculum: "2022",
    enrollmentYear: 2024,
    graduationYear: 2027,
    track: "social",
    careerField: "전략컨설팅·M&A",
    profileHint:
      "경제경영 심화 + 창업 대회 + 통계 탐구. 내신 1.2~1.5.",
  },
  {
    university: "고려대학교",
    department: "국어국문학과",
    admissionRound: "early_comprehensive",
    schoolCategory: "일반고",
    schoolName: "가상 일반고 M",
    curriculum: "2015",
    enrollmentYear: 2022,
    graduationYear: 2025,
    track: "humanities",
    careerField: "현대문학 연구",
    profileHint:
      "고전·현대문학 비교 + 문예창작 수상 + 독서토론. 내신 1.3~1.6.",
  },
  {
    university: "서울대학교",
    department: "전기정보공학부",
    admissionRound: "early_comprehensive",
    schoolCategory: "일반고",
    schoolName: "가상 일반고 N",
    curriculum: "2022",
    enrollmentYear: 2024,
    graduationYear: 2027,
    track: "engineering",
    careerField: "반도체·시스템반도체",
    profileHint:
      "물리·전자 회로 심화 + 아두이노 프로젝트 + 수학 미적 상위. 내신 1.1~1.4.",
  },
  {
    university: "연세대학교",
    department: "의예과",
    admissionRound: "early_comprehensive",
    schoolCategory: "일반고",
    schoolName: "가상 일반고 O",
    curriculum: "2015",
    enrollmentYear: 2022,
    graduationYear: 2025,
    track: "medical",
    careerField: "내과·감염병 연구",
    profileHint:
      "생명·화학 1등급 + 의료윤리 독서 + 감염병 탐구. 내신 1.0~1.2.",
  },
  {
    university: "고려대학교",
    department: "의과대학",
    admissionRound: "early_comprehensive",
    schoolCategory: "자사고",
    schoolName: "가상 자사고 P",
    curriculum: "2022",
    enrollmentYear: 2024,
    graduationYear: 2027,
    track: "medical",
    careerField: "신경외과·뇌과학",
    profileHint:
      "뇌과학 논문 리뷰 + 생명·화학 심화 + 자원봉사 누적 100시간. 내신 1.0~1.3.",
  },
  {
    university: "카이스트",
    department: "물리학과",
    admissionRound: "early_comprehensive",
    schoolCategory: "과학고",
    schoolName: "가상 과학고 Q",
    curriculum: "2015",
    enrollmentYear: 2023,
    graduationYear: 2025,
    track: "natural",
    careerField: "이론물리·양자컴퓨팅",
    profileHint:
      "물리 R&E + 수학 올림피아드 + 영어 논문 초록 작성. 조기졸업.",
  },
  {
    university: "포스텍",
    department: "화학공학과",
    admissionRound: "early_comprehensive",
    schoolCategory: "과학고",
    schoolName: "가상 과학고 R",
    curriculum: "2015",
    enrollmentYear: 2023,
    graduationYear: 2025,
    track: "engineering",
    careerField: "이차전지·에너지소재",
    profileHint:
      "화학 R&E + 배터리 소재 탐구 + 수학 심화. 조기졸업.",
  },
  {
    university: "서울대학교",
    department: "사회학과",
    admissionRound: "early_comprehensive",
    schoolCategory: "일반고",
    schoolName: "가상 일반고 S",
    curriculum: "2022",
    enrollmentYear: 2024,
    graduationYear: 2027,
    track: "social",
    careerField: "사회정책·불평등 연구",
    profileHint:
      "사회조사방법 탐구 + 통계·수학 상위 + 사회과학 독서. 내신 1.2~1.5.",
  },
  {
    university: "연세대학교",
    department: "사회학과",
    admissionRound: "early_comprehensive",
    schoolCategory: "일반고",
    schoolName: "가상 일반고 T",
    curriculum: "2015",
    enrollmentYear: 2022,
    graduationYear: 2025,
    track: "social",
    careerField: "미디어사회학",
    profileHint:
      "미디어 리터러시 + SNS 알고리즘 연구 + 통계 탐구. 내신 1.4~1.7.",
  },
  {
    university: "고려대학교",
    department: "컴퓨터학과",
    admissionRound: "early_comprehensive",
    schoolCategory: "일반고",
    schoolName: "가상 일반고 U",
    curriculum: "2022",
    enrollmentYear: 2024,
    graduationYear: 2027,
    track: "engineering",
    careerField: "AI·자연어처리",
    profileHint:
      "정보·수학 1등급 + 파이썬 NLP 프로젝트 + 영어 논문 리딩. 내신 1.3~1.6.",
  },
  {
    university: "성균관대학교",
    department: "경영학과",
    admissionRound: "early_comprehensive",
    schoolCategory: "일반고",
    schoolName: "가상 일반고 V",
    curriculum: "2022",
    enrollmentYear: 2024,
    graduationYear: 2027,
    track: "social",
    careerField: "디지털 마케팅·브랜드",
    profileHint:
      "경제·경영 + 데이터 분석 초급 + 교내 창업. 내신 1.5~1.8.",
  },
  {
    university: "한양대학교",
    department: "건축학부",
    admissionRound: "early_comprehensive",
    schoolCategory: "일반고",
    schoolName: "가상 일반고 W",
    curriculum: "2015",
    enrollmentYear: 2022,
    graduationYear: 2025,
    track: "engineering",
    careerField: "지속가능 건축·도시",
    profileHint:
      "건축사 독서 + 물리·수학 + 공간 디자인 동아리. 내신 1.7~2.0.",
  },
  {
    university: "서울대학교",
    department: "약학대학",
    admissionRound: "early_comprehensive",
    schoolCategory: "일반고",
    schoolName: "가상 일반고 X",
    curriculum: "2015",
    enrollmentYear: 2022,
    graduationYear: 2025,
    track: "medical",
    careerField: "신약개발·임상약학",
    profileHint:
      "생명·화학 심화 + 약학 관련 독서 + 제약산업 탐구. 내신 1.1~1.4.",
  },
  {
    university: "한양대학교",
    department: "의예과",
    admissionRound: "early_comprehensive",
    schoolCategory: "일반고",
    schoolName: "가상 일반고 Y",
    curriculum: "2022",
    enrollmentYear: 2024,
    graduationYear: 2027,
    track: "medical",
    careerField: "외과·수술로봇",
    profileHint:
      "생명·물리 심화 + 로봇 동아리 + 의료봉사. 내신 1.1~1.4.",
  },
  {
    university: "경희대학교",
    department: "한의예과",
    admissionRound: "early_comprehensive",
    schoolCategory: "일반고",
    schoolName: "가상 일반고 Z",
    curriculum: "2022",
    enrollmentYear: 2024,
    graduationYear: 2027,
    track: "medical",
    careerField: "한의학·보건정책",
    profileHint:
      "생명·화학 + 고전 한문 독서 + 전통의학 탐구. 내신 1.3~1.6.",
  },
  {
    university: "서울대학교",
    department: "국어교육과",
    admissionRound: "early_comprehensive",
    schoolCategory: "일반고",
    schoolName: "가상 일반고 AA",
    curriculum: "2015",
    enrollmentYear: 2022,
    graduationYear: 2025,
    track: "humanities",
    careerField: "중등 국어교육·교육정책",
    profileHint:
      "문법·문학 심화 + 교내 국어 학습지도 + 교육학 독서. 내신 1.2~1.5.",
  },
  {
    university: "서울교육대학교",
    department: "초등교육과",
    admissionRound: "early_comprehensive",
    schoolCategory: "일반고",
    schoolName: "가상 일반고 BB",
    curriculum: "2022",
    enrollmentYear: 2024,
    graduationYear: 2027,
    track: "humanities",
    careerField: "초등교사·발달심리",
    profileHint:
      "전과목 균형 + 아동심리 독서 + 멘토링 봉사. 내신 1.3~1.6.",
  },
  {
    university: "서울대학교",
    department: "자유전공학부",
    admissionRound: "early_comprehensive",
    schoolCategory: "일반고",
    schoolName: "가상 일반고 CC",
    curriculum: "2022",
    enrollmentYear: 2024,
    graduationYear: 2027,
    track: "social",
    careerField: "융합학문·정책기획",
    profileHint:
      "전과목 1~2 + 사회·과학 융합 탐구 + 데이터 분석. 내신 1.0~1.3.",
  },
  {
    university: "연세대학교",
    department: "심리학과",
    admissionRound: "early_comprehensive",
    schoolCategory: "일반고",
    schoolName: "가상 일반고 DD",
    curriculum: "2022",
    enrollmentYear: 2024,
    graduationYear: 2027,
    track: "social",
    careerField: "인지심리·UX연구",
    profileHint:
      "심리학 독서 + 통계 + 기술·가정 실험 설계. 내신 1.4~1.7.",
  },
  {
    university: "서강대학교",
    department: "컴퓨터공학과",
    admissionRound: "early_comprehensive",
    schoolCategory: "일반고",
    schoolName: "가상 일반고 EE",
    curriculum: "2022",
    enrollmentYear: 2024,
    graduationYear: 2027,
    track: "engineering",
    careerField: "웹·모바일 개발",
    profileHint:
      "정보 A + 앱 개발 동아리 + 수학·영어 우수. 내신 1.4~1.7.",
  },
  {
    university: "성균관대학교",
    department: "의예과",
    admissionRound: "early_comprehensive",
    schoolCategory: "일반고",
    schoolName: "가상 일반고 FF",
    curriculum: "2022",
    enrollmentYear: 2024,
    graduationYear: 2027,
    track: "medical",
    careerField: "소아과·아동건강",
    profileHint:
      "생명·화학 심화 + 아동복지 봉사 + 의료윤리 독서. 내신 1.0~1.3.",
  },
  {
    university: "서울대학교",
    department: "산업공학과",
    admissionRound: "early_comprehensive",
    schoolCategory: "일반고",
    schoolName: "가상 일반고 GG",
    curriculum: "2022",
    enrollmentYear: 2024,
    graduationYear: 2027,
    track: "engineering",
    careerField: "공급망·데이터 최적화",
    profileHint:
      "수학 상위 + 통계 + 물류 시뮬레이션 탐구. 내신 1.2~1.5.",
  },
  {
    university: "중앙대학교",
    department: "약학대학",
    admissionRound: "early_comprehensive",
    schoolCategory: "일반고",
    schoolName: "가상 일반고 HH",
    curriculum: "2015",
    enrollmentYear: 2022,
    graduationYear: 2025,
    track: "medical",
    careerField: "임상약학·병원약제",
    profileHint:
      "생명·화학 심화 + 의료봉사 + 약물학 독서. 내신 1.3~1.6.",
  },
  {
    university: "경희대학교",
    department: "국제학과",
    admissionRound: "early_comprehensive",
    schoolCategory: "외고",
    schoolName: "가상 외고 II",
    curriculum: "2022",
    enrollmentYear: 2024,
    graduationYear: 2027,
    track: "social",
    careerField: "국제기구·ODA",
    profileHint:
      "영어·제2외국어 + 국제관계 탐구 + UN 모의. 내신 1.5~1.8.",
  },
  {
    university: "한국외국어대학교",
    department: "영어통번역학과",
    admissionRound: "early_comprehensive",
    schoolCategory: "외고",
    schoolName: "가상 외고 JJ",
    curriculum: "2022",
    enrollmentYear: 2024,
    graduationYear: 2027,
    track: "humanities",
    careerField: "국제회의 통역·번역",
    profileHint:
      "영어·제2외국어 심화 + 번역 동아리 + 영미문학. 내신 1.3~1.6.",
  },
  {
    university: "서울대학교",
    department: "조선해양공학과",
    admissionRound: "early_comprehensive",
    schoolCategory: "일반고",
    schoolName: "가상 일반고 KK",
    curriculum: "2022",
    enrollmentYear: 2024,
    graduationYear: 2027,
    track: "engineering",
    careerField: "해양플랜트·친환경선박",
    profileHint:
      "물리·수학 상위 + 해양 탐구 + 창의융합. 내신 1.2~1.5.",
  },
  {
    university: "고려대학교",
    department: "환경생태공학부",
    admissionRound: "early_comprehensive",
    schoolCategory: "일반고",
    schoolName: "가상 일반고 LL",
    curriculum: "2022",
    enrollmentYear: 2024,
    graduationYear: 2027,
    track: "natural",
    careerField: "기후변화·생태복원",
    profileHint:
      "생명·지구과학 + 환경 봉사 + 기후정책 독서. 내신 1.4~1.7.",
  },
  {
    university: "세종대학교",
    department: "호텔관광대학",
    admissionRound: "early_comprehensive",
    schoolCategory: "일반고",
    schoolName: "가상 일반고 MM",
    curriculum: "2022",
    enrollmentYear: 2024,
    graduationYear: 2027,
    track: "social",
    careerField: "관광마케팅·MICE",
    profileHint:
      "경제·영어 + 지역관광 탐구 + 다문화 봉사. 내신 2.0~2.3.",
  },
  {
    university: "서울대학교",
    department: "농경제사회학부",
    admissionRound: "early_comprehensive",
    schoolCategory: "일반고",
    schoolName: "가상 일반고 NN",
    curriculum: "2015",
    enrollmentYear: 2022,
    graduationYear: 2025,
    track: "social",
    careerField: "농업정책·푸드테크",
    profileHint:
      "경제+생명 융합 + 식량안보 탐구 + 통계. 내신 1.3~1.6.",
  },
];

// ─── System prompt ──────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `당신은 한국 학종(학생부종합전형) 합격 생기부 작성 전문가입니다.
주어진 학생 프로필(대학·학과·계열·교육과정)에 맞는 **현실적인 합격 수준**의 생기부를 JSON으로 생성합니다.

## 작성 원칙 (반드시 준수)
1. **교육과정별 차이 엄격 준수**
   - 2022 개정: 봉사활동은 창체 영역에서 분리(volunteerRecords로만 기록, creativeActivities 에 volunteer 타입 금지), 자율/자치 분리(self_governance), 진로희망사항 없음, 행특 300자(900바이트) 이하.
   - 2015 개정: 자치 미분리(autonomy 에 포함), 봉사활동 창체 포함, 진로희망사항 없음(2018부터), 행특 500자(1500바이트) 이하.
   - 2009 개정: 모든 영역 존재.
2. **세특(seteks) 품질 — 가장 중요**
   - 좋은 세특 8단계 순환: ①지적호기심 → ②주제선정(진로연결) → ③탐구내용/이론 → ④참고문헌 → ⑤결론 → ⑥교사관찰(구체적 근거) → ⑦성장서사 → ⑧오류분석/재탐구
   - 진로교과: ①②③⑤ 필수. SKY카+ 합격 수준은 ①②③④⑤ 포함(참고문헌 명시)
   - 비진로교과: 교과 역량 중심. 진로 연결 없어도 됨(오히려 도배하면 역효과)
   - 세특 분량: 과목당 400~600자. 과목명은 교육과정에 맞게 표기(2022: 공통국어1/2, 통합과학1/2, 공통수학1/2 등)
   - **세특 최소 수량 — 엄격 강제**: 학년(1, 2, 3) × 학기(1, 2) × 과목(공통 4 + 진로교과 2~3) = **총 30~36행 필수**. 학년 또는 학기 누락 금지. 조기졸업 과학고만 2학년까지 = 24행 최소.
   - **진로 도배 방지**: 전체 세특 중 **30~40%만 진로 연결**. 나머지 60~70%(특히 체육·예술·제2외국어·일부 국영수)는 순수 교과역량 중심(탐구방법·논리·발표·문제해결)으로만 기술. 모든 과목에 진로 키워드 넣으면 F16 주요 감점.
   - **피해야 할 패턴**: 나열식, 키워드 나열, 내신과 탐구 불일치, 별개활동 포장, 자기주도성 부재, 진로 과잉 도배
3. **창체(creativeActivities)**
   - 학년별 자율/동아리/진로 영역. 2022는 self_governance 추가.
   - 동아리=진로 가중치 동등. 자율은 그 다음. 각 300~500자.
4. **행특(haengteuk)**: 학년별 1개. 교사 관찰 근거 + 성장 서사. 교육과정별 바이트 제한 엄격 준수.
5. **성적(grades)**: 학기별 주요 과목. 진로교과 우수 + 전체 상승 추이(3학년 1학기 상승). 학기·과목 누락 금지.
   - **rankGrade 는 1~9 정수 또는 null.** 2022 개정 진로선택·융합선택 과목은 **반드시 rankGrade=null**, achievementLevel 만 "A"/"B"/"C" 로 기록. 2015/2009 공통/일반선택은 rankGrade 1~9 정수.
   - sentinel 값(-1, 0) 절대 사용 금지. 해당 없을 때는 반드시 null.
6. **수상(awards)**: 2022 개정은 대입 미반영이지만 기록은 유지. 2~3건/학년.
7. **독서(reading)**: 교과별로 2~3권. 제목·저자 명시.
8. **출결(attendance)**: 대부분 0. 건강 사유 병결 1~2일 허용.
9. **학년 범위**: grade=1, 2, 3 모두 생성. 과학고 조기 졸업은 1, 2 만 허용.
10. **익명성**: 학생 이름은 "가상학생_<대학약칭>_<학과약칭>_<번호>" 형식. 실제 인물명 사용 금지.

## 품질 기준
- parse_quality_score: 80~95 (합성 데이터 표시)
- parsed_by: "synthetic:vertex:gemini-2.5-pro"
- 모든 텍스트는 존댓말 "~습니다" 체. 입학사정관이 평가할 수 있는 수준.

출력은 **반드시 JSON 단일 객체**로, 제공된 schema 를 정확히 따릅니다.`;

// ─── Response schema (ExemplarParsedData 축약판 — 핵심 필드만 schema 강제) ──

const EXEMPLAR_SCHEMA = {
  type: Type.OBJECT,
  required: [
    "metadata",
    "studentInfo",
    "admissions",
    "enrollment",
    "attendance",
    "awards",
    "creativeActivities",
    "volunteerRecords",
    "grades",
    "seteks",
    "reading",
    "haengteuk",
    "careerAspirations",
    "certifications",
    "peArtGrades",
  ],
  properties: {
    metadata: {
      type: Type.OBJECT,
      required: ["sourceFilePath", "sourceFileFormat", "parseQualityScore", "parseErrors", "parsedBy"],
      properties: {
        sourceFilePath: { type: Type.STRING },
        sourceFileFormat: { type: Type.STRING, enum: ["pdf", "docx", "hwp"] },
        parseQualityScore: { type: Type.INTEGER },
        parsedBy: { type: Type.STRING },
        parseErrors: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            required: ["section", "message", "severity"],
            properties: {
              section: { type: Type.STRING },
              message: { type: Type.STRING },
              severity: { type: Type.STRING, enum: ["error", "warning"] },
            },
          },
        },
      },
    },
    studentInfo: {
      type: Type.OBJECT,
      required: ["name", "schoolName", "enrollmentYear"],
      properties: {
        name: { type: Type.STRING },
        schoolName: { type: Type.STRING },
        schoolCategory: { type: Type.STRING },
        enrollmentYear: { type: Type.INTEGER },
        graduationYear: { type: Type.INTEGER },
        curriculumRevision: { type: Type.STRING, enum: ["2009", "2015", "2022"] },
      },
    },
    admissions: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        required: ["universityName", "admissionYear"],
        properties: {
          universityName: { type: Type.STRING },
          department: { type: Type.STRING },
          admissionType: { type: Type.STRING },
          admissionRound: { type: Type.STRING },
          admissionYear: { type: Type.INTEGER },
          isPrimary: { type: Type.BOOLEAN },
        },
      },
    },
    enrollment: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        required: ["grade"],
        properties: {
          grade: { type: Type.INTEGER },
          className: { type: Type.STRING },
          studentNumber: { type: Type.STRING },
          homeroomTeacher: { type: Type.STRING },
          enrollmentStatus: { type: Type.STRING },
          enrollmentDate: { type: Type.STRING },
        },
      },
    },
    attendance: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        required: [
          "grade",
          "absenceSick",
          "absenceUnauthorized",
          "absenceOther",
          "latenessSick",
          "latenessUnauthorized",
          "latenessOther",
          "earlyLeaveSick",
          "earlyLeaveUnauthorized",
          "earlyLeaveOther",
          "classAbsenceSick",
          "classAbsenceUnauthorized",
          "classAbsenceOther",
        ],
        properties: {
          grade: { type: Type.INTEGER },
          schoolDays: { type: Type.INTEGER },
          absenceSick: { type: Type.INTEGER },
          absenceUnauthorized: { type: Type.INTEGER },
          absenceOther: { type: Type.INTEGER },
          latenessSick: { type: Type.INTEGER },
          latenessUnauthorized: { type: Type.INTEGER },
          latenessOther: { type: Type.INTEGER },
          earlyLeaveSick: { type: Type.INTEGER },
          earlyLeaveUnauthorized: { type: Type.INTEGER },
          earlyLeaveOther: { type: Type.INTEGER },
          classAbsenceSick: { type: Type.INTEGER },
          classAbsenceUnauthorized: { type: Type.INTEGER },
          classAbsenceOther: { type: Type.INTEGER },
          notes: { type: Type.STRING },
        },
      },
    },
    awards: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        required: ["grade", "awardName"],
        properties: {
          grade: { type: Type.INTEGER },
          awardName: { type: Type.STRING },
          awardLevel: { type: Type.STRING },
          awardDate: { type: Type.STRING },
          awardingBody: { type: Type.STRING },
          participants: { type: Type.STRING },
        },
      },
    },
    certifications: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        required: ["certName"],
        properties: {
          certName: { type: Type.STRING },
          certLevel: { type: Type.STRING },
          certNumber: { type: Type.STRING },
          issuingOrg: { type: Type.STRING },
          certDate: { type: Type.STRING },
        },
      },
    },
    careerAspirations: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        required: ["grade"],
        properties: {
          grade: { type: Type.INTEGER },
          studentAspiration: { type: Type.STRING },
          parentAspiration: { type: Type.STRING },
          reason: { type: Type.STRING },
          specialSkillsHobbies: { type: Type.STRING },
        },
      },
    },
    creativeActivities: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        required: ["grade", "activityType", "content"],
        properties: {
          grade: { type: Type.INTEGER },
          activityType: {
            type: Type.STRING,
            enum: ["autonomy", "self_governance", "club", "volunteer", "career"],
          },
          activityName: { type: Type.STRING },
          hours: { type: Type.INTEGER },
          content: { type: Type.STRING },
        },
      },
    },
    volunteerRecords: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        required: ["grade"],
        properties: {
          grade: { type: Type.INTEGER },
          activityDate: { type: Type.STRING },
          location: { type: Type.STRING },
          description: { type: Type.STRING },
          hours: { type: Type.INTEGER },
          cumulativeHours: { type: Type.INTEGER },
        },
      },
    },
    grades: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        required: ["grade", "semester", "subjectName"],
        properties: {
          grade: { type: Type.INTEGER },
          semester: { type: Type.INTEGER },
          subjectName: { type: Type.STRING },
          subjectType: { type: Type.STRING },
          creditHours: { type: Type.INTEGER },
          rawScore: { type: Type.NUMBER },
          classAverage: { type: Type.NUMBER },
          stdDev: { type: Type.NUMBER },
          rankGrade: { type: Type.INTEGER },
          achievementLevel: { type: Type.STRING },
          totalStudents: { type: Type.INTEGER },
        },
      },
    },
    seteks: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        required: ["grade", "semester", "subjectName", "content"],
        properties: {
          grade: { type: Type.INTEGER },
          semester: { type: Type.INTEGER },
          subjectName: { type: Type.STRING },
          content: { type: Type.STRING },
        },
      },
    },
    peArtGrades: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        required: ["grade", "semester", "subjectName"],
        properties: {
          grade: { type: Type.INTEGER },
          semester: { type: Type.INTEGER },
          subjectName: { type: Type.STRING },
          creditHours: { type: Type.INTEGER },
          achievementLevel: { type: Type.STRING },
          content: { type: Type.STRING },
        },
      },
    },
    reading: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        required: ["grade", "subjectArea", "bookDescription"],
        properties: {
          grade: { type: Type.INTEGER },
          subjectArea: { type: Type.STRING },
          bookDescription: { type: Type.STRING },
          bookTitle: { type: Type.STRING },
          author: { type: Type.STRING },
        },
      },
    },
    haengteuk: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        required: ["grade", "content"],
        properties: {
          grade: { type: Type.INTEGER },
          content: { type: Type.STRING },
        },
      },
    },
  },
} as const;

// ─── User prompt builder ────────────────────────────────────────────────────

function buildUserPrompt(profile: Profile, syntheticIdx: number): string {
  const { university, department, admissionRound, schoolCategory, schoolName, curriculum, enrollmentYear, graduationYear, track, careerField, profileHint } = profile;

  const curriculumNotes =
    curriculum === "2022"
      ? "2022 개정: 자율/자치 분리, 봉사활동 창체 없음(volunteerRecords 만), 진로희망사항 없음, 행특 300자"
      : curriculum === "2015"
      ? "2015 개정: 자치 미분리, 봉사활동 창체 포함, 진로희망사항 없음(2018~), 행특 500자"
      : "2009 개정: 모든 영역 존재";

  const shortName = university.replace(/학교|여자/g, "").slice(0, 3);
  const deptShort = department.slice(0, 3);

  return `## 생성 대상 프로필

- 합격 대학·학과: ${university} ${department} (${admissionRound === "early_comprehensive" ? "학생부종합전형" : admissionRound})
- 학교: ${schoolName} (${schoolCategory})
- 교육과정: ${curriculum} 개정 — ${curriculumNotes}
- 입학년도: ${enrollmentYear}, 졸업년도: ${graduationYear}
- 계열: ${track}
- 희망 진로: ${careerField}
- 프로필 힌트: ${profileHint}

## 생성 지시

위 프로필에 맞는 **합격 수준**의 생기부를 ExemplarParsedData 구조로 JSON 생성.

- studentInfo.name = "합성_${shortName}_${deptShort}_${syntheticIdx.toString().padStart(3, "0")}"
- studentInfo.schoolName = "${schoolName}"
- studentInfo.schoolCategory = "${schoolCategory}"
- studentInfo.enrollmentYear = ${enrollmentYear}
- studentInfo.graduationYear = ${graduationYear}
- studentInfo.curriculumRevision = "${curriculum}"
- admissions[0] = { universityName: "${university}", department: "${department}", admissionRound: "${admissionRound}", admissionYear: ${graduationYear}, isPrimary: true }
- metadata.sourceFilePath = "synthetic://vertex/${shortName}-${deptShort}-${syntheticIdx}"
- metadata.sourceFileFormat = "pdf"
- metadata.parsedBy = "synthetic:vertex:${modelId}"
- metadata.parseQualityScore: 85~92 사이 정수
- metadata.parseErrors: []

## 필수 생성 수량 체크리스트 (반드시 충족)

- 세특(seteks): **최소 30행, 목표 36행**
  - grade=1 semester=1: 6과목 (공통국어1, 공통수학1, 공통영어1, 통합사회1, 통합과학1, 한국사1)
  - grade=1 semester=2: 6과목 (공통국어2, 공통수학2, 공통영어2, 통합사회2, 통합과학2, 한국사2)
  - grade=2 semester=1: 6과목 (일반선택·진로교과 중심)
  - grade=2 semester=2: 6과목
  - grade=3 semester=1: 6과목 (진로선택·심화)
  - grade=3 semester=2: 6과목
  - 과학고 조기졸업의 경우 grade=1,2 까지 2학년 × 2학기 × 6과목 = 24행
- 창체(creativeActivities): 학년 × 영역(2022는 autonomy/self_governance/club/career 4종, 2015는 autonomy/club/volunteer/career 4종) = **12~16행**
- 행특(haengteuk): 학년당 1행 = **3행** (조기졸업 2행)
- 성적(grades): 세특과 동일한 (학년/학기/과목) 조합 = 30~36행
- 수상(awards): 학년당 2~3건 = 6~9행
- 독서(reading): 교과별 2~3권 = 15행 이상
- 행특 바이트 제한 엄격 준수 (2022: 300자/900B, 2015: 500자/1500B)

**진로 도배 밸런스**: 세특 36행 중 진로 강한 연결은 12~14행(40% 이하). 나머지 22~24행은 교과역량 중심 기술.

모든 한국어 텍스트는 합격자 수준의 구체성·진로 연결·성장 서사를 담아야 합니다.`;
}

// ─── Vertex AI / AI Studio client ───────────────────────────────────────────

function createGenaiClient(): GoogleGenAI {
  if (useAiStudio) {
    const apiKey = process.env.GOOGLE_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    if (!apiKey) {
      throw new Error("--ai-studio 모드: GOOGLE_API_KEY 또는 GOOGLE_GENERATIVE_AI_API_KEY 필요");
    }
    return new GoogleGenAI({ apiKey });
  }

  const project = process.env.GOOGLE_CLOUD_PROJECT;
  const location = process.env.GOOGLE_CLOUD_LOCATION || "us-central1";
  if (!project) {
    throw new Error(
      "Vertex 모드: GOOGLE_CLOUD_PROJECT 환경변수 필요.\n" +
        "  .env.local 에 GOOGLE_CLOUD_PROJECT=<your-gcp-project-id> 추가\n" +
        "  사전에 `gcloud auth application-default login` 실행 필요",
    );
  }
  return new GoogleGenAI({ vertexai: true, project, location });
}

// ─── Single generation ──────────────────────────────────────────────────────

async function generateOne(
  ai: GoogleGenAI,
  profile: Profile,
  syntheticIdx: number,
): Promise<ExemplarParsedData> {
  const userPrompt = buildUserPrompt(profile, syntheticIdx);

  const response = await ai.models.generateContent({
    model: modelId,
    contents: [{ role: "user", parts: [{ text: userPrompt }] }],
    config: {
      systemInstruction: SYSTEM_PROMPT,
      temperature: 0.85,
      maxOutputTokens: 32768,
      responseMimeType: "application/json",
      responseSchema: EXEMPLAR_SCHEMA,
    },
  });

  const rawText = response.text ?? "";
  const cleaned = rawText.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "");
  const parsed = JSON.parse(cleaned) as ExemplarParsedData;

  parsed.metadata ??= {
    sourceFilePath: `synthetic://fallback/${syntheticIdx}`,
    sourceFileFormat: "pdf",
    parseQualityScore: 80,
    parseErrors: [],
    parsedBy: `synthetic:vertex:${modelId}`,
  };

  sanitizeExemplar(parsed);
  return parsed;
}

/** DB CHECK 제약에 걸리지 않도록 범위 밖 값을 null 로 정규화. */
function sanitizeExemplar(data: ExemplarParsedData): void {
  if (Array.isArray(data.grades)) {
    for (const g of data.grades) {
      if (g.rankGrade !== null && g.rankGrade !== undefined) {
        if (!Number.isInteger(g.rankGrade) || g.rankGrade < 1 || g.rankGrade > 9) {
          g.rankGrade = undefined;
        }
      }
      if (g.semester !== undefined && (g.semester < 1 || g.semester > 2)) {
        g.semester = 1;
      }
    }
  }
  if (Array.isArray(data.seteks)) {
    for (const s of data.seteks) {
      if (s.semester !== undefined && (s.semester < 1 || s.semester > 2)) {
        s.semester = 1;
      }
    }
  }
  if (Array.isArray(data.peArtGrades)) {
    for (const p of data.peArtGrades) {
      if (p.semester !== undefined && (p.semester < 1 || p.semester > 2)) {
        p.semester = 1;
      }
    }
  }
}

// ─── Validation (최소 품질 가드) ────────────────────────────────────────────

function validateExemplar(data: ExemplarParsedData): string[] {
  const issues: string[] = [];
  if (!data.studentInfo?.name) issues.push("studentInfo.name 누락");
  if (!data.studentInfo?.schoolName) issues.push("studentInfo.schoolName 누락");
  if (!data.studentInfo?.enrollmentYear) issues.push("studentInfo.enrollmentYear 누락");
  if (!data.admissions?.length) issues.push("admissions[] 비어있음");
  if ((data.seteks?.length ?? 0) < 24) issues.push(`seteks ${data.seteks?.length ?? 0}건 (최소 24건 기대, 권장 30~36)`);
  if ((data.creativeActivities?.length ?? 0) < 6) issues.push(`creativeActivities ${data.creativeActivities?.length ?? 0}건`);
  if ((data.haengteuk?.length ?? 0) < 1) issues.push("haengteuk 없음");
  if ((data.grades?.length ?? 0) < 10) issues.push(`grades ${data.grades?.length ?? 0}건`);

  const curriculum = data.studentInfo?.curriculumRevision;
  if (curriculum === "2022") {
    const hasVolunteerInChangche = data.creativeActivities?.some((c) => c.activityType === "volunteer");
    if (hasVolunteerInChangche) issues.push("2022 개정인데 creativeActivities 에 volunteer 포함");
  }

  return issues;
}

// ─── Output file writer ─────────────────────────────────────────────────────

function writeOutputFile(data: ExemplarParsedData, profile: Profile, idx: number): string {
  const outDir = path.resolve(process.cwd(), "scripts/out/exemplar-synthetic");
  fs.mkdirSync(outDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const filename = `${stamp}-${idx.toString().padStart(3, "0")}-${profile.university.slice(0, 2)}-${profile.department.slice(0, 3)}.json`;
  const filepath = path.join(outDir, filename);
  fs.writeFileSync(filepath, JSON.stringify(data, null, 2), "utf-8");
  return filepath;
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  console.log("─".repeat(70));
  console.log("Exemplar Synthetic Generator");
  console.log("─".repeat(70));
  console.log(`mode       : ${useAiStudio ? "AI Studio" : "Vertex AI"}`);
  console.log(`model      : ${modelId}`);
  console.log(`limit      : ${limit}`);
  console.log(`offset     : ${offset}`);
  console.log(`delay      : ${delayMs}ms`);
  console.log(`dryRun     : ${dryRun}`);
  console.log(`saveToDb   : ${!noSave && !dryRun}`);
  console.log(`tenant     : ${TENANT_ID}`);
  console.log("");

  const selected = PROFILES.slice(offset, offset + limit);
  if (!selected.length) {
    console.log("⚠️  선택된 프로필 없음 (offset/limit 확인)");
    process.exit(0);
  }

  console.log(`선택 프로필 (${selected.length}건):`);
  selected.forEach((p, i) => {
    console.log(`  [${offset + i}] ${p.university} ${p.department} — ${p.schoolCategory}/${p.curriculum}/${p.track}`);
  });
  console.log("");

  if (dryRun) {
    console.log("✅ dry-run 종료 (LLM 호출 없음)");
    process.exit(0);
  }

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    if (!noSave) {
      console.error("❌ Supabase 환경변수 미설정 (.env.local). --no-save 플래그로 DB 저장 건너뛸 수 있음.");
      process.exit(1);
    }
  }

  const ai = createGenaiClient();

  const summary = {
    total: selected.length,
    generated: 0,
    saved: 0,
    failed: 0,
    skipped: 0,
    elapsed: 0,
  };
  const startMs = Date.now();

  for (let i = 0; i < selected.length; i++) {
    const profile = selected[i];
    const absoluteIdx = offset + i;
    const prefix = `[${i + 1}/${selected.length}]`;

    try {
      console.log(`${prefix} → ${profile.university} ${profile.department} (idx=${absoluteIdx})`);
      const t0 = Date.now();
      const data = await generateOne(ai, profile, absoluteIdx);
      const elapsedSec = Math.round((Date.now() - t0) / 1000);
      summary.generated++;

      const issues = validateExemplar(data);
      if (issues.length) {
        console.log(`   ⚠️  품질 경고 ${issues.length}건: ${issues.slice(0, 3).join(" / ")}${issues.length > 3 ? " ..." : ""}`);
      }

      const filepath = writeOutputFile(data, profile, absoluteIdx);
      console.log(`   💾 JSON 저장: ${filepath} (${elapsedSec}s, seteks=${data.seteks?.length ?? 0} / ca=${data.creativeActivities?.length ?? 0})`);

      if (!noSave) {
        const result = await importExemplarToDb(data, TENANT_ID, { overwriteExisting: false });
        if (result.success) {
          summary.saved++;
          console.log(`   ✅ DB 저장: exemplar_id=${result.exemplarId?.slice(0, 8)}... | seteks=${result.counts.seteks} / ca=${result.counts.creativeActivities} / awards=${result.counts.awards}`);
        } else {
          summary.skipped++;
          console.log(`   ⏭️  DB 스킵: ${result.error}`);
        }
      }
    } catch (err) {
      summary.failed++;
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`   ❌ 실패: ${msg}`);
    }

    if (i < selected.length - 1 && delayMs > 0) {
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }

  summary.elapsed = Math.round((Date.now() - startMs) / 1000);

  console.log("");
  console.log("─".repeat(70));
  console.log(`총 ${summary.total} | 생성 ${summary.generated} | DB 저장 ${summary.saved} | 실패 ${summary.failed} | 스킵 ${summary.skipped} | ${summary.elapsed}s`);
  console.log("─".repeat(70));

  process.exit(summary.failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("fatal:", err);
  process.exit(1);
});

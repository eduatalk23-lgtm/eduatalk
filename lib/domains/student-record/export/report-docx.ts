// ============================================
// report-docx.ts — Word(DOCX) 내보내기
// ============================================

import {
  type ReportExportData,
  EDGE_TYPE_LABELS,
  AREA_LABELS,
  SECTION_LABELS,
} from "./report-transform";

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`;
}

function buildFileName(data: ReportExportData, ext: string): string {
  const date = new Date(data.createdAt);
  const dateStr = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}`;
  return `${data.studentName}_${data.title}_${dateStr}.${ext}`;
}

export async function exportReportAsDocx(data: ReportExportData): Promise<void> {
  const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } =
    await import("docx");
  const { saveAs } = await import("file-saver");

  const dateStr = formatDate(data.createdAt);
  const children: (typeof Paragraph.prototype)[] = [];

  // 제목
  children.push(
    new Paragraph({
      text: data.title,
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
    }),
  );

  // 부제: 학생명 / 학년 / 날짜
  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 },
      children: [
        new TextRun({
          text: `${data.studentName} · ${data.targetGrades.join(",")}학년 · ${dateStr}`,
          size: 20,
          color: "666666",
        }),
      ],
    }),
  );

  // 구분선
  children.push(
    new Paragraph({
      spacing: { after: 300 },
      border: { bottom: { style: "single" as const, size: 6, color: "333333" } },
    }),
  );

  if (data.editedText) {
    // 수동 편집 텍스트
    for (const line of data.editedText.split("\n")) {
      children.push(
        new Paragraph({
          children: [new TextRun({ text: line, size: 22 })],
          spacing: { after: 120 },
        }),
      );
    }
  } else {
    // F4: 종합 진단
    if (data.diagnosis) {
      const d = data.diagnosis;
      children.push(new Paragraph({ text: "종합 진단", heading: HeadingLevel.HEADING_2, spacing: { before: 300, after: 150 } }));
      const gradeText = d.directionStrength
        ? `종합등급: ${d.overallGrade} · ${d.recordDirection} (${d.directionStrength})`
        : `종합등급: ${d.overallGrade} · ${d.recordDirection}`;
      children.push(new Paragraph({ children: [new TextRun({ text: gradeText, size: 22, bold: true })], spacing: { after: 80 } }));
      if (d.directionReasoning) {
        children.push(new Paragraph({ children: [new TextRun({ text: d.directionReasoning, size: 20, color: "555555", italics: true })], spacing: { after: 100 } }));
      }
      for (const s of d.strengths) {
        children.push(new Paragraph({ children: [new TextRun({ text: `✅ ${s}`, size: 20 })], spacing: { after: 60 } }));
      }
      for (const w of d.weaknesses) {
        children.push(new Paragraph({ children: [new TextRun({ text: `⚠️ ${w}`, size: 20 })], spacing: { after: 60 } }));
      }
      if (d.improvements && d.improvements.length > 0) {
        children.push(new Paragraph({ children: [new TextRun({ text: "개선 전략:", size: 20, bold: true })], spacing: { before: 80, after: 60 } }));
        for (const imp of d.improvements) {
          const impText = imp.gap
            ? `[${imp.priority}] ${imp.area}: ${imp.gap} → ${imp.action}`
            : `[${imp.priority}] ${imp.area}: ${imp.action}`;
          children.push(new Paragraph({ children: [new TextRun({ text: impText, size: 20 })], spacing: { after: 40 } }));
        }
      }
      if (d.recommendedMajors.length > 0) {
        children.push(new Paragraph({ children: [new TextRun({ text: `추천 전공: ${d.recommendedMajors.join(", ")}`, size: 20, color: "666666" })], spacing: { after: 80 } }));
      }
      if (d.strategyNotes) {
        children.push(new Paragraph({ children: [new TextRun({ text: `후속 조치: ${d.strategyNotes}`, size: 20, color: "555555" })], spacing: { after: 150 } }));
      }
    }

    // F4: 교과 이수 적합도
    if (data.courseAdequacy) {
      const ca = data.courseAdequacy;
      children.push(new Paragraph({ text: "교과 이수 적합도", heading: HeadingLevel.HEADING_2, spacing: { before: 300, after: 150 } }));
      const rateText = ca.fusionRate != null
        ? `일반 ${ca.generalRate}% / 진로 ${ca.careerRate}% / 융합 ${ca.fusionRate}%`
        : `일반 ${ca.generalRate}% / 진로 ${ca.careerRate}%`;
      children.push(new Paragraph({ children: [new TextRun({ text: `${ca.majorCategory} 계열 · 적합도 ${ca.score}% (${rateText})`, size: 22 })], spacing: { after: 80 } }));
      if (ca.taken.length > 0) children.push(new Paragraph({ children: [new TextRun({ text: `이수: ${ca.taken.join(", ")}`, size: 20 })], spacing: { after: 60 } }));
      if (ca.notTaken.length > 0) children.push(new Paragraph({ children: [new TextRun({ text: `미이수: ${ca.notTaken.join(", ")}`, size: 20, color: "CC0000" })], spacing: { after: 60 } }));
      if (ca.notOffered.length > 0) children.push(new Paragraph({ children: [new TextRun({ text: `학교 미개설: ${ca.notOffered.join(", ")}`, size: 20, color: "999999" })], spacing: { after: 100 } }));
    }

    // F4: 보완 전략
    if (data.strategies && data.strategies.length > 0) {
      children.push(new Paragraph({ text: "보완 전략", heading: HeadingLevel.HEADING_2, spacing: { before: 300, after: 150 } }));
      for (const st of data.strategies) {
        children.push(new Paragraph({ children: [new TextRun({ text: `[${st.targetArea}] ${st.content}`, size: 20 })], spacing: { after: 80 } }));
      }
    }

    // 모의고사 분석
    if (data.mockAnalysis) {
      const m = data.mockAnalysis;
      children.push(new Paragraph({ text: "모의고사 분석", heading: HeadingLevel.HEADING_2, spacing: { before: 300, after: 150 } }));
      children.push(new Paragraph({ children: [new TextRun({ text: `기준 시험: ${m.recentExamTitle} (${m.recentExamDate})`, size: 20, color: "666666" })], spacing: { after: 100 } }));
      const metrics = [
        { label: "평균 백분위", value: m.avgPercentile != null ? `${m.avgPercentile.toFixed(1)}%` : "-", basis: "국/수/탐(상위2)" },
        { label: "표준점수 합", value: m.totalStdScore != null ? String(m.totalStdScore) : "-", basis: "국/수/탐(상위2)" },
        { label: "상위 3과목 등급합", value: m.best3GradeSum != null ? String(m.best3GradeSum) : "-", basis: "국·수·영·탐 중" },
      ];
      for (const mt of metrics) {
        children.push(new Paragraph({ children: [new TextRun({ text: `${mt.label}: ${mt.value} (${mt.basis})`, size: 22 })], spacing: { after: 60 } }));
      }
    }

    // 활동 연결 분석
    if (data.edgeSummary && data.edgeSummary.totalEdges > 0) {
      children.push(new Paragraph({ text: "활동 연결 분석", heading: HeadingLevel.HEADING_2, spacing: { before: 300, after: 150 } }));
      children.push(new Paragraph({ children: [new TextRun({ text: `총 ${data.edgeSummary.totalEdges}개 연결 감지`, size: 20, color: "666666" })], spacing: { after: 80 } }));
      for (const et of data.edgeSummary.byType) {
        const typeLabel = EDGE_TYPE_LABELS[et.type] ?? et.type;
        const exampleText = et.example ? ` — ${et.example.slice(0, 80)}` : "";
        children.push(new Paragraph({ children: [new TextRun({ text: `${typeLabel}: ${et.count}건${exampleText}`, size: 20 })], spacing: { after: 60 } }));
      }
    }

    // 로드맵
    if (data.roadmapItems && data.roadmapItems.length > 0) {
      children.push(new Paragraph({ text: "활동 로드맵", heading: HeadingLevel.HEADING_2, spacing: { before: 300, after: 150 } }));
      children.push(new Paragraph({ children: [new TextRun({ text: `총 ${data.roadmapItems.length}개 항목`, size: 20, color: "666666" })], spacing: { after: 80 } }));
      for (const item of data.roadmapItems) {
        const areaLabel = AREA_LABELS[item.area] ?? item.area;
        const semLabel = item.semester ? `${item.semester}학기` : "연간";
        const slLabel = item.storylineTitle ? ` → ${item.storylineTitle}` : "";
        children.push(new Paragraph({ children: [new TextRun({ text: `[${item.grade}학년 ${semLabel}] ${areaLabel}: ${item.plan_content}${slLabel}`, size: 20 })], spacing: { after: 60 } }));
      }
    }

    // 면접 예상 질문
    if (data.interviewQuestions && data.interviewQuestions.length > 0) {
      children.push(new Paragraph({ text: "면접 예상 질문", heading: HeadingLevel.HEADING_2, spacing: { before: 300, after: 150 } }));
      for (const q of data.interviewQuestions) {
        const diffLabel = q.difficulty === "hard" ? "[심화]" : q.difficulty === "medium" ? "[중간]" : "[기본]";
        children.push(new Paragraph({ children: [new TextRun({ text: `${diffLabel} Q: ${q.question}`, size: 20, bold: true })], spacing: { after: 40 } }));
        if (q.suggestedAnswer) {
          children.push(new Paragraph({ children: [new TextRun({ text: `A: ${q.suggestedAnswer}`, size: 20, color: "555555" })], spacing: { after: 100 } }));
        }
      }
    }

    // 활동 요약서 섹션별 렌더링
    for (const sec of data.sections) {
      const label = SECTION_LABELS[sec.sectionType] ?? sec.title;
      const subtitle =
        sec.relatedSubjects && sec.relatedSubjects.length > 0
          ? ` (${sec.relatedSubjects.join(", ")})`
          : "";

      children.push(
        new Paragraph({
          text: label + subtitle,
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 300, after: 150 },
        }),
      );

      for (const line of sec.content.split("\n")) {
        if (!line.trim()) continue;
        children.push(
          new Paragraph({
            children: [new TextRun({ text: line, size: 22 })],
            spacing: { after: 100 },
          }),
        );
      }
    }
  }

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
          },
        },
        children,
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  const fileName = buildFileName(data, "docx");
  saveAs(blob, fileName);
}

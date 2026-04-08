// ============================================
// report-html.ts — HTML 렌더러 (PDF용)
// ============================================

import {
  type ReportExportData,
  EDGE_TYPE_LABELS,
  AREA_LABELS,
  SECTION_LABELS,
} from "./transform";

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`;
}

export function buildReportHtml(data: ReportExportData): string {
  const dateStr = formatDate(data.createdAt);
  const isProspective = data.mode === "prospective";
  let body = "";

  body += `<div style="text-align:center;border-bottom:2px solid #222;padding-bottom:16px;margin-bottom:24px;">`;
  body += `<h1 style="font-size:22px;font-weight:bold;margin:0;">${escapeHtml(data.title)}</h1>`;
  body += `<p style="font-size:12px;color:#666;margin-top:8px;">${escapeHtml(data.studentName)} · ${data.targetGrades.join(",")}학년 · ${dateStr}</p>`;
  body += `</div>`;

  // Phase V1: prospective 모드 안내문
  if (isProspective) {
    body += `<div style="margin-bottom:20px;padding:12px 16px;background:#fffbe6;border:1px solid #ffe58f;border-radius:6px;">`;
    body += `<p style="font-size:13px;color:#856404;margin:0;line-height:1.6;">이 리포트는 수강 계획 기반 가상본입니다. 실제 기록이 추가되면 분석 기반 리포트로 전환됩니다.</p>`;
    body += `</div>`;
  }

  if (data.editedText) {
    body += `<div style="font-size:13px;line-height:1.8;white-space:pre-wrap;">${escapeHtml(data.editedText)}</div>`;
  } else {
    // F4: 종합 진단 섹션
    if (data.diagnosis) {
      const d = data.diagnosis;
      const diagTitle = isProspective ? "[예상] 활동 진단" : "종합 진단";
      body += `<div style="margin-bottom:20px;">`;
      body += `<h2 style="font-size:15px;font-weight:600;border-bottom:1px solid #ddd;padding-bottom:4px;margin-bottom:8px;">${escapeHtml(diagTitle)}</h2>`;
      const htmlGrade = d.directionStrength
        ? `${escapeHtml(d.overallGrade)} · ${escapeHtml(d.recordDirection)} (${escapeHtml(d.directionStrength)})`
        : `${escapeHtml(d.overallGrade)} · ${escapeHtml(d.recordDirection)}`;
      body += `<p style="font-size:13px;margin-bottom:6px;"><strong>종합등급:</strong> ${htmlGrade}</p>`;
      if (d.directionReasoning) {
        body += `<p style="font-size:12px;color:#555;font-style:italic;margin-bottom:8px;">${escapeHtml(d.directionReasoning)}</p>`;
      }
      if (d.strengths.length > 0) {
        body += `<p style="font-size:13px;margin-bottom:4px;"><strong>강점:</strong></p><ul style="font-size:12px;margin:0 0 8px 16px;">`;
        for (const s of d.strengths) body += `<li>${escapeHtml(s)}</li>`;
        body += `</ul>`;
      }
      if (d.weaknesses.length > 0) {
        body += `<p style="font-size:13px;margin-bottom:4px;"><strong>약점:</strong></p><ul style="font-size:12px;margin:0 0 8px 16px;">`;
        for (const w of d.weaknesses) body += `<li>${escapeHtml(w)}</li>`;
        body += `</ul>`;
      }
      if (d.improvements && d.improvements.length > 0) {
        body += `<p style="font-size:13px;margin-bottom:4px;"><strong>개선 전략:</strong></p><ul style="font-size:12px;margin:0 0 8px 16px;">`;
        for (const imp of d.improvements) {
          const impHtml = imp.gap
            ? `[${escapeHtml(imp.priority)}] ${escapeHtml(imp.area)}: ${escapeHtml(imp.gap)} → ${escapeHtml(imp.action)}`
            : `[${escapeHtml(imp.priority)}] ${escapeHtml(imp.area)}: ${escapeHtml(imp.action)}`;
          body += `<li>${impHtml}</li>`;
        }
        body += `</ul>`;
      }
      if (d.recommendedMajors.length > 0) {
        body += `<p style="font-size:12px;color:#666;">추천 전공: ${d.recommendedMajors.map(escapeHtml).join(", ")}</p>`;
      }
      if (d.strategyNotes) {
        body += `<p style="font-size:12px;color:#555;">후속 조치: ${escapeHtml(d.strategyNotes)}</p>`;
      }
      body += `</div>`;
    }

    // F4: 역량 등급 섹션
    if (data.competencyScores && data.competencyScores.length > 0) {
      body += `<div style="margin-bottom:20px;">`;
      body += `<h2 style="font-size:15px;font-weight:600;border-bottom:1px solid #ddd;padding-bottom:4px;margin-bottom:8px;">역량 등급</h2>`;
      body += `<table style="font-size:12px;width:100%;border-collapse:collapse;">`;
      body += `<tr style="background:#f5f5f5;"><th style="padding:4px 8px;text-align:left;border:1px solid #ddd;">영역</th><th style="padding:4px 8px;text-align:left;border:1px solid #ddd;">항목</th><th style="padding:4px 8px;text-align:center;border:1px solid #ddd;">등급</th></tr>`;
      for (const cs of data.competencyScores) {
        body += `<tr><td style="padding:4px 8px;border:1px solid #ddd;">${escapeHtml(cs.area)}</td><td style="padding:4px 8px;border:1px solid #ddd;">${escapeHtml(cs.label)}</td><td style="padding:4px 8px;text-align:center;border:1px solid #ddd;">${escapeHtml(cs.grade)}</td></tr>`;
      }
      body += `</table></div>`;
    }

    // F4: 교과 이수 적합도 섹션
    if (data.courseAdequacy) {
      const ca = data.courseAdequacy;
      body += `<div style="margin-bottom:20px;">`;
      body += `<h2 style="font-size:15px;font-weight:600;border-bottom:1px solid #ddd;padding-bottom:4px;margin-bottom:8px;">교과 이수 적합도</h2>`;
      const htmlRateText = ca.fusionRate != null
        ? `일반 ${ca.generalRate}% / 진로 ${ca.careerRate}% / 융합 ${ca.fusionRate}%`
        : `일반 ${ca.generalRate}% / 진로 ${ca.careerRate}%`;
      body += `<p style="font-size:13px;margin-bottom:6px;"><strong>${escapeHtml(ca.majorCategory)}</strong> 계열 · 적합도 <strong>${ca.score}%</strong> (${htmlRateText})</p>`;
      if (ca.taken.length > 0) body += `<p style="font-size:12px;">이수: ${ca.taken.map(escapeHtml).join(", ")}</p>`;
      if (ca.notTaken.length > 0) body += `<p style="font-size:12px;color:#c00;">미이수: ${ca.notTaken.map(escapeHtml).join(", ")}</p>`;
      if (ca.notOffered.length > 0) body += `<p style="font-size:12px;color:#999;">학교 미개설: ${ca.notOffered.map(escapeHtml).join(", ")}</p>`;
      body += `</div>`;
    }

    // F4: 보완 전략 섹션
    if (data.strategies && data.strategies.length > 0) {
      const stratTitle = isProspective ? "[예상] 보완 전략" : "보완 전략";
      body += `<div style="margin-bottom:20px;">`;
      body += `<h2 style="font-size:15px;font-weight:600;border-bottom:1px solid #ddd;padding-bottom:4px;margin-bottom:8px;">${escapeHtml(stratTitle)}</h2>`;
      for (const st of data.strategies) {
        const badge = st.priority === "critical" ? "🔴" : st.priority === "high" ? "🟠" : "🟡";
        body += `<p style="font-size:12px;margin-bottom:6px;">${badge} <strong>[${escapeHtml(st.targetArea)}]</strong> ${escapeHtml(st.content)}</p>`;
      }
      body += `</div>`;
    }

    // 모의고사 분석 섹션
    if (data.mockAnalysis) {
      const m = data.mockAnalysis;
      body += `<div style="margin-bottom:20px;">`;
      body += `<h2 style="font-size:15px;font-weight:600;border-bottom:1px solid #ddd;padding-bottom:4px;margin-bottom:8px;">모의고사 분석</h2>`;
      body += `<p style="font-size:12px;color:#666;margin-bottom:8px;">기준 시험: ${escapeHtml(m.recentExamTitle)} (${escapeHtml(m.recentExamDate)})</p>`;
      body += `<table style="font-size:12px;width:100%;border-collapse:collapse;">`;
      body += `<tr style="background:#f5f5f5;"><th style="padding:6px 8px;text-align:left;border:1px solid #ddd;">지표</th><th style="padding:6px 8px;text-align:center;border:1px solid #ddd;">값</th><th style="padding:6px 8px;text-align:left;border:1px solid #ddd;">기준</th></tr>`;
      body += `<tr><td style="padding:6px 8px;border:1px solid #ddd;">평균 백분위</td><td style="padding:6px 8px;text-align:center;border:1px solid #ddd;">${m.avgPercentile != null ? m.avgPercentile.toFixed(1) + "%" : "-"}</td><td style="padding:6px 8px;border:1px solid #ddd;">국/수/탐(상위2)</td></tr>`;
      body += `<tr><td style="padding:6px 8px;border:1px solid #ddd;">표준점수 합</td><td style="padding:6px 8px;text-align:center;border:1px solid #ddd;">${m.totalStdScore ?? "-"}</td><td style="padding:6px 8px;border:1px solid #ddd;">국/수/탐(상위2)</td></tr>`;
      body += `<tr><td style="padding:6px 8px;border:1px solid #ddd;">상위 3과목 등급합</td><td style="padding:6px 8px;text-align:center;border:1px solid #ddd;">${m.best3GradeSum ?? "-"}</td><td style="padding:6px 8px;border:1px solid #ddd;">국·수·영·탐 중</td></tr>`;
      body += `</table></div>`;
    }

    // 활동 연결 분석 섹션
    if (data.edgeSummary && data.edgeSummary.totalEdges > 0) {
      body += `<div style="margin-bottom:20px;">`;
      body += `<h2 style="font-size:15px;font-weight:600;border-bottom:1px solid #ddd;padding-bottom:4px;margin-bottom:8px;">활동 연결 분석</h2>`;
      body += `<p style="font-size:12px;margin-bottom:8px;">총 ${data.edgeSummary.totalEdges}개 연결 감지</p>`;
      for (const et of data.edgeSummary.byType) {
        const typeLabel = EDGE_TYPE_LABELS[et.type] ?? et.type;
        body += `<p style="font-size:12px;margin-bottom:4px;"><strong>${escapeHtml(typeLabel)}</strong> ${et.count}건`;
        if (et.example) body += ` <span style="color:#666;">— ${escapeHtml(et.example.slice(0, 80))}</span>`;
        body += `</p>`;
      }
      body += `</div>`;
    }

    // 로드맵 섹션
    if (data.roadmapItems && data.roadmapItems.length > 0) {
      body += `<div style="margin-bottom:20px;">`;
      body += `<h2 style="font-size:15px;font-weight:600;border-bottom:1px solid #ddd;padding-bottom:4px;margin-bottom:8px;">활동 로드맵</h2>`;
      body += `<p style="font-size:12px;color:#666;margin-bottom:8px;">총 ${data.roadmapItems.length}개 항목</p>`;
      for (const item of data.roadmapItems) {
        const areaLabel = AREA_LABELS[item.area] ?? item.area;
        const semLabel = item.semester ? `${item.semester}학기` : "연간";
        const slLabel = item.storylineTitle ? ` <span style="color:#888;">→ ${escapeHtml(item.storylineTitle)}</span>` : "";
        body += `<p style="font-size:12px;margin-bottom:4px;"><strong>[${item.grade}학년 ${semLabel}]</strong> ${escapeHtml(areaLabel)}: ${escapeHtml(item.plan_content)}${slLabel}</p>`;
      }
      body += `</div>`;
    }

    // 면접 예상 질문 섹션
    if (data.interviewQuestions && data.interviewQuestions.length > 0) {
      const interviewTitle = isProspective ? "[예상] 면접 질문" : "면접 예상 질문";
      body += `<div style="margin-bottom:20px;">`;
      body += `<h2 style="font-size:15px;font-weight:600;border-bottom:1px solid #ddd;padding-bottom:4px;margin-bottom:8px;">${escapeHtml(interviewTitle)}</h2>`;
      for (const q of data.interviewQuestions) {
        const diffBadge = q.difficulty === "hard" ? "🔴" : q.difficulty === "medium" ? "🟡" : "🟢";
        body += `<div style="margin-bottom:10px;">`;
        body += `<p style="font-size:12px;font-weight:600;margin-bottom:2px;">${diffBadge} ${escapeHtml(q.question)}</p>`;
        if (q.suggestedAnswer) {
          body += `<p style="font-size:11px;color:#555;margin-left:16px;">${escapeHtml(q.suggestedAnswer)}</p>`;
        }
        body += `</div>`;
      }
      body += `</div>`;
    }

    // ── AI 종합 분석 ──
    if (data.executiveSummary) {
      const es = data.executiveSummary;
      body += `<div style="margin-bottom:20px;">`;
      body += `<h2 style="font-size:15px;font-weight:600;border-bottom:1px solid #ddd;padding-bottom:4px;margin-bottom:8px;">AI 종합 분석</h2>`;
      body += `<p style="font-size:13px;margin-bottom:6px;">종합 점수: <strong>${es.overallScore}점</strong> (${escapeHtml(es.overallGrade)}등급)`;
      if (es.growthTrend) body += ` · 성장 추이: ${escapeHtml(es.growthTrend)}`;
      body += `</p>`;
      if (es.topStrengths.length > 0) {
        body += `<p style="font-size:12px;color:#16a34a;">강점: ${es.topStrengths.map((s) => `${escapeHtml(s.name)}(${s.score})`).join(", ")}</p>`;
      }
      if (es.topWeaknesses.length > 0) {
        body += `<p style="font-size:12px;color:#dc2626;">약점: ${es.topWeaknesses.map((s) => `${escapeHtml(s.name)}(${s.score})`).join(", ")}</p>`;
      }
      body += `<p style="font-size:12px;color:#555;margin-top:6px;line-height:1.6;">${escapeHtml(es.narrative)}</p>`;
      body += `</div>`;
    }

    // ── 시계열 분석 ──
    if (data.timeSeriesAnalysis) {
      const ts = data.timeSeriesAnalysis;
      body += `<div style="margin-bottom:20px;">`;
      body += `<h2 style="font-size:15px;font-weight:600;border-bottom:1px solid #ddd;padding-bottom:4px;margin-bottom:8px;">3년 성장 분석</h2>`;
      body += `<p style="font-size:12px;">전체 성장률: ${ts.overallGrowthRate.toFixed(1)}% · 최강점: ${escapeHtml(ts.strongestName)} · 최약점: ${escapeHtml(ts.weakestName)}</p>`;
      if (ts.anomalyCount > 0) {
        body += `<p style="font-size:12px;color:#d97706;">이상치 ${ts.anomalyCount}건 감지</p>`;
      }
      body += `<p style="font-size:12px;color:#555;margin-top:4px;">${escapeHtml(ts.summary)}</p>`;
      body += `</div>`;
    }

    // ── 계열별 적합도 ──
    if (data.universityMatch) {
      const um = data.universityMatch;
      body += `<div style="margin-bottom:20px;">`;
      body += `<h2 style="font-size:15px;font-weight:600;border-bottom:1px solid #ddd;padding-bottom:4px;margin-bottom:8px;">계열별 적합도</h2>`;
      body += `<p style="font-size:13px;margin-bottom:6px;">최적 계열: <strong>${escapeHtml(um.topMatch.label)}</strong> (${escapeHtml(um.topMatch.grade)}등급, ${um.topMatch.score}점)</p>`;
      body += `<table style="width:100%;border-collapse:collapse;font-size:11px;margin-bottom:6px;">`;
      body += `<tr style="border-bottom:1px solid #eee;font-weight:600;"><td>계열</td><td>등급</td><td>점수</td></tr>`;
      for (const m of um.matches) {
        body += `<tr style="border-bottom:1px solid #f5f5f5;"><td>${escapeHtml(m.label)}</td><td>${escapeHtml(m.grade)}</td><td>${m.score}</td></tr>`;
      }
      body += `</table>`;
      body += `<p style="font-size:12px;color:#555;">${escapeHtml(um.summary)}</p>`;
      body += `</div>`;
    }

    // ── 콘텐츠 품질 상세 ──
    if (data.contentQualityDetail && data.contentQualityDetail.length > 0) {
      body += `<div style="margin-bottom:20px;">`;
      body += `<h2 style="font-size:15px;font-weight:600;border-bottom:1px solid #ddd;padding-bottom:4px;margin-bottom:8px;">콘텐츠 품질 상세</h2>`;
      body += `<table style="width:100%;border-collapse:collapse;font-size:11px;">`;
      body += `<tr style="border-bottom:1px solid #eee;font-weight:600;"><td>유형</td><td>점수</td><td>이슈</td></tr>`;
      for (const q of data.contentQualityDetail) {
        body += `<tr style="border-bottom:1px solid #f5f5f5;">`;
        body += `<td>${escapeHtml(q.recordType)}</td><td>${q.overallScore}</td>`;
        body += `<td>${q.issues.length > 0 ? escapeHtml(q.issues.join(", ")) : "-"}</td>`;
        body += `</tr>`;
      }
      body += `</table>`;
      body += `</div>`;
    }

    // ── 설계 모드 예상 분석 ──
    if (data.projectedAnalysis) {
      const pa = data.projectedAnalysis;
      body += `<div style="margin-bottom:20px;border:1px solid #8b5cf6;border-radius:8px;padding:12px;">`;
      body += `<h2 style="font-size:15px;font-weight:600;color:#7c3aed;margin-bottom:8px;">설계 모드 예상 분석</h2>`;
      body += `<p style="font-size:11px;color:#6b7280;margin-bottom:8px;">⚠ 아래는 희망 진로 및 학교권 기준 예상이며 실제와 다를 수 있습니다.</p>`;
      body += `<p style="font-size:12px;">목표 학교권: <strong>${escapeHtml(pa.tierLabel)}</strong> · 적용 레벨: <strong>${escapeHtml(pa.levelLabel)}</strong></p>`;
      if (pa.gap !== 0) {
        const gapText = pa.gap > 0 ? `목표 대비 ${pa.gap}단계 부족` : `목표 대비 ${Math.abs(pa.gap)}단계 초과`;
        body += `<p style="font-size:12px;color:${pa.gap > 0 ? "#d97706" : "#16a34a"};">${gapText}</p>`;
      } else {
        body += `<p style="font-size:12px;color:#16a34a;">목표와 일치</p>`;
      }
      body += `<p style="font-size:12px;margin-top:4px;">대상 학년: ${pa.designGrades.join(", ")}학년 · 예상 역량 ${pa.projectedCompetencyCount}개 · 예상 연결 ${pa.projectedEdgeCount}개</p>`;
      body += `</div>`;
    }

    // 활동 요약서 섹션
    for (const sec of data.sections) {
      const baseLabel = SECTION_LABELS[sec.sectionType] ?? sec.title;
      const label = isProspective ? `[예상] ${baseLabel}` : baseLabel;
      const subtitle =
        sec.relatedSubjects && sec.relatedSubjects.length > 0
          ? ` <span style="font-weight:normal;color:#999;">(${sec.relatedSubjects.join(", ")})</span>`
          : "";
      body += `<div style="margin-bottom:20px;">`;
      body += `<h2 style="font-size:15px;font-weight:600;border-bottom:1px solid #ddd;padding-bottom:4px;margin-bottom:8px;">${escapeHtml(label)}${subtitle}</h2>`;
      body += `<p style="font-size:13px;line-height:1.8;white-space:pre-wrap;">${escapeHtml(sec.content)}</p>`;
      body += `</div>`;
    }
  }

  return body;
}

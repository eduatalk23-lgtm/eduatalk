import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSchoolScoreSummary, getMockScoreSummary, getRiskIndexBySubject } from "@/lib/scheduler/scoreLoader";

async function checkStudentScores() {
  const supabase = await createSupabaseServerClient();
  
  // 이메일로 사용자 찾기
  const email = "ghkdwp2282@naver.com";
  
  // getUserByEmail이 없으므로 listUsers로 필터링
  const { data: usersData, error: authError } = await supabase.auth.admin.listUsers();
  
  if (authError || !usersData?.users) {
    console.error("사용자 목록을 가져올 수 없습니다:", authError);
    return;
  }
  
  const authUser = usersData.users.find((u) => u.email === email);
  
  if (!authUser) {
    console.error("사용자를 찾을 수 없습니다:", email);
    return;
  }
  
  const studentId = authUser.id;
  console.log(`\n=== ${email} (${studentId}) 성적 데이터 분석 ===\n`);
  
  // 1. 내신 성적 조회
  const { data: schoolScores, error: schoolError } = await supabase
    .from("student_school_scores")
    .select("*")
    .eq("student_id", studentId)
    .order("grade", { ascending: true })
    .order("semester", { ascending: true })
    .order("created_at", { ascending: false });
  
  if (schoolError) {
    console.error("내신 성적 조회 실패:", schoolError);
  } else {
    console.log(`\n📚 내신 성적: ${schoolScores?.length || 0}개`);
    if (schoolScores && schoolScores.length > 0) {
      // 과목별 그룹화
      const bySubject = new Map<string, typeof schoolScores>();
      schoolScores.forEach(score => {
        const subject = score.subject_group || "미지정";
        if (!bySubject.has(subject)) {
          bySubject.set(subject, []);
        }
        bySubject.get(subject)!.push(score);
      });
      
      bySubject.forEach((scores, subject) => {
        const validGrades = scores.filter(s => s.grade_score !== null && s.grade_score !== undefined);
        const avgGrade = validGrades.length > 0
          ? (validGrades.reduce((sum, s) => sum + (s.grade_score || 0), 0) / validGrades.length).toFixed(2)
          : "없음";
        console.log(`  - ${subject}: ${scores.length}개 (평균 등급: ${avgGrade})`);
        scores.forEach(s => {
          console.log(`    • ${s.grade}학년 ${s.semester}학기: 등급 ${s.grade_score || "없음"}, 원점수 ${s.raw_score || "없음"}`);
        });
      });
    }
  }
  
  // 2. 모의고사 성적 조회
  const { data: mockScores, error: mockError } = await supabase
    .from("student_mock_scores")
    .select("*")
    .eq("student_id", studentId)
    .order("grade", { ascending: true })
    .order("test_date", { ascending: false });
  
  if (mockError) {
    console.error("모의고사 성적 조회 실패:", mockError);
  } else {
    console.log(`\n📝 모의고사 성적: ${mockScores?.length || 0}개`);
    if (mockScores && mockScores.length > 0) {
      // 과목별 그룹화
      const bySubject = new Map<string, typeof mockScores>();
      mockScores.forEach(score => {
        const subject = score.subject_group || "미지정";
        if (!bySubject.has(subject)) {
          bySubject.set(subject, []);
        }
        bySubject.get(subject)!.push(score);
      });
      
      bySubject.forEach((scores, subject) => {
        const validPercentiles = scores.filter(s => s.percentile !== null && s.percentile !== undefined);
        const avgPercentile = validPercentiles.length > 0
          ? (validPercentiles.reduce((sum, s) => sum + (s.percentile || 0), 0) / validPercentiles.length).toFixed(1)
          : "없음";
        const validGrades = scores.filter(s => s.grade_score !== null && s.grade_score !== undefined);
        const avgGrade = validGrades.length > 0
          ? (validGrades.reduce((sum, s) => sum + (s.grade_score || 0), 0) / validGrades.length).toFixed(2)
          : "없음";
        console.log(`  - ${subject}: ${scores.length}개 (평균 백분위: ${avgPercentile}%, 평균 등급: ${avgGrade})`);
        scores.forEach(s => {
          console.log(`    • ${s.grade}학년 ${s.exam_type} ${s.exam_round || ""}: 백분위 ${s.percentile || "없음"}%, 등급 ${s.grade_score || "없음"} (${s.test_date || "날짜 없음"})`);
        });
      });
    }
  }
  
  // 3. 추천 시스템에서 사용하는 요약 데이터 확인
  console.log(`\n\n=== 추천 시스템 분석 ===\n`);
  
  const [schoolSummary, mockSummary, riskIndex] = await Promise.all([
    getSchoolScoreSummary(studentId),
    getMockScoreSummary(studentId),
    getRiskIndexBySubject(studentId),
  ]);
  
  console.log(`\n📊 내신 성적 요약 (${schoolSummary.size}개 과목):`);
  if (schoolSummary.size === 0) {
    console.log("  ⚠️ 내신 성적 데이터가 없습니다.");
  } else {
    schoolSummary.forEach((summary, subject) => {
      console.log(`  - ${subject}:`);
      console.log(`    • 최근 등급: ${summary.recentGrade || "없음"}`);
      console.log(`    • 평균 등급: ${summary.averageGrade?.toFixed(2) || "없음"}`);
      console.log(`    • 등급 편차: ${summary.gradeVariance.toFixed(2)}`);
      console.log(`    • 원점수 편차: ${summary.scoreVariance.toFixed(2)}`);
    });
  }
  
  console.log(`\n📝 모의고사 성적 요약 (${mockSummary.size}개 과목):`);
  if (mockSummary.size === 0) {
    console.log("  ⚠️ 모의고사 성적 데이터가 없습니다.");
  } else {
    mockSummary.forEach((summary, subject) => {
      console.log(`  - ${subject}:`);
      console.log(`    • 최근 백분위: ${summary.recentPercentile?.toFixed(1) || "없음"}%`);
      console.log(`    • 평균 백분위: ${summary.averagePercentile?.toFixed(1) || "없음"}%`);
      console.log(`    • 최근 등급: ${summary.recentGrade || "없음"}`);
      console.log(`    • 평균 등급: ${summary.averageGrade?.toFixed(2) || "없음"}`);
    });
  }
  
  console.log(`\n⚠️ 위험도 분석 (${riskIndex.size}개 과목):`);
  if (riskIndex.size === 0) {
    console.log("  ⚠️ 위험도 분석을 위한 데이터가 부족합니다.");
  } else {
    riskIndex.forEach((risk, subject) => {
      console.log(`  - ${subject}: 위험도 ${risk.riskScore}점`);
      if (risk.reasons.length > 0) {
        console.log(`    • 이유: ${risk.reasons.join(", ")}`);
      }
    });
  }
  
  // 4. 추천 콘텐츠에 필요한 데이터 부족 여부 확인
  console.log(`\n\n=== 추천 콘텐츠 활용 가능 여부 ===\n`);
  
  const allSubjects = new Set<string>();
  schoolSummary.forEach((_, subject) => allSubjects.add(subject));
  mockSummary.forEach((_, subject) => allSubjects.add(subject));
  
  const requiredSubjects = ["국어", "수학", "영어"];
  const hasRequiredSubjects = requiredSubjects.every(subject => 
    allSubjects.has(subject.toLowerCase())
  );
  
  console.log(`✅ 필수 과목 데이터: ${hasRequiredSubjects ? "충족" : "부족"}`);
  if (!hasRequiredSubjects) {
    const missing = requiredSubjects.filter(s => !allSubjects.has(s.toLowerCase()));
    console.log(`   부족한 과목: ${missing.join(", ")}`);
  }
  
  // 각 과목별 데이터 충족도
  console.log(`\n📋 과목별 데이터 충족도:`);
  allSubjects.forEach(subject => {
    const school = schoolSummary.get(subject);
    const mock = mockSummary.get(subject);
    const risk = riskIndex.get(subject);
    
    const hasSchool = school && school.recentGrade !== null;
    const hasMock = mock && (mock.recentPercentile !== null || mock.recentGrade !== null);
    const hasMultipleSchool = school && school.averageGrade !== null && school.gradeVariance > 0;
    const hasMultipleMock = mock && mock.averagePercentile !== null;
    
    let level = "기본";
    if (hasMultipleSchool && hasMultipleMock) {
      level = "최적";
    } else if (hasMultipleSchool || hasMultipleMock) {
      level = "좋음";
    } else if (hasSchool || hasMock) {
      level = "기본";
    } else {
      level = "없음";
    }
    
    console.log(`  - ${subject}: ${level}`);
    console.log(`    • 내신: ${hasSchool ? (hasMultipleSchool ? "2개 이상" : "1개") : "없음"}`);
    console.log(`    • 모의고사: ${hasMock ? (hasMultipleMock ? "2개 이상" : "1개") : "없음"}`);
    console.log(`    • 위험도: ${risk ? `${risk.riskScore}점` : "계산 불가"}`);
  });
  
  // 5. 개선 권장사항
  console.log(`\n\n=== 개선 권장사항 ===\n`);
  
  const recommendations: string[] = [];
  
  if (schoolSummary.size === 0 && mockSummary.size === 0) {
    recommendations.push("❌ 성적 데이터가 전혀 없습니다. 최소 1개 과목의 성적을 입력해주세요.");
  } else {
    if (schoolSummary.size === 0) {
      recommendations.push("⚠️ 내신 성적이 없습니다. 내신 성적을 입력하면 더 정확한 추천을 받을 수 있습니다.");
    }
    if (mockSummary.size === 0) {
      recommendations.push("⚠️ 모의고사 성적이 없습니다. 모의고사 성적을 입력하면 위험도 분석이 가능합니다.");
    }
    
    // 필수 과목 확인
    requiredSubjects.forEach(subject => {
      const lowerSubject = subject.toLowerCase();
      if (!allSubjects.has(lowerSubject)) {
        recommendations.push(`⚠️ 필수 과목 "${subject}"의 성적 데이터가 없습니다.`);
      } else {
        const school = schoolSummary.get(lowerSubject);
        const mock = mockSummary.get(lowerSubject);
        if (!school && !mock) {
          recommendations.push(`⚠️ 필수 과목 "${subject}"의 성적 데이터가 없습니다.`);
        } else if (school && school.averageGrade === null) {
          recommendations.push(`💡 필수 과목 "${subject}"의 내신 성적을 2개 이상 입력하면 평균 계산이 가능합니다.`);
        } else if (mock && mock.averagePercentile === null) {
          recommendations.push(`💡 필수 과목 "${subject}"의 모의고사 성적을 2개 이상 입력하면 평균 계산이 가능합니다.`);
        }
      }
    });
    
    // 위험도 분석을 위한 데이터
    const highRiskSubjects = Array.from(riskIndex.entries())
      .filter(([_, risk]) => risk.riskScore >= 50)
      .map(([subject, _]) => subject);
    
    if (highRiskSubjects.length === 0 && riskIndex.size > 0) {
      recommendations.push("💡 위험도가 높은 과목이 없습니다. 현재 성적이 안정적입니다.");
    } else if (highRiskSubjects.length > 0) {
      recommendations.push(`⚠️ 위험도가 높은 과목: ${highRiskSubjects.join(", ")} - 추가 학습이 필요합니다.`);
    }
  }
  
  if (recommendations.length === 0) {
    console.log("✅ 모든 추천 기능을 활용할 수 있는 충분한 데이터가 있습니다!");
  } else {
    recommendations.forEach(rec => console.log(rec));
  }
  
  console.log(`\n`);
}

checkStudentScores().catch(console.error);


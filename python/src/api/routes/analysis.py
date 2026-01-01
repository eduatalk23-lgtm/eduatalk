"""
분석 API 라우트

학습 패턴 분석, 성적 트렌드 분석 등의 엔드포인트를 제공합니다.
"""

from typing import Any

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from ...db_connector import get_connector
from ...analysis import (
    analyze_learning_patterns,
    analyze_score_trends,
    calculate_study_efficiency,
)

router = APIRouter()


# ============================================
# 요청/응답 스키마
# ============================================


class LearningPatternResponse(BaseModel):
    """학습 패턴 분석 응답"""

    student_id: str
    daily_distribution: dict[str, Any] | None = None
    hourly_distribution: dict[str, Any] | None = None
    subject_distribution: dict[str, Any] | None = None
    completion_rate: dict[str, Any] | None = None
    average_duration: dict[str, Any] | None = None


class ScoreTrendResponse(BaseModel):
    """성적 트렌드 분석 응답"""

    student_id: str
    subject_averages: dict[str, Any] | None = None
    overall_trend: dict[str, Any] | None = None
    grade_distribution: dict[int, int] | None = None
    weak_subjects: dict[str, float] | None = None


class EfficiencyAnalysisResponse(BaseModel):
    """학습 효율성 분석 응답"""

    student_id: str
    study_score_correlation: dict[str, Any] | None = None
    recommendations: list[str]


class ComprehensiveReportResponse(BaseModel):
    """종합 분석 리포트 응답"""

    student_id: str
    learning_patterns: dict[str, Any]
    score_trends: dict[str, Any]
    efficiency: dict[str, Any]
    insights: list[str]
    action_items: list[str]


# ============================================
# 엔드포인트
# ============================================


@router.get("/learning-patterns/{student_id}", response_model=LearningPatternResponse)
async def get_learning_patterns(
    student_id: str,
    days: int = Query(default=90, ge=7, le=365, description="분석 기간 (일)"),
) -> LearningPatternResponse:
    """
    학생의 학습 패턴을 분석합니다.

    - 요일별/시간대별 학습량 분포
    - 과목별 학습 시간
    - 완료율 및 평균 학습 시간
    """
    try:
        db = get_connector()

        # 기간 계산
        from datetime import datetime, timedelta

        start_date = (datetime.now() - timedelta(days=days)).strftime("%Y-%m-%d")

        # 플랜 데이터 조회
        plans_df = db.get_student_plans(student_id, start_date=start_date)

        if plans_df.empty:
            return LearningPatternResponse(
                student_id=student_id,
                daily_distribution=None,
                hourly_distribution=None,
                subject_distribution=None,
                completion_rate=None,
                average_duration=None,
            )

        # 분석 실행
        analysis = analyze_learning_patterns(plans_df)

        return LearningPatternResponse(
            student_id=student_id,
            daily_distribution=analysis.get("daily_distribution"),
            hourly_distribution=analysis.get("hourly_distribution"),
            subject_distribution=analysis.get("subject_distribution"),
            completion_rate=analysis.get("completion_rate"),
            average_duration=analysis.get("average_duration"),
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/score-trends/{student_id}", response_model=ScoreTrendResponse)
async def get_score_trends(
    student_id: str,
    limit: int = Query(default=50, ge=5, le=200, description="분석할 성적 수"),
) -> ScoreTrendResponse:
    """
    학생의 성적 트렌드를 분석합니다.

    - 과목별 평균 성적
    - 전체 성적 추이
    - 등급 분포
    - 취약 과목
    """
    try:
        db = get_connector()

        # 성적 데이터 조회
        scores_df = db.get_student_scores(student_id, limit=limit)

        if scores_df.empty:
            return ScoreTrendResponse(
                student_id=student_id,
                subject_averages=None,
                overall_trend=None,
                grade_distribution=None,
                weak_subjects=None,
            )

        # 분석 실행
        analysis = analyze_score_trends(scores_df)

        return ScoreTrendResponse(
            student_id=student_id,
            subject_averages=analysis.get("subject_averages"),
            overall_trend=analysis.get("overall_trend"),
            grade_distribution=analysis.get("grade_distribution"),
            weak_subjects=analysis.get("weak_subjects"),
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/efficiency/{student_id}", response_model=EfficiencyAnalysisResponse)
async def get_study_efficiency(student_id: str) -> EfficiencyAnalysisResponse:
    """
    학습 효율성을 분석합니다.

    - 학습 시간과 성적의 상관관계
    - 개선 추천사항
    """
    try:
        db = get_connector()

        # 데이터 조회
        plans_df = db.get_student_plans(student_id)
        scores_df = db.get_student_scores(student_id)

        # 효율성 분석
        efficiency = calculate_study_efficiency(plans_df, scores_df)

        # 추천사항 생성
        recommendations = _generate_efficiency_recommendations(efficiency)

        return EfficiencyAnalysisResponse(
            student_id=student_id,
            study_score_correlation=efficiency.get("study_score_correlation"),
            recommendations=recommendations,
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/report/{student_id}", response_model=ComprehensiveReportResponse)
async def get_comprehensive_report(student_id: str) -> ComprehensiveReportResponse:
    """
    종합 분석 리포트를 생성합니다.

    모든 분석 결과를 통합하여 인사이트와 실행 항목을 제공합니다.
    """
    try:
        db = get_connector()

        # 모든 데이터 조회
        plans_df = db.get_student_plans(student_id)
        scores_df = db.get_student_scores(student_id)

        # 각 분석 실행
        learning_patterns = analyze_learning_patterns(plans_df)
        score_trends = analyze_score_trends(scores_df)
        efficiency = calculate_study_efficiency(plans_df, scores_df)

        # 인사이트 생성
        insights = _generate_insights(learning_patterns, score_trends, efficiency)

        # 실행 항목 생성
        action_items = _generate_action_items(learning_patterns, score_trends, efficiency)

        return ComprehensiveReportResponse(
            student_id=student_id,
            learning_patterns=learning_patterns,
            score_trends=score_trends,
            efficiency=efficiency,
            insights=insights,
            action_items=action_items,
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/compare/{student_id}")
async def compare_with_peers(
    student_id: str,
    tenant_id: str = Query(..., description="테넌트 ID"),
) -> dict[str, Any]:
    """
    동일 테넌트 내 다른 학생들과 성적을 비교합니다.
    """
    try:
        db = get_connector()

        # 학생 성적 조회
        student_scores = db.get_student_scores(student_id)

        if student_scores.empty:
            raise HTTPException(
                status_code=404,
                detail="학생의 성적 데이터가 없습니다.",
            )

        # 테넌트 전체 성적 조회
        all_scores = db.get_all_scores_by_tenant(tenant_id)

        if all_scores.empty:
            return {
                "student_id": student_id,
                "comparison": None,
                "message": "비교 데이터가 없습니다.",
            }

        # 비교 분석
        student_avg = student_scores["score"].mean()
        tenant_avg = all_scores["score"].mean()
        percentile = (all_scores["score"] < student_avg).mean() * 100

        # 과목별 비교
        subject_comparison = {}
        for subject in student_scores["subject"].unique():
            student_subj_avg = student_scores[
                student_scores["subject"] == subject
            ]["score"].mean()
            tenant_subj = all_scores[all_scores["subject"] == subject]
            if not tenant_subj.empty:
                tenant_subj_avg = tenant_subj["score"].mean()
                subject_comparison[subject] = {
                    "student_avg": round(student_subj_avg, 2),
                    "tenant_avg": round(tenant_subj_avg, 2),
                    "difference": round(student_subj_avg - tenant_subj_avg, 2),
                }

        return {
            "student_id": student_id,
            "overall": {
                "student_average": round(student_avg, 2),
                "tenant_average": round(tenant_avg, 2),
                "percentile": round(percentile, 1),
                "position": _get_position_description(percentile),
            },
            "by_subject": subject_comparison,
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================
# 헬퍼 함수
# ============================================


def _generate_efficiency_recommendations(efficiency: dict[str, Any]) -> list[str]:
    """효율성 기반 추천사항 생성"""
    recommendations = []

    correlation = efficiency.get("study_score_correlation", {})
    if correlation:
        corr_value = correlation.get("correlation", 0)
        if corr_value > 0.5:
            recommendations.append(
                "학습 시간과 성적이 강한 양의 상관관계를 보입니다. "
                "현재 학습 방법을 유지하세요."
            )
        elif corr_value < 0:
            recommendations.append(
                "학습 시간이 늘어도 성적이 오르지 않습니다. "
                "학습 방법을 점검해보세요."
            )
        else:
            recommendations.append(
                "학습 시간과 성적의 상관관계가 약합니다. "
                "집중력 있는 학습이 필요합니다."
            )

    # 기본 추천
    if not recommendations:
        recommendations.extend([
            "규칙적인 학습 습관을 유지하세요.",
            "취약 과목에 더 많은 시간을 투자하세요.",
        ])

    return recommendations


def _generate_insights(
    patterns: dict[str, Any],
    trends: dict[str, Any],
    efficiency: dict[str, Any],
) -> list[str]:
    """인사이트 생성"""
    insights = []

    # 완료율 인사이트
    if "completion_rate" in patterns:
        rate = patterns["completion_rate"].get("rate", 0)
        if rate >= 80:
            insights.append(f"높은 완료율({rate}%)을 유지하고 있습니다.")
        elif rate < 50:
            insights.append(f"완료율({rate}%)이 낮습니다. 목표 조정이 필요합니다.")

    # 성적 추세 인사이트
    if "overall_trend" in trends:
        trend = trends["overall_trend"]
        direction = trend.get("direction", "stable")
        change = trend.get("change", 0)
        if direction == "improving":
            insights.append(f"성적이 상승 추세입니다 (+{change:.1f}점).")
        elif direction == "declining":
            insights.append(f"성적이 하락 추세입니다 ({change:.1f}점).")

    # 취약 과목 인사이트
    if "weak_subjects" in trends:
        weak = list(trends["weak_subjects"].keys())
        if weak:
            insights.append(f"취약 과목: {', '.join(weak[:3])}")

    return insights or ["분석을 위한 데이터가 부족합니다."]


def _generate_action_items(
    patterns: dict[str, Any],
    trends: dict[str, Any],
    efficiency: dict[str, Any],
) -> list[str]:
    """실행 항목 생성"""
    actions = []

    # 완료율 기반 액션
    if "completion_rate" in patterns:
        rate = patterns["completion_rate"].get("rate", 0)
        if rate < 70:
            actions.append("일일 목표 플랜 수를 줄여 완료율을 높이세요.")

    # 취약 과목 기반 액션
    if "weak_subjects" in trends:
        weak = list(trends["weak_subjects"].keys())
        if weak:
            actions.append(f"{weak[0]} 과목에 주당 2시간 추가 학습을 권장합니다.")

    # 학습 패턴 기반 액션
    if "daily_distribution" in patterns:
        least_day = patterns["daily_distribution"].get("least_active_day")
        day_names = ["일", "월", "화", "수", "목", "금", "토"]
        if least_day is not None:
            actions.append(f"{day_names[least_day]}요일에 학습 플랜을 추가하세요.")

    # 기본 액션
    if not actions:
        actions.extend([
            "매일 일정한 시간에 학습하는 습관을 만드세요.",
            "복습 시간을 확보하세요 (새 학습의 20%).",
        ])

    return actions[:5]


def _get_position_description(percentile: float) -> str:
    """백분위에 따른 위치 설명"""
    if percentile >= 90:
        return "상위 10%"
    elif percentile >= 75:
        return "상위 25%"
    elif percentile >= 50:
        return "상위 50%"
    elif percentile >= 25:
        return "하위 50%"
    else:
        return "하위 25%"

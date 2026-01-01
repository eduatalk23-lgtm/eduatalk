"""
추천 API 라우트

콘텐츠 추천, 학습 플랜 추천 등의 엔드포인트를 제공합니다.
"""

from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from ...db_connector import get_connector
from ...ml.content_recommender import ContentRecommender

router = APIRouter()


# ============================================
# 요청/응답 스키마
# ============================================


class ContentRecommendationRequest(BaseModel):
    """콘텐츠 추천 요청"""

    student_id: str = Field(..., description="학생 ID")
    subject: str | None = Field(default=None, description="특정 과목 (선택)")
    limit: int = Field(default=5, ge=1, le=20, description="추천 개수")
    include_reasons: bool = Field(default=True, description="추천 이유 포함")


class RecommendedContent(BaseModel):
    """추천 콘텐츠"""

    content_id: str
    title: str
    subject: str
    content_type: str
    difficulty: str | None
    relevance_score: float
    reason: str | None = None


class ContentRecommendationResponse(BaseModel):
    """콘텐츠 추천 응답"""

    student_id: str
    recommendations: list[RecommendedContent]
    weak_subjects: list[str]
    strategy: str


class StudyPlanRecommendationRequest(BaseModel):
    """학습 플랜 추천 요청"""

    student_id: str = Field(..., description="학생 ID")
    content_ids: list[str] = Field(..., description="학습할 콘텐츠 ID 목록")
    days: int = Field(default=7, ge=1, le=30, description="플랜 기간 (일)")
    daily_minutes: int = Field(default=180, ge=30, le=480, description="일일 학습 시간 (분)")


class RecommendedTimeSlot(BaseModel):
    """추천 시간대"""

    day_of_week: int  # 0-6
    start_time: str
    end_time: str
    subject: str
    reason: str


class StudyPlanRecommendationResponse(BaseModel):
    """학습 플랜 추천 응답"""

    student_id: str
    recommended_slots: list[RecommendedTimeSlot]
    daily_distribution: dict[str, int]  # 과목별 일일 추천 시간
    tips: list[str]


# ============================================
# 엔드포인트
# ============================================


@router.post("/content", response_model=ContentRecommendationResponse)
async def recommend_content(
    request: ContentRecommendationRequest,
) -> ContentRecommendationResponse:
    """
    학생에게 적합한 학습 콘텐츠를 추천합니다.

    - 취약 과목 우선 추천
    - 학습 이력 기반 난이도 조절
    - 콘텐츠 유형 다양화
    """
    try:
        db = get_connector()
        recommender = ContentRecommender()

        # 데이터 조회
        scores_df = db.get_student_scores(request.student_id)
        contents_df = db.get_student_contents(request.student_id)
        plans_df = db.get_student_plans(request.student_id)

        if contents_df.empty:
            raise HTTPException(
                status_code=404,
                detail="학생의 콘텐츠 데이터가 없습니다.",
            )

        # 추천 실행
        result = recommender.recommend(
            scores_df=scores_df,
            contents_df=contents_df,
            plans_df=plans_df,
            subject=request.subject,
            limit=request.limit,
            include_reasons=request.include_reasons,
        )

        recommendations = [
            RecommendedContent(
                content_id=r["content_id"],
                title=r["title"],
                subject=r["subject"],
                content_type=r["content_type"],
                difficulty=r.get("difficulty"),
                relevance_score=r["relevance_score"],
                reason=r.get("reason") if request.include_reasons else None,
            )
            for r in result["recommendations"]
        ]

        return ContentRecommendationResponse(
            student_id=request.student_id,
            recommendations=recommendations,
            weak_subjects=result["weak_subjects"],
            strategy=result["strategy"],
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/study-plan", response_model=StudyPlanRecommendationResponse)
async def recommend_study_plan(
    request: StudyPlanRecommendationRequest,
) -> StudyPlanRecommendationResponse:
    """
    최적의 학습 시간대와 과목 배치를 추천합니다.

    - 학습 패턴 분석 기반
    - 집중력 높은 시간대에 어려운 과목 배치
    - 과목 간 균형 유지
    """
    try:
        db = get_connector()

        # 데이터 조회
        plans_df = db.get_student_plans(request.student_id)
        scores_df = db.get_student_scores(request.student_id)
        contents_df = db.get_student_contents(request.student_id)

        # 선택된 콘텐츠 필터링
        if not contents_df.empty:
            selected_contents = contents_df[
                contents_df["id"].isin(request.content_ids)
            ]
        else:
            selected_contents = contents_df

        # 학습 패턴 분석
        from ...analysis import analyze_learning_patterns

        patterns = analyze_learning_patterns(plans_df)

        # 추천 시간대 생성
        recommended_slots = _generate_recommended_slots(
            patterns=patterns,
            contents=selected_contents,
            scores_df=scores_df,
            daily_minutes=request.daily_minutes,
        )

        # 과목별 일일 추천 시간
        daily_distribution = _calculate_daily_distribution(
            contents=selected_contents,
            scores_df=scores_df,
            daily_minutes=request.daily_minutes,
        )

        # 학습 팁 생성
        tips = _generate_study_tips(patterns, scores_df)

        return StudyPlanRecommendationResponse(
            student_id=request.student_id,
            recommended_slots=recommended_slots,
            daily_distribution=daily_distribution,
            tips=tips,
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/weak-subjects/{student_id}")
async def get_weak_subjects(student_id: str) -> dict[str, Any]:
    """
    학생의 취약 과목 목록을 반환합니다.
    """
    try:
        db = get_connector()
        scores_df = db.get_student_scores(student_id)

        if scores_df.empty:
            return {"weak_subjects": [], "message": "성적 데이터가 없습니다."}

        # 과목별 평균 성적
        subject_avg = scores_df.groupby("subject")["score"].mean()

        # 전체 평균보다 낮은 과목 또는 60점 미만
        overall_avg = scores_df["score"].mean()
        weak = subject_avg[
            (subject_avg < overall_avg) | (subject_avg < 60)
        ].sort_values()

        return {
            "weak_subjects": weak.index.tolist(),
            "scores": weak.to_dict(),
            "overall_average": round(overall_avg, 2),
            "threshold": min(overall_avg, 60),
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================
# 헬퍼 함수
# ============================================


def _generate_recommended_slots(
    patterns: dict[str, Any],
    contents: Any,
    scores_df: Any,
    daily_minutes: int,
) -> list[RecommendedTimeSlot]:
    """추천 시간대 생성"""
    slots = []

    # 기본 시간대 (패턴이 없는 경우)
    default_slots = [
        (0, "09:00", "10:00", "어려운 과목", "아침 집중력이 높은 시간"),
        (0, "14:00", "15:00", "복습", "점심 후 가벼운 복습"),
        (0, "19:00", "20:00", "암기 과목", "저녁 암기 최적 시간"),
    ]

    # 패턴 기반 추천 또는 기본값 사용
    if "hourly_distribution" in patterns:
        peak_hours = patterns["hourly_distribution"].get("peak_hours", [9, 14, 19])
        for i, hour in enumerate(peak_hours[:3]):
            subject_type = ["어려운 과목", "복습", "암기 과목"][i % 3]
            reason = f"학습 패턴 분석: {hour}시가 집중력이 높습니다."
            slots.append(
                RecommendedTimeSlot(
                    day_of_week=0,
                    start_time=f"{hour:02d}:00",
                    end_time=f"{hour+1:02d}:00",
                    subject=subject_type,
                    reason=reason,
                )
            )
    else:
        for day, start, end, subject, reason in default_slots:
            slots.append(
                RecommendedTimeSlot(
                    day_of_week=day,
                    start_time=start,
                    end_time=end,
                    subject=subject,
                    reason=reason,
                )
            )

    return slots


def _calculate_daily_distribution(
    contents: Any,
    scores_df: Any,
    daily_minutes: int,
) -> dict[str, int]:
    """과목별 일일 추천 시간 계산"""
    if contents.empty:
        return {}

    subjects = contents["subject"].unique().tolist() if "subject" in contents.columns else []

    if not subjects:
        return {}

    # 취약 과목에 더 많은 시간 배분
    weak_subjects = set()
    if not scores_df.empty and "subject" in scores_df.columns:
        subject_avg = scores_df.groupby("subject")["score"].mean()
        weak_subjects = set(subject_avg[subject_avg < 60].index)

    distribution = {}
    remaining = daily_minutes
    per_subject = daily_minutes // len(subjects)

    for subject in subjects:
        if subject in weak_subjects:
            # 취약 과목은 1.5배
            allocation = min(int(per_subject * 1.5), remaining)
        else:
            allocation = min(per_subject, remaining)

        distribution[subject] = allocation
        remaining -= allocation

    return distribution


def _generate_study_tips(patterns: dict[str, Any], scores_df: Any) -> list[str]:
    """학습 팁 생성"""
    tips = []

    # 완료율 기반 팁
    if "completion_rate" in patterns:
        rate = patterns["completion_rate"].get("rate", 0)
        if rate < 70:
            tips.append("완료율을 높이기 위해 현실적인 목표를 설정하세요.")
        elif rate > 90:
            tips.append("훌륭한 완료율입니다! 학습량을 조금 늘려보는 것도 좋습니다.")

    # 요일별 패턴 기반 팁
    if "daily_distribution" in patterns:
        least_day = patterns["daily_distribution"].get("least_active_day")
        day_names = ["일", "월", "화", "수", "목", "금", "토"]
        if least_day is not None:
            tips.append(f"{day_names[least_day]}요일 학습량을 늘려보세요.")

    # 기본 팁
    tips.extend([
        "50분 학습 후 10분 휴식을 권장합니다.",
        "어려운 과목은 집중력이 높은 오전에 배치하세요.",
    ])

    return tips[:5]  # 최대 5개

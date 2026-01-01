"""
ScorePredictor 테스트
"""

import numpy as np
import pandas as pd
import pytest

from src.ml.score_predictor import ScorePredictor


class TestScorePredictor:
    """ScorePredictor 단위 테스트"""

    @pytest.fixture
    def predictor(self):
        """테스트용 예측기 인스턴스"""
        return ScorePredictor(min_samples_for_ml=10)

    @pytest.fixture
    def sample_scores(self):
        """샘플 성적 데이터"""
        return pd.DataFrame(
            {
                "subject": ["수학"] * 5 + ["영어"] * 3,
                "score": [75, 78, 80, 82, 85, 70, 72, 75],
                "created_at": pd.date_range("2024-01-01", periods=8, freq="W"),
            }
        )

    @pytest.fixture
    def sample_plans(self):
        """샘플 플랜 데이터"""
        return pd.DataFrame(
            {
                "subject": ["수학"] * 10,
                "actual_duration": [60, 45, 50, 55, 60, 45, 50, 55, 60, 45],
                "is_completed": [True] * 8 + [False] * 2,
            }
        )

    def test_predict_with_sufficient_data(self, predictor, sample_scores, sample_plans):
        """충분한 데이터로 예측"""
        result = predictor.predict(
            scores_df=sample_scores,
            plans_df=sample_plans,
            subject="수학",
            days_ahead=30,
        )

        assert "current_score" in result
        assert "predicted_score" in result
        assert "confidence" in result
        assert "trend" in result
        assert "factors" in result

        assert result["current_score"] == 85  # 마지막 수학 점수
        assert 0 <= result["predicted_score"] <= 100
        assert 0 <= result["confidence"] <= 1
        assert result["trend"] in ["improving", "stable", "declining"]

    def test_predict_insufficient_data(self, predictor):
        """데이터 부족 시 응답"""
        scores_df = pd.DataFrame(
            {
                "subject": ["수학", "수학"],
                "score": [75, 80],
                "created_at": pd.date_range("2024-01-01", periods=2, freq="W"),
            }
        )

        result = predictor.predict(
            scores_df=scores_df,
            plans_df=None,
            subject="수학",
            days_ahead=30,
        )

        assert result["current_score"] is None
        assert result["predicted_score"] == 0
        assert result["confidence"] == 0
        assert result["trend"] == "unknown"
        assert "message" in result["factors"]

    def test_analyze_trend_improving(self, predictor):
        """상승 트렌드 분석"""
        scores_df = pd.DataFrame(
            {
                "score": [60, 65, 70, 75, 80, 85, 90],
            }
        )

        trend = predictor._analyze_trend(scores_df)

        assert trend["direction"] == "improving"
        assert trend["slope"] > 0

    def test_analyze_trend_declining(self, predictor):
        """하락 트렌드 분석"""
        scores_df = pd.DataFrame(
            {
                "score": [90, 85, 80, 75, 70, 65, 60],
            }
        )

        trend = predictor._analyze_trend(scores_df)

        assert trend["direction"] == "declining"
        assert trend["slope"] < 0

    def test_analyze_trend_stable(self, predictor):
        """안정 트렌드 분석"""
        scores_df = pd.DataFrame(
            {
                "score": [75, 76, 74, 75, 76, 74, 75],
            }
        )

        trend = predictor._analyze_trend(scores_df)

        assert trend["direction"] == "stable"
        assert abs(trend["slope"]) <= 0.5

    def test_simple_predict(self, predictor, sample_scores):
        """단순 예측 테스트"""
        subject_scores = sample_scores[sample_scores["subject"] == "수학"]
        trend_info = predictor._analyze_trend(subject_scores)

        predicted, confidence = predictor._simple_predict(
            scores_df=subject_scores,
            trend_info=trend_info,
            days_ahead=30,
        )

        assert isinstance(predicted, float)
        assert isinstance(confidence, float)
        assert 0 <= confidence <= 1

    def test_extract_features(self, predictor, sample_scores):
        """특성 추출 테스트"""
        subject_scores = sample_scores[sample_scores["subject"] == "수학"]

        features = predictor._extract_features(subject_scores, None)

        assert features is not None
        assert isinstance(features, np.ndarray)
        assert features.shape[0] == len(subject_scores)
        assert features.shape[1] == 5  # 이전 점수 3개 + 이동평균 + 표준편차

    def test_extract_features_insufficient(self, predictor):
        """특성 추출 - 데이터 부족"""
        scores_df = pd.DataFrame({"score": [75, 80]})

        features = predictor._extract_features(scores_df, None)

        assert features is None

    def test_analyze_factors(self, predictor, sample_scores, sample_plans):
        """영향 요인 분석"""
        subject_scores = sample_scores[sample_scores["subject"] == "수학"]

        factors = predictor._analyze_factors(subject_scores, sample_plans, "수학")

        assert "recent_change" in factors
        assert "average_score" in factors
        assert "volatility" in factors

    def test_score_bounds(self, predictor):
        """점수 범위 제한 테스트"""
        # 극단적인 상승 트렌드
        scores_df = pd.DataFrame(
            {
                "subject": ["수학"] * 5,
                "score": [95, 96, 97, 98, 99],
                "created_at": pd.date_range("2024-01-01", periods=5, freq="W"),
            }
        )

        result = predictor.predict(
            scores_df=scores_df,
            plans_df=None,
            subject="수학",
            days_ahead=365,  # 긴 예측 기간
        )

        # 100점을 초과하지 않아야 함
        assert result["predicted_score"] <= 100

    def test_ml_predict_fallback(self, predictor):
        """ML 예측 실패 시 폴백"""
        # ML에 충분한 데이터가 있지만 XGBoost 오류 시 폴백
        scores_df = pd.DataFrame(
            {
                "subject": ["수학"] * 15,
                "score": [70 + i for i in range(15)],
                "created_at": pd.date_range("2024-01-01", periods=15, freq="W"),
            }
        )

        result = predictor.predict(
            scores_df=scores_df,
            plans_df=None,
            subject="수학",
            days_ahead=30,
        )

        # 결과가 반환되어야 함 (ML 또는 폴백)
        assert result["predicted_score"] > 0
        assert result["confidence"] > 0

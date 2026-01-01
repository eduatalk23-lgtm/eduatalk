"""
성적 예측 모델

과거 성적과 학습 패턴을 기반으로 미래 성적을 예측합니다.
"""

from typing import Any

import numpy as np
import pandas as pd


class ScorePredictor:
    """
    성적 예측 모델

    선형 회귀와 이동 평균을 조합하여 성적을 예측합니다.
    데이터가 충분할 경우 XGBoost 모델을 사용합니다.
    """

    def __init__(self, min_samples_for_ml: int = 10):
        """
        Args:
            min_samples_for_ml: ML 모델 사용을 위한 최소 샘플 수
        """
        self.min_samples_for_ml = min_samples_for_ml
        self._model = None

    def predict(
        self,
        scores_df: pd.DataFrame,
        plans_df: pd.DataFrame | None,
        subject: str,
        days_ahead: int = 30,
    ) -> dict[str, Any]:
        """
        성적 예측

        Args:
            scores_df: 전체 성적 DataFrame
            plans_df: 학습 플랜 DataFrame (선택)
            subject: 예측할 과목
            days_ahead: 예측 기간 (일)

        Returns:
            예측 결과 딕셔너리
        """
        # 해당 과목 데이터 필터링
        subject_scores = scores_df[scores_df["subject"] == subject].copy()

        if len(subject_scores) < 3:
            return self._insufficient_data_response(subject)

        # 시간순 정렬
        subject_scores = subject_scores.sort_values("created_at")
        current_score = subject_scores["score"].iloc[-1]

        # 트렌드 분석
        trend_info = self._analyze_trend(subject_scores)

        # 예측 방법 선택
        if len(subject_scores) >= self.min_samples_for_ml:
            predicted_score, confidence = self._ml_predict(
                subject_scores, plans_df, days_ahead
            )
        else:
            predicted_score, confidence = self._simple_predict(
                subject_scores, trend_info, days_ahead
            )

        # 점수 범위 제한 (0-100)
        predicted_score = max(0, min(100, predicted_score))

        # 영향 요인 분석
        factors = self._analyze_factors(subject_scores, plans_df, subject)

        return {
            "current_score": float(current_score),
            "predicted_score": round(predicted_score, 1),
            "confidence": round(confidence, 2),
            "trend": trend_info["direction"],
            "factors": factors,
        }

    def _insufficient_data_response(self, subject: str) -> dict[str, Any]:
        """데이터 부족 시 응답"""
        return {
            "current_score": None,
            "predicted_score": 0,
            "confidence": 0,
            "trend": "unknown",
            "factors": {
                "message": f"{subject} 과목의 데이터가 부족합니다 (최소 3개 필요).",
            },
        }

    def _analyze_trend(self, scores_df: pd.DataFrame) -> dict[str, Any]:
        """트렌드 분석"""
        scores = scores_df["score"].values

        if len(scores) < 2:
            return {"direction": "stable", "slope": 0, "r_squared": 0}

        # 선형 회귀로 트렌드 계산
        x = np.arange(len(scores))
        coeffs = np.polyfit(x, scores, 1)
        slope = coeffs[0]

        # R² 계산
        y_pred = np.polyval(coeffs, x)
        ss_res = np.sum((scores - y_pred) ** 2)
        ss_tot = np.sum((scores - np.mean(scores)) ** 2)
        r_squared = 1 - (ss_res / ss_tot) if ss_tot > 0 else 0

        # 방향 결정
        if slope > 0.5:
            direction = "improving"
        elif slope < -0.5:
            direction = "declining"
        else:
            direction = "stable"

        return {
            "direction": direction,
            "slope": float(slope),
            "r_squared": float(r_squared),
        }

    def _simple_predict(
        self,
        scores_df: pd.DataFrame,
        trend_info: dict[str, Any],
        days_ahead: int,
    ) -> tuple[float, float]:
        """단순 예측 (데이터 부족 시)"""
        scores = scores_df["score"].values

        # 가중 이동 평균 (최근 데이터에 더 높은 가중치)
        weights = np.exp(np.linspace(0, 1, len(scores)))
        weighted_avg = np.average(scores, weights=weights)

        # 트렌드 반영
        slope = trend_info["slope"]
        # days_ahead를 "시험 간격" 단위로 변환 (평균 30일 가정)
        prediction_periods = days_ahead / 30
        predicted = weighted_avg + slope * prediction_periods

        # 신뢰도 (데이터 양과 트렌드 일관성 기반)
        data_confidence = min(len(scores) / 10, 1.0) * 0.5
        trend_confidence = min(abs(trend_info["r_squared"]), 1.0) * 0.5
        confidence = data_confidence + trend_confidence

        return float(predicted), float(confidence)

    def _ml_predict(
        self,
        scores_df: pd.DataFrame,
        plans_df: pd.DataFrame | None,
        days_ahead: int,
    ) -> tuple[float, float]:
        """ML 기반 예측 (데이터 충분 시)"""
        try:
            # 특성 엔지니어링
            features = self._extract_features(scores_df, plans_df)

            if features is None:
                return self._simple_predict(
                    scores_df,
                    self._analyze_trend(scores_df),
                    days_ahead,
                )

            # XGBoost 모델 학습 및 예측
            from xgboost import XGBRegressor

            X = features[:-1]  # 마지막 제외 (예측용)
            y = scores_df["score"].values[1:]  # 다음 점수

            if len(X) < 3:
                return self._simple_predict(
                    scores_df,
                    self._analyze_trend(scores_df),
                    days_ahead,
                )

            model = XGBRegressor(
                n_estimators=50,
                max_depth=3,
                learning_rate=0.1,
                random_state=42,
            )
            model.fit(X, y)

            # 마지막 데이터로 예측
            last_features = features[-1:].reshape(1, -1)
            predicted = model.predict(last_features)[0]

            # 신뢰도 (모델 점수 기반)
            confidence = min(model.score(X, y), 1.0) * 0.8 + 0.2

            return float(predicted), float(confidence)

        except Exception:
            # ML 실패 시 단순 예측으로 폴백
            return self._simple_predict(
                scores_df,
                self._analyze_trend(scores_df),
                days_ahead,
            )

    def _extract_features(
        self,
        scores_df: pd.DataFrame,
        plans_df: pd.DataFrame | None,
    ) -> np.ndarray | None:
        """특성 추출"""
        scores = scores_df["score"].values

        if len(scores) < 3:
            return None

        features_list = []
        for i in range(len(scores)):
            feat = []

            # 이전 점수들 (최대 3개)
            for j in range(1, 4):
                if i >= j:
                    feat.append(scores[i - j])
                else:
                    feat.append(scores[0])  # 패딩

            # 이동 평균
            window = min(i + 1, 5)
            feat.append(np.mean(scores[max(0, i - window + 1) : i + 1]))

            # 표준편차
            if i >= 2:
                feat.append(np.std(scores[max(0, i - 4) : i + 1]))
            else:
                feat.append(0)

            features_list.append(feat)

        return np.array(features_list)

    def _analyze_factors(
        self,
        scores_df: pd.DataFrame,
        plans_df: pd.DataFrame | None,
        subject: str,
    ) -> dict[str, Any]:
        """영향 요인 분석"""
        factors = {}

        # 최근 성적 변화
        if len(scores_df) >= 2:
            recent_change = scores_df["score"].iloc[-1] - scores_df["score"].iloc[-2]
            factors["recent_change"] = round(float(recent_change), 1)

        # 평균과의 차이
        avg = scores_df["score"].mean()
        factors["average_score"] = round(float(avg), 1)

        # 변동성
        if len(scores_df) >= 3:
            factors["volatility"] = round(float(scores_df["score"].std()), 1)

        # 학습량 (플랜 데이터가 있는 경우)
        if plans_df is not None and not plans_df.empty:
            subject_plans = plans_df[plans_df.get("subject") == subject]
            if not subject_plans.empty:
                factors["study_sessions"] = len(subject_plans)
                if "actual_duration" in subject_plans.columns:
                    total_minutes = subject_plans["actual_duration"].sum()
                    factors["total_study_minutes"] = int(total_minutes)

        return factors

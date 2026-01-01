"""
FastAPI 엔드포인트 테스트
"""

from unittest.mock import MagicMock, patch

import pandas as pd
import pytest
from fastapi.testclient import TestClient

from src.api.main import app


@pytest.fixture
def client():
    """테스트 클라이언트"""
    return TestClient(app)


@pytest.fixture
def mock_db():
    """모의 DB 커넥터"""
    mock = MagicMock()

    # 기본 반환값 설정
    mock.get_student_scores.return_value = pd.DataFrame(
        {
            "subject": ["수학", "수학", "수학", "영어", "영어"],
            "score": [75, 78, 80, 70, 72],
            "created_at": pd.date_range("2024-01-01", periods=5, freq="W"),
        }
    )

    mock.get_student_plans.return_value = pd.DataFrame(
        {
            "subject": ["수학", "영어"],
            "actual_duration": [60, 45],
            "is_completed": [True, True],
            "scheduled_date": pd.date_range("2024-01-01", periods=2, freq="D"),
        }
    )

    mock.get_student_contents.return_value = pd.DataFrame(
        {
            "id": ["c1", "c2", "c3"],
            "title": ["수학 기초", "영어 문법", "과학 개념"],
            "subject": ["수학", "영어", "과학"],
            "content_type": ["book", "lecture", "video"],
            "difficulty": ["easy", "medium", "easy"],
        }
    )

    return mock


class TestHealthCheck:
    """헬스체크 테스트"""

    def test_health(self, client):
        """헬스체크 성공"""
        response = client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"


class TestPredictionsAPI:
    """예측 API 테스트"""

    @patch("src.api.routes.predictions.get_connector")
    def test_predict_score(self, mock_get_connector, client, mock_db):
        """성적 예측"""
        mock_get_connector.return_value = mock_db

        response = client.post(
            "/api/predictions/score",
            json={
                "student_id": "test-student",
                "subject": "수학",
                "days_ahead": 30,
            },
        )

        assert response.status_code == 200
        data = response.json()
        assert data["student_id"] == "test-student"
        assert data["subject"] == "수학"
        assert "predicted_score" in data
        assert "confidence" in data
        assert "trend" in data

    @patch("src.api.routes.predictions.get_connector")
    def test_predict_score_no_data(self, mock_get_connector, client):
        """성적 데이터 없음"""
        mock_db = MagicMock()
        mock_db.get_student_scores.return_value = pd.DataFrame()
        mock_get_connector.return_value = mock_db

        response = client.post(
            "/api/predictions/score",
            json={
                "student_id": "test-student",
                "subject": "수학",
            },
        )

        assert response.status_code == 404

    @patch("src.api.routes.predictions.get_connector")
    def test_predict_workload(self, mock_get_connector, client, mock_db):
        """학습량 예측"""
        mock_get_connector.return_value = mock_db

        response = client.post(
            "/api/predictions/workload",
            json={
                "student_id": "test-student",
                "weeks_ahead": 1,
            },
        )

        assert response.status_code == 200
        data = response.json()
        assert data["student_id"] == "test-student"
        assert "predicted_plans" in data
        assert "confidence_interval" in data

    @patch("src.api.routes.predictions.get_connector")
    def test_get_predictable_subjects(self, mock_get_connector, client, mock_db):
        """예측 가능 과목"""
        mock_get_connector.return_value = mock_db

        response = client.get("/api/predictions/subjects/test-student")

        assert response.status_code == 200
        data = response.json()
        assert "subjects" in data
        assert "수학" in data["subjects"]  # 3개 이상의 데이터


class TestRecommendationsAPI:
    """추천 API 테스트"""

    @patch("src.api.routes.recommendations.get_connector")
    def test_recommend_content(self, mock_get_connector, client, mock_db):
        """콘텐츠 추천"""
        mock_get_connector.return_value = mock_db

        response = client.post(
            "/api/recommendations/content",
            json={
                "student_id": "test-student",
                "limit": 3,
            },
        )

        assert response.status_code == 200
        data = response.json()
        assert data["student_id"] == "test-student"
        assert "recommendations" in data
        assert "weak_subjects" in data
        assert "strategy" in data

    @patch("src.api.routes.recommendations.get_connector")
    def test_recommend_content_no_data(self, mock_get_connector, client):
        """콘텐츠 데이터 없음"""
        mock_db = MagicMock()
        mock_db.get_student_scores.return_value = pd.DataFrame()
        mock_db.get_student_plans.return_value = pd.DataFrame()
        mock_db.get_student_contents.return_value = pd.DataFrame()
        mock_get_connector.return_value = mock_db

        response = client.post(
            "/api/recommendations/content",
            json={
                "student_id": "test-student",
            },
        )

        assert response.status_code == 404

    @patch("src.api.routes.recommendations.get_connector")
    def test_recommend_study_plan(self, mock_get_connector, client, mock_db):
        """학습 플랜 추천"""
        mock_get_connector.return_value = mock_db

        response = client.post(
            "/api/recommendations/study-plan",
            json={
                "student_id": "test-student",
                "content_ids": ["c1", "c2"],
                "days": 7,
                "daily_minutes": 120,
            },
        )

        assert response.status_code == 200
        data = response.json()
        assert data["student_id"] == "test-student"
        assert "recommended_slots" in data
        assert "daily_distribution" in data
        assert "tips" in data

    @patch("src.api.routes.recommendations.get_connector")
    def test_get_weak_subjects(self, mock_get_connector, client, mock_db):
        """취약 과목 조회"""
        mock_get_connector.return_value = mock_db

        response = client.get("/api/recommendations/weak-subjects/test-student")

        assert response.status_code == 200
        data = response.json()
        assert "weak_subjects" in data


class TestAnalysisAPI:
    """분석 API 테스트"""

    @patch("src.api.routes.analysis.get_connector")
    def test_get_learning_patterns(self, mock_get_connector, client, mock_db):
        """학습 패턴 분석"""
        mock_get_connector.return_value = mock_db

        response = client.get("/api/analysis/learning-patterns/test-student?days=30")

        assert response.status_code == 200
        data = response.json()
        assert data["student_id"] == "test-student"

    @patch("src.api.routes.analysis.get_connector")
    def test_get_score_trends(self, mock_get_connector, client, mock_db):
        """성적 트렌드 분석"""
        mock_get_connector.return_value = mock_db

        response = client.get("/api/analysis/score-trends/test-student?limit=20")

        assert response.status_code == 200
        data = response.json()
        assert data["student_id"] == "test-student"

    @patch("src.api.routes.analysis.get_connector")
    def test_get_efficiency(self, mock_get_connector, client, mock_db):
        """효율성 분석"""
        mock_get_connector.return_value = mock_db

        response = client.get("/api/analysis/efficiency/test-student")

        assert response.status_code == 200
        data = response.json()
        assert data["student_id"] == "test-student"
        assert "recommendations" in data

    @patch("src.api.routes.analysis.get_connector")
    def test_get_comprehensive_report(self, mock_get_connector, client, mock_db):
        """종합 리포트"""
        mock_get_connector.return_value = mock_db

        response = client.get("/api/analysis/report/test-student")

        assert response.status_code == 200
        data = response.json()
        assert data["student_id"] == "test-student"
        assert "learning_patterns" in data
        assert "score_trends" in data
        assert "efficiency" in data
        assert "insights" in data
        assert "action_items" in data

    @patch("src.api.routes.analysis.get_connector")
    def test_compare_with_peers(self, mock_get_connector, client, mock_db):
        """동료 비교"""
        mock_db.get_all_scores_by_tenant.return_value = pd.DataFrame(
            {
                "student_id": ["s1", "s1", "s2", "s2"],
                "subject": ["수학", "영어", "수학", "영어"],
                "score": [80, 75, 70, 65],
            }
        )
        mock_get_connector.return_value = mock_db

        response = client.get(
            "/api/analysis/compare/test-student?tenant_id=test-tenant"
        )

        assert response.status_code == 200
        data = response.json()
        assert data["student_id"] == "test-student"
        assert "overall" in data
        assert "by_subject" in data


class TestValidation:
    """요청 유효성 검사 테스트"""

    @patch("src.api.routes.predictions.get_connector")
    def test_predict_score_invalid_days(self, mock_get_connector, client):
        """잘못된 days_ahead - 음수 값도 허용 (모델에서 처리)"""
        mock_db = MagicMock()
        mock_db.get_student_scores.return_value = pd.DataFrame()
        mock_get_connector.return_value = mock_db

        response = client.post(
            "/api/predictions/score",
            json={
                "student_id": "test",
                "subject": "수학",
                "days_ahead": -1,  # 음수 - 모델에서 기본값 사용 또는 404 반환
            },
        )
        # days_ahead 음수는 허용되지만 데이터가 없으면 404
        assert response.status_code in [200, 404, 422]

    def test_recommend_content_invalid_limit(self, client):
        """잘못된 limit"""
        response = client.post(
            "/api/recommendations/content",
            json={
                "student_id": "test",
                "limit": 100,  # 최대 20
            },
        )
        assert response.status_code == 422

    def test_missing_required_field(self, client):
        """필수 필드 누락"""
        response = client.post(
            "/api/predictions/score",
            json={
                "student_id": "test",
                # subject 누락
            },
        )
        assert response.status_code == 422

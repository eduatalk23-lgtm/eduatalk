-- =============================================
-- 매출 리포트 함수: cancelled/refunded 상태 제외
-- 수납 관리 페이지와 데이터 일관성 확보
-- =============================================

-- 1. get_revenue_summary: status 필터 추가
CREATE OR REPLACE FUNCTION get_revenue_summary(
  p_tenant_id UUID,
  p_start DATE,
  p_end DATE,
  p_program_id UUID DEFAULT NULL,
  p_consultant_id UUID DEFAULT NULL
)
RETURNS TABLE(
  total_billed NUMERIC,
  total_paid NUMERIC,
  total_unpaid NUMERIC,
  collection_rate NUMERIC,
  payment_count BIGINT,
  student_count BIGINT
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(SUM(pr.amount), 0),
    COALESCE(SUM(pr.paid_amount), 0),
    COALESCE(SUM(pr.amount - pr.paid_amount), 0),
    CASE
      WHEN SUM(pr.amount) > 0
      THEN ROUND(SUM(pr.paid_amount) / SUM(pr.amount) * 100, 1)
      ELSE 0
    END,
    COUNT(*)::BIGINT,
    COUNT(DISTINCT pr.student_id)::BIGINT
  FROM payment_records pr
  JOIN enrollments e ON e.id = pr.enrollment_id
  WHERE pr.tenant_id = p_tenant_id
    AND pr.created_at::DATE BETWEEN p_start AND p_end
    AND pr.status NOT IN ('cancelled', 'refunded')
    AND (p_program_id IS NULL OR e.program_id = p_program_id)
    AND (p_consultant_id IS NULL OR e.consultant_id = p_consultant_id);
END;
$$;

-- 2. get_monthly_revenue: status 필터 추가
CREATE OR REPLACE FUNCTION get_monthly_revenue(
  p_tenant_id UUID,
  p_start DATE,
  p_end DATE,
  p_program_id UUID DEFAULT NULL
)
RETURNS TABLE(
  month TEXT,
  billed NUMERIC,
  paid NUMERIC,
  unpaid NUMERIC,
  rate NUMERIC
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT
    TO_CHAR(DATE_TRUNC('month', pr.created_at), 'YYYY-MM'),
    COALESCE(SUM(pr.amount), 0),
    COALESCE(SUM(pr.paid_amount), 0),
    COALESCE(SUM(pr.amount - pr.paid_amount), 0),
    CASE
      WHEN SUM(pr.amount) > 0
      THEN ROUND(SUM(pr.paid_amount) / SUM(pr.amount) * 100, 1)
      ELSE 0
    END
  FROM payment_records pr
  JOIN enrollments e ON e.id = pr.enrollment_id
  WHERE pr.tenant_id = p_tenant_id
    AND pr.created_at::DATE BETWEEN p_start AND p_end
    AND pr.status NOT IN ('cancelled', 'refunded')
    AND (p_program_id IS NULL OR e.program_id = p_program_id)
  GROUP BY DATE_TRUNC('month', pr.created_at)
  ORDER BY DATE_TRUNC('month', pr.created_at) DESC;
END;
$$;

-- 3. get_program_revenue: status 필터 추가 (v_total + 메인 쿼리 모두)
CREATE OR REPLACE FUNCTION get_program_revenue(
  p_tenant_id UUID,
  p_start DATE,
  p_end DATE
)
RETURNS TABLE(
  program_id UUID,
  program_name TEXT,
  total_billed NUMERIC,
  total_paid NUMERIC,
  enrollment_count BIGINT,
  pct NUMERIC
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_total NUMERIC;
BEGIN
  SELECT COALESCE(SUM(amount), 0) INTO v_total
  FROM payment_records
  WHERE tenant_id = p_tenant_id
    AND created_at::DATE BETWEEN p_start AND p_end
    AND status NOT IN ('cancelled', 'refunded');

  RETURN QUERY
  SELECT
    p.id,
    p.name,
    COALESCE(SUM(pr.amount), 0),
    COALESCE(SUM(pr.paid_amount), 0),
    COUNT(DISTINCT e.id)::BIGINT,
    CASE
      WHEN v_total > 0
      THEN ROUND(COALESCE(SUM(pr.amount), 0) / v_total * 100, 1)
      ELSE 0
    END
  FROM programs p
  LEFT JOIN enrollments e ON e.program_id = p.id AND e.tenant_id = p_tenant_id
  LEFT JOIN payment_records pr ON pr.enrollment_id = e.id
    AND pr.created_at::DATE BETWEEN p_start AND p_end
    AND pr.status NOT IN ('cancelled', 'refunded')
  WHERE p.tenant_id = p_tenant_id
  GROUP BY p.id, p.name
  HAVING COALESCE(SUM(pr.amount), 0) > 0
  ORDER BY 3 DESC;
END;
$$;

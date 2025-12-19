-- Migration: Create link_student_with_connection_code function
-- Description: 연결 코드로 학생 계정을 연결하는 PostgreSQL 함수 (트랜잭션 보장)
-- Date: 2025-12-19
-- Refs: .cursor/plans/-6f9e6333.plan.md [TODO #1]

-- ============================================
-- Function: link_student_with_connection_code
-- Purpose: 연결 코드를 사용하여 기존 학생 레코드를 새 사용자 ID로 연결
-- Security: SECURITY DEFINER로 RLS 정책 우회 (Admin 클라이언트 대신)
-- Transaction: 자동으로 트랜잭션으로 래핑됨 (PostgREST RPC 호출)
-- ============================================

CREATE OR REPLACE FUNCTION link_student_with_connection_code(
  p_user_id uuid,
  p_connection_code text
) RETURNS jsonb AS $$
DECLARE
  v_student_id uuid;
  v_existing_student record;
  v_profile record;
  v_career record;
  v_code_record record;
BEGIN
  -- 1. 연결 코드 검증 및 조회
  SELECT 
    student_id,
    expires_at,
    used_at
  INTO v_code_record
  FROM student_connection_codes
  WHERE connection_code = p_connection_code;

  -- 코드가 존재하지 않는 경우
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', '유효하지 않은 연결 코드입니다.'
    );
  END IF;

  -- 코드가 만료된 경우
  IF v_code_record.expires_at < now() THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', '만료된 연결 코드입니다.'
    );
  END IF;

  -- 코드가 이미 사용된 경우
  IF v_code_record.used_at IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', '이미 사용된 연결 코드입니다.'
    );
  END IF;

  v_student_id := v_code_record.student_id;

  -- 2. 기존 학생 데이터 조회
  SELECT * INTO v_existing_student
  FROM students
  WHERE id = v_student_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', '연결할 학생 정보를 찾을 수 없습니다.'
    );
  END IF;

  -- 3. 프로필 정보 조회 (있는 경우)
  SELECT * INTO v_profile
  FROM student_profiles
  WHERE id = v_student_id;

  -- 4. 진로 정보 조회 (있는 경우)
  SELECT * INTO v_career
  FROM student_career_goals
  WHERE student_id = v_student_id;

  -- 5. 새 ID로 students 레코드 생성
  INSERT INTO students (
    id,
    tenant_id,
    name,
    grade,
    class,
    birth_date,
    school_id,
    school_type,
    division,
    student_number,
    enrolled_at,
    status,
    is_active
  ) VALUES (
    p_user_id,
    v_existing_student.tenant_id,
    v_existing_student.name,
    v_existing_student.grade,
    v_existing_student.class,
    v_existing_student.birth_date,
    v_existing_student.school_id,
    v_existing_student.school_type,
    v_existing_student.division,
    v_existing_student.student_number,
    v_existing_student.enrolled_at,
    v_existing_student.status,
    COALESCE(v_existing_student.is_active, true)
  );

  -- 6. 프로필 정보 재생성 (있는 경우)
  IF v_profile IS NOT NULL THEN
    INSERT INTO student_profiles (
      id,
      tenant_id,
      gender,
      phone,
      mother_phone,
      father_phone,
      address,
      address_detail,
      postal_code,
      emergency_contact,
      emergency_contact_phone,
      medical_info,
      bio,
      interests
    ) VALUES (
      p_user_id,
      v_profile.tenant_id,
      v_profile.gender,
      v_profile.phone,
      v_profile.mother_phone,
      v_profile.father_phone,
      v_profile.address,
      v_profile.address_detail,
      v_profile.postal_code,
      v_profile.emergency_contact,
      v_profile.emergency_contact_phone,
      v_profile.medical_info,
      v_profile.bio,
      v_profile.interests
    );
  END IF;

  -- 7. 진로 정보 재생성 (있는 경우)
  IF v_career IS NOT NULL THEN
    INSERT INTO student_career_goals (
      student_id,
      tenant_id,
      exam_year,
      curriculum_revision,
      desired_university_ids,
      desired_career_field,
      target_major,
      target_major_2,
      target_score,
      target_university_type,
      notes
    ) VALUES (
      p_user_id,
      v_career.tenant_id,
      v_career.exam_year,
      v_career.curriculum_revision,
      v_career.desired_university_ids,
      v_career.desired_career_field,
      v_career.target_major,
      v_career.target_major_2,
      v_career.target_score,
      v_career.target_university_type,
      v_career.notes
    );
  END IF;

  -- 8. 연결 코드 used_at 업데이트
  UPDATE student_connection_codes
  SET used_at = now()
  WHERE connection_code = p_connection_code
    AND used_at IS NULL;

  -- 9. 기존 레코드 삭제 (CASCADE로 관련 데이터 자동 삭제)
  DELETE FROM students
  WHERE id = v_student_id;

  -- 성공 반환
  RETURN jsonb_build_object(
    'success', true,
    'student_id', p_user_id::text,
    'old_student_id', v_student_id::text
  );

EXCEPTION
  WHEN unique_violation THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', '이미 존재하는 학생 ID입니다.'
    );
  WHEN foreign_key_violation THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', '관련된 데이터를 찾을 수 없습니다.'
    );
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', '학생 계정 연결 중 오류가 발생했습니다: ' || SQLERRM
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION link_student_with_connection_code IS 
'연결 코드를 사용하여 기존 학생 레코드를 새 사용자 ID로 연결하는 함수. 
트랜잭션으로 보장되어 중간에 실패 시 모든 변경사항이 롤백됩니다.
SECURITY DEFINER로 실행되어 RLS 정책을 우회합니다.';

-- ============================================
-- Grant permissions
-- ============================================

-- 인증된 사용자만 호출 가능하도록 설정
GRANT EXECUTE ON FUNCTION link_student_with_connection_code(uuid, text) TO authenticated;


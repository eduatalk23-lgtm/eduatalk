/**
 * 뿌리오 SMS 발송 API Route
 * Client Component에서 호출하는 서버 전용 엔드포인트
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/auth/requireAdminAuth";
import { getTenantContext } from "@/lib/tenant/getTenantContext";
import { sendSMS, sendBulkSMS } from "@/lib/services/smsService";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  formatSMSTemplate,
  type SMSTemplateType,
} from "@/lib/services/smsTemplates";
import { AppError, ErrorCode } from "@/lib/errors";
import { getStudentPhonesBatch } from "@/lib/utils/studentPhoneUtils";

/**
 * 단일 SMS 발송
 * POST /api/purio/send
 * Body: { type: "single", phone: string, message: string, recipientId?: string }
 */
export async function POST(request: NextRequest) {
  try {
    // 인증 확인
    await requireAdminAuth();
    const tenantContext = await getTenantContext();

    if (!tenantContext?.tenantId) {
      return NextResponse.json(
        {
          success: false,
          error: "기관 정보를 찾을 수 없습니다.",
        },
        { status: 404 }
      );
    }

    // 요청 본문 파싱
    const body = await request.json();
    const { type, phone, message, studentIds, templateVariables, recipientType } = body;

    // 입력값 검증
    if (!type || (type !== "single" && type !== "bulk")) {
      return NextResponse.json(
        {
          success: false,
          error: "발송 타입이 올바르지 않습니다. (single 또는 bulk)",
        },
        { status: 400 }
      );
    }

    if (type === "single") {
      // 단일 발송
      if (!phone || !message) {
        return NextResponse.json(
          {
            success: false,
            error: "전화번호와 메시지 내용을 입력해주세요.",
          },
          { status: 400 }
        );
      }

      const result = await sendSMS({
        recipientPhone: phone,
        message,
        recipientId: body.recipientId,
        tenantId: tenantContext.tenantId,
      });

      if (!result.success) {
        return NextResponse.json(
          {
            success: false,
            error: result.error || "SMS 발송에 실패했습니다.",
          },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        msgId: result.messageKey,
      });
    } else {
      // 일괄 발송
      if (!studentIds || !Array.isArray(studentIds) || studentIds.length === 0) {
        return NextResponse.json(
          {
            success: false,
            error: "발송 대상 학생을 선택해주세요.",
          },
          { status: 400 }
        );
      }

      if (!message) {
        return NextResponse.json(
          {
            success: false,
            error: "메시지 내용을 입력해주세요.",
          },
          { status: 400 }
        );
      }

      // 학생 정보 일괄 조회
      const supabase = await createSupabaseServerClient();
      const { data: students, error: studentsError } = await supabase
        .from("students")
        .select("id, name")
        .in("id", studentIds);

      if (studentsError) {
        console.error("[SMS API] 학생 정보 조회 실패:", studentsError);
        return NextResponse.json(
          {
            success: false,
            error: "학생 정보를 조회하는 중 오류가 발생했습니다.",
          },
          { status: 500 }
        );
      }

      if (!students || students.length === 0) {
        return NextResponse.json(
          {
            success: false,
            error: "학생 정보를 찾을 수 없습니다.",
          },
          { status: 404 }
        );
      }

      // getStudentPhonesBatch 함수를 사용하여 연락처 정보 일괄 조회 (통합 로직)
      const phoneDataList = await getStudentPhonesBatch(studentIds);
      const phoneDataMap = new Map(phoneDataList.map((p) => [p.id, p]));

      // 프로필 정보를 학생 정보와 병합
      const studentsWithPhones = students.map((student: any) => {
        const phoneData = phoneDataMap.get(student.id);
        return {
          ...student,
          phone: phoneData?.phone ?? null,
          mother_phone: phoneData?.mother_phone ?? null,
          father_phone: phoneData?.father_phone ?? null,
        };
      });

      // 학원명 조회
      const { data: tenant } = await supabase
        .from("tenants")
        .select("name")
        .eq("id", tenantContext.tenantId)
        .single();

      const academyName = tenant?.name || "학원";

      // 전송 대상자에 따라 전화번호 선택
      const getPhoneByRecipientType = (
        student: any,
        type: "student" | "mother" | "father"
      ): string | null => {
        switch (type) {
          case "student":
            return student.phone;
          case "mother":
            return student.mother_phone;
          case "father":
            return student.father_phone;
          default:
            return student.mother_phone ?? student.father_phone ?? student.phone;
        }
      };

      // SMS 발송 대상 준비
      const recipients = studentsWithPhones
        .map((student) => {
          const phone = getPhoneByRecipientType(
            student,
            recipientType || "mother"
          );
          return { ...student, selectedPhone: phone };
        })
        .filter((student) => student.selectedPhone)
        .map((student) => {
          // 각 학생별로 메시지 변수 치환
          let finalMessage = message;

          // 학생명 자동 치환 (항상)
          finalMessage = finalMessage.replace(
            /\{학생명\}/g,
            student.name || "학생"
          );

          // 학원명 자동 치환 (항상)
          finalMessage = finalMessage.replace(/\{학원명\}/g, academyName);

          // 템플릿 변수가 있으면 추가 변수 치환
          if (templateVariables) {
            for (const [key, value] of Object.entries(templateVariables)) {
              if (key !== "학생명" && key !== "학원명" && value) {
                finalMessage = finalMessage.replace(
                  new RegExp(`\\{${key}\\}`, "g"),
                  value as string
                );
              }
            }
          }

          return {
            phone: student.selectedPhone!,
            message: finalMessage,
            recipientId: student.id,
          };
        });

      if (recipients.length === 0) {
        return NextResponse.json(
          {
            success: false,
            error: "발송 가능한 연락처가 없습니다.",
          },
          { status: 400 }
        );
      }

      // 대량 발송
      const result = await sendBulkSMS(recipients, tenantContext.tenantId);

      // 결과 매핑 (studentId 포함)
      const errors = result.errors.map((err, index) => {
        const recipient = recipients[index];
        return {
          studentId: recipient.recipientId || "",
          error: err.error,
        };
      });

      return NextResponse.json({
        success: result.success,
        failed: result.failed,
        errors,
      });
    }
  } catch (error: any) {
    console.error("[SMS API] 오류:", error);

    // AppError인 경우
    if (error instanceof AppError) {
      return NextResponse.json(
        {
          success: false,
          error: error.message,
        },
        { status: error.statusCode || 500 }
      );
    }

    // 일반 에러
    return NextResponse.json(
      {
        success: false,
        error: error.message || "알 수 없는 오류가 발생했습니다.",
      },
      { status: 500 }
    );
  }
}


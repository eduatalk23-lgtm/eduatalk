"use client";

type SMSSendSummaryProps = {
  recipientCount: number;
  messageLength: number;
};

export function SMSSendSummary({
  recipientCount,
  messageLength,
}: SMSSendSummaryProps) {
  // SMS/LMS 구분 (90자 이하: SMS, 90자 초과: LMS)
  const messageType = messageLength <= 90 ? "SMS" : "LMS";
  
  // 예상 비용 계산 (SMS: 10원, LMS: 30원 - 대략적인 가격)
  const estimatedCost = messageType === "SMS" 
    ? recipientCount * 10 
    : recipientCount * 30;

  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
      <h3 className="mb-3 text-sm font-semibold text-gray-900">발송 요약</h3>
      <div className="grid grid-cols-3 gap-4">
        <div>
          <div className="text-xs text-gray-600">발송 대상자</div>
          <div className="text-lg font-semibold text-gray-900">
            {recipientCount}명
          </div>
        </div>
        <div>
          <div className="text-xs text-gray-600">메시지 유형</div>
          <div className="text-lg font-semibold text-gray-900">
            {messageType}
          </div>
        </div>
        <div>
          <div className="text-xs text-gray-600">예상 비용</div>
          <div className="text-lg font-semibold text-gray-900">
            약 {estimatedCost.toLocaleString()}원
          </div>
        </div>
      </div>
      <p className="mt-2 text-xs text-gray-500">
        * 예상 비용은 대략적인 금액이며, 실제 발송 비용은 다를 수 있습니다.
      </p>
    </div>
  );
}


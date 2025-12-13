"use client";

import { DeviceManagement } from "../_components/DeviceManagement";
import PageContainer from "@/components/layout/PageContainer";
import PageHeader from "@/components/layout/PageHeader";

export default function DevicesPage() {
  return (
    <PageContainer widthType="FORM">
      <div className="flex flex-col gap-6">
        <PageHeader title="로그인 기기 관리" />
        <DeviceManagement />
      </div>
    </PageContainer>
  );
}


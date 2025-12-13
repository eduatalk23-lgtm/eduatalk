"use client";

import { DeviceManagement } from "../_components/DeviceManagement";
import { getContainerClass } from "@/lib/constants/layout";

export default function DevicesPage() {
  return (
    <div className="p-6 md:p-8">
      <div className={getContainerClass("FORM", "md")}>
        <div className="flex flex-col gap-6">
          <h1 className="text-h1">로그인 기기 관리</h1>
          <DeviceManagement />
        </div>
      </div>
    </div>
  );
}


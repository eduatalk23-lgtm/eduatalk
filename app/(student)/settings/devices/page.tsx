"use client";

import { DeviceManagement } from "../_components/DeviceManagement";

export default function DevicesPage() {
  return (
    <div className="p-6 md:p-8">
      <div className="mx-auto max-w-4xl">
        <h1 className="mb-6 text-3xl font-semibold">로그인 기기 관리</h1>
        <DeviceManagement />
      </div>
    </div>
  );
}


"use client";

import { useState } from "react";
import { TenantForm } from "./TenantForm";
import { TenantCard } from "./TenantCard";

type Tenant = {
  id: string;
  name: string;
  type: string;
  created_at: string;
  updated_at: string;
};

type TenantListProps = {
  tenants: Tenant[];
};

export function TenantList({ tenants: initialTenants }: TenantListProps) {
  const [tenants, setTenants] = useState(initialTenants);
  const [isFormOpen, setIsFormOpen] = useState(false);

  const handleTenantCreated = (newTenant: Tenant) => {
    setTenants([newTenant, ...tenants]);
    setIsFormOpen(false);
  };

  const handleTenantUpdated = (updatedTenant: Tenant) => {
    setTenants(
      tenants.map((t) => (t.id === updatedTenant.id ? updatedTenant : t))
    );
  };

  const handleTenantDeleted = (tenantId: string) => {
    setTenants(tenants.filter((t) => t.id !== tenantId));
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <button
          onClick={() => setIsFormOpen(true)}
          className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
        >
          + 새 기관 추가
        </button>
      </div>

      {isFormOpen && (
        <TenantForm
          onClose={() => setIsFormOpen(false)}
          onSuccess={handleTenantCreated}
        />
      )}

      {tenants.length === 0 ? (
        <div className="rounded border border-gray-200 bg-gray-50 p-8 text-center text-gray-500">
          등록된 기관이 없습니다.
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {tenants.map((tenant) => (
            <TenantCard
              key={tenant.id}
              tenant={tenant}
              onUpdate={handleTenantUpdated}
              onDelete={handleTenantDeleted}
            />
          ))}
        </div>
      )}
    </div>
  );
}


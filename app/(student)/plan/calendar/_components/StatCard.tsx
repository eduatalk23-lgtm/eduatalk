"use client";

type StatCardProps = {
  label: string;
  value: string | number;
  color?: "gray" | "green" | "blue" | "indigo" | "red" | "amber" | "purple";
  icon?: React.ReactNode;
};

export function StatCard({ label, value, color = "gray", icon }: StatCardProps) {
  const colorClasses = {
    gray: "bg-gray-100 text-gray-900",
    green: "bg-green-100 text-green-900",
    blue: "bg-blue-100 text-blue-900",
    indigo: "bg-indigo-100 text-indigo-900",
    red: "bg-red-100 text-red-900",
    amber: "bg-amber-100 text-amber-900",
    purple: "bg-purple-100 text-purple-900",
  };

  return (
    <div className={`rounded-lg p-4 ${colorClasses[color]}`}>
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          {icon && <span className="text-base">{icon}</span>}
          <div className="text-xs font-medium opacity-75">{label}</div>
        </div>
        <div className="text-2xl font-bold">{value}</div>
      </div>
    </div>
  );
}


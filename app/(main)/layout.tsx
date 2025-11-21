import { ReactNode } from "react";
import { Nav } from "./_components/Nav";

export default function MainLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <Nav />
      <main className="min-h-screen bg-gray-50">{children}</main>
    </>
  );
}


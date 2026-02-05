"use client";

import { usePathname } from "next/navigation";
import { CompanyProvider } from "@/lib/context/CompanyContext";
import { Header } from "./header";

/**
 * Wraps staff app with CompanyProvider and Header. On /portal/* routes, renders only children
 * so the portal has its own layout without the staff header.
 */
export function ConditionalStaffLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isPortal = pathname?.startsWith("/portal");

  if (isPortal) {
    return <>{children}</>;
  }

  return (
    <CompanyProvider>
      <Header />
      {children}
    </CompanyProvider>
  );
}

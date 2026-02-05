"use client";

import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import { LogOut } from "lucide-react";

export function PortalLogout() {
  const router = useRouter();

  const handleLogout = async () => {
    const supabase = createBrowserSupabaseClient();
    await supabase.auth.signOut();
    router.push("/portal/login");
    router.refresh();
  };

  return (
    <button
      type="button"
      onClick={handleLogout}
      className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
    >
      <LogOut className="h-4 w-4" />
      Log out
    </button>
  );
}

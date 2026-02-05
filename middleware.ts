import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

const STAFF_PATHS = ["/", "/documents", "/company", "/companies", "/proposals", "/results"];
const STAFF_PREFIXES = ["/documents", "/company", "/companies", "/proposals", "/results", "/api/"];
const PORTAL_PREFIX = "/portal";
const PORTAL_LOGIN = "/portal/login";
const LOGIN = "/login";
const AUTH_CALLBACK = "/auth/callback";
const INNGEST_PATH = "/api/inngest";

/** Routes that must not require user auth (e.g. webhooks with their own auth). */
function isExcludedApiPath(pathname: string): boolean {
  return pathname === INNGEST_PATH || pathname.startsWith(`${INNGEST_PATH}/`);
}

function isStaffPath(pathname: string): boolean {
  if (pathname === "/" || pathname === "/login") return true;
  return STAFF_PREFIXES.some((p) => pathname.startsWith(p));
}

function isPortalPath(pathname: string): boolean {
  return pathname.startsWith(PORTAL_PREFIX);
}

function isPortalLogin(pathname: string): boolean {
  return pathname === PORTAL_LOGIN;
}

function isAuthCallback(pathname: string): boolean {
  return pathname.startsWith(AUTH_CALLBACK);
}

function isPublicPath(pathname: string): boolean {
  return pathname === LOGIN || isPortalLogin(pathname) || isAuthCallback(pathname);
}

function isPageRequest(pathname: string): boolean {
  return !pathname.startsWith("/api/");
}

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll().map((c) => ({ name: c.name, value: c.value }));
        },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, (options as Record<string, unknown>) ?? {});
          });
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  // Allow public auth routes
  if (isPublicPath(pathname)) {
    return response;
  }

  // Allow API routes that use their own auth (e.g. Inngest signing key)
  if (isExcludedApiPath(pathname)) {
    return response;
  }

  // Resolve client vs staff for page redirects only (APIs return 403 instead)
  let isClient: boolean | null = null;
  if (user && isPageRequest(pathname)) {
    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    const { data } = await admin
      .from("company_profiles")
      .select("id")
      .eq("client_user_id", user.id)
      .maybeSingle();
    isClient = !!data?.id;
  }

  // Require auth for portal (except login)
  if (isPortalPath(pathname)) {
    if (!user) {
      const url = request.nextUrl.clone();
      url.pathname = PORTAL_LOGIN;
      return NextResponse.redirect(url);
    }
    // Staff users hitting portal pages -> redirect to staff app
    if (isClient === false) {
      const url = request.nextUrl.clone();
      url.pathname = "/";
      return NextResponse.redirect(url);
    }
    return response;
  }

  // Require auth for staff paths (including API)
  if (isStaffPath(pathname)) {
    if (!user) {
      const url = request.nextUrl.clone();
      url.pathname = LOGIN;
      url.searchParams.set("next", pathname);
      return NextResponse.redirect(url);
    }
    // Client users hitting staff pages -> redirect to portal
    if (isPageRequest(pathname) && isClient === true) {
      const url = request.nextUrl.clone();
      url.pathname = "/portal";
      return NextResponse.redirect(url);
    }
    return response;
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};

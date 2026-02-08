import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

// Type definition for cookie objects used by Supabase SSR
interface CookieOptions {
    path?: string;
    domain?: string;
    maxAge?: number;
    expires?: Date;
    httpOnly?: boolean;
    secure?: boolean;
    sameSite?: "lax" | "strict" | "none";
}

interface CookieToSet {
    name: string;
    value: string;
    options?: CookieOptions;
}

export async function proxy(request: NextRequest) {
    let supabaseResponse = NextResponse.next({
        request,
    });

    // Create Supabase client for proxy
    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll();
                },
                setAll(cookiesToSet: CookieToSet[]) {
                    cookiesToSet.forEach(({ name, value }: CookieToSet) =>
                        request.cookies.set(name, value)
                    );
                    supabaseResponse = NextResponse.next({
                        request,
                    });
                    cookiesToSet.forEach(({ name, value, options }: CookieToSet) =>
                        supabaseResponse.cookies.set(name, value, options)
                    );
                },
            },
        }
    );

    const { data, error } = await supabase.auth.getUser();

    // Skip setup page - it has its own protection
    if (request.nextUrl.pathname === "/setup") {
        return supabaseResponse;
    }

    // Handle auth errors: distinguish "no session" from real failures
    if (error) {
        // AuthSessionMissingError (status 400, __isAuthError) is the normal
        // "not logged in" state — treat it the same as a missing user.
        const isSessionMissing =
            (error as any).__isAuthError === true ||
            error.message?.includes("Auth session missing");

        if (!isSessionMissing) {
            // Unexpected auth-service error → surface as 500
            console.error("Authentication service error in proxy:", error);
            return NextResponse.json(
                { error: "Authentication service error" },
                { status: 500 }
            );
        }

        // No session → redirect to login
        const redirectPath = encodeURIComponent(request.nextUrl.pathname);
        return NextResponse.redirect(
            new URL(`/login?redirect=${redirectPath}`, request.url)
        );
    }

    // For all other routes, ensure user is authenticated
    if (!data.user) {
        const redirectPath = encodeURIComponent(request.nextUrl.pathname);
        return NextResponse.redirect(
            new URL(`/login?redirect=${redirectPath}`, request.url)
        );
    }

    // Verify admin role server-side
    const userRole = data.user.user_metadata?.role;
    const isAdmin = userRole === "admin" || userRole === "super_admin";

    if (!isAdmin) {
        console.warn(`Non-admin user ${data.user.id} attempted to access admin route: ${request.nextUrl.pathname}`);
        const redirectPath = encodeURIComponent(request.nextUrl.pathname);
        return NextResponse.redirect(
            new URL(`/login?redirect=${redirectPath}&error=unauthorized`, request.url)
        );
    }

    return supabaseResponse;
}

export const config = {
    matcher: [
        /*
         * Match all request paths except for the ones starting with:
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         * - login (login page)
         * - api (API routes)
         */
        "/((?!_next/static|_next/image|favicon.ico|login|api|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
    ],
};

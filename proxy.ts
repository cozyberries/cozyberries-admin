import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

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
                setAll(cookiesToSet: any[]) {
                    cookiesToSet.forEach(({ name, value }: any) =>
                        request.cookies.set(name, value)
                    );
                    supabaseResponse = NextResponse.next({
                        request,
                    });
                    cookiesToSet.forEach(({ name, value, options }: any) =>
                        supabaseResponse.cookies.set(name, value, options)
                    );
                },
            },
        }
    );

    const {
        data: { user },
    } = await supabase.auth.getUser();

    // Skip setup page - it has its own protection
    if (request.nextUrl.pathname === "/setup") {
        return supabaseResponse;
    }

    // For all other routes, ensure user is authenticated
    // The actual admin role checking will be done on the client side and in API routes
    if (!user) {
        return NextResponse.redirect(
            new URL("/login?redirect=" + request.nextUrl.pathname, request.url)
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

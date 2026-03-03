import { NextResponse, type NextRequest } from "next/server";
import { verify } from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production';
const COOKIE_NAME = 'admin_session';

export async function proxy(request: NextRequest) {
    // Skip setup page - it has its own protection
    if (request.nextUrl.pathname === "/setup") {
        return NextResponse.next({ request });
    }

    const token = request.cookies.get(COOKIE_NAME)?.value;

    if (!token) {
        const redirectPath = encodeURIComponent(request.nextUrl.pathname);
        return NextResponse.redirect(
            new URL(`/login?redirect=${redirectPath}`, request.url)
        );
    }

    try {
        const decoded = verify(token, JWT_SECRET) as {
            id: string;
            username: string;
            role: string;
        };

        const isAdmin = decoded.role === "admin" || decoded.role === "super_admin";

        if (!isAdmin) {
            console.warn(`Non-admin user ${decoded.id} attempted to access admin route: ${request.nextUrl.pathname}`);
            const redirectPath = encodeURIComponent(request.nextUrl.pathname);
            return NextResponse.redirect(
                new URL(`/login?redirect=${redirectPath}&error=unauthorized`, request.url)
            );
        }

        return NextResponse.next({ request });
    } catch (error) {
        // Invalid/expired token - redirect to login and clear the bad cookie
        const redirectPath = encodeURIComponent(request.nextUrl.pathname);
        const response = NextResponse.redirect(
            new URL(`/login?redirect=${redirectPath}`, request.url)
        );
        response.cookies.set(COOKIE_NAME, '', { maxAge: 0, path: '/' });
        return response;
    }
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

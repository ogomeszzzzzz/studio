
import { NextResponse, type NextRequest } from 'next/server';
import { cookies } from 'next/headers';

const PROTECTED_ROUTES_PREFIX = '/app/'; // For example, if your dashboard is at /app/dashboard
const PUBLIC_ROUTES = ['/login', '/register', '/api/auth/approve']; // Routes accessible without login

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const cookieStore = cookies();
  // Firebase JS SDK stores auth state in IndexedDB client-side.
  // For server-side protection with middleware, you'd typically use session cookies set by Firebase Admin SDK
  // or verify an ID token passed in headers/cookies.
  // The 'firebaseIdToken' is a common name for such a cookie if you implement server-side session management.
  // This example assumes you might set such a cookie upon successful login.
  // A more robust solution would involve verifying this token's validity.

  // For now, let's assume client-side auth handles redirects for the (app) layout.
  // This middleware will primarily focus on redirecting from root or non-auth pages if not logged in.
  // And ensuring auth pages are not accessed if logged in.

  // NOTE: True Firebase Auth state is best managed client-side with onAuthStateChanged for App Router,
  // or server-side with custom session cookies and Firebase Admin SDK.
  // This middleware is a simplified example. A common pattern is to check for a session cookie.
  // Since we're using client-side Firebase SDK for login state primarily, this middleware
  // won't have direct access to the Firebase Auth user object without custom session management.
  // The (app)/layout.tsx will handle the primary auth guarding for client-rendered routes.

  const sessionCookie = cookieStore.get('firebaseSession'); // Example: you might set this cookie

  const isProtectedRoute = pathname.startsWith('/dashboard') || pathname.startsWith('/collection-analyzer');
  const isAuthRoute = pathname.startsWith('/login') || pathname.startsWith('/register');

  // This is a simplified check. In a real app, you'd verify the sessionCookie.
  const isAuthenticated = !!sessionCookie; 

  if (isProtectedRoute && !isAuthenticated) {
    // If trying to access a protected route without auth, redirect to login
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirectedFrom', pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isAuthRoute && isAuthenticated) {
    // If trying to access login/register while authenticated, redirect to dashboard
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }
  
  // Allow request to proceed for API routes or if no specific redirection rule matched
  if (pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  // If accessing root and authenticated, go to dashboard, else login
  if (pathname === '/' ) {
    if(isAuthenticated) {
       return NextResponse.redirect(new URL('/dashboard', request.url));
    }
    // If not authenticated, the /app/page.tsx (which is now login) will handle it or be shown
    // Let's explicitly redirect to /login if at root and not authenticated
    return NextResponse.redirect(new URL('/login', request.url));
  }


  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - assets (any other static assets)
     */
    '/((?!_next/static|_next/image|favicon.ico|assets|api/auth/approve).*)',
  ],
};

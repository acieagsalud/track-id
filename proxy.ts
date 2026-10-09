import { NextResponse, type NextRequest } from "next/server";

/**
 * Local dev only: Spotify requires a 127.0.0.1 redirect URI, and auth cookies are per-host, so
 * browsing on "localhost" breaks sign-in. Redirect to the configured origin instead.
 */
export function proxy(request: NextRequest) {
  const pinned = process.env.AUTH_REDIRECT_PROXY_URL;
  const host = request.headers.get("host");
  if (!pinned || !host?.startsWith("localhost:")) return NextResponse.next();

  // Next.js rewrites a Location header on 127.0.0.1 back to a relative (localhost) URL, which
  // would loop, so hand the browser the absolute URL in the page body instead.
  const { origin } = new URL(pinned);
  const location = `${origin}${request.nextUrl.pathname}${request.nextUrl.search}`;
  const href = location.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
  return new Response(
    `<!doctype html><meta http-equiv="refresh" content="0;url=${href}"><a href="${href}">Continue to ${origin}</a>`,
    { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } },
  );
}

export const config = {
  matcher: "/((?!_next/|favicon.ico).*)",
};

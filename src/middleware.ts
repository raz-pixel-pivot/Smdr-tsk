import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

// Auth is enforced where data is accessed: the app layout redirects signed-out visitors
// and every server action / API route calls requireUser().
// Local preview without signing in (see server/auth.ts) is never active in production builds.
const devBypass = process.env.NODE_ENV === "development" && process.env.DEV_AUTH_BYPASS === "1";

export default devBypass ? () => NextResponse.next() : clerkMiddleware();

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};

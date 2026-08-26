import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    "/athena/:path*",
    "/brand-studio/:path*",
    "/costbook/:path*",
    "/customers/:path*",
    "/dashboard/:path*",
    "/dispatch/:path*",
    "/finish-setup/:path*",
    "/field/:path*",
    "/portal/:path*",
    "/projects/:path*",
    "/settings/:path*",
  ],
};

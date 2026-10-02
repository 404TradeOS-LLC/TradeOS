import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isTeamTimeEnabled } from "@/lib/team-time-config";
import { createTeamTimePostHandler } from "@/lib/team-time-route";

export async function POST(request: NextRequest) {
  return createTeamTimePostHandler({
    isEnabled: isTeamTimeEnabled,
    env: process.env,
    getAccessToken: async () => {
      const supabase = await createClient();
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData.user) return null;
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      const session = sessionData.session;
      if (sessionError || !session || session.user.id !== userData.user.id) return null;
      return session.access_token;
    },
  })(request);
}

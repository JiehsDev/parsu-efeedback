import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { homeRouteForRole } from "@/middleware/rbac";

export default async function DashboardSwitchboardPage() {
  // 1. Fetch the session directly on the server (Zero client-side waterfalls)
  const session = await auth();

  // 2. If they somehow got here without being logged in, kick them to login
  if (!session?.user?.role) {
    redirect("/login");
  }

  // 3. Perform an instant server-side redirect to their precise role dashboard
  redirect(homeRouteForRole(session.user.role));
}

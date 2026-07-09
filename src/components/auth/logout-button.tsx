// src/components/auth/logout-button.tsx
import { logoutAction } from "@/features/auth/actions/logout.action";
import { LogOut } from "lucide-react"; // Or any icon library you prefer

export function LogoutButton() {
  return (
    <form action={logoutAction} className="w-full">
      <button
        type="submit"
        className="flex w-full items-center gap-3 rounded-lg px-4 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors duration-200 dark:text-red-400 dark:hover:bg-red-950/30"
      >
        <LogOut className="h-4 w-4" />
        <span>Sign Out</span>
      </button>
    </form>
  );
}
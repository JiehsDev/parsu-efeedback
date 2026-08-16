import { redirect } from "next/navigation";

// `/` is never actually shown — src/proxy.ts redirects unauthenticated
// visitors to /login and authenticated ones to their role dashboard before
// this route ever renders. This is just the fallback for the two cases
// (a bare fetch, or a future proxy matcher change) where it isn't.
export default function Home() {
  redirect("/login");
}

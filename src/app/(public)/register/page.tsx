import { connectToDatabase } from "@/lib/db";
import { Office } from "@/models/Office";
import { RegisterForm } from "./register-form";

export default async function RegisterPage() {
  // BR-008/015: a student picks their college at registration. Fetched
  // server-side (this is a public, unauthenticated page — no session to
  // scope a client-side fetch through) so the form always has an
  // up-to-date, active-only list without needing a public colleges API
  // route just for this one dropdown.
  await connectToDatabase();
  const colleges = await Office.find({ type: "college", isActive: true })
    .select("_id name")
    .sort({ name: 1 })
    .lean();

  const collegeOptions = colleges.map((college) => ({
    id: college._id.toString(),
    name: college.name,
  }));

  return (
    <main className="flex min-h-full flex-1 items-center justify-center px-4 py-16">
      <div className="w-full max-w-md">
        <h1 className="text-2xl font-semibold text-[var(--foreground)]">
          Create your account
        </h1>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">
          For students. Staff, dean, QA, and admin accounts are created by an
          administrator.
        </p>

        <RegisterForm colleges={collegeOptions} />
      </div>
    </main>
  );
}

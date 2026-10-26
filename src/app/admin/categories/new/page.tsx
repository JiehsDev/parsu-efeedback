"use client";

import { clientFetch } from "@/lib/client-fetch";
import { useState } from "react";
import { useRouter } from "next/navigation";
export default function NewCategoryPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [domain, setDomain] = useState("other");
  const [priority, setPriority] = useState("medium");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [slaReady, setSlaReady] = useState(false);
  async function save(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const request = async (url: string, method: string, body: any) => {
        const response = await clientFetch(url, {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = await response.json();
        if (!response.ok)
          throw new Error(typeof data.error === "string" ? data.error : "Could not save category.");
        return data;
      };
      let id = categoryId;
      if (!id) {
        const data = await request("/api/admin/categories", "POST", {
          name,
          description,
          domain,
          defaultPriority: priority,
        });
        id = data.category._id as string;
        setCategoryId(id);
      }
      if (!slaReady) {
        await request("/api/admin/sla-rules", "POST", {
          categoryRef: id,
          priority,
          responseHours: 72,
          resolutionHours: 72,
          isActive: true,
        });
        setSlaReady(true);
      }
      await request(`/api/admin/categories/${id}`, "PATCH", { isActive: true });
      router.push("/admin/categories");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save category.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <form
      onSubmit={save}
      className="max-w-xl space-y-4 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6"
    >
      <h1 className="text-2xl font-semibold">Add category</h1>
      <p className="text-sm text-[var(--muted-foreground)]">
        Add a name and description to help students classify their concerns.
      </p>
      {error && (
        <p role="alert" className="text-[var(--destructive)]">
          {error}
        </p>
      )}
      <label className="block">
        Name
        <input
          required
          disabled={Boolean(categoryId)}
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mt-1 w-full rounded-xl border border-[var(--border)] bg-[var(--background)] p-2"
        />
      </label>
      <label className="block">
        Description
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="mt-1 w-full rounded-xl border border-[var(--border)] bg-[var(--background)] p-2"
        />
      </label>
      <label className="block">
        Service domain
        <select
          value={domain}
          onChange={(e) => setDomain(e.target.value)}
          className="mt-1 w-full rounded-xl bg-[var(--background)] p-2"
        >
          {[
            "academic",
            "administrative",
            "finance",
            "facilities",
            "student_services",
            "ict",
            "health",
            "other",
          ].map((d) => (
            <option key={d}>{d}</option>
          ))}
        </select>
      </label>
      <label className="block">
        Priority
        <select
          value={priority}
          onChange={(e) => setPriority(e.target.value)}
          className="mt-1 w-full rounded-xl bg-[var(--background)] p-2"
        >
          {["low", "medium", "high", "critical"].map((p) => (
            <option key={p}>{p}</option>
          ))}
        </select>
      </label>
      <button
        disabled={busy}
        className="rounded-full bg-[var(--primary)] px-4 py-2 text-[var(--primary-foreground)]"
      >
        {busy ? "Saving..." : "Save category"}
      </button>
    </form>
  );
}

export async function POST() {
  // TODO: built in Phase 10 (SLA monitoring) — secret-header protected
  return new Response(JSON.stringify({ error: "Not implemented" }), {
    status: 501,
    headers: { "Content-Type": "application/json" },
  });
}

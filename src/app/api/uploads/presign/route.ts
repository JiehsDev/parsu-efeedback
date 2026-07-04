export async function POST() {
  // TODO: built in Phase 12 (File uploads)
  return new Response(JSON.stringify({ error: "Not implemented" }), {
    status: 501,
    headers: { "Content-Type": "application/json" },
  });
}

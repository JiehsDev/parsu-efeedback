export async function GET() {
  // TODO: built in Phase 11 (Notifications)
  return new Response(JSON.stringify({ error: "Not implemented" }), {
    status: 501,
    headers: { "Content-Type": "application/json" },
  });
}

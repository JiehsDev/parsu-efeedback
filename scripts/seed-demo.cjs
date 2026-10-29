// Retired: the authoritative development seed creates accounts/configuration and zero tickets.
async function seedDemo() {
  throw new Error(
    "Complaint demo seeding is retired. The authenticated /api/dev/seed provisions accounts and categories without creating or deleting complaints. Existing records are unchanged by this command.",
  );
}
if (require.main === module)
  seedDemo().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
module.exports = { seedDemo };

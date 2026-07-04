export default function StudentLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // Role-specific nav/sidebar for the Student route group will be added
  // once Authentication (Phase 6) and RBAC are wired up.
  return <div className="min-h-screen">{children}</div>;
}

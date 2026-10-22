import { ComplaintDetail } from "@/components/shared/ComplaintDetail";
export default async function ComplaintPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ComplaintDetail id={id} base="admin" />;
}

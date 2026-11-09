import { ResolutionRequestReviewPage } from "@/components/shared/ResolutionRequestReviewPage";

export default async function StaffResolutionRequestReviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return <ResolutionRequestReviewPage params={params} base="staff" />;
}

import { ResolutionRequestReviewPage } from "@/components/shared/ResolutionRequestReviewPage";

export default function AdminResolutionRequestReviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return <ResolutionRequestReviewPage params={params} base="admin" />;
}

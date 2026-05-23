import { VideoReviewView } from "@/components/review/video-review-view";

export default async function VideoDetailPage({ params }: { params: Promise<{ videoId: string }> }) {
  const { videoId } = await params;
  return <VideoReviewView videoId={videoId} />;
}

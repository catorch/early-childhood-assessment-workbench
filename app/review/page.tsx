import { VideoReviewView } from "@/components/review/video-review-view";
import { getReviewQueue } from "@/lib/data";

export default function ReviewPage() {
  const firstVideo = getReviewQueue()[0];
  return <VideoReviewView videoId={firstVideo.id} />;
}

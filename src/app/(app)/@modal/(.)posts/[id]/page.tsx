import { PostModal } from "@/components/PostModal";
import { PostDetail } from "../../../posts/PostDetail";

// Clicking a tile on Explore lands here instead of the full page, so the post
// opens over the mosaic and Back closes it.
export default async function InterceptedPost({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <PostModal>
      <PostDetail id={id} />
    </PostModal>
  );
}

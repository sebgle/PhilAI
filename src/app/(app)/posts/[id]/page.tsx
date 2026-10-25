import { PostDetail } from "../PostDetail";

// Opened directly (a shared link, or a reload while the popup was up).
export default async function PostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PostDetail id={id} />;
}

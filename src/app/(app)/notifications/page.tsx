import { createClient } from "@/lib/supabase/server";
import { recentReplies } from "@/lib/notifications";
import { THEMES } from "@/lib/contract";
import { MarkSeen } from "./MarkSeen";
import { NoticeList } from "./NoticeList";
import { PageTitle } from "@/components/PageTitle";
import { Backdrop } from "@/components/Backdrop";

const themeNames = Object.fromEntries(THEMES.map((t) => [t.slug, t.name]));

export default async function NotificationsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const replies = await recentReplies(user!.id);

  return (
    <div className="flex flex-col gap-6">
      <MarkSeen />
      <Backdrop variant="quiet" />
      <PageTitle title="Replies to you" />
      {replies.length === 0 ? (
        <p className="text-muted">
          No replies yet. When someone answers a line you shared in the forums, it shows up here.
        </p>
      ) : (
        <NoticeList replies={replies} themeNames={themeNames} />
      )}
    </div>
  );
}

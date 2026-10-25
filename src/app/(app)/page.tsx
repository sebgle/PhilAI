import { createClient } from "@/lib/supabase/server";
import { WriteForm } from "./WriteForm";

export default async function WritePage() {
  const supabase = await createClient();
  // RLS counts only the signed-in user's entries.
  const { count } = await supabase.from("entries").select("id", { count: "exact", head: true });
  return <WriteForm entryNumber={(count ?? 0) + 1} />;
}

import { createClient } from "@/lib/supabase/server";
import { DeleteAccount } from "./DeleteAccount";

export default async function AccountPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from("users").select("handle").eq("id", user!.id).single();

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-2">
        <h1 className="text-xl font-semibold">Your account</h1>
        <p>
          You are <span className="font-medium">{profile?.handle}</span>. Only you see this name. In the
          forums you get a fresh one in every thread.
        </p>
        <p className="text-sm opacity-70">
          Your email ({user!.email}) is used only to log in. It&apos;s never shown to anyone.
        </p>
      </section>

      <section className="flex flex-col gap-3 rounded border border-red-500/30 p-5">
        <h2 className="font-medium">Delete your account</h2>
        <p className="text-sm opacity-80">
          This permanently removes your entries, matches, library, and everything you&apos;ve posted or
          replied in the forums. It can&apos;t be undone.
        </p>
        <DeleteAccount />
      </section>
    </div>
  );
}

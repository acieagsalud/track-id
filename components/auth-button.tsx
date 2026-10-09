import { connection } from "next/server";
import Link from "next/link";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { auth, signIn, signOut } from "@/lib/auth";
import { isDemo } from "@/lib/env";

export function SpotifySignInButton({
  redirectTo,
  label = "Sign in with Spotify",
}: {
  redirectTo?: string;
  label?: string;
}) {
  return (
    <form
      action={async () => {
        "use server";
        await signIn("spotify", { redirectTo });
      }}
    >
      <Button type="submit" size="sm" className="bg-brand text-brand-foreground hover:bg-brand/90">
        {label}
      </Button>
    </form>
  );
}

export async function AuthButton() {
  if (isDemo()) return null;
  await connection(); // Auth.js generates CSRF randomness; keep it out of the static shell
  const session = await auth();
  if (!session?.user?.spotifyId) return <SpotifySignInButton label="Sign in" />;

  return (
    <form
      action={async () => {
        "use server";
        await signOut({ redirectTo: "/" });
      }}
      className="flex shrink-0 items-center gap-2"
    >
      <Link
        href="/playlists"
        className="text-muted-foreground hover:text-foreground text-sm whitespace-nowrap"
      >
        My playlists
      </Link>
      <Button type="submit" size="icon-sm" variant="ghost" aria-label="Sign out">
        <LogOut aria-hidden />
      </Button>
    </form>
  );
}

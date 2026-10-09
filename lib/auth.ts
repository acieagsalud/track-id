import NextAuth, { type DefaultSession } from "next-auth";
import Spotify from "next-auth/providers/spotify";
import { saveUserTokens } from "@/lib/spotify/client";

declare module "next-auth" {
  interface Session {
    user: { spotifyId?: string } & DefaultSession["user"];
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    spotifyId?: string;
  }
}

const SCOPES = ["playlist-modify-private", "playlist-modify-public"].join(" ");

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Spotify({
      authorization: `https://accounts.spotify.com/authorize?${new URLSearchParams({ scope: SCOPES })}`,
    }),
  ],
  session: { strategy: "jwt" },
  trustHost: true,
  callbacks: {
    // Next.js reports 127.0.0.1 requests as "localhost", so Auth.js would bounce users to a host
    // where their cookies don't exist. Send them back to the public origin, same-origin only.
    redirect({ url, baseUrl }) {
      const origin = new URL(process.env.AUTH_REDIRECT_PROXY_URL ?? baseUrl).origin;
      const target = new URL(url, baseUrl);
      if (target.origin !== new URL(baseUrl).origin && target.origin !== origin) return origin;
      return `${origin}${target.pathname}${target.search}${target.hash}`;
    },
    // Tokens go to the DB (encrypted); the session cookie only carries the Spotify user id.
    async jwt({ token, account }) {
      if (account?.provider === "spotify" && account.access_token && account.refresh_token) {
        await saveUserTokens(account.providerAccountId, {
          accessToken: account.access_token,
          refreshToken: account.refresh_token,
          expiresAt: new Date((account.expires_at ?? Date.now() / 1000 + 3600) * 1000),
        });
        token.spotifyId = account.providerAccountId;
      }
      return token;
    },
    session({ session, token }) {
      session.user.spotifyId = token.spotifyId;
      return session;
    },
  },
});

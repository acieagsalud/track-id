import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { AudioLines } from "lucide-react";
import { SearchBar } from "@/components/search-bar";
import { isDemo } from "@/lib/env";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: { default: "track-id", template: "%s · track-id" },
  description: "Find a DJ set's tracklist and save it as a Spotify playlist.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} dark h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        {isDemo() && (
          <div className="bg-brand text-brand-foreground px-4 py-1.5 text-center text-xs font-medium">
            Demo mode: showing bundled sample sets. Spotify saving is simulated.
          </div>
        )}
        <header className="border-b">
          <div className="mx-auto flex max-w-5xl items-center gap-4 px-4 py-3">
            <Link href="/" className="flex shrink-0 items-center gap-2 font-semibold">
              <AudioLines className="text-brand size-5" aria-hidden />
              track-id
            </Link>
            <SearchBar className="ml-auto w-full max-w-xs" size="sm" />
          </div>
        </header>
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">{children}</main>
        <footer className="text-muted-foreground border-t px-4 py-6 text-center text-xs">
          Tracklists from{" "}
          <a href="https://www.mixesdb.com" className="underline underline-offset-2">
            MixesDB
          </a>
          , a community wiki. track-id is a portfolio project and is not affiliated with MixesDB or
          Spotify.
        </footer>
      </body>
    </html>
  );
}

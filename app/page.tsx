import Link from "next/link";
import { SearchBar } from "@/components/search-bar";
import { DEMO_SETS } from "@/lib/demo";
import { djHref } from "@/lib/format";

const EXAMPLES = ["Solomun", "Robin Schulz", "Essential Mix"];

export default function Home() {
  return (
    <section className="mx-auto flex max-w-xl flex-col items-center gap-6 py-16 text-center">
      <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
        Heard it in a set?
        <br />
        <span className="text-brand">Save the whole tracklist.</span>
      </h1>
      <p className="text-muted-foreground">
        Search a DJ or event, browse the tracklist, and turn it into a Spotify playlist. Unreleased
        IDs are flagged so you know what you&apos;re missing.
      </p>
      <SearchBar className="w-full" />
      <p className="text-muted-foreground text-sm">
        Try{" "}
        {EXAMPLES.map((q, i) => (
          <span key={q}>
            {i > 0 && ", "}
            <Link
              href={i === 0 ? djHref(q) : `/search?q=${encodeURIComponent(q)}`}
              className="text-foreground underline underline-offset-2"
            >
              {q}
            </Link>
          </span>
        ))}{" "}
        or a sample set like{" "}
        <Link
          href={`/set/${DEMO_SETS[0].sourceId}`}
          className="text-foreground underline underline-offset-2"
        >
          {DEMO_SETS[0].title}
        </Link>
        .
      </p>
    </section>
  );
}

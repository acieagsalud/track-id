import Link from "next/link";

export default function NotFound() {
  return (
    <div className="py-16 text-center">
      <h1 className="text-2xl font-semibold">Set not found</h1>
      <p className="text-muted-foreground mt-2">
        It may have been removed from MixesDB.{" "}
        <Link href="/" className="text-foreground underline underline-offset-2">
          Back to search
        </Link>
      </p>
    </div>
  );
}

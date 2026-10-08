"use client";

import { Button } from "@/components/ui/button";

export default function Error({ retry }: { error: Error; retry: () => void }) {
  return (
    <div className="py-16 text-center">
      <h1 className="text-2xl font-semibold">Something went wrong</h1>
      <p className="text-muted-foreground mt-2">
        MixesDB may be slow or unavailable. Try again in a moment.
      </p>
      <Button className="mt-6" onClick={() => retry()}>
        Try again
      </Button>
    </div>
  );
}

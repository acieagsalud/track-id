import Form from "next/form";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export function SearchBar({
  defaultValue,
  className,
  size = "lg",
}: {
  defaultValue?: string;
  className?: string;
  size?: "sm" | "lg";
}) {
  return (
    <Form action="/search" role="search" className={cn("relative", className)}>
      <Search
        className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
        aria-hidden
      />
      <Input
        name="q"
        type="search"
        defaultValue={defaultValue}
        placeholder="Search a DJ, event or track…"
        aria-label="Search sets"
        className={cn("pl-9", size === "lg" && "h-12 text-base")}
        required
      />
    </Form>
  );
}

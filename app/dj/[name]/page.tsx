import { Suspense } from "react";
import { SetList, SetListSkeleton } from "@/components/set-card";
import { getDjSets } from "@/lib/data/sets";

export async function generateMetadata(props: PageProps<"/dj/[name]">) {
  const { name } = await props.params;
  return { title: decodeURIComponent(name) };
}

export default function DjPage(props: PageProps<"/dj/[name]">) {
  return (
    <Suspense fallback={<SetListSkeleton />}>
      <DjSets params={props.params} />
    </Suspense>
  );
}

async function DjSets({ params }: Pick<PageProps<"/dj/[name]">, "params">) {
  const name = decodeURIComponent((await params).name);
  const sets = await getDjSets(name);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">{name}</h1>
        <p className="text-muted-foreground text-sm">
          {sets.length ? `${sets.length} most recent sets on MixesDB` : "No sets found on MixesDB."}
        </p>
      </div>
      {sets.length > 0 && <SetList sets={sets} />}
    </div>
  );
}

import Link from "next/link";
import { PageTitle } from "@/components/PageTitle";
import { exploreTiles } from "./explore";
import { ExploreGrid } from "./ExploreGrid";

// The home page. Unlike the rest of the app it isn't read top to bottom: it's
// a wide mosaic of lines from every room that keeps loading as you scroll,
// each tile opening its post in a popup over the grid.
export default async function ExplorePage() {
  const { tiles, next } = await exploreTiles();

  return (
    <div className="flex flex-col gap-6">
      <PageTitle title="Explore" />

      {tiles.length === 0 ? (
        <p className="text-muted">
          No one has shared yet.{" "}
          <Link href="/write" className="underline underline-offset-4 hover:text-foreground">Write an entry</Link>
          {" "}and share a line from its passage card to start.
        </p>
      ) : (
        <ExploreGrid initial={tiles} next={next} />
      )}
    </div>
  );
}

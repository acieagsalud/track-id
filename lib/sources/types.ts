export type SourceName = "mixesdb" | "mixcloud";

export interface ParsedTrack {
  position: number;
  /** Heading from a b2b / multi-DJ page (";Robin Schulz @ PACHA"), if any. */
  section: string | null;
  cueSec: number | null;
  /** "track" can be matched on Spotify; "unknown" is a "?" line; "note" has no Artist - Title shape. */
  kind: "track" | "unknown" | "note";
  artist: string | null;
  title: string | null;
  mixName: string | null;
  label: string | null;
  catalogNo: string | null;
  isUnreleased: boolean;
  /** Layered over the previous track ("+ ..." or "w/ ..."). */
  isMashupPart: boolean;
  rawLine: string;
}

export interface SetSummary {
  source: SourceName;
  sourceId: string;
  title: string;
  djs: string[];
  venue: string | null;
  event: string | null;
  playedAt: string | null;
  sourceUrl: string;
}

export interface SetDetail extends SetSummary {
  genres: string[];
  isComplete: boolean;
  tracks: ParsedTrack[];
}

export interface TracklistSource {
  name: SourceName;
  search(query: string, limit?: number): Promise<SetSummary[]>;
  getSetsByDj(dj: string, limit?: number): Promise<SetSummary[]>;
  getSet(sourceId: string): Promise<SetDetail | null>;
}

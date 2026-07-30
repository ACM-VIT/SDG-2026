import { trackById } from "../../convex/tracks";
import { TRACK_COLORS, FALLBACK_COLOR } from "../trackColors";

export function TrackBadge({ track }: { track: string }) {
  const info = trackById(track);
  const colors = TRACK_COLORS[track] ?? FALLBACK_COLOR;
  return (
    <span
      className="badge"
      style={{ background: colors.bg, color: colors.fg }}
      title={info?.sdg}
    >
      {info?.name ?? track}
    </span>
  );
}

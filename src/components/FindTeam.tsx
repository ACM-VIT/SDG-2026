import { FormEvent, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { TRACKS } from "../../convex/tracks";
import { TRACK_COLORS, FALLBACK_COLOR } from "../trackColors";
import { TrackBadge } from "./TrackBadge";

export function FindTeam() {
  const teams = useQuery(api.teams.listTeams);
  const createTeam = useMutation(api.teams.createTeam);
  const joinTeam = useMutation(api.teams.joinTeam);

  const [teamName, setTeamName] = useState("");
  const [track, setTrack] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [createError, setCreateError] = useState("");
  const [joinError, setJoinError] = useState("");
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(false);

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    setCreateError("");
    if (!track) {
      setCreateError("Choose an SDG track for your team");
      return;
    }
    setCreating(true);
    try {
      await createTeam({ name: teamName, track });
    } catch (err) {
      setCreateError(errorMessage(err));
    } finally {
      setCreating(false);
    }
  };

  const handleJoin = async (e: FormEvent) => {
    e.preventDefault();
    setJoinError("");
    setJoining(true);
    try {
      await joinTeam({ inviteCode });
    } catch (err) {
      setJoinError(errorMessage(err));
    } finally {
      setJoining(false);
    }
  };

  return (
    <>
      <header className="hero">
        <p className="hero-eyebrow">SDG Ideathon</p>
        <h1>Find your team</h1>
        <p className="hero-sub">Create a squad or hop into one already forming</p>
      </header>

      <div className="card-grid">
        <form className="action-card card-create" onSubmit={handleCreate}>
          <span className="icon">+</span>
          <h2>Create a team</h2>
          <p>Name your team, pick an SDG track, get an invite code to share.</p>
          <input
            className="field"
            placeholder="Team name"
            value={teamName}
            onChange={(e) => setTeamName(e.target.value)}
            required
          />
          <select
            className="field"
            value={track}
            onChange={(e) => setTrack(e.target.value)}
          >
            <option value="">Choose SDG track</option>
            {TRACKS.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} ({t.sdg})
              </option>
            ))}
          </select>
          {createError && <p className="form-error">{createError}</p>}
          <button className="btn btn-create" type="submit" disabled={creating}>
            {creating ? "Creating…" : "Create team"}
          </button>
        </form>

        <form className="action-card card-join" onSubmit={handleJoin}>
          <span className="icon">👥</span>
          <h2>Join a team</h2>
          <p>Got an invite code from a teammate? Drop it in here.</p>
          <input
            className="field"
            placeholder="Enter invite code"
            value={inviteCode}
            onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
            required
          />
          <p className="hint">Codes are shared by team creators after signup.</p>
          {joinError && <p className="form-error">{joinError}</p>}
          <button className="btn btn-join" type="submit" disabled={joining}>
            {joining ? "Joining…" : "Join team"}
          </button>
        </form>
      </div>

      <h2 className="section-title">Teams forming now</h2>
      {teams === undefined ? (
        <div className="empty-note">Loading teams…</div>
      ) : teams.length === 0 ? (
        <div className="empty-note">
          No teams yet — be the first to create one!
        </div>
      ) : (
        teams.map((team) => {
          const colors = TRACK_COLORS[team.track] ?? FALLBACK_COLOR;
          return (
            <div className="team-row" key={team.id}>
              <span className="team-dot" style={{ background: colors.dot }} />
              <span className="team-name">{team.name}</span>
              <TrackBadge track={team.track} />
              <span className="team-count">
                {team.memberCount}/{team.maxSize} joined
              </span>
            </div>
          );
        })
      )}
    </>
  );
}

export function errorMessage(err: unknown): string {
  if (err instanceof Error) {
    // Convex wraps thrown errors; surface just the human-readable part
    const match = err.message.match(/(?:Uncaught Error: )([^\n]+)/);
    return match ? match[1] : err.message;
  }
  return "Something went wrong. Try again.";
}

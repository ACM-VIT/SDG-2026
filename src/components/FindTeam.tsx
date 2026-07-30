import { FormEvent, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { TRACKS } from "../../convex/tracks";

export function FindTeam() {
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
        <h1>
          Find your <span className="accent-orange">team</span>
        </h1>
        <p className="hero-sub">
          <span className="accent-orange">Create</span>.{" "}
          <span className="accent-blue">Join</span>.{" "}
          <span className="accent-purple">Submit</span>. Teams of up to four,
          one SDG track each.
        </p>
      </header>

      <form className="flow-section" onSubmit={handleCreate}>
        <h2>Create a Team</h2>
        <p className="flow-sub">Name your team and choose a track</p>
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

      <div className="divider">or</div>

      <form className="flow-section" onSubmit={handleJoin}>
        <h2>Join a Team</h2>
        <p className="flow-sub">Join a team using a team code</p>
        <input
          className="field"
          placeholder="Enter invite code"
          value={inviteCode}
          onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
          required
        />
        {joinError && <p className="form-error">{joinError}</p>}
        <button className="btn btn-join" type="submit" disabled={joining}>
          {joining ? "Joining…" : "Join team"}
        </button>
      </form>
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

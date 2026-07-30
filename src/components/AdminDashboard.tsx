import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { trackById } from "../../convex/tracks";

export function AdminDashboard() {
  const overview = useQuery(api.admin.overview);

  if (overview === undefined) {
    return <div className="center-note">Loading admin data…</div>;
  }

  return (
    <>
      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-value">{overview.teamCount}</div>
          <div className="stat-label">Teams</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{overview.participantCount}</div>
          <div className="stat-label">Participants</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{overview.submissionCount}</div>
          <div className="stat-label">Ideas submitted</div>
        </div>
      </div>

      {overview.teams.length === 0 && (
        <div className="empty-note">No teams yet.</div>
      )}

      {overview.teams.map((team) => (
        <div className="admin-team" key={team.id}>
          <div className="admin-team-head">
            <h3>{team.name}</h3>
            <span className="admin-code">code: {team.inviteCode}</span>
          </div>
          <p className="admin-track">
            {trackById(team.track)?.name ?? team.track} (
            {trackById(team.track)?.sdg})
          </p>

          <div className="admin-subhead">
            Members ({team.members.length}/{team.maxSize})
          </div>
          <ul className="member-list">
            {team.members.map((member) => (
              <li key={member.email}>
                <span>
                  {member.name}
                  {member.isCreator && (
                    <span className="member-role"> · creator</span>
                  )}
                </span>
                <span className="member-email">{member.email}</span>
              </li>
            ))}
          </ul>

          <div className="admin-subhead">
            Submissions ({team.submissions.length})
          </div>
          {team.submissions.length === 0 ? (
            <p className="submission-meta">No submissions yet.</p>
          ) : (
            team.submissions.map((submission) => (
              <div className="submission" key={submission.id}>
                <div className="submission-head">
                  <h3>{submission.title}</h3>
                  <span className="submission-meta">
                    by {submission.author} ·{" "}
                    {new Date(submission.createdAt).toLocaleString()}
                  </span>
                </div>
                {submission.text && <p>{submission.text}</p>}
                {submission.attachments.map(
                  (attachment) =>
                    attachment.url && (
                      <a
                        key={attachment.url}
                        className="attachment-link"
                        href={attachment.url}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {attachment.name}
                      </a>
                    )
                )}
              </div>
            ))
          )}
        </div>
      ))}
    </>
  );
}

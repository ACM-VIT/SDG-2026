import { FormEvent, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { TrackBadge } from "./TrackBadge";
import { errorMessage } from "./FindTeam";

type Team = {
  id: string;
  name: string;
  track: string;
  inviteCode: string;
  maxSize: number;
  members: {
    id: string;
    name: string;
    email: string;
    isCreator: boolean;
  }[];
};

export function TeamDashboard({ team }: { team: Team }) {
  const submissions = useQuery(api.ideas.teamSubmissions);
  const generateUploadUrl = useMutation(api.ideas.generateUploadUrl);
  const submitIdea = useMutation(api.ideas.submitIdea);
  const deleteSubmission = useMutation(api.ideas.deleteSubmission);
  const leaveTeam = useMutation(api.teams.leaveTeam);

  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);

  const showToast = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(""), 2500);
  };

  const copyCode = async () => {
    await navigator.clipboard.writeText(team.inviteCode);
    showToast("Invite code copied!");
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const attachments = [];
      for (const file of files) {
        const uploadUrl = await generateUploadUrl();
        const result = await fetch(uploadUrl, {
          method: "POST",
          headers: { "Content-Type": file.type || "application/octet-stream" },
          body: file,
        });
        if (!result.ok) throw new Error(`Failed to upload ${file.name}`);
        const { storageId } = await result.json();
        attachments.push({ storageId, name: file.name });
      }
      await submitIdea({ title, text, attachments });
      setTitle("");
      setText("");
      setFiles([]);
      if (fileInput.current) fileInput.current.value = "";
      showToast("Idea submitted!");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleLeave = async () => {
    if (
      !confirm(
        "Leave this team? If you are the last member, the team and its submissions will be deleted."
      )
    ) {
      return;
    }
    await leaveTeam();
  };

  return (
    <>
      <div className="panel">
        <div className="team-header">
          <h1>{team.name}</h1>
          <TrackBadge track={team.track} />
          <div className="invite-box">
            <span className="invite-label">Invite code</span>
            <span className="invite-code">{team.inviteCode}</span>
            <button className="btn-small" onClick={() => void copyCode()}>
              Copy
            </button>
          </div>
        </div>
      </div>

      <div className="panel">
        <h2>
          Members ({team.members.length}/{team.maxSize})
        </h2>
        <ul className="member-list">
          {team.members.map((member) => (
            <li key={member.id}>
              <span>{member.name}</span>
              {member.isCreator && <span className="creator-tag">Creator</span>}
              <span className="member-email">{member.email}</span>
            </li>
          ))}
        </ul>
      </div>

      <form className="panel" onSubmit={handleSubmit}>
        <h2>Submit an idea</h2>
        <input
          className="field"
          placeholder="Idea title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />
        <textarea
          className="field"
          placeholder="Describe your idea — the problem, your ML approach, the datasets you'd use…"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <div className="file-row">
          <button
            type="button"
            className="btn-small"
            onClick={() => fileInput.current?.click()}
          >
            + Attach documents
          </button>
          {files.map((file) => (
            <span className="file-chip" key={file.name}>
              {file.name}
            </span>
          ))}
          <input
            ref={fileInput}
            type="file"
            multiple
            hidden
            accept=".pdf,.doc,.docx,.ppt,.pptx,.txt,.md,.csv,.zip,.png,.jpg,.jpeg"
            onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
          />
        </div>
        {error && <p className="form-error">{error}</p>}
        <button
          className="btn btn-create"
          type="submit"
          disabled={submitting}
          style={{ maxWidth: 240 }}
        >
          {submitting ? "Submitting…" : "Submit idea"}
        </button>
      </form>

      <div className="panel">
        <h2>Team submissions</h2>
        {submissions === undefined ? (
          <p className="submission-meta">Loading…</p>
        ) : submissions.length === 0 ? (
          <p className="submission-meta">
            Nothing submitted yet — your ideas will show up here.
          </p>
        ) : (
          submissions.map((submission) => (
            <div className="submission" key={submission.id}>
              <div className="submission-head">
                <h3>{submission.title}</h3>
                <span className="submission-meta">
                  by {submission.author} ·{" "}
                  {new Date(submission.createdAt).toLocaleString()}
                </span>
                {submission.isMine && (
                  <button
                    className="btn-small danger"
                    onClick={() =>
                      void deleteSubmission({ id: submission.id })
                    }
                  >
                    Delete
                  </button>
                )}
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

      <button className="btn-small danger" onClick={() => void handleLeave()}>
        Leave team
      </button>

      {toast && <div className="toast">{toast}</div>}
    </>
  );
}

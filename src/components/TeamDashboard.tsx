import { FormEvent, useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { TRACKS } from "../../convex/tracks";
import { TrackBadge } from "./TrackBadge";
import { errorMessage } from "./FindTeam";

type Team = {
  id: string;
  name: string;
  track?: string;
  inviteCode: string;
  maxSize: number;
  members: {
    id: string;
    name: string;
    email: string;
    isCreator: boolean;
  }[];
};

type Attachment = { storageId: Id<"_storage">; name: string };

export function TeamDashboard({ team }: { team: Team }) {
  const submissions = useQuery(api.ideas.teamSubmissions);
  const settings = useQuery(api.settings.get);
  const generateUploadUrl = useMutation(api.ideas.generateUploadUrl);
  const claimUpload = useMutation(api.ideas.claimUpload);
  const submitIdea = useMutation(api.ideas.submitIdea);
  const updateSubmission = useMutation(api.ideas.updateSubmission);
  const cleanupUploads = useMutation(api.ideas.cleanupUploads);
  const deleteSubmission = useMutation(api.ideas.deleteSubmission);
  const leaveTeam = useMutation(api.teams.leaveTeam);
  const setTrack = useMutation(api.teams.setTrack);

  // One submission per team: the form edits it once it exists.
  const submission = submissions?.[0] ?? null;
  const uploadsClosed = settings?.uploads === "closed";

  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [keptAttachments, setKeptAttachments] = useState<Attachment[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);

  const submissionId = submission?.id ?? null;
  useEffect(() => {
    setTitle(submission?.title ?? "");
    setText(submission?.text ?? "");
    setKeptAttachments(
      submission?.attachments.map((attachment) => ({
        storageId: attachment.storageId,
        name: attachment.name,
      })) ?? []
    );
    setFiles([]);
    if (fileInput.current) fileInput.current.value = "";
    // Keyed on the id so a teammate's edits don't clobber typing mid-edit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submissionId]);

  const showToast = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(""), 2500);
  };

  const copyCode = async () => {
    await navigator.clipboard.writeText(team.inviteCode);
    showToast("Invite code copied!");
  };

  const changeTrack = async (value: string) => {
    if (!value || value === team.track) return;
    try {
      await setTrack({ track: value });
      showToast("Track updated!");
    } catch (err) {
      showToast(errorMessage(err));
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    const uploaded: Attachment[] = [];
    try {
      for (const file of files) {
        const uploadUrl = await generateUploadUrl();
        const result = await fetch(uploadUrl, {
          method: "POST",
          headers: { "Content-Type": file.type || "application/octet-stream" },
          body: file,
        });
        if (!result.ok) throw new Error(`Failed to upload ${file.name}`);
        const { storageId } = await result.json();
        await claimUpload({ storageId });
        uploaded.push({ storageId, name: file.name });
      }
      if (submission) {
        const attachments = [...keptAttachments, ...uploaded];
        await updateSubmission({ id: submission.id, title, text, attachments });
        setKeptAttachments(attachments);
        showToast("Submission updated!");
      } else {
        await submitIdea({ title, text, attachments: uploaded });
        showToast("Idea submitted!");
      }
      setFiles([]);
      if (fileInput.current) fileInput.current.value = "";
    } catch (err) {
      setError(errorMessage(err));
      if (uploaded.length > 0) {
        // Best effort: discard uploads that never made it onto a submission.
        void cleanupUploads({
          storageIds: uploaded.map((attachment) => attachment.storageId),
        }).catch(() => {});
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!submission) return;
    if (!confirm("Delete your team's submission? This cannot be undone.")) {
      return;
    }
    await deleteSubmission({ id: submission.id });
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
          <select
            className="field track-select"
            value=""
            onChange={(e) => void changeTrack(e.target.value)}
          >
            <option value="">
              {team.track ? "Change track…" : "Choose track…"}
            </option>
            {TRACKS.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} ({t.sdg})
              </option>
            ))}
          </select>
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
        <h2>{submission ? "Edit your submission" : "Submit an idea"}</h2>
        {uploadsClosed && (
          <p className="form-error">
            Submissions are currently closed — uploading and editing is
            disabled.
          </p>
        )}
        {submission && (
          <p className="submission-meta">
            Submitted by {submission.author} ·{" "}
            {new Date(submission.createdAt).toLocaleString()}
          </p>
        )}
        <input
          className="field"
          placeholder="Idea title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          disabled={uploadsClosed}
          required
        />
        <textarea
          className="field"
          placeholder="Describe your idea — the problem, your ML approach, the datasets you'd use…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={uploadsClosed}
        />
        <div className="file-row">
          <button
            type="button"
            className="btn-small"
            disabled={uploadsClosed}
            onClick={() => fileInput.current?.click()}
          >
            + Attach documents
          </button>
          {keptAttachments.map((attachment) => {
            const url = submission?.attachments.find(
              (a) => a.storageId === attachment.storageId
            )?.url;
            return (
            <span className="file-chip" key={attachment.storageId}>
              {url ? (
                <a
                  className="attachment-link"
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                >
                  {attachment.name}
                </a>
              ) : (
                attachment.name
              )}
              <button
                type="button"
                className="chip-remove"
                title="Remove attachment"
                disabled={uploadsClosed}
                onClick={() =>
                  setKeptAttachments(
                    keptAttachments.filter(
                      (kept) => kept.storageId !== attachment.storageId
                    )
                  )
                }
              >
                ×
              </button>
            </span>
            );
          })}
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
        <div className="file-row">
          <button
            className="btn btn-create"
            type="submit"
            disabled={submitting || uploadsClosed}
            style={{ maxWidth: 240 }}
          >
            {submitting ? "Saving…" : submission ? "Save changes" : "Submit idea"}
          </button>
          {submission && (
            <button
              type="button"
              className="btn-small danger"
              onClick={() => void handleDelete()}
            >
              Delete submission
            </button>
          )}
        </div>
      </form>

      <button
        className="btn-small danger btn-leave"
        onClick={() => void handleLeave()}
      >
        Leave team
      </button>

      {toast && <div className="toast">{toast}</div>}
    </>
  );
}

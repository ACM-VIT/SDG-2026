import { useAuthActions } from "@convex-dev/auth/react";

export function SignIn() {
  const { signIn } = useAuthActions();
  return (
    <div className="signin-wrap">
      <div className="signin-card">
        <p className="hero-eyebrow">SDG Workshop</p>
        <h1>
          ML Workshop <span className="accent-orange">2026</span>
        </h1>
        <p>
          <span className="accent-orange">Sign in</span> to{" "}
          <span className="accent-blue">create</span> or{" "}
          <span className="accent-purple">join</span> a team, pick an SDG
          track, and submit your ideas.
        </p>
        <button className="btn-google" onClick={() => void signIn("google")}>
          Continue with Google
        </button>
      </div>
    </div>
  );
}

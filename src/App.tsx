import { useState } from "react";
import {
  Authenticated,
  Unauthenticated,
  AuthLoading,
  useQuery,
} from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { api } from "../convex/_generated/api";
import { SignIn } from "./components/SignIn";
import { FindTeam } from "./components/FindTeam";
import { TeamDashboard } from "./components/TeamDashboard";
import { AdminDashboard } from "./components/AdminDashboard";

type Tab = "teams" | "demo" | "admin";

export default function App() {
  return (
    <>
      <AuthLoading>
        <div className="center-note">Loading…</div>
      </AuthLoading>
      <Unauthenticated>
        <SignIn />
      </Unauthenticated>
      <Authenticated>
        <Main />
      </Authenticated>
    </>
  );
}

function Main() {
  const [tab, setTab] = useState<Tab>("teams");
  const { signOut } = useAuthActions();
  const viewer = useQuery(api.users.viewer);
  const isAdmin = useQuery(api.admin.isAdmin);
  const myTeam = useQuery(api.teams.myTeam);

  return (
    <div className="page">
      <nav className="nav">
        <span className="nav-logo">🌍 SDG Ideathon</span>
        <div className="nav-tabs">
          <button
            className={`nav-tab ${tab === "teams" ? "active" : ""}`}
            onClick={() => setTab("teams")}
          >
            {myTeam ? "My team" : "Find a team"}
          </button>
          <button
            className={`nav-tab ${tab === "demo" ? "active" : ""}`}
            onClick={() => setTab("demo")}
          >
            Live demo
          </button>
          {isAdmin && (
            <button
              className={`nav-tab ${tab === "admin" ? "active" : ""}`}
              onClick={() => setTab("admin")}
            >
              Admin
            </button>
          )}
        </div>
        <div className="nav-spacer" />
        {viewer && <span className="nav-user">{viewer.name}</span>}
        <button className="nav-signout" onClick={() => void signOut()}>
          Sign out
        </button>
      </nav>

      {tab === "teams" &&
        (myTeam === undefined ? (
          <div className="center-note">Loading…</div>
        ) : myTeam === null ? (
          <FindTeam />
        ) : (
          <TeamDashboard team={myTeam} />
        ))}

      {tab === "demo" && (
        <div className="demo-placeholder">
          <h2>Live demo</h2>
          <p>
            The RL training demo will appear here during the workshop. Stay
            tuned!
          </p>
        </div>
      )}

      {tab === "admin" && isAdmin && <AdminDashboard />}
    </div>
  );
}

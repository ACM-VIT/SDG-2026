import { useState } from "react";
import {
  Authenticated,
  Unauthenticated,
  AuthLoading,
  useQuery,
} from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { api } from "../convex/_generated/api";
import { BinaryField } from "./components/BinaryField";
import { SignIn } from "./components/SignIn";
import { FindTeam } from "./components/FindTeam";
import { TeamDashboard } from "./components/TeamDashboard";
import { AdminDashboard } from "./components/AdminDashboard";
import { RLTreasureLab } from "./components/RLTreasureLab";

type Tab = "teams" | "demo" | "admin";

export default function App() {
  return (
    <>
      <AuthLoading>
        <div className="center-note">Loading…</div>
      </AuthLoading>
      <Unauthenticated>
        <BinaryField />
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
      {tab !== "admin" && <BinaryField />}
      <nav className="nav">
        <span className="nav-logo">SDG Workshop</span>
        <div className="nav-spacer" />
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

      {tab === "demo" && <RLTreasureLab />}

      {tab === "admin" && isAdmin && <AdminDashboard />}
    </div>
  );
}

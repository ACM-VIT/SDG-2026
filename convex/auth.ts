import Google from "@auth/core/providers/google";
import { convexAuth } from "@convex-dev/auth/server";

// isAdmin is never set automatically — it's only ever changed by editing the
// users table directly in the Convex dashboard.
export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [Google],
});

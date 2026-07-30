import Google from "@auth/core/providers/google";
import { Anonymous } from "@convex-dev/auth/providers/Anonymous";
import { convexAuth } from "@convex-dev/auth/server";

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    Google,
    // Guest access while Google OAuth is not set up. Remove before the
    // real event so participants must sign in with Google.
    Anonymous({
      profile: () => ({
        name: `Guest ${Math.floor(1000 + Math.random() * 9000)}`,
        isAnonymous: true,
      }),
    }),
  ],
});

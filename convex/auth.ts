import Google from "@auth/core/providers/google";
import { convexAuth } from "@convex-dev/auth/server";

// Emails in the comma-separated ADMIN_EMAILS env var get isAdmin set on their
// first sign-in. After that, the isAdmin flag on the users table is the source
// of truth (editable in the Convex dashboard).
const DEFAULT_ADMIN_EMAILS = ["ayaankhatri@outlook.com"];

function bootstrapAdminEmails() {
  const env = process.env.ADMIN_EMAILS;
  if (!env) return DEFAULT_ADMIN_EMAILS;
  return env.split(",").map((e) => e.trim().toLowerCase());
}

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [Google],
  callbacks: {
    async afterUserCreatedOrUpdated(ctx, { userId }) {
      const user = await ctx.db.get(userId);
      if (!user || user.isAdmin !== undefined) return;
      const email = user.email?.toLowerCase();
      if (email && bootstrapAdminEmails().includes(email)) {
        await ctx.db.patch(userId, { isAdmin: true });
      }
    },
  },
});

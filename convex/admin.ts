import { query, QueryCtx } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { MAX_TEAM_SIZE } from "./teams";

export async function checkAdmin(ctx: QueryCtx) {
  const userId = await getAuthUserId(ctx);
  if (userId === null) return false;
  const user = await ctx.db.get(userId);
  return user?.isAdmin === true;
}

export const isAdmin = query({
  args: {},
  handler: async (ctx) => await checkAdmin(ctx),
});

export const overview = query({
  args: {},
  handler: async (ctx) => {
    if (!(await checkAdmin(ctx))) throw new Error("Admins only");

    const teams = await ctx.db.query("teams").order("desc").collect();
    const allMemberships = await ctx.db.query("memberships").collect();
    const allSubmissions = await ctx.db.query("submissions").collect();

    const teamDetails = await Promise.all(
      teams.map(async (team) => {
        const memberships = allMemberships.filter(
          (m) => m.teamId === team._id
        );
        const members = await Promise.all(
          memberships.map(async (m) => {
            const user = await ctx.db.get(m.userId);
            return {
              name: user?.name ?? "Unknown",
              email: user?.email ?? "",
              isCreator: m.userId === team.createdBy,
            };
          })
        );
        const submissions = await Promise.all(
          allSubmissions
            .filter((s) => s.teamId === team._id)
            .map(async (submission) => {
              const author = await ctx.db.get(submission.authorId);
              return {
                id: submission._id,
                title: submission.title,
                text: submission.text,
                author: author?.name ?? author?.email ?? "Unknown",
                createdAt: submission._creationTime,
                attachments: await Promise.all(
                  submission.attachments.map(async (attachment) => ({
                    name: attachment.name,
                    url: await ctx.storage.getUrl(attachment.storageId),
                  }))
                ),
              };
            })
        );
        return {
          id: team._id,
          name: team.name,
          track: team.track,
          inviteCode: team.inviteCode,
          maxSize: MAX_TEAM_SIZE,
          members,
          submissions,
        };
      })
    );

    return {
      teamCount: teams.length,
      participantCount: allMemberships.length,
      submissionCount: allSubmissions.length,
      teams: teamDetails,
    };
  },
});

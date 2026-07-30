import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not signed in");
    const membership = await ctx.db
      .query("memberships")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();
    if (!membership) {
      throw new Error("Join a team before uploading documents");
    }
    return await ctx.storage.generateUploadUrl();
  },
});

export const submitIdea = mutation({
  args: {
    title: v.string(),
    text: v.string(),
    attachments: v.array(
      v.object({
        storageId: v.id("_storage"),
        name: v.string(),
      })
    ),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not signed in");
    const membership = await ctx.db
      .query("memberships")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();
    if (!membership) throw new Error("Join a team before submitting an idea");
    const title = args.title.trim();
    if (title.length === 0) throw new Error("Give your idea a title");
    if (args.text.trim().length === 0 && args.attachments.length === 0) {
      throw new Error("Add a description or attach a document");
    }
    await ctx.db.insert("submissions", {
      teamId: membership.teamId,
      authorId: userId,
      title,
      text: args.text.trim(),
      attachments: args.attachments,
    });
  },
});

export const teamSubmissions = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];
    const membership = await ctx.db
      .query("memberships")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();
    if (!membership) return [];
    const submissions = await ctx.db
      .query("submissions")
      .withIndex("by_team", (q) => q.eq("teamId", membership.teamId))
      .order("desc")
      .collect();
    return await Promise.all(
      submissions.map(async (submission) => {
        const author = await ctx.db.get(submission.authorId);
        return {
          id: submission._id,
          title: submission.title,
          text: submission.text,
          author: author?.name ?? author?.email ?? "Unknown",
          isMine: submission.authorId === userId,
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
  },
});

export const deleteSubmission = mutation({
  args: { id: v.id("submissions") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not signed in");
    const submission = await ctx.db.get(args.id);
    if (!submission) return;
    if (submission.authorId !== userId) {
      throw new Error("Only the author can delete a submission");
    }
    for (const attachment of submission.attachments) {
      await ctx.storage.delete(attachment.storageId);
    }
    await ctx.db.delete(args.id);
  },
});

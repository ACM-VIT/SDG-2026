import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { uploadsOpen } from "./settings";

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
    if (!(await uploadsOpen(ctx))) {
      throw new Error("Submissions are currently closed");
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
    if (!(await uploadsOpen(ctx))) {
      throw new Error("Submissions are currently closed");
    }
    const existing = await ctx.db
      .query("submissions")
      .withIndex("by_team", (q) => q.eq("teamId", membership.teamId))
      .first();
    if (existing) {
      throw new Error("Your team already has a submission — edit it instead");
    }
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

export const updateSubmission = mutation({
  args: {
    id: v.id("submissions"),
    title: v.string(),
    text: v.string(),
    // The full attachment list the submission should end up with: kept
    // existing uploads plus any newly uploaded files.
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
    const submission = await ctx.db.get(args.id);
    if (!submission) throw new Error("Submission not found");
    const membership = await ctx.db
      .query("memberships")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();
    if (!membership || membership.teamId !== submission.teamId) {
      throw new Error("Only current team members can edit the submission");
    }
    if (!(await uploadsOpen(ctx))) {
      throw new Error("Submissions are currently closed");
    }
    const title = args.title.trim();
    if (title.length === 0) throw new Error("Give your idea a title");
    if (args.text.trim().length === 0 && args.attachments.length === 0) {
      throw new Error("Add a description or attach a document");
    }
    const keptIds = new Set<string>(
      args.attachments.map((attachment) => attachment.storageId)
    );
    for (const attachment of submission.attachments) {
      if (!keptIds.has(attachment.storageId)) {
        await ctx.storage.delete(attachment.storageId);
      }
    }
    await ctx.db.patch(args.id, {
      title,
      text: args.text.trim(),
      attachments: args.attachments,
    });
  },
});

export const cleanupUploads = mutation({
  args: { storageIds: v.array(v.id("_storage")) },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not signed in");
    // No membership check: a failed submission may be caused by the user
    // having just left their team, and they must still be able to discard
    // the files they uploaded moments earlier.
    const submissions = await ctx.db.query("submissions").collect();
    const referenced = new Set<string>();
    for (const submission of submissions) {
      for (const attachment of submission.attachments) {
        referenced.add(attachment.storageId);
      }
    }
    for (const storageId of args.storageIds) {
      // Only delete uploads no submission references, so a caller can
      // never remove an attachment that belongs to a committed submission.
      if (!referenced.has(storageId)) {
        await ctx.storage.delete(storageId);
      }
    }
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
              storageId: attachment.storageId,
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
    // Any current member may delete: the submission belongs to the team,
    // and ex-members lose access once they leave.
    const membership = await ctx.db
      .query("memberships")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();
    if (!membership || membership.teamId !== submission.teamId) {
      throw new Error("Only current team members can delete a submission");
    }
    for (const attachment of submission.attachments) {
      await ctx.storage.delete(attachment.storageId);
    }
    await ctx.db.delete(args.id);
  },
});

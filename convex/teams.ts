import { v } from "convex/values";
import { mutation, query, QueryCtx } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { Id } from "./_generated/dataModel";
import { TRACK_IDS } from "./tracks";

export const MAX_TEAM_SIZE = 4;

// Unambiguous characters only (no 0/O, 1/I/L)
const CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

function randomCode() {
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return code;
}

async function requireUserId(ctx: QueryCtx) {
  const userId = await getAuthUserId(ctx);
  if (userId === null) throw new Error("Not signed in");
  return userId;
}

async function membershipFor(ctx: QueryCtx, userId: Id<"users">) {
  return await ctx.db
    .query("memberships")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .unique();
}

async function teamMemberCount(ctx: QueryCtx, teamId: Id<"teams">) {
  const members = await ctx.db
    .query("memberships")
    .withIndex("by_team", (q) => q.eq("teamId", teamId))
    .collect();
  return members.length;
}

export const createTeam = mutation({
  args: { name: v.string(), track: v.string() },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const name = args.name.trim();
    if (name.length < 2 || name.length > 40) {
      throw new Error("Team name must be 2-40 characters");
    }
    if (!TRACK_IDS.includes(args.track)) {
      throw new Error("Pick a valid SDG track");
    }
    if (await membershipFor(ctx, userId)) {
      throw new Error("You are already in a team");
    }
    let inviteCode = randomCode();
    while (
      await ctx.db
        .query("teams")
        .withIndex("by_inviteCode", (q) => q.eq("inviteCode", inviteCode))
        .unique()
    ) {
      inviteCode = randomCode();
    }
    const teamId = await ctx.db.insert("teams", {
      name,
      track: args.track,
      inviteCode,
      createdBy: userId,
    });
    await ctx.db.insert("memberships", { teamId, userId });
    return { teamId, inviteCode };
  },
});

export const joinTeam = mutation({
  args: { inviteCode: v.string() },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    if (await membershipFor(ctx, userId)) {
      throw new Error("You are already in a team");
    }
    const code = args.inviteCode.trim().toUpperCase();
    const team = await ctx.db
      .query("teams")
      .withIndex("by_inviteCode", (q) => q.eq("inviteCode", code))
      .unique();
    if (!team) throw new Error("No team found for that invite code");
    // Capacity check + insert are atomic: Convex mutations run as
    // serializable transactions, so a concurrent join to the same team
    // conflicts on the membership read and one of the two retries,
    // re-running this check against the new count.
    if ((await teamMemberCount(ctx, team._id)) >= MAX_TEAM_SIZE) {
      throw new Error("That team is already full");
    }
    await ctx.db.insert("memberships", { teamId: team._id, userId });
    return { teamId: team._id };
  },
});

export const leaveTeam = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    const membership = await membershipFor(ctx, userId);
    if (!membership) throw new Error("You are not in a team");
    await ctx.db.delete(membership._id);
    // Delete the team once the last member leaves
    if ((await teamMemberCount(ctx, membership.teamId)) === 0) {
      const submissions = await ctx.db
        .query("submissions")
        .withIndex("by_team", (q) => q.eq("teamId", membership.teamId))
        .collect();
      for (const submission of submissions) {
        for (const attachment of submission.attachments) {
          await ctx.storage.delete(attachment.storageId);
        }
        await ctx.db.delete(submission._id);
      }
      await ctx.db.delete(membership.teamId);
    }
  },
});

export const listTeams = query({
  args: {},
  handler: async (ctx) => {
    const teams = await ctx.db.query("teams").order("desc").collect();
    return await Promise.all(
      teams.map(async (team) => ({
        id: team._id,
        name: team.name,
        track: team.track,
        memberCount: await teamMemberCount(ctx, team._id),
        maxSize: MAX_TEAM_SIZE,
      }))
    );
  },
});

export const myTeam = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const membership = await membershipFor(ctx, userId);
    if (!membership) return null;
    const team = await ctx.db.get(membership.teamId);
    if (!team) return null;
    const memberships = await ctx.db
      .query("memberships")
      .withIndex("by_team", (q) => q.eq("teamId", team._id))
      .collect();
    const members = await Promise.all(
      memberships.map(async (m) => {
        const user = await ctx.db.get(m.userId);
        return {
          id: m.userId,
          name: user?.name ?? user?.email ?? "Unknown",
          email: user?.email ?? "",
          isCreator: m.userId === team.createdBy,
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
    };
  },
});

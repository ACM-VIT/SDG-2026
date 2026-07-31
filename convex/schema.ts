import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

export default defineSchema({
  ...authTables,
  // Overrides the authTables users table to add the isAdmin flag.
  users: defineTable({
    name: v.optional(v.string()),
    image: v.optional(v.string()),
    email: v.optional(v.string()),
    emailVerificationTime: v.optional(v.number()),
    phone: v.optional(v.string()),
    phoneVerificationTime: v.optional(v.number()),
    isAnonymous: v.optional(v.boolean()),
    isAdmin: v.optional(v.boolean()),
  })
    .index("email", ["email"])
    .index("phone", ["phone"]),
  teams: defineTable({
    name: v.string(),
    track: v.optional(v.string()),
    inviteCode: v.string(),
    createdBy: v.id("users"),
  }).index("by_inviteCode", ["inviteCode"]),
  // Single-row table of global event settings.
  settings: defineTable({
    uploads: v.union(v.literal("open"), v.literal("closed")),
  }),
  memberships: defineTable({
    teamId: v.id("teams"),
    userId: v.id("users"),
  })
    .index("by_team", ["teamId"])
    .index("by_user", ["userId"]),
  submissions: defineTable({
    teamId: v.id("teams"),
    authorId: v.id("users"),
    title: v.string(),
    text: v.string(),
    attachments: v.array(
      v.object({
        storageId: v.id("_storage"),
        name: v.string(),
      })
    ),
  }).index("by_team", ["teamId"]),
});

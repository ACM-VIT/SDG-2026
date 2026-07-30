import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

export default defineSchema({
  ...authTables,
  teams: defineTable({
    name: v.string(),
    track: v.string(),
    inviteCode: v.string(),
    createdBy: v.id("users"),
  }).index("by_inviteCode", ["inviteCode"]),
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

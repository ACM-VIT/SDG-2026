import { v } from "convex/values";
import { mutation, query, QueryCtx } from "./_generated/server";
import { checkAdmin } from "./admin";

// Uploads default to open until an admin flips the switch.
export async function uploadsOpen(ctx: QueryCtx) {
  const settings = await ctx.db.query("settings").first();
  return (settings?.uploads ?? "open") === "open";
}

export const get = query({
  args: {},
  handler: async (ctx) => {
    const settings = await ctx.db.query("settings").first();
    return { uploads: settings?.uploads ?? ("open" as const) };
  },
});

export const setUploads = mutation({
  args: { uploads: v.union(v.literal("open"), v.literal("closed")) },
  handler: async (ctx, args) => {
    if (!(await checkAdmin(ctx))) throw new Error("Admins only");
    const settings = await ctx.db.query("settings").first();
    if (settings) {
      await ctx.db.patch(settings._id, { uploads: args.uploads });
    } else {
      await ctx.db.insert("settings", { uploads: args.uploads });
    }
  },
});

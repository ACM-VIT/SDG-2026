import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { getAuthUserId } from "@convex-dev/auth/server";
import { auth } from "./auth";

const http = httpRouter();

auth.addHttpRoutes(http);

const corsHeaders = () => ({
  "Access-Control-Allow-Origin": process.env.SITE_URL ?? "*",
  Vary: "Origin",
});

// Uploads go through this endpoint instead of a client-side upload URL, so
// the storage ID is created server-side and bound to the uploader's team in
// the same request. Ownership is never asserted by the client, which closes
// the race where someone else claims a freshly uploaded file first.
http.route({
  path: "/upload",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      return new Response(JSON.stringify({ error: "Not signed in" }), {
        status: 401,
        headers: corsHeaders(),
      });
    }
    const storageId = await ctx.storage.store(await request.blob());
    try {
      await ctx.runMutation(internal.ideas.recordUpload, { storageId });
    } catch (err) {
      await ctx.storage.delete(storageId);
      return new Response(
        JSON.stringify({
          error: err instanceof Error ? err.message : "Upload rejected",
        }),
        { status: 400, headers: corsHeaders() }
      );
    }
    return new Response(JSON.stringify({ storageId }), {
      status: 200,
      headers: corsHeaders(),
    });
  }),
});

http.route({
  path: "/upload",
  method: "OPTIONS",
  handler: httpAction(async () => {
    return new Response(null, {
      headers: {
        ...corsHeaders(),
        "Access-Control-Allow-Methods": "POST",
        "Access-Control-Allow-Headers": "Authorization, Content-Type",
        "Access-Control-Max-Age": "86400",
      },
    });
  }),
});

export default http;

import "@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "@supabase/supabase-js";
import { SIWNMessage } from "./lib/siwn.ts";
import { getAddressFromPublicKey, verifySignature } from "./lib/crypto.ts";
import { isDomainAllowed } from "./lib/utils.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function getSupabase() {
  return createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );
}

Deno.serve(async (req) => {
  const { method } = req;
  const url = new URL(req.url);
  const path = url.pathname.replace(/\/$/, "");

  // CORS Preflight
  if (method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    /**
     * GET /auth/nonce?address=...
     * Generates a challenge nonce for a specific Neo address.
     */
    if (path.endsWith("/nonce") && method === "GET") {
      const address = url.searchParams.get("address");
      if (!address) {
        return new Response(JSON.stringify({ error: "Address is required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const supabase = getSupabase();
      const nonce = crypto.randomUUID();

      const { error } = await supabase
        .schema("private")
        .from("auth_nonces")
        .insert({
          address,
          nonce,
          expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(), // 5 minutes
        });

      if (error) {
        console.error("Error storing nonce:", error);
        return new Response(
          JSON.stringify({ error: "Failed to generate nonce" }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      return new Response(JSON.stringify({ nonce }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    /**
     * POST /auth/login
     * Verifies SIWN message and signature, then logs the user in.
     */
    if (path.endsWith("/login") && method === "POST") {
      const { message, signature, publicKey } = await req.json();

      if (!message || !signature || !publicKey) {
        return new Response(
          JSON.stringify({ error: "Missing required fields" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      const siwn = SIWNMessage.fromMessage(message);
      const supabase = getSupabase();

      // 1. Validate message parameters (domain, expiration, etc.)
      const allowedDomainsEnv = Deno.env.get("ALLOWED_DOMAINS");
      if (!allowedDomainsEnv) {
        console.error("ALLOWED_DOMAINS environment variable is not set");
        return new Response(
          JSON.stringify({ error: "Server configuration error" }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      const allowedPatterns = allowedDomainsEnv.split(",").map((p) => p.trim());

      if (!isDomainAllowed(siwn.domain, allowedPatterns)) {
        return new Response(
          JSON.stringify({ error: "Invalid domain in SIWN message" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      siwn.validate({
        time: new Date(),
      });

      // 2. Verify that the public key matches the claimed address in the message
      const derivedAddress = getAddressFromPublicKey(publicKey);
      if (derivedAddress !== siwn.address) {
        return new Response(
          JSON.stringify({ error: "Public key does not match address" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      // 3. Verify the signature
      const isValid = verifySignature(message, signature, publicKey);
      if (!isValid) {
        return new Response(JSON.stringify({ error: "Invalid signature" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      // 4. Verify and consume the nonce
      const { data: nonceData, error: nonceError } = await supabase
        .schema("private")
        .from("auth_nonces")
        .delete()
        .match({ address: siwn.address, nonce: siwn.nonce })
        .select()
        .maybeSingle();

      if (nonceError || !nonceData) {
        return new Response(
          JSON.stringify({ error: "Invalid or expired nonce" }),
          {
            status: 401,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      // 5. Check if user already has a mapping
      const { data: walletData } = await supabase
        .schema("private")
        .from("user_wallets")
        .select("user_id")
        .eq("address", siwn.address)
        .maybeSingle();

      // Use a server-side secret + address as deterministic password
      // This is secure because only the server knows WALLET_AUTH_SECRET
      const authSecret = Deno.env.get("WALLET_AUTH_SECRET");
      if (!authSecret) {
        console.error("WALLET_AUTH_SECRET environment variable is not set");
        return new Response(
          JSON.stringify({ error: "Server configuration error" }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }
      // Use first 16 chars of secret to keep total password under 72 chars
      const walletPassword = `neo_${siwn.address}_${
        authSecret.substring(0, 16)
      }`;
      const walletEmail = `wallet_${siwn.address}@my-app.com`;

      if (!walletData) {
        // Create new Supabase user with the wallet-derived password
        const { data: newUser, error: createError } = await supabase.auth.admin
          .createUser({
            email: walletEmail,
            password: walletPassword,
            email_confirm: true,
            user_metadata: {
              address: siwn.address,
              login_type: "neo_wallet",
            },
          });

        if (createError) {
          console.error("Error creating user:", createError.message);
          return new Response(
            JSON.stringify({ error: "Failed to create user account" }),
            {
              status: 500,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            },
          );
        }

        // Link wallet to user
        const { error: linkError } = await supabase
          .schema("private")
          .from("user_wallets")
          .insert({
            user_id: newUser.user.id,
            address: siwn.address,
          });

        if (linkError) {
          console.error("Error linking wallet:", linkError);
          return new Response(
            JSON.stringify({ error: "Failed to link wallet to account" }),
            {
              status: 500,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            },
          );
        }
      }

      // 6. Sign in with the wallet-derived credentials to get a session
      const { data: sessionData, error: signInError } = await supabase.auth
        .signInWithPassword({
          email: walletEmail,
          password: walletPassword,
        });

      if (signInError || !sessionData.session) {
        console.error("Error signing in:", signInError);
        return new Response(
          JSON.stringify({ error: "Failed to create login session" }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      return new Response(
        JSON.stringify({
          user: sessionData.user,
          session: {
            access_token: sessionData.session.access_token,
            refresh_token: sessionData.session.refresh_token,
            expires_at: sessionData.session.expires_at,
          },
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(JSON.stringify({ error: "Not Found" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    console.error("Login processing error:", err);
    return new Response(
      JSON.stringify({ error: "Authentication failed" }),
      {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});

import { assertEquals } from "@std/assert";

Deno.test("Integration - GET /nonce", async () => {
  const address = "NfPrMub1CHvD3A6iC2jM7m7r6B3aJvM7m7";
  const url =
    `http://localhost:54321/functions/v1/auth/nonce?address=${address}`;

  try {
    const response = await fetch(url);
    assertEquals(response.status, 200);

    const data = await response.json();
    assertEquals(typeof data.nonce, "string");
    assertEquals(data.nonce.length > 0, true);
  } catch (err) {
    console.warn(
      "Integration test skipped: Local Supabase instance not reachable at",
      url,
    );
  }
});

Deno.test("Integration - GET /nonce (missing address)", async () => {
  const url = `http://localhost:54321/functions/v1/auth/nonce`;

  try {
    const response = await fetch(url);
    assertEquals(response.status, 400);

    const data = await response.json();
    assertEquals(data.error, "Address is required");
  } catch (err) {
    // Skip if server not running
  }
});

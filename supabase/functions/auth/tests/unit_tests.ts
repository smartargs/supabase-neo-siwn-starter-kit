import { assertEquals, assertThrows } from "@std/assert";
import { isDomainAllowed } from "../lib/utils.ts";
import { SIWNMessage } from "../lib/siwn.ts";
import { getAddressFromPublicKey } from "../lib/crypto.ts";

Deno.test("isDomainAllowed - exact match", () => {
  const allowedPatterns = ["example.com", "test.io"];
  assertEquals(isDomainAllowed("example.com", allowedPatterns), true);
  assertEquals(isDomainAllowed("test.io", allowedPatterns), true);
  assertEquals(isDomainAllowed("fail.com", allowedPatterns), false);
});

Deno.test("isDomainAllowed - subdomain wildcard", () => {
  const allowedPatterns = ["*.example.com"];
  assertEquals(isDomainAllowed("app.example.com", allowedPatterns), true);
  assertEquals(
    isDomainAllowed("nested.app.example.com", allowedPatterns),
    true,
  );
  assertEquals(isDomainAllowed("example.com", allowedPatterns), true);
  assertEquals(isDomainAllowed("other.com", allowedPatterns), false);
});

Deno.test("isDomainAllowed - port wildcard", () => {
  const allowedPatterns = ["localhost:*"];
  assertEquals(isDomainAllowed("localhost", allowedPatterns), true);
  assertEquals(isDomainAllowed("localhost:3000", allowedPatterns), true);
  assertEquals(isDomainAllowed("localhost:8080", allowedPatterns), true);
  assertEquals(isDomainAllowed("127.0.0.1", allowedPatterns), false);
});

Deno.test("SIWNMessage - prepare and parse", () => {
  const params = {
    domain: "localhost",
    address: "NfPrMub1CHvD3A6iC2jM7m7r6B3aJvM7m7",
    statement: "Sign in with your Neo account",
    uri: "http://localhost:3000",
    version: "1",
    chainId: 3,
    nonce: "test-nonce",
    issuedAt: "2026-02-19T11:00:00.000Z",
  };

  const siwn = new SIWNMessage(params);
  const message = siwn.prepareMessage();

  assertEquals(message.includes("localhost wants you to sign in"), true);
  assertEquals(message.includes("Nonce: test-nonce"), true);

  const parsed = SIWNMessage.fromMessage(message);
  assertEquals(parsed.domain, params.domain);
  assertEquals(parsed.address, params.address);
  assertEquals(parsed.nonce, params.nonce);
});

Deno.test("SIWNMessage - validate expiration", () => {
  const siwn = new SIWNMessage({
    domain: "localhost",
    address: "addr",
    statement: "stmt",
    uri: "uri",
    version: "1",
    chainId: 3,
    nonce: "nonce",
    issuedAt: "2026-02-19T11:00:00.000Z",
    expirationTime: "2026-02-19T11:05:00.000Z",
  });

  // Valid time
  siwn.validate({ time: new Date("2026-02-19T11:02:00.000Z") });

  // Expired
  assertThrows(
    () => siwn.validate({ time: new Date("2026-02-19T11:10:00.000Z") }),
    Error,
    "Message has expired",
  );
});

Deno.test("Crypto - getAddressFromPublicKey", () => {
  const pubKey =
    "0307077e6f8cc500ac6993a90324d553b49e095b3f114674384a62174621c7694f";
  const expectedAddr = "NWxZhS89HjdRw2ZushLjEZTdd51ErUFx6a";
  assertEquals(getAddressFromPublicKey(pubKey), expectedAddr);
});

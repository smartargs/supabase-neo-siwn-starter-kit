/**
 * Validates a domain against a list of allowed patterns.
 * Supports exact matches and wildcards (*.domain.com or domain.com:*).
 */
export function isDomainAllowed(
  domain: string,
  allowedPatterns: string[],
): boolean {
  return allowedPatterns.some((pattern) => {
    if (pattern.startsWith("*.")) {
      // Subdomain wildcard: *.my-domain.com matches app.my-domain.com
      const suffix = pattern.slice(1); // .my-domain.com
      return domain.endsWith(suffix) || domain === pattern.slice(2);
    } else if (pattern.endsWith(":*")) {
      // Port wildcard: localhost:* matches localhost:4200
      const prefix = pattern.slice(0, -2);
      return domain === prefix || domain.startsWith(prefix + ":");
    }
    return domain === pattern;
  });
}

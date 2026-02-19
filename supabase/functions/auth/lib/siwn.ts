export interface SIWNMessageParams {
  domain: string;
  address: string;
  statement: string;
  uri: string;
  version: string;
  chainId: number;
  nonce: string;
  issuedAt: string;
  expirationTime?: string;
}

export class SIWNMessage {
  domain: string;
  address: string;
  statement: string;
  uri: string;
  version: string;
  chainId: number;
  nonce: string;
  issuedAt: string;
  expirationTime?: string;

  constructor(params: SIWNMessageParams) {
    this.domain = params.domain;
    this.address = params.address;
    this.statement = params.statement;
    this.uri = params.uri;
    this.version = params.version;
    this.chainId = params.chainId;
    this.nonce = params.nonce;
    this.issuedAt = params.issuedAt;
    this.expirationTime = params.expirationTime;
  }

  /**
   * Generates the structured string to be signed.
   */
  prepareMessage(): string {
    const header = `${this.domain} wants you to sign in with your Neo account:`;
    const lines = [
      header,
      this.address,
      "",
      this.statement,
      "",
      `URI: ${this.uri}`,
      `Version: ${this.version}`,
      `Chain ID: ${this.chainId}`,
      `Nonce: ${this.nonce}`,
      `Issued At: ${this.issuedAt}`,
    ];

    if (this.expirationTime) {
      lines.push(`Expiration Time: ${this.expirationTime}`);
    }

    return lines.join("\n");
  }

  /**
   * Parses a SIWN message string back into an object.
   */
  static fromMessage(message: string): SIWNMessage {
    const lines = message.split("\n");

    const domainMatch = lines[0].match(
      /^(.+) wants you to sign in with your Neo account:$/,
    );
    if (!domainMatch) {
      throw new Error("Invalid SIWN message: Header missing or malformed");
    }

    const address = lines[1];
    const statement = lines[3]; // Skip blank line

    const params: Partial<SIWNMessageParams> = {
      domain: domainMatch[1],
      address,
      statement,
    };

    for (let i = 5; i < lines.length; i++) {
      const line = lines[i];
      if (!line) continue;

      const [key, ...valueParts] = line.split(": ");
      const value = valueParts.join(": ");

      switch (key) {
        case "URI":
          params.uri = value;
          break;
        case "Version":
          params.version = value;
          break;
        case "Chain ID":
          params.chainId = parseInt(value, 10);
          break;
        case "Nonce":
          params.nonce = value;
          break;
        case "Issued At":
          params.issuedAt = value;
          break;
        case "Expiration Time":
          params.expirationTime = value;
          break;
      }
    }

    return new SIWNMessage(params as SIWNMessageParams);
  }

  /**
   * Validates the message parameters.
   */
  validate(opts: { domain?: string; nonce?: string; time?: Date }): void {
    const now = opts.time || new Date();

    if (opts.domain && this.domain !== opts.domain) {
      throw new Error(
        `Domain mismatch: expected ${opts.domain}, got ${this.domain}`,
      );
    }

    if (opts.nonce && this.nonce !== opts.nonce) {
      throw new Error(
        `Nonce mismatch: expected ${opts.nonce}, got ${this.nonce}`,
      );
    }

    if (this.expirationTime && new Date(this.expirationTime) < now) {
      throw new Error("Message has expired");
    }

    if (new Date(this.issuedAt) > now) {
      throw new Error("Message issue time is in the future");
    }
  }
}

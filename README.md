# Supabase Neo N3 SIWN Starter Kit

A premium starter kit for building decentralized applications with **Supabase** and **Neo N3**. This kit implements a secure **Sign-In With Neo (SIWN)** flow, allowing users to authenticate using their Neo N3 wallets (e.g., NeoLine) and receive a standard Supabase Auth session.

## 🚀 Features

- **Sign-In With Neo (SIWN)**: Secure, message-based authentication following Neo N3 standards.
- **Nonce-based Security**: Challenge-response flow using ephemeral nonces to prevent replay attacks.
- **Deterministic User Mapping**: Automatically maps Neo addresses to Supabase Auth users using a secure, server-side secret.
- **Supabase Edge Functions**: Logic is encapsulated in a high-performance Deno-based Edge Function.
- **Private Schema Migration**: Securely manages nonces and wallet mappings in a `private` database schema.
- **Configurable Security**: Domain validation via `ALLOWED_DOMAINS` to prevent unauthorized usage.

## 📁 Project Structure

```text
.
├── supabase/
│   ├── functions/
│   │   └── auth/               # Deno Edge Function for SIWN
│   │       ├── lib/            # Auth logic (SIWN, Crypto, Utils)
│   │       ├── deno.json       # Deno configuration & dependencies
│   │       └── index.ts        # Main entry point for the auth API
│   └── migrations/             # Database schema migrations
```

## 🛠 Prerequisites

- [Supabase CLI](https://supabase.com/docs/guides/cli)
- [Docker](https://www.docker.com/) (required for running Supabase locally)
- A Neo N3 wallet (e.g., [NeoLine](https://neoline.io/))

## ⚙️ Setup Instructions

### 1. Initialize Supabase
If you haven't already, install the Supabase CLI and link your project:
```bash
supabase init
```

### 2. Configure Environment Variables
Create a `.env` file in the root directory and fill in the values:
```bash
# Create .env file
touch .env
```
- `ALLOWED_DOMAINS`: Comma-separated list of domains allowed to use the auth flow (e.g., `localhost:*,*.myapp.com`).
- `WALLET_AUTH_SECRET`: A long, random string used to deterministically generate passwords for wallet-based accounts. **Keep this secret!**

### 3. Deploy Migrations
Apply the database schema to your local or remote Supabase instance:
```bash
supabase db push
# OR for local development
supabase start
```

### 4. Set Secrets in Supabase
When deploying to production, ensure your secrets are set in the Supabase vault:
```bash
supabase secrets set ALLOWED_DOMAINS="your-domain.com"
supabase secrets set WALLET_AUTH_SECRET="your-very-long-secret"
```

## 🖥 Local Development

Start the Supabase backend and the auth Edge Function:

```bash
supabase start
supabase functions serve auth --no-verify-jwt --env-file .env
```

Your auth API will be available at `http://localhost:54321/functions/v1/auth`.

## 📡 API Reference

### `GET /nonce?address=<neo-address>`
Generates a unique, ephemeral challenge nonce for a specific Neo address.
- **Returns**: `{ "nonce": "uuid" }`

### `POST /login`
Verifies the signed message and logs the user in.
- **Body**: `{ "message": "raw-siwn-message", "signature": "hex", "publicKey": "hex" }`
- **Returns**: A Supabase User object and Session (including `access_token` and `refresh_token`).

## 🌐 Frontend Integration

To integrate this flow into your frontend, follow these simplified steps using the [NeoLine N3 API](https://tutorial.neoline.io/reference/neo3-provider-api).

### 1. Get User Address
```javascript
const account = await neoline.getAccount();
const address = account.address;
```

### 2. Fetch Nonce
```javascript
const { nonce } = await fetch(`${edgeUrl}/auth/nonce?address=${address}`).then(res => res.json());
```

### 3. Sign SIWN Message
Construct the structured message and sign it using NeoLine:
```javascript
const domain = window.location.host;
const statement = 'Sign in with your Neo wallet.';
const issuedAt = new Date().toISOString();

const message = `${domain} wants you to sign in with your Neo account:
${address}

${statement}

URI: ${window.location.origin}
Version: 1
Chain ID: 3
Nonce: ${nonce}
Issued At: ${issuedAt}`;

const signed = await neoline.signMessageWithoutSaltV2({ message });
// signed contains { data: "signature-hex", publicKey: "compressed-pubkey-hex" }
```

### 4. Authenticate & Set Session
```javascript
const { session } = await fetch(`${edgeUrl}/auth/login`, {
  method: 'POST',
  body: JSON.stringify({
    message,
    signature: signed.data,
    publicKey: signed.publicKey
  })
}).then(res => res.json());

// Finalize Supabase session
const { error } = await supabase.auth.setSession({
  access_token: session.access_token,
  refresh_token: session.refresh_token
});
```

## ⚙️ How it Works

The backend follows a strict verification pipeline to ensure the authenticity of the Neo wallet holder.

### 1. Challenge Generation (`/nonce`)
- Generates a cryptographically secure `UUID` (nonce).
- Stores the nonce in the `private.auth_nonces` table, mapped to the user's Neo address.
- Sets a short expiration time (5 minutes) to prevent long-term replay attacks.

### 2. Verification Pipeline (`/login`)
When a user submits their signed message, the Edge Function performs the following checks:

1.  **Domain Validation**: Compares the `domain` inside the SIWN message against your `ALLOWED_DOMAINS` env variable.
2.  **Public Key Matching**: Derives the Neo address from the provided `publicKey` and ensures it matches the `address` claimed in the SIWN message.
3.  **Signature Verification**: 
    - Reconstructs the raw message string.
    - Applies `n3MessageFormat` (mimicking a Neo N3 transaction wrapper).
    - Verifies the signature using the user's public key.
4.  **Nonce Consumption**: Deletes the matching nonce from `private.auth_nonces`. If the nonce was already used or doesn't exist, the login fails.

### 3. Session Management
Once verified, the backend handles Supabase Auth:
- **Deterministic Identity**: Uses `WALLET_AUTH_SECRET` + the Neo address to generate a consistent, secure password.
- **Auto-Provisioning**: If the user doesn't exist, it uses `auth.admin.createUser` to create a new Supabase Auth account.
- **Login**: Calls `signInWithPassword` with the derived credentials and returns the JWT session to the frontend.

## 🛡 Security Notes

- **Deterministic Passwords**: This kit uses `WALLET_AUTH_SECRET` + the Neo address to create a deterministic password for Supabase Auth. Since only your server knows the secret, the password cannot be reverse-engineered by users.
- **CORS**: The function includes standard CORS headers. Ensure your frontend is listed in `ALLOWED_DOMAINS` to pass the domain validation check.
- **Private Schema**: Nonces and wallet mappings are stored in a `private` schema. By default, these tables are not exposed via PostgREST (Supabase's auto-generated API), adding an extra layer of security.

## 📜 License

MIT

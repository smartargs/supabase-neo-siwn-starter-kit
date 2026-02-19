-- Wallet Authentication System

-- Table to map Neo addresses to Supabase auth users
CREATE TABLE private.user_wallets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    address TEXT NOT NULL UNIQUE,
    provider TEXT NOT NULL DEFAULT 'neoline',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for address lookups
CREATE INDEX idx_user_wallets_address ON private.user_wallets(address);

-- Table to manage ephemeral nonces for the SIWN flow
CREATE TABLE private.auth_nonces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    address TEXT NOT NULL,
    nonce TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for nonce verification and cleanup
CREATE INDEX idx_auth_nonces_address_nonce ON private.auth_nonces(address, nonce);
CREATE INDEX idx_auth_nonces_expires_at ON private.auth_nonces(expires_at);


-- RLS
ALTER TABLE private.user_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.auth_nonces ENABLE ROW LEVEL SECURITY;


-- Cleanup function for expired nonces
CREATE OR REPLACE FUNCTION private.cleanup_expired_nonces()
RETURNS void AS $$
BEGIN
    DELETE FROM private.auth_nonces WHERE expires_at < now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = private;

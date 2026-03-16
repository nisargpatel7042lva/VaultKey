use anchor_lang::prelude::*;

/// PDA storing global vault configuration and accounting.
#[account]
pub struct VaultState {
    pub admin: Pubkey,        // 32
    pub vk_usdc_mint: Pubkey, // 32 — vkUSDC mint (Token-2022 with transfer hook)
    pub usdc_vault: Pubkey,   // 32 — vault's USDC token account
    pub total_assets: u64,    //  8 — total USDC (lamports) held
    pub total_shares: u64,    //  8 — total vkUSDC minted
    pub nav_per_share: u64,   //  8 — USDC lamports per share (1e6 initial)
    pub vasp_did: String,     // 64 — "did:web:vaultkey.finance" or similar
    pub bump: u8,             //  1
}

impl VaultState {
    pub const SEED_PREFIX: &'static [u8] = b"vault_state";

    // Rough size: 32 + 32 + 32 + 8 + 8 + 8 + 64 + 1
    pub const SIZE: usize = 32 + 32 + 32 + 8 + 8 + 8 + 64 + 1;
}

use anchor_lang::prelude::*;

#[account]
pub struct VaultState {
    pub admin: Pubkey,        // 32
    pub vk_usdc_mint: Pubkey, // 32 — the vkUSDC token mint
    pub usdc_vault: Pubkey,   // 32 — vault's USDC token account
    pub total_assets: u64,    // 8  — total USDC held
    pub total_shares: u64,    // 8  — total vkUSDC minted
    pub nav_per_share: u64,   // 8  — USDC lamports per share (starts at 1_000_000)
    pub vasp_did: String,     // 64 — "did:web:vaultkey.finance" for Travel Rule
    pub bump: u8,             // 1
}

impl VaultState {
    // Anchor stores a String as a 4-byte length prefix + bytes.
    // We provision 64 bytes for the DID string.
    pub const VASP_DID_MAX_LEN: usize = 64;

    pub const SIZE: usize = 32 + 32 + 32 + 8 + 8 + 8 + 4 + Self::VASP_DID_MAX_LEN + 1;
}


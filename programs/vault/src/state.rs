use anchor_lang::prelude::*;

/// PDA storing global vault configuration and accounting.
#[account]
pub struct VaultState {
    pub admin: Pubkey,        // 32
    pub vk_usdc_mint: Pubkey, // 32 — vkUSDC mint (Token-2022 with transfer hook)
    pub usdc_vault: Pubkey,   // 32 — vault's USDC token account
    pub total_assets: u64,    //  8
    pub total_shares: u64,    //  8
    pub nav_per_share: u64,   //  8
    pub vasp_did: String,     // borsh: 4-byte len + bytes (max 64 in account space)
    pub bump: u8,             //  1
}

impl VaultState {
    pub const SEED_PREFIX: &'static [u8] = b"vault_state";

    /// Anchor `String` in accounts: 4-byte length prefix + up to max_len bytes.
    pub const VASP_DID_MAX_LEN: usize = 64;

    pub const SIZE: usize = 32 + 32 + 32 + 8 + 8 + 8 + 4 + Self::VASP_DID_MAX_LEN + 1;
}

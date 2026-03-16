use anchor_lang::prelude::*;

/// Emitted on every deposit and withdrawal — backend listens to these.
#[event]
pub struct KytEvent {
    pub wallet: Pubkey,
    pub amount_usdc: u64,
    /// 0 = deposit, 1 = withdraw
    pub direction: u8,
    /// 0=LOW, 1=MEDIUM, 2=HIGH (mocked: HIGH if >10k)
    pub risk_tier: u8,
    pub timestamp: i64,
}

/// Emitted on withdrawals above $3000 USDC (3_000_000_000 with 6 decimals).
#[event]
pub struct TravelRuleEvent {
    pub sender_wallet: Pubkey,
    pub sender_vasp: String,
    pub amount_usdc: u64,
    pub timestamp: i64,
    /// First 8 chars of tx signature (mocked/placeholder on-chain).
    pub tx_ref: String,
}

use anchor_lang::prelude::*;

// Emitted on every deposit and withdrawal — backend listens to these.
#[event]
pub struct KytEvent {
    pub wallet: Pubkey,
    pub amount_usdc: u64,
    pub direction: u8,  // 0 = deposit, 1 = withdraw
    pub risk_tier: u8,  // 0=LOW, 1=MEDIUM, 2=HIGH (mocked off-chain)
    pub timestamp: i64,
}

// Emitted on withdrawals above $3000 USDC (3_000_000_000 with 6 decimals).
#[event]
pub struct TravelRuleEvent {
    pub sender_wallet: Pubkey,
    pub sender_vasp: String, // e.g. "did:web:vaultkey.finance"
    pub amount_usdc: u64,
    pub timestamp: i64,
    pub tx_ref: String,      // first 8 chars of tx signature (set off-chain)
}


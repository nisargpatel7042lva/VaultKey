use anchor_lang::prelude::*;

// Placeholder. Anchor will overwrite this on `anchor keys sync` / deploy.
declare_id!("11111111111111111111111111111111");

#[program]
pub mod kyc_registry {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        let config = &mut ctx.accounts.config;
        config.admin = ctx.accounts.admin.key();
        config.bump = *ctx.bumps.get("config").unwrap();
        Ok(())
    }

    pub fn issue_credential(
        ctx: Context<IssueCredential>,
        tier: u8,
        expiry_days: u16,
    ) -> Result<()> {
        let config = &ctx.accounts.config;
        let admin = &ctx.accounts.admin;
        require_keys_eq!(config.admin, admin.key(), KycRegistryError::NotAdmin);

        let credential = &mut ctx.accounts.credential;

        // If this PDA was already initialized, prevent re-issuing.
        require!(
            credential.issued_at == 0,
            KycRegistryError::AlreadyIssued
        );

        let clock = Clock::get()?;
        let now = clock.unix_timestamp;
        let expiry = now
            .checked_add(expiry_days as i64 * 86_400)
            .ok_or(KycRegistryError::ExpiryOverflow)?;

        credential.wallet = ctx.accounts.wallet.key();
        credential.tier = tier;
        credential.issued_at = now;
        credential.expiry = expiry;
        credential.aml_cleared = true;
        credential.bump = *ctx.bumps.get("credential").unwrap();

        Ok(())
    }

    pub fn revoke_credential(ctx: Context<RevokeCredential>) -> Result<()> {
        let config = &ctx.accounts.config;
        let admin = &ctx.accounts.admin;
        require_keys_eq!(config.admin, admin.key(), KycRegistryError::NotAdmin);

        let credential = &mut ctx.accounts.credential;

        // Basic sanity check; if somehow uninitialized, surface a clearer error.
        require!(
            credential.issued_at != 0,
            KycRegistryError::CredentialNotFound
        );

        credential.aml_cleared = false;
        Ok(())
    }
}

// --------------------------------
// Accounts
// --------------------------------

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        init,
        payer = admin,
        space = 8 + KycRegistryConfig::SIZE,
        seeds = [b"kyc_registry_config"],
        bump
    )]
    pub config: Account<'info, KycRegistryConfig>,

    #[account(mut)]
    pub admin: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct IssueCredential<'info> {
    #[account(
        mut,
        seeds = [b"kyc_registry_config"],
        bump = config.bump
    )]
    pub config: Account<'info, KycRegistryConfig>,

    #[account(mut)]
    pub admin: Signer<'info>,

    /// The wallet being KYC-verified. Can be any system account.
    #[account()]
    pub wallet: SystemAccount<'info>,

    #[account(
        init_if_needed,
        payer = admin,
        space = 8 + KycCredential::SIZE,
        seeds = [b"kyc", wallet.key().as_ref()],
        bump
    )]
    pub credential: Account<'info, KycCredential>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct RevokeCredential<'info> {
    #[account(
        mut,
        seeds = [b"kyc_registry_config"],
        bump = config.bump
    )]
    pub config: Account<'info, KycRegistryConfig>,

    #[account(mut)]
    pub admin: Signer<'info>,

    /// The wallet whose credential is being revoked.
    #[account()]
    pub wallet: SystemAccount<'info>,

    #[account(
        mut,
        seeds = [b"kyc", wallet.key().as_ref()],
        bump = credential.bump
    )]
    pub credential: Account<'info, KycCredential>,
}

// --------------------------------
// State
// --------------------------------

#[account]
pub struct KycRegistryConfig {
    pub admin: Pubkey, // 32
    pub bump: u8,      // 1
}

impl KycRegistryConfig {
    pub const SIZE: usize = 32 + 1;
}

#[account]
pub struct KycCredential {
    pub wallet: Pubkey,   // 32 — the verified wallet
    pub tier: u8,         //  1 — 1=retail-qualified, 2=institutional
    pub issued_at: i64,   //  8 — unix timestamp
    pub expiry: i64,      //  8 — unix timestamp
    pub aml_cleared: bool, //  1 — false = AML flagged
    pub bump: u8,         //  1
}

impl KycCredential {
    pub const SIZE: usize = 32 + 1 + 8 + 8 + 1 + 1;
}

// --------------------------------
// Errors
// --------------------------------

#[error_code]
pub enum KycRegistryError {
    #[msg("Caller is not the admin")]
    NotAdmin,

    #[msg("KYC credential already issued for this wallet")]
    AlreadyIssued,

    #[msg("KYC credential not found")]
    CredentialNotFound,

    #[msg("Expiry calculation overflowed")]
    ExpiryOverflow,
}


use anchor_lang::prelude::*;

// Placeholder. Anchor will overwrite this on `anchor keys sync` / deploy.
declare_id!("11111111111111111111111111111111");

/// Program 2: transfer_hook
///
/// Enforces KYC compliance on every vkUSDC transfer via the Token-2022 transfer hook.
///
/// Notes:
/// - `initialize_extra_account_meta_list` is called once (per mint) to register the
///   extra accounts that must be passed to the hook, including the recipient's
///   `KycCredential` PDA from the `kyc_registry` program.
/// - `transfer_hook` is invoked automatically by the token-2022 program during
///   any transfer that has this hook configured on the mint.
#[program]
pub mod transfer_hook {
    use super::*;

    /// One-time initialization to store the KYC registry program id and vault mint
    /// configuration. The actual registration of the extra account meta list with
    /// the Token-2022 program is performed off-chain using this config.
    pub fn initialize_extra_account_meta_list(
        ctx: Context<InitializeExtraAccountMetaList>,
        kyc_registry_program: Pubkey,
    ) -> Result<()> {
        let cfg = &mut ctx.accounts.config;
        cfg.admin = ctx.accounts.admin.key();
        cfg.kyc_registry_program = kyc_registry_program;
        cfg.bump = *ctx.bumps.get("config").unwrap();
        Ok(())
    }

    /// Transfer hook entrypoint.
    ///
    /// This is called by the Token-2022 program during a transfer that has this
    /// hook configured. We expect the recipient's `KycCredential` PDA to be
    /// passed in via the extra accounts list.
    pub fn transfer_hook(ctx: Context<TransferHook>, _amount: u64) -> Result<()> {
        let cfg = &ctx.accounts.config;

        // Ensure the credential PDA is derived using the configured kyc_registry program id
        // and the recipient wallet address. This mirrors the seeds used in the kyc_registry
        // program: ["kyc", wallet.key().as_ref()].
        let recipient_wallet = ctx.accounts.recipient_wallet.key();
        let (expected_pda, _bump) = Pubkey::find_program_address(
            &[b"kyc", recipient_wallet.as_ref()],
            &cfg.kyc_registry_program,
        );

        require_keys_eq!(
            expected_pda,
            ctx.accounts.credential.key(),
            TransferHookError::NotKyced
        );

        let credential = &ctx.accounts.credential;

        // Check expiry
        let clock = Clock::get()?;
        require!(
            credential.expiry > clock.unix_timestamp,
            TransferHookError::CredentialExpired
        );

        // Check AML flag
        require!(
            credential.aml_cleared,
            TransferHookError::AmlFlagged
        );

        Ok(())
    }
}

// --------------------------------
// Accounts
// --------------------------------

#[derive(Accounts)]
pub struct InitializeExtraAccountMetaList<'info> {
    #[account(
        init,
        payer = admin,
        space = 8 + TransferHookConfig::SIZE,
        seeds = [b"transfer_hook_config"],
        bump
    )]
    pub config: Account<'info, TransferHookConfig>,

    #[account(mut)]
    pub admin: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct TransferHook<'info> {
    #[account(
        seeds = [b"transfer_hook_config"],
        bump = config.bump
    )]
    pub config: Account<'info, TransferHookConfig>,

    /// CHECK: The Token-2022 program passes in the recipient wallet as a plain account.
    pub recipient_wallet: UncheckedAccount<'info>,

    /// The recipient's KycCredential PDA from the kyc_registry program.
    /// Seeds (in kyc_registry): ["kyc", wallet.key().as_ref()]
    /// We derive and check this PDA in the instruction logic.
    #[account()]
    pub credential: Account<'info, KycCredential>,
}

// --------------------------------
// State
// --------------------------------

#[account]
pub struct TransferHookConfig {
    pub admin: Pubkey,            // 32
    pub kyc_registry_program: Pubkey, // 32
    pub bump: u8,                 // 1
}

impl TransferHookConfig {
    pub const SIZE: usize = 32 + 32 + 1;
}

/// Minimal mirror of the `KycCredential` account from the kyc_registry program.
/// We only need the fields required for validation in the hook.
#[account]
pub struct KycCredential {
    pub wallet: Pubkey,    // 32
    pub tier: u8,          // 1
    pub issued_at: i64,    // 8
    pub expiry: i64,       // 8
    pub aml_cleared: bool, // 1
    pub bump: u8,          // 1
}

// --------------------------------
// Errors
// --------------------------------

#[error_code]
pub enum TransferHookError {
    #[msg("Recipient wallet is not KYC verified")]
    NotKyced,

    #[msg("KYC credential has expired")]
    CredentialExpired,

    #[msg("Wallet has been AML flagged")]
    AmlFlagged,
}


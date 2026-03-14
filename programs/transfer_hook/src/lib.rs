use anchor_lang::{
    prelude::*,
    system_program::{create_account, CreateAccount},
};
use anchor_spl::token_interface::{Mint, TokenAccount, TokenInterface};
use spl_tlv_account_resolution::{
    account::ExtraAccountMeta,
    seeds::Seed,
    state::ExtraAccountMetaList,
};
use spl_transfer_hook_interface::instruction::{ExecuteInstruction, TransferHookInstruction};

// Placeholder. Anchor will overwrite this on `anchor keys sync` / deploy.
declare_id!("11111111111111111111111111111111");

// Indices used by the ExtraAccountMeta configuration in the Execute accounts list.
// 0: source_token
// 1: mint
// 2: destination_token
// 3: owner
// 4: extra_account_meta_list
// 5: kyc_registry_program
// 6+: extra accounts resolved from ExtraAccountMetaList (e.g. KycCredential)
const OWNER_ACCOUNT_INDEX: u8 = 3;
const KYC_REGISTRY_PROGRAM_INDEX: u8 = 5;

/// Program 2: transfer_hook
///
/// Enforces KYC compliance on every vkUSDC transfer via the Token-2022 transfer hook.
#[program]
pub mod transfer_hook {
    use super::*;
    use anchor_lang::solana_program::program_error::ProgramError;

    /// One-time initialization per mint to create and populate the
    /// ExtraAccountMetaList (validation) account.
    ///
    /// This registers the recipient's `KycCredential` PDA (owned by the
    /// `kyc_registry` program) as a required extra account:
    ///   PDA seeds = ["kyc", recipient_wallet.key().as_ref()]
    pub fn initialize_extra_account_meta_list(
        ctx: Context<InitializeExtraAccountMetaList>,
    ) -> Result<()> {
        // Describe the KycCredential PDA using dynamic seeds:
        // - literal "kyc"
        // - owner wallet pubkey (account index = OWNER_ACCOUNT_INDEX)
        let seeds = [
            Seed::Literal {
                bytes: b"kyc".to_vec(),
            },
            Seed::AccountKey {
                index: OWNER_ACCOUNT_INDEX,
            },
        ];

        let metas = vec![ExtraAccountMeta::new_external_pda_with_seeds(
            KYC_REGISTRY_PROGRAM_INDEX,
            &seeds,
            false, // is_signer
            false, // is_writable
        )?];

        let account_size = ExtraAccountMetaList::size_of(metas.len())? as u64;
        let lamports = Rent::get()?.minimum_balance(account_size as usize);

        let mint = ctx.accounts.mint.key();
        let signer_seeds: &[&[&[u8]]] = &[&[
            b"extra-account-metas",
            mint.as_ref(),
            &[ctx.bumps.extra_account_meta_list],
        ]];

        // Create the ExtraAccountMetaList PDA account owned by this program.
        create_account(
            CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                CreateAccount {
                    from: ctx.accounts.payer.to_account_info(),
                    to: ctx.accounts.extra_account_meta_list.to_account_info(),
                },
            )
            .with_signer(signer_seeds),
            lamports,
            account_size,
            ctx.program_id,
        )?;

        // Initialize its TLV data with our extra account meta configuration.
        ExtraAccountMetaList::init::<ExecuteInstruction>(
            &mut ctx
                .accounts
                .extra_account_meta_list
                .try_borrow_mut_data()?,
            &metas,
        )?;

        Ok(())
    }

    /// Transfer hook entrypoint.
    ///
    /// This is called automatically by the Token-2022 program's `Execute`
    /// instruction for mints configured with this hook.
    pub fn transfer_hook(ctx: Context<TransferHook>, _amount: u64) -> Result<()> {
        // The recipient is the owner of the destination token account.
        let recipient_wallet = ctx.accounts.destination_token.owner;
        let (expected_pda, _bump) = Pubkey::find_program_address(
            &[b"kyc", recipient_wallet.as_ref()],
            &ctx.accounts.kyc_registry_program.key(),
        );

        require_keys_eq!(
            expected_pda,
            ctx.accounts.credential.key(),
            TransferHookError::NotKyced
        );

        let credential = &ctx.accounts.credential;
        let clock = Clock::get()?;

        require!(
            credential.expiry > clock.unix_timestamp,
            TransferHookError::CredentialExpired
        );
        require!(credential.aml_cleared, TransferHookError::AmlFlagged);

        Ok(())
    }

    /// Fallback handler so the SPL Token-2022 program can call this program's
    /// transfer hook via the standard transfer-hook interface.
    pub fn fallback<'info>(
        program_id: &Pubkey,
        accounts: &'info [AccountInfo<'info>],
        data: &[u8],
    ) -> Result<()> {
        let instruction = TransferHookInstruction::unpack(data)
            .map_err(|_| ProgramError::InvalidInstructionData)?;

        match instruction {
            TransferHookInstruction::Execute { amount } => {
                let amount_bytes = amount.to_le_bytes();
                __private::__global::transfer_hook(program_id, accounts, &amount_bytes)
            }
            _ => Err(ProgramError::InvalidInstructionData.into()),
        }
    }
}

// --------------------------------
// Accounts
// --------------------------------

#[derive(Accounts)]
pub struct InitializeExtraAccountMetaList<'info> {
    /// Payer funding the ExtraAccountMetaList PDA creation.
    #[account(mut)]
    pub payer: Signer<'info>,

    /// CHECK: ExtraAccountMetaList PDA for this mint.
    #[account(
        mut,
        seeds = [b"extra-account-metas", mint.key().as_ref()],
        bump
    )]
    pub extra_account_meta_list: AccountInfo<'info>,

    /// The Token-2022 mint protected by this hook.
    pub mint: InterfaceAccount<'info, Mint>,

    /// CHECK: kyc_registry program; only its pubkey is used when resolving
    /// the external PDA for `KycCredential`.
    pub kyc_registry_program: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

/// Accounts passed to the transfer-hook `Execute` instruction.
///
/// Indices (referenced by OWNER_ACCOUNT_INDEX and KYC_REGISTRY_PROGRAM_INDEX):
/// 0: source_token
/// 1: mint
/// 2: destination_token
/// 3: owner
/// 4: extra_account_meta_list
/// 5: kyc_registry_program
/// 6: credential (resolved from ExtraAccountMetaList)
#[derive(Accounts)]
pub struct TransferHook<'info> {
    #[account(
        token::mint = mint,
        token::authority = owner,
    )]
    pub source_token: InterfaceAccount<'info, TokenAccount>,

    pub mint: InterfaceAccount<'info, Mint>,

    #[account(
        token::mint = mint,
    )]
    pub destination_token: InterfaceAccount<'info, TokenAccount>,

    /// CHECK: Owner of the source token account.
    pub owner: UncheckedAccount<'info>,

    /// CHECK: ExtraAccountMetaList PDA.
    #[account(
        seeds = [b"extra-account-metas", mint.key().as_ref()],
        bump
    )]
    pub extra_account_meta_list: UncheckedAccount<'info>,

    /// CHECK: kyc_registry program id, used when deriving the KycCredential PDA.
    pub kyc_registry_program: UncheckedAccount<'info>,

    /// Recipient's KycCredential PDA from the kyc_registry program.
    pub credential: Account<'info, KycCredential>,

    /// CHECK: Token-2022 program; currently unused, but included for future-proofing.
    pub token_program: Interface<'info, TokenInterface>,
}

// --------------------------------
// State
// --------------------------------

/// Minimal mirror of the `KycCredential` account from the kyc_registry program.
#[account]
pub struct KycCredential {
    pub wallet: Pubkey,
    pub tier: u8,
    pub issued_at: i64,
    pub expiry: i64,
    pub aml_cleared: bool,
    pub bump: u8,
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


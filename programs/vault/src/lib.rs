use anchor_lang::prelude::*;
use anchor_spl::token_interface::{
    burn, mint_to, transfer_checked, Burn, Mint, MintTo, TokenAccount, TokenInterface,
    TransferChecked,
};

mod errors;
mod events;
mod state;

use errors::VaultError;
use events::{KytEvent, TravelRuleEvent};
use state::VaultState;

// Placeholder. Anchor will overwrite this on `anchor keys sync` / deploy.
declare_id!("11111111111111111111111111111111");

const DECIMALS: u8 = 6;
const TRAVEL_RULE_THRESHOLD: u64 = 3_000_000_000; // 3000 USDC with 6 decimals

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

#[program]
pub mod vault {
    use super::*;

    /// Initialize the vault state.
    ///
    /// Assumes vkUSDC mint and the vault USDC token account exist and are passed in.
    pub fn initialize_vault(ctx: Context<InitializeVault>, vasp_did: String) -> Result<()> {
        let state = &mut ctx.accounts.vault_state;

        state.admin = ctx.accounts.admin.key();
        state.vk_usdc_mint = ctx.accounts.vk_usdc_mint.key();
        state.usdc_vault = ctx.accounts.usdc_vault.key();
        state.total_assets = 0;
        state.total_shares = 0;
        state.nav_per_share = 1_000_000;
        state.vasp_did = vasp_did;
        state.bump = *ctx.bumps.get("vault_state").unwrap();

        Ok(())
    }

    /// Deposit USDC and receive vkUSDC shares.
    pub fn deposit_usdc(ctx: Context<DepositUsdc>, amount: u64) -> Result<()> {
        require!(amount > 0, VaultError::BelowMinDeposit);

        validate_credential(&ctx.accounts.credential, &ctx.accounts.investor.key())?;

        let state = &mut ctx.accounts.vault_state;
        let clock = Clock::get()?;

        let shares = if state.total_shares == 0 || state.total_assets == 0 {
            amount
        } else {
            (amount as u128)
                .checked_mul(state.total_shares as u128)
                .and_then(|n| n.checked_div(state.total_assets as u128))
                .ok_or(VaultError::ComplianceFailed)? as u64
        };
        require!(shares > 0, VaultError::ComplianceFailed);

        // Transfer USDC in using the USDC token program (often legacy Tokenkeg on devnet).
        transfer_checked(
            CpiContext::new(
                ctx.accounts.usdc_token_program.to_account_info(),
                TransferChecked {
                    from: ctx.accounts.investor_usdc_ata.to_account_info(),
                    to: ctx.accounts.usdc_vault.to_account_info(),
                    mint: ctx.accounts.usdc_mint.to_account_info(),
                    authority: ctx.accounts.investor.to_account_info(),
                },
            ),
            amount,
            DECIMALS,
        )?;

        // Mint vkUSDC shares using the vkUSDC token program (Token-2022).
        mint_to(
            CpiContext::new(
                ctx.accounts.vk_token_program.to_account_info(),
                MintTo {
                    mint: ctx.accounts.vk_usdc_mint.to_account_info(),
                    to: ctx.accounts.investor_vk_usdc_ata.to_account_info(),
                    authority: ctx.accounts.vault_state.to_account_info(),
                },
            )
            .with_signer(&[&[VaultState::SEED_PREFIX, &[state.bump]]]),
            shares,
        )?;

        state.total_assets = state
            .total_assets
            .checked_add(amount)
            .ok_or(VaultError::ComplianceFailed)?;
        state.total_shares = state
            .total_shares
            .checked_add(shares)
            .ok_or(VaultError::ComplianceFailed)?;

        emit!(KytEvent {
            wallet: ctx.accounts.investor.key(),
            amount_usdc: amount,
            direction: 0,
            risk_tier: kyt_risk_tier(amount),
            timestamp: clock.unix_timestamp,
        });

        Ok(())
    }

    /// Burn vkUSDC shares in exchange for USDC.
    pub fn withdraw_usdc(ctx: Context<WithdrawUsdc>, shares: u64) -> Result<()> {
        require!(shares > 0, VaultError::InsufficientShares);

        validate_credential(&ctx.accounts.credential, &ctx.accounts.investor.key())?;

        let state = &mut ctx.accounts.vault_state;
        let clock = Clock::get()?;
        require!(state.total_shares > 0, VaultError::InsufficientShares);

        let usdc_out = (shares as u128)
            .checked_mul(state.total_assets as u128)
            .and_then(|n| n.checked_div(state.total_shares as u128))
            .ok_or(VaultError::ComplianceFailed)? as u64;
        require!(usdc_out > 0, VaultError::ComplianceFailed);

        // Burn vkUSDC via Token-2022.
        burn(
            CpiContext::new(
                ctx.accounts.vk_token_program.to_account_info(),
                Burn {
                    mint: ctx.accounts.vk_usdc_mint.to_account_info(),
                    from: ctx.accounts.investor_vk_usdc_ata.to_account_info(),
                    authority: ctx.accounts.investor.to_account_info(),
                },
            ),
            shares,
        )?;

        // Transfer USDC out via the USDC token program.
        transfer_checked(
            CpiContext::new(
                ctx.accounts.usdc_token_program.to_account_info(),
                TransferChecked {
                    from: ctx.accounts.usdc_vault.to_account_info(),
                    to: ctx.accounts.investor_usdc_ata.to_account_info(),
                    mint: ctx.accounts.usdc_mint.to_account_info(),
                    authority: ctx.accounts.vault_state.to_account_info(),
                },
            )
            .with_signer(&[&[VaultState::SEED_PREFIX, &[state.bump]]]),
            usdc_out,
            DECIMALS,
        )?;

        state.total_assets = state
            .total_assets
            .checked_sub(usdc_out)
            .ok_or(VaultError::ComplianceFailed)?;
        state.total_shares = state
            .total_shares
            .checked_sub(shares)
            .ok_or(VaultError::ComplianceFailed)?;

        emit!(KytEvent {
            wallet: ctx.accounts.investor.key(),
            amount_usdc: usdc_out,
            direction: 1,
            risk_tier: kyt_risk_tier(usdc_out),
            timestamp: clock.unix_timestamp,
        });

        if usdc_out >= TRAVEL_RULE_THRESHOLD {
            emit!(TravelRuleEvent {
                sender_wallet: ctx.accounts.investor.key(),
                sender_vasp: state.vasp_did.clone(),
                amount_usdc: usdc_out,
                timestamp: clock.unix_timestamp,
                tx_ref: "00000000".to_string(),
            });
        }

        Ok(())
    }

    /// Mock yield harvesting — admin sets a new nav_per_share.
    pub fn harvest_yield(ctx: Context<HarvestYield>, new_nav: u64) -> Result<()> {
        let state = &mut ctx.accounts.vault_state;
        require_keys_eq!(state.admin, ctx.accounts.admin.key(), VaultError::NotAdmin);
        require!(new_nav > 0, VaultError::ComplianceFailed);
        state.nav_per_share = new_nav;
        Ok(())
    }

    /// Admin-only config update (currently only vasp_did is mutable).
    pub fn update_vault_config(
        ctx: Context<UpdateVaultConfig>,
        new_vasp_did: String,
    ) -> Result<()> {
        let state = &mut ctx.accounts.vault_state;
        require_keys_eq!(state.admin, ctx.accounts.admin.key(), VaultError::NotAdmin);
        state.vasp_did = new_vasp_did;
        Ok(())
    }
}

fn validate_credential(credential: &KycCredential, wallet: &Pubkey) -> Result<()> {
    let clock = Clock::get()?;
    require_keys_eq!(credential.wallet, *wallet, VaultError::NotKyced);
    require!(
        credential.expiry > clock.unix_timestamp,
        VaultError::CredentialExpired
    );
    require!(credential.aml_cleared, VaultError::AmlFlagged);
    Ok(())
}

// --------------------------------
// Accounts
// --------------------------------

#[derive(Accounts)]
pub struct InitializeVault<'info> {
    #[account(
        init,
        payer = admin,
        space = 8 + VaultState::SIZE,
        seeds = [VaultState::SEED_PREFIX],
        bump
    )]
    pub vault_state: Account<'info, VaultState>,

    #[account(mut)]
    pub admin: Signer<'info>,

    pub vk_usdc_mint: InterfaceAccount<'info, Mint>,

    pub usdc_vault: InterfaceAccount<'info, TokenAccount>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct DepositUsdc<'info> {
    #[account(
        mut,
        seeds = [VaultState::SEED_PREFIX],
        bump = vault_state.bump
    )]
    pub vault_state: Account<'info, VaultState>,

    #[account(mut)]
    pub investor: Signer<'info>,

    #[account(mut)]
    pub investor_usdc_ata: InterfaceAccount<'info, TokenAccount>,

    #[account(mut)]
    pub usdc_vault: InterfaceAccount<'info, TokenAccount>,

    #[account(mut)]
    pub investor_vk_usdc_ata: InterfaceAccount<'info, TokenAccount>,

    pub usdc_mint: InterfaceAccount<'info, Mint>,

    pub vk_usdc_mint: InterfaceAccount<'info, Mint>,

    pub credential: Account<'info, KycCredential>,

    pub usdc_token_program: Interface<'info, TokenInterface>,
    pub vk_token_program: Interface<'info, TokenInterface>,
}

#[derive(Accounts)]
pub struct WithdrawUsdc<'info> {
    #[account(
        mut,
        seeds = [VaultState::SEED_PREFIX],
        bump = vault_state.bump
    )]
    pub vault_state: Account<'info, VaultState>,

    #[account(mut)]
    pub investor: Signer<'info>,

    #[account(mut)]
    pub investor_usdc_ata: InterfaceAccount<'info, TokenAccount>,

    #[account(mut)]
    pub usdc_vault: InterfaceAccount<'info, TokenAccount>,

    #[account(mut)]
    pub investor_vk_usdc_ata: InterfaceAccount<'info, TokenAccount>,

    pub usdc_mint: InterfaceAccount<'info, Mint>,

    pub vk_usdc_mint: InterfaceAccount<'info, Mint>,

    pub credential: Account<'info, KycCredential>,

    pub usdc_token_program: Interface<'info, TokenInterface>,
    pub vk_token_program: Interface<'info, TokenInterface>,
}

#[derive(Accounts)]
pub struct HarvestYield<'info> {
    #[account(
        mut,
        seeds = [VaultState::SEED_PREFIX],
        bump = vault_state.bump
    )]
    pub vault_state: Account<'info, VaultState>,

    pub admin: Signer<'info>,
}

#[derive(Accounts)]
pub struct UpdateVaultConfig<'info> {
    #[account(
        mut,
        seeds = [VaultState::SEED_PREFIX],
        bump = vault_state.bump
    )]
    pub vault_state: Account<'info, VaultState>,

    pub admin: Signer<'info>,
}

fn kyt_risk_tier(amount: u64) -> u8 {
    if amount < 1_000_000_000 {
        0
    } else if amount < 10_000_000_000 {
        1
    } else {
        2
    }
}


use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, TokenAccount, Token, Transfer, Burn, MintTo};

mod state;
mod events;
mod errors;

use crate::state::VaultState;
use crate::events::{KytEvent, TravelRuleEvent};
use crate::errors::VaultError;

// Placeholder. Anchor will overwrite this on `anchor keys sync` / deploy.
declare_id!("11111111111111111111111111111111");

#[program]
pub mod vault {
    use super::*;

    pub fn initialize_vault(ctx: Context<InitializeVault>, vasp_did: String) -> Result<()> {
        require!(vasp_did.len() <= VaultState::VASP_DID_MAX_LEN, VaultError::ComplianceFailed);

        let vault_state = &mut ctx.accounts.vault_state;
        vault_state.admin = ctx.accounts.admin.key();
        vault_state.vk_usdc_mint = ctx.accounts.vk_usdc_mint.key();
        vault_state.usdc_vault = ctx.accounts.usdc_vault.key();
        vault_state.total_assets = 0;
        vault_state.total_shares = 0;
        vault_state.nav_per_share = 1_000_000; // 1.0 in 6-decimal lamports
        vault_state.vasp_did = vasp_did;
        vault_state.bump = *ctx.bumps.get("vault_state").unwrap();

        Ok(())
    }

    pub fn deposit_usdc(ctx: Context<DepositUsdc>, amount: u64) -> Result<()> {
        require!(amount > 0, VaultError::BelowMinDeposit);

        // KYC checks are primarily enforced by the transfer hook, but we defensively
        // ensure the credential is valid here as well.
        validate_credential(&ctx.accounts.credential)?;

        let vault_state = &mut ctx.accounts.vault_state;

        // Transfer USDC from user to vault.
        let cpi_accounts = Transfer {
            from: ctx.accounts.user_usdc.to_account_info(),
            to: ctx.accounts.usdc_vault.to_account_info(),
            authority: ctx.accounts.user.to_account_info(),
        };
        let cpi_ctx = CpiContext::new(ctx.accounts.token_program.to_account_info(), cpi_accounts);
        token::transfer(cpi_ctx, amount)?;

        // Compute shares to mint.
        let shares_to_mint = if vault_state.total_shares == 0 || vault_state.total_assets == 0 {
            amount
        } else {
            amount
                .checked_mul(vault_state.total_shares)
                .ok_or(VaultError::ComplianceFailed)?
                .checked_div(vault_state.total_assets)
                .ok_or(VaultError::ComplianceFailed)?
        };

        // Mint vkUSDC shares to user.
        let seeds: &[&[u8]] = &[b"vault_state", &[vault_state.bump]];
        let signer_seeds = &[seeds];
        let cpi_accounts = MintTo {
            mint: ctx.accounts.vk_usdc_mint.to_account_info(),
            to: ctx.accounts.user_vk_usdc.to_account_info(),
            authority: ctx.accounts.vault_state.to_account_info(),
        };
        let cpi_ctx =
            CpiContext::new_with_signer(ctx.accounts.token_program.to_account_info(), cpi_accounts, signer_seeds);
        token::mint_to(cpi_ctx, shares_to_mint)?;

        // Update accounting.
        vault_state.total_assets = vault_state
            .total_assets
            .checked_add(amount)
            .ok_or(VaultError::ComplianceFailed)?;
        vault_state.total_shares = vault_state
            .total_shares
            .checked_add(shares_to_mint)
            .ok_or(VaultError::ComplianceFailed)?;

        // Emit KYT event (risk tier is determined off-chain).
        let clock = Clock::get()?;
        emit!(KytEvent {
            wallet: ctx.accounts.user.key(),
            amount_usdc: amount,
            direction: 0,
            risk_tier: 0,
            timestamp: clock.unix_timestamp,
        });

        Ok(())
    }

    pub fn withdraw_usdc(ctx: Context<WithdrawUsdc>, shares: u64) -> Result<()> {
        require!(shares > 0, VaultError::InsufficientShares);

        validate_credential(&ctx.accounts.credential)?;

        let vault_state = &mut ctx.accounts.vault_state;
        require!(ctx.accounts.user_vk_usdc.amount >= shares, VaultError::InsufficientShares);
        require!(vault_state.total_shares > 0, VaultError::InsufficientShares);

        // Compute USDC amount out.
        let amount_out = shares
            .checked_mul(vault_state.total_assets)
            .ok_or(VaultError::ComplianceFailed)?
            .checked_div(vault_state.total_shares)
            .ok_or(VaultError::ComplianceFailed)?;

        require!(amount_out > 0, VaultError::InsufficientShares);
        require!(ctx.accounts.usdc_vault.amount >= amount_out, VaultError::InsufficientShares);

        // Burn vkUSDC shares from user.
        let cpi_accounts = Burn {
            mint: ctx.accounts.vk_usdc_mint.to_account_info(),
            from: ctx.accounts.user_vk_usdc.to_account_info(),
            authority: ctx.accounts.user.to_account_info(),
        };
        let cpi_ctx = CpiContext::new(ctx.accounts.token_program.to_account_info(), cpi_accounts);
        token::burn(cpi_ctx, shares)?;

        // Transfer USDC from vault to user.
        let seeds: &[&[u8]] = &[b"vault_state", &[vault_state.bump]];
        let signer_seeds = &[seeds];
        let cpi_accounts = Transfer {
            from: ctx.accounts.usdc_vault.to_account_info(),
            to: ctx.accounts.user_usdc.to_account_info(),
            authority: ctx.accounts.vault_state.to_account_info(),
        };
        let cpi_ctx =
            CpiContext::new_with_signer(ctx.accounts.token_program.to_account_info(), cpi_accounts, signer_seeds);
        token::transfer(cpi_ctx, amount_out)?;

        // Update accounting.
        vault_state.total_assets = vault_state
            .total_assets
            .checked_sub(amount_out)
            .ok_or(VaultError::ComplianceFailed)?;
        vault_state.total_shares = vault_state
            .total_shares
            .checked_sub(shares)
            .ok_or(VaultError::ComplianceFailed)?;

        // Emit KYT event.
        let clock = Clock::get()?;
        emit!(KytEvent {
            wallet: ctx.accounts.user.key(),
            amount_usdc: amount_out,
            direction: 1,
            risk_tier: 0,
            timestamp: clock.unix_timestamp,
        });

        // Emit Travel Rule event for withdrawals above 3000 USDC (3_000_000_000 with 6 decimals).
        if amount_out >= 3_000_000_000 {
            emit!(TravelRuleEvent {
                sender_wallet: ctx.accounts.user.key(),
                sender_vasp: vault_state.vasp_did.clone(),
                amount_usdc: amount_out,
                timestamp: clock.unix_timestamp,
                tx_ref: String::new(), // Filled by backend using tx signature.
            });
        }

        Ok(())
    }

    pub fn harvest_yield(ctx: Context<HarvestYield>, new_nav: u64) -> Result<()> {
        let vault_state = &mut ctx.accounts.vault_state;
        require_keys_eq!(vault_state.admin, ctx.accounts.admin.key(), VaultError::NotAdmin);
        vault_state.nav_per_share = new_nav;
        Ok(())
    }

    pub fn update_vault_config(
        ctx: Context<UpdateVaultConfig>,
        new_admin: Option<Pubkey>,
        min_deposit: Option<u64>,
    ) -> Result<()> {
        let vault_state = &mut ctx.accounts.vault_state;
        require_keys_eq!(vault_state.admin, ctx.accounts.admin.key(), VaultError::NotAdmin);

        if let Some(admin) = new_admin {
            vault_state.admin = admin;
        }

        // For now we do not store min_deposit in state; this is a placeholder to
        // show where additional config fields would be wired. Kept minimal for MVP.
        let _ = min_deposit;

        Ok(())
    }
}

// --------------------------------
// Account validation helpers
// --------------------------------

fn validate_credential(credential: &KycCredential) -> Result<()> {
    let clock = Clock::get()?;
    require!(credential.expiry > clock.unix_timestamp, VaultError::CredentialExpired);
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
        seeds = [b"vault_state"],
        bump
    )]
    pub vault_state: Account<'info, VaultState>,

    #[account(mut)]
    pub admin: Signer<'info>,

    /// vkUSDC mint controlled by the vault_state PDA.
    pub vk_usdc_mint: Account<'info, Mint>,

    /// Vault's USDC token account.
    #[account(mut)]
    pub usdc_vault: Account<'info, TokenAccount>,

    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct DepositUsdc<'info> {
    #[account(
        mut,
        seeds = [b"vault_state"],
        bump = vault_state.bump
    )]
    pub vault_state: Account<'info, VaultState>,

    #[account(mut)]
    pub user: Signer<'info>,

    #[account(mut)]
    pub user_usdc: Account<'info, TokenAccount>,

    #[account(mut)]
    pub usdc_vault: Account<'info, TokenAccount>,

    #[account(mut)]
    pub vk_usdc_mint: Account<'info, Mint>,

    #[account(mut)]
    pub user_vk_usdc: Account<'info, TokenAccount>,

    /// The user's KYC credential PDA.
    #[account()]
    pub credential: Account<'info, KycCredential>,

    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct WithdrawUsdc<'info> {
    #[account(
        mut,
        seeds = [b"vault_state"],
        bump = vault_state.bump
    )]
    pub vault_state: Account<'info, VaultState>,

    #[account(mut)]
    pub user: Signer<'info>,

    #[account(mut)]
    pub user_usdc: Account<'info, TokenAccount>,

    #[account(mut)]
    pub usdc_vault: Account<'info, TokenAccount>,

    #[account(mut)]
    pub vk_usdc_mint: Account<'info, Mint>,

    #[account(mut)]
    pub user_vk_usdc: Account<'info, TokenAccount>,

    /// The user's KYC credential PDA.
    #[account()]
    pub credential: Account<'info, KycCredential>,

    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct HarvestYield<'info> {
    #[account(
        mut,
        seeds = [b"vault_state"],
        bump = vault_state.bump
    )]
    pub vault_state: Account<'info, VaultState>,

    pub admin: Signer<'info>,
}

#[derive(Accounts)]
pub struct UpdateVaultConfig<'info> {
    #[account(
        mut,
        seeds = [b"vault_state"],
        bump = vault_state.bump
    )]
    pub vault_state: Account<'info, VaultState>,

    pub admin: Signer<'info>,
}

// --------------------------------
// Minimal KycCredential mirror
// --------------------------------

#[account]
pub struct KycCredential {
    pub wallet: Pubkey,
    pub tier: u8,
    pub issued_at: i64,
    pub expiry: i64,
    pub aml_cleared: bool,
    pub bump: u8,
}


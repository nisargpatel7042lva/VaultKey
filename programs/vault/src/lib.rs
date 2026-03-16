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
    /// For simplicity, this instruction assumes the vkUSDC mint and the
    /// vault's USDC token account have been created off-chain and passed in.
    pub fn initialize_vault(ctx: Context<InitializeVault>, vasp_did: String) -> Result<()> {
        let state = &mut ctx.accounts.vault_state;

        state.admin = ctx.accounts.admin.key();
        state.vk_usdc_mint = ctx.accounts.vk_usdc_mint.key();
        state.usdc_vault = ctx.accounts.usdc_vault.key();
        state.total_assets = 0;
        state.total_shares = 0;
        state.nav_per_share = 1_000_000; // 1.0 in 6-decimal USDC units
        state.vasp_did = vasp_did;
        state.bump = *ctx.bumps.get("vault_state").unwrap();

        Ok(())
    }

    /// Deposit USDC and receive vkUSDC shares.
    pub fn deposit_usdc(ctx: Context<DepositUsdc>, amount: u64) -> Result<()> {
        require!(amount > 0, VaultError::BelowMinDeposit);

        // KYC / AML checks
        let credential = &ctx.accounts.credential;
        let clock = Clock::get()?;

        require!(
            credential.expiry > clock.unix_timestamp,
            VaultError::CredentialExpired
        );
        require!(credential.aml_cleared, VaultError::AmlFlagged);
        require_keys_eq!(
            credential.wallet,
            ctx.accounts.investor.key(),
            VaultError::NotKyced
        );

        let state = &mut ctx.accounts.vault_state;

        // Share pricing:
        // - First deposit: 1:1 with amount.
        // - Subsequent: shares = (amount * total_shares) / total_assets
        let shares = if state.total_shares == 0 || state.total_assets == 0 {
            amount
        } else {
            (amount as u128)
                .checked_mul(state.total_shares as u128)
                .and_then(|n| n.checked_div(state.total_assets as u128))
                .ok_or(VaultError::ComplianceFailed)? as u64
        };

        require!(shares > 0, VaultError::ComplianceFailed);

        // Transfer USDC from investor to vault.
        transfer_checked(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
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

        // Mint vkUSDC shares to the investor.
        mint_to(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
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

        // Emit KYT event with mocked risk tier.
        let risk_tier = kyt_risk_tier(amount);
        emit!(KytEvent {
            wallet: ctx.accounts.investor.key(),
            amount_usdc: amount,
            direction: 0,
            risk_tier,
            timestamp: clock.unix_timestamp,
        });

        Ok(())
    }

    /// Burn vkUSDC shares in exchange for USDC.
    pub fn withdraw_usdc(ctx: Context<WithdrawUsdc>, shares: u64) -> Result<()> {
        require!(shares > 0, VaultError::InsufficientShares);

        // KYC / AML checks
        let credential = &ctx.accounts.credential;
        let clock = Clock::get()?;

        require!(
            credential.expiry > clock.unix_timestamp,
            VaultError::CredentialExpired
        );
        require!(credential.aml_cleared, VaultError::AmlFlagged);
        require_keys_eq!(
            credential.wallet,
            ctx.accounts.investor.key(),
            VaultError::NotKyced
        );

        let state = &mut ctx.accounts.vault_state;
        require!(state.total_shares > 0, VaultError::InsufficientShares);

        // usdc_out = (shares * total_assets) / total_shares
        let usdc_out = (shares as u128)
            .checked_mul(state.total_assets as u128)
            .and_then(|n| n.checked_div(state.total_shares as u128))
            .ok_or(VaultError::ComplianceFailed)? as u64;

        require!(usdc_out > 0, VaultError::ComplianceFailed);
        require!(
            ctx.accounts.investor_vk_usdc_ata.amount >= shares,
            VaultError::InsufficientShares
        );

        // Burn vkUSDC shares from the investor.
        burn(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Burn {
                    mint: ctx.accounts.vk_usdc_mint.to_account_info(),
                    from: ctx.accounts.investor_vk_usdc_ata.to_account_info(),
                    authority: ctx.accounts.investor.to_account_info(),
                },
            ),
            shares,
        )?;

        // Transfer USDC from vault to investor.
        transfer_checked(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
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

        // Emit KYT event (withdraw direction = 1).
        let risk_tier = kyt_risk_tier(usdc_out);
        emit!(KytEvent {
            wallet: ctx.accounts.investor.key(),
            amount_usdc: usdc_out,
            direction: 1,
            risk_tier,
            timestamp: clock.unix_timestamp,
        });

        // Emit Travel Rule event if above threshold.
        if usdc_out >= TRAVEL_RULE_THRESHOLD {
            emit!(TravelRuleEvent {
                sender_wallet: ctx.accounts.investor.key(),
                sender_vasp: state.vasp_did.clone(),
                amount_usdc: usdc_out,
                timestamp: clock.unix_timestamp,
                // On-chain we don't have direct access to the tx signature;
                // we emit a placeholder here for the backend to correlate.
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

        // Optionally adjust total_assets to reflect the new NAV.
        if state.total_shares > 0 {
            let new_assets = (state.total_shares as u128)
                .checked_mul(new_nav as u128)
                .and_then(|n| n.checked_div(1_000_000u128))
                .ok_or(VaultError::ComplianceFailed)? as u64;
            state.total_assets = new_assets;
        }

        Ok(())
    }

    /// Admin-only config update (currently only vasp_did is mutable).
    pub fn update_vault_config(ctx: Context<UpdateVaultConfig>, new_vasp_did: String) -> Result<()> {
        let state = &mut ctx.accounts.vault_state;
        require_keys_eq!(state.admin, ctx.accounts.admin.key(), VaultError::NotAdmin);
        state.vasp_did = new_vasp_did;
        Ok(())
    }
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

    /// vkUSDC mint (Token-2022) configured with the transfer hook.
    pub vk_usdc_mint: InterfaceAccount<'info, Mint>,

    /// Vault's USDC token account.
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

    /// Investor's USDC token account.
    #[account(mut)]
    pub investor_usdc_ata: InterfaceAccount<'info, TokenAccount>,

    /// Vault's USDC token account.
    #[account(mut)]
    pub usdc_vault: InterfaceAccount<'info, TokenAccount>,

    /// Investor's vkUSDC token account.
    #[account(mut)]
    pub investor_vk_usdc_ata: InterfaceAccount<'info, TokenAccount>,

    /// USDC mint (Token-2022 or legacy, but 6 decimals).
    pub usdc_mint: InterfaceAccount<'info, Mint>,

    /// vkUSDC mint.
    pub vk_usdc_mint: InterfaceAccount<'info, Mint>,

    /// KYC credential PDA from the kyc_registry program.
    pub credential: Account<'info, KycCredential>,

    pub token_program: Interface<'info, TokenInterface>,
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

    /// Investor's USDC token account.
    #[account(mut)]
    pub investor_usdc_ata: InterfaceAccount<'info, TokenAccount>,

    /// Vault's USDC token account.
    #[account(mut)]
    pub usdc_vault: InterfaceAccount<'info, TokenAccount>,

    /// Investor's vkUSDC token account.
    #[account(mut)]
    pub investor_vk_usdc_ata: InterfaceAccount<'info, TokenAccount>,

    /// USDC mint.
    pub usdc_mint: InterfaceAccount<'info, Mint>,

    /// vkUSDC mint.
    pub vk_usdc_mint: InterfaceAccount<'info, Mint>,

    /// KYC credential PDA from the kyc_registry program.
    pub credential: Account<'info, KycCredential>,

    pub token_program: Interface<'info, TokenInterface>,
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

// --------------------------------
// Helpers
// --------------------------------

fn kyt_risk_tier(amount: u64) -> u8 {
    if amount < 1_000_000_000 {
        0 // LOW
    } else if amount < 10_000_000_000 {
        1 // MEDIUM
    } else {
        2 // HIGH
    }
}

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


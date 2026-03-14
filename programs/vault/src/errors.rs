use anchor_lang::prelude::*;

#[error_code]
pub enum VaultError {
    #[msg("Wallet is not KYC verified")]
    NotKyced,

    #[msg("KYC credential has expired")]
    CredentialExpired,

    #[msg("Wallet has been AML flagged")]
    AmlFlagged,

    #[msg("Deposit amount below minimum")]
    BelowMinDeposit,

    #[msg("Insufficient shares to withdraw")]
    InsufficientShares,

    #[msg("Compliance checks failed")]
    ComplianceFailed,

    #[msg("Caller is not the admin")]
    NotAdmin,
}


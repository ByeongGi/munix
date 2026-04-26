use serde::Serialize;
use thiserror::Error;

#[derive(Debug, Error, Serialize)]
#[serde(tag = "type", content = "message")]
pub enum VaultError {
    #[error("Not a directory")]
    NotADirectory,

    #[error("Path traversal blocked: {0}")]
    PathTraversal(String),

    #[error("Vault not open")]
    NotOpen,

    #[error("Vault id not found: {0}")]
    VaultNotFound(String),

    /// Phase B에서 cross-vault id leak 방지에 사용 (현재 active vault와 다른 id로 호출 시).
    #[error("Invalid vault id: {0}")]
    #[allow(dead_code)]
    InvalidVault(String),

    #[error("File not found: {0}")]
    NotFound(String),

    #[error("Permission denied: {0}")]
    PermissionDenied(String),

    #[error("Permission required: {0}")]
    PermissionRequired(String),

    #[error("IO error: {0}")]
    Io(String),

    #[error("Invalid file name: {0}")]
    InvalidName(String),

    #[error("File exists: {0}")]
    AlreadyExists(String),

    #[error("Invalid UTF-8 content")]
    #[allow(dead_code)]
    InvalidUtf8,
}

impl From<std::io::Error> for VaultError {
    fn from(e: std::io::Error) -> Self {
        use std::io::ErrorKind;
        match e.kind() {
            ErrorKind::NotFound => VaultError::NotFound(e.to_string()),
            ErrorKind::PermissionDenied => VaultError::PermissionDenied(e.to_string()),
            ErrorKind::AlreadyExists => VaultError::AlreadyExists(e.to_string()),
            _ => VaultError::Io(e.to_string()),
        }
    }
}

pub type VaultResult<T> = Result<T, VaultError>;

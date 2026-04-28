//! 앱 전역 상태.
//!
//! ADR-031 적용 — 단일 `Vault`/`watcher` 슬롯에서 `VaultManager`로 마이그레이션.
//! `ActiveVault`는 Phase A 동안 frontend가 vault_id 없이 호출하던 코드를
//! 임시로 라우팅해주는 어댑터다 (Phase B 이후 제거 가능).

use crate::commands::terminal::TerminalManager;
use crate::vault_manager::{ActiveVault, VaultManager};

pub struct AppState {
    pub vault_manager: VaultManager,
    pub active_vault: ActiveVault,
    pub terminal_manager: TerminalManager,
}

impl AppState {
    pub fn new() -> Self {
        Self {
            vault_manager: VaultManager::new(),
            active_vault: ActiveVault::default(),
            terminal_manager: TerminalManager::default(),
        }
    }
}

impl Default for AppState {
    fn default() -> Self {
        Self::new()
    }
}

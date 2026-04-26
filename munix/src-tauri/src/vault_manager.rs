//! VaultManager — 멀티 vault 동시 운영을 위한 레이어. (ADR-031)
//!
//! 각 vault는 `VaultId` (UUID v4 문자열)로 식별되며, `VaultManager`는
//! `HashMap<VaultId, VaultEntry>`로 vault·watcher·recent_writes 묶음을 보관한다.
//!
//! Phase A 단계에서는 watcher 이벤트 payload에 `vault_id`만 포함하면 되므로,
//! recent_writes는 vault별 `Arc<Mutex<HashMap<PathBuf, Instant>>>`로 분리한다.
//!
//! Frontend는 `lib/ipc.ts` 어댑터에서 active vault id를 자동 주입 (Phase A-5).

use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex, RwLock};
use std::time::Instant;

use serde::Serialize;
use tauri::AppHandle;
use uuid::Uuid;

use crate::error::{VaultError, VaultResult};
use crate::vault::{Vault, VaultInfo};
use crate::watcher::{RecentWrites, VaultWatcher};

pub type VaultId = String;

/// vault 1개의 운영 상태.
pub struct VaultEntry {
    pub id: VaultId,
    pub vault: Vault,
    /// Drop 시 자동 정지 — 직접 접근하지 않으므로 dead_code 허용.
    #[allow(dead_code)]
    pub watcher: Option<VaultWatcher>,
    pub recent_writes: RecentWrites,
}

impl VaultEntry {
    pub fn info(&self) -> VaultResult<VaultInfo> {
        self.vault.info(&self.id)
    }
}

/// 여러 vault를 동시에 보관·운영하는 매니저.
///
/// 잠금 전략:
/// - `vaults`: RwLock — 빈번한 읽기(IPC 호출) 우선
/// - 각 entry의 watcher 등 mutable 자원: 별도 Mutex 또는 Option swap
pub struct VaultManager {
    vaults: RwLock<HashMap<VaultId, VaultEntry>>,
}

impl VaultManager {
    pub fn new() -> Self {
        Self {
            vaults: RwLock::new(HashMap::new()),
        }
    }

    /// 새 vault를 열고 watcher를 시작한다.
    /// 같은 경로(canonical)가 이미 열려 있으면 기존 id를 그대로 반환한다.
    /// 같은 path 가 `munix.json` 에 등록돼 있으면 그 id 를 재사용 (ADR-032 — 매 부팅마다
    /// 새 UUID 가 부여돼 registry 에 stale entry 가 쌓이는 문제 회피).
    pub fn open(&self, path: impl AsRef<Path>, app: AppHandle) -> VaultResult<VaultId> {
        let canonical = path
            .as_ref()
            .canonicalize()
            .map_err(VaultError::from)?;

        // 1. backend 내부 vaults 에서 검색
        {
            let guard = self
                .vaults
                .read()
                .map_err(|e| VaultError::Io(format!("vaults rwlock poisoned: {e}")))?;
            for entry in guard.values() {
                if entry.vault.root() == canonical {
                    return Ok(entry.id.clone());
                }
            }
        }

        // 2. munix.json 에서 같은 path 의 id 재사용 (ADR-032)
        let canonical_str = canonical.to_string_lossy().to_string();
        let reused_id: Option<VaultId> = crate::vault_registry::load(&app)
            .ok()
            .and_then(|reg| {
                reg.vaults
                    .into_iter()
                    .find(|(_, e)| e.path == canonical_str)
                    .map(|(id, _)| id)
            });

        let vault = Vault::open(&canonical)?;
        let id: VaultId = reused_id.unwrap_or_else(|| Uuid::new_v4().to_string());
        let recent_writes: RecentWrites = Arc::new(Mutex::new(HashMap::<PathBuf, Instant>::new()));
        let watcher = VaultWatcher::spawn(
            app,
            vault.root().to_path_buf(),
            id.clone(),
            recent_writes.clone(),
        )?;

        let entry = VaultEntry {
            id: id.clone(),
            vault,
            watcher: Some(watcher),
            recent_writes,
        };

        {
            let mut guard = self
                .vaults
                .write()
                .map_err(|e| VaultError::Io(format!("vaults rwlock poisoned: {e}")))?;
            guard.insert(id.clone(), entry);
        }

        Ok(id)
    }

    /// vault를 닫고 watcher를 정리한다.
    pub fn close(&self, id: &str) -> VaultResult<()> {
        let mut guard = self
            .vaults
            .write()
            .map_err(|e| VaultError::Io(format!("vaults rwlock poisoned: {e}")))?;
        match guard.remove(id) {
            Some(_) => Ok(()),
            None => Err(VaultError::VaultNotFound(id.to_string())),
        }
    }

    /// vault 정보 1개 — 파일 수 등 동기 fs 호출 포함.
    pub fn info(&self, id: &str) -> VaultResult<VaultInfo> {
        let guard = self
            .vaults
            .read()
            .map_err(|e| VaultError::Io(format!("vaults rwlock poisoned: {e}")))?;
        let entry = guard
            .get(id)
            .ok_or_else(|| VaultError::VaultNotFound(id.to_string()))?;
        entry.info()
    }

    /// 열린 vault 정보 목록.
    pub fn list_open(&self) -> VaultResult<Vec<VaultInfo>> {
        let guard = self
            .vaults
            .read()
            .map_err(|e| VaultError::Io(format!("vaults rwlock poisoned: {e}")))?;
        let mut out = Vec::with_capacity(guard.len());
        for entry in guard.values() {
            out.push(entry.info()?);
        }
        Ok(out)
    }

    /// vault에서 read-only 작업 수행 (IPC 커맨드 헬퍼).
    pub fn with_vault<T>(
        &self,
        id: &str,
        f: impl FnOnce(&Vault) -> VaultResult<T>,
    ) -> VaultResult<T> {
        let guard = self
            .vaults
            .read()
            .map_err(|e| VaultError::Io(format!("vaults rwlock poisoned: {e}")))?;
        let entry = guard
            .get(id)
            .ok_or_else(|| VaultError::VaultNotFound(id.to_string()))?;
        f(&entry.vault)
    }

    /// vault의 recent_writes에 abs path 기록 (self-write suppression).
    pub fn record_writes(&self, id: &str, paths: &[&Path]) -> VaultResult<()> {
        let guard = self
            .vaults
            .read()
            .map_err(|e| VaultError::Io(format!("vaults rwlock poisoned: {e}")))?;
        let entry = guard
            .get(id)
            .ok_or_else(|| VaultError::VaultNotFound(id.to_string()))?;
        crate::watcher::record_write(&entry.recent_writes, paths);
        Ok(())
    }

    /// (Phase D 이후) 남은 vault 수 — 0이면 Welcome 화면 표시.
    #[allow(dead_code)]
    pub fn count(&self) -> usize {
        self.vaults
            .read()
            .map(|g| g.len())
            .unwrap_or(0)
    }
}

impl Default for VaultManager {
    fn default() -> Self {
        Self::new()
    }
}

/// 어댑터: 단일 vault 시나리오에서 frontend가 vault_id 없이 호출하던 코드를
/// 임시로 활성 vault id 하나에 매핑한다. Phase A-5에서 frontend가
/// 명시 vault_id를 보내면 이 어댑터는 필요 없어진다.
#[derive(Debug, Default)]
pub struct ActiveVault(pub Mutex<Option<VaultId>>);

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
#[allow(dead_code)]
pub struct VaultIdResponse {
    pub vault_id: VaultId,
}

//! 글로벌 vault 레지스트리 — `munix.json`. (ADR-032)
//!
//! 위치: `app_config_dir/munix.json` (macOS: `~/Library/Application Support/app.munix.desktop/`).
//! Obsidian 의 `obsidian.json` 과 같은 위치를 공유하지 않는다 — race 회피.
//!
//! Frontend 의 `localStorage[munix:vaultHistory]` / `munix:lastVault` 를 대체한다.
//! 마이그레이션은 frontend 에서 1회 — 부팅 시 `munix.json` 이 없고 localStorage 에
//! 값이 있으면 옮긴 후 이전 키 삭제.

use std::collections::HashMap;
use std::fs;
use std::io::Write;
use std::path::PathBuf;
use std::sync::{Mutex, OnceLock};

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};

const REGISTRY_VERSION: u32 = 1;

/// 동시 save 직렬화용 — 같은 tmp 파일명을 쓰기 때문에 lock 없이 두 호출이
/// 겹치면 한 쪽이 rename 한 직후 다른 쪽 tmp 가 사라져 os error 2 가 난다.
/// bootstrap 의 자동 reopen + close 동시 진행 시 자주 재현됐다.
static SAVE_MUTEX: OnceLock<Mutex<()>> = OnceLock::new();

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VaultRegistryEntry {
    /// canonical absolute path
    pub path: String,
    /// 마지막 open 한 unix ms — recent 정렬용
    pub ts: i64,
    /// 마지막 부팅 종료 시 열려 있었는지 — 자동 reopen 대상
    #[serde(default)]
    pub open: bool,
    /// 마지막 active vault (한 번에 1개만)
    #[serde(default)]
    pub active: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VaultRegistry {
    pub version: u32,
    /// vault id (UUID v4) → entry
    pub vaults: HashMap<String, VaultRegistryEntry>,
}

impl Default for VaultRegistry {
    fn default() -> Self {
        Self {
            version: REGISTRY_VERSION,
            vaults: HashMap::new(),
        }
    }
}

fn registry_path(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_config_dir()
        .map_err(|e| format!("app_config_dir failed: {e}"))?;
    if !dir.exists() {
        fs::create_dir_all(&dir)
            .map_err(|e| format!("failed to create config dir {}: {e}", dir.display()))?;
    }
    Ok(dir.join("munix.json"))
}

/// `munix.json` 을 읽어 레지스트리 반환. 파일이 없거나 파싱 실패하면 default(empty).
pub fn load(app: &AppHandle) -> Result<VaultRegistry, String> {
    let path = registry_path(app)?;
    if !path.exists() {
        return Ok(VaultRegistry::default());
    }
    let raw = fs::read_to_string(&path)
        .map_err(|e| format!("failed to read {}: {e}", path.display()))?;
    match serde_json::from_str::<VaultRegistry>(&raw) {
        Ok(r) => Ok(r),
        Err(e) => {
            // 깨진 파일은 무시하고 default — 사용자 데이터 보호 (덮어쓰기 X)
            eprintln!("[vault-registry] parse failed, treating as empty: {e}");
            Ok(VaultRegistry::default())
        }
    }
}

/// atomic 하게 저장 (tmp → rename). 동시 save 는 SAVE_MUTEX 로 직렬화.
pub fn save(app: &AppHandle, registry: &VaultRegistry) -> Result<(), String> {
    let mutex = SAVE_MUTEX.get_or_init(|| Mutex::new(()));
    let _guard = mutex
        .lock()
        .map_err(|e| format!("registry save lock poisoned: {e}"))?;

    let path = registry_path(app)?;
    let tmp = path.with_extension("json.tmp");
    let raw = serde_json::to_string_pretty(registry)
        .map_err(|e| format!("failed to serialize registry: {e}"))?;

    {
        let mut f = fs::File::create(&tmp)
            .map_err(|e| format!("failed to create {}: {e}", tmp.display()))?;
        f.write_all(raw.as_bytes())
            .map_err(|e| format!("failed to write {}: {e}", tmp.display()))?;
        f.sync_all()
            .map_err(|e| format!("failed to sync {}: {e}", tmp.display()))?;
    }

    fs::rename(&tmp, &path).map_err(|e| {
        format!(
            "failed to rename {} -> {}: {e}",
            tmp.display(),
            path.display()
        )
    })?;
    Ok(())
}

// ── Tauri commands ───────────────────────────────────────────────────────

#[tauri::command]
pub async fn vault_registry_load(app: AppHandle) -> Result<VaultRegistry, String> {
    load(&app)
}

#[tauri::command]
pub async fn vault_registry_save(
    registry: VaultRegistry,
    app: AppHandle,
) -> Result<(), String> {
    save(&app, &registry)
}

#[tauri::command]
pub async fn vault_registry_remove(id: String, app: AppHandle) -> Result<(), String> {
    let mut reg = load(&app)?;
    let removed_path = reg.vaults.remove(&id).map(|e| e.path);
    save(&app, &reg)?;
    // ADR-031 C-6 후속: 사용자가 vault 흔적을 지우면 trusted 등록도 같이 정리한다.
    // 같은 path 가 다른 entry id 로 남아 있으면 trust 는 보존 (다른 entry 가 여전히
    // 그 vault 를 가리키고 있으므로).
    if let Some(path) = removed_path {
        let still_referenced = reg.vaults.values().any(|e| e.path == path);
        if !still_referenced {
            let _ = crate::trust::untrust(&app, std::path::Path::new(&path));
        }
    }
    Ok(())
}

#[tauri::command]
pub async fn vault_registry_clear(app: AppHandle) -> Result<(), String> {
    save(&app, &VaultRegistry::default())?;
    // 모든 vault 흔적 제거 흐름 — trusted 도 같이 비운다.
    let _ = crate::trust::clear_all(&app);
    Ok(())
}

/// closed entry (open=false) 만 일괄 제거. open 중인 vault 는 보존.
/// 제거된 path 들 중 open entry 에 더 이상 참조되지 않는 것은 trust 에서도 untrust.
#[tauri::command]
pub async fn vault_registry_clear_closed(app: AppHandle) -> Result<(), String> {
    let mut reg = load(&app)?;
    let mut removed_paths: Vec<String> = Vec::new();
    reg.vaults.retain(|_, e| {
        if !e.open {
            removed_paths.push(e.path.clone());
            false
        } else {
            true
        }
    });
    save(&app, &reg)?;
    for path in removed_paths {
        let still_referenced = reg.vaults.values().any(|e| e.path == path);
        if !still_referenced {
            let _ = crate::trust::untrust(&app, std::path::Path::new(&path));
        }
    }
    Ok(())
}

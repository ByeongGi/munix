use std::collections::BTreeSet;
use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};

#[derive(Debug, Default, Deserialize, Serialize)]
struct TrustedVaults {
    version: u8,
    roots: BTreeSet<String>,
}

fn trust_path(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_config_dir()
        .map_err(|e| format!("app_config_dir failed: {e}"))?;
    if !dir.exists() {
        fs::create_dir_all(&dir)
            .map_err(|e| format!("failed to create config dir {}: {e}", dir.display()))?;
    }
    Ok(dir.join("trusted-vaults.json"))
}

fn canonical_root(path: &Path) -> Result<String, String> {
    path.canonicalize()
        .map_err(|e| format!("failed to canonicalize {}: {e}", path.display()))
        .map(|p| p.to_string_lossy().to_string())
}

fn load(app: &AppHandle) -> Result<TrustedVaults, String> {
    let path = trust_path(app)?;
    if !path.exists() {
        return Ok(TrustedVaults {
            version: 1,
            roots: BTreeSet::new(),
        });
    }
    let raw =
        fs::read_to_string(&path).map_err(|e| format!("failed to read {}: {e}", path.display()))?;
    serde_json::from_str(&raw).map_err(|e| format!("invalid {}: {e}", path.display()))
}

fn save(app: &AppHandle, trusted: &TrustedVaults) -> Result<(), String> {
    let path = trust_path(app)?;
    let tmp = path.with_extension("json.tmp");
    let raw = serde_json::to_string_pretty(trusted)
        .map_err(|e| format!("failed to serialize trusted vaults: {e}"))?;

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

pub fn is_trusted(app: &AppHandle, root: &Path) -> Result<bool, String> {
    let root = canonical_root(root)?;
    Ok(load(app)?.roots.contains(&root))
}

pub fn trust(app: &AppHandle, root: &Path) -> Result<(), String> {
    let root = canonical_root(root)?;
    let mut trusted = load(app)?;
    trusted.version = 1;
    trusted.roots.insert(root);
    save(app, &trusted)
}

/// path 의 trust 등록 해제. canonical 화 실패 (path 가 사라짐 등) 시
/// 문자열 그대로도 한 번 더 시도해서 best-effort 로 정리한다.
pub fn untrust(app: &AppHandle, root: &Path) -> Result<(), String> {
    let raw = root.to_string_lossy().to_string();
    let canonical = canonical_root(root).ok();
    let mut trusted = load(app)?;
    let mut changed = false;
    if let Some(c) = canonical {
        if trusted.roots.remove(&c) {
            changed = true;
        }
    }
    if trusted.roots.remove(&raw) {
        changed = true;
    }
    if !changed {
        return Ok(());
    }
    save(app, &trusted)
}

/// 모든 trusted root 비우기. registry reset 흐름에서 호출.
pub fn clear_all(app: &AppHandle) -> Result<(), String> {
    let trusted = TrustedVaults {
        version: 1,
        roots: BTreeSet::new(),
    };
    save(app, &trusted)
}

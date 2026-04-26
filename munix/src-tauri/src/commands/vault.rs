use std::fs;

use tauri::{AppHandle, Manager, State};

use crate::error::{VaultError, VaultResult};
use crate::state::AppState;
use crate::vault::VaultInfo;
use crate::vault_manager::VaultId;

/// 새 vault 오픈.
/// ADR-031: 같은 경로가 이미 열려 있으면 기존 id 반환.
/// `set_active` (default true) 면 ActiveVault 어댑터에도 등록.
#[tauri::command]
pub async fn open_vault(
    path: String,
    set_active: Option<bool>,
    app: AppHandle,
    state: State<'_, AppState>,
) -> VaultResult<VaultInfo> {
    let id = state.vault_manager.open(&path, app)?;
    let info = state.vault_manager.info(&id)?;

    if set_active.unwrap_or(true) {
        let mut slot = state
            .active_vault
            .0
            .lock()
            .map_err(|e| VaultError::Io(format!("active_vault poisoned: {e}")))?;
        *slot = Some(id.clone());
    }

    Ok(info)
}

/// vault 닫기. id 미지정 시 active vault 사용.
#[tauri::command]
pub async fn close_vault(
    vault_id: Option<VaultId>,
    state: State<'_, AppState>,
) -> VaultResult<()> {
    let id = resolve_id(&state, vault_id)?;
    state.vault_manager.close(&id)?;

    // active 였다면 해제
    let mut slot = state
        .active_vault
        .0
        .lock()
        .map_err(|e| VaultError::Io(format!("active_vault poisoned: {e}")))?;
    if slot.as_ref() == Some(&id) {
        *slot = None;
    }
    Ok(())
}

/// 특정 vault 정보. id 미지정 시 active vault 사용. 없으면 None.
#[tauri::command]
pub async fn get_vault_info(
    vault_id: Option<VaultId>,
    state: State<'_, AppState>,
) -> VaultResult<Option<VaultInfo>> {
    let id = match vault_id {
        Some(id) => Some(id),
        None => state
            .active_vault
            .0
            .lock()
            .map_err(|e| VaultError::Io(format!("active_vault poisoned: {e}")))?
            .clone(),
    };

    match id {
        Some(id) => match state.vault_manager.info(&id) {
            Ok(info) => Ok(Some(info)),
            Err(VaultError::VaultNotFound(_)) => Ok(None),
            Err(e) => Err(e),
        },
        None => Ok(None),
    }
}

/// 현재 열린 vault 목록.
#[tauri::command]
pub async fn list_open_vaults(state: State<'_, AppState>) -> VaultResult<Vec<VaultInfo>> {
    state.vault_manager.list_open()
}

/// 경로가 실제 디렉토리로 존재하는지 검사. Welcome 의 history 가 깨진 vault
/// 항목을 ⚠ 로 표시하기 위해 사용. 권한·심볼릭 링크는 검증하지 않는다 — 단순 존재 확인.
#[tauri::command]
pub async fn path_exists(path: String) -> bool {
    std::path::Path::new(&path).is_dir()
}

/// 기본 샘플 vault 경로. 사용자의 Documents 아래에 만들되, 플랫폼 경로 해석은
/// Tauri path resolver 에 맡긴다.
#[tauri::command]
pub async fn default_sample_vault_path(app: AppHandle) -> Result<String, String> {
    let dir = app
        .path()
        .document_dir()
        .or_else(|_| app.path().home_dir())
        .map_err(|e| format!("failed to resolve sample vault base dir: {e}"))?;
    Ok(dir.join("Munix Sample Vault").to_string_lossy().to_string())
}

/// absolute directory 생성. 기존 디렉터리는 그대로 재사용한다.
#[tauri::command]
pub async fn create_dir(path: String) -> VaultResult<String> {
    let raw = std::path::PathBuf::from(path);
    if raw.as_os_str().is_empty() {
        return Err(VaultError::InvalidName("empty path".to_string()));
    }
    fs::create_dir_all(&raw)?;
    if !raw.is_dir() {
        return Err(VaultError::NotADirectory);
    }
    raw.canonicalize()
        .map(|p| p.to_string_lossy().to_string())
        .map_err(VaultError::from)
}

/// path 가 trusted vault 인지 검사. ADR-031 C-6 — 새 vault open 직전 prompt 분기용.
#[tauri::command]
pub async fn is_path_trusted(path: String, app: AppHandle) -> Result<bool, String> {
    crate::trust::is_trusted(&app, std::path::Path::new(&path))
}

/// path 를 trusted 로 등록. open 전 prompt 에서 사용자가 동의했을 때 호출.
#[tauri::command]
pub async fn trust_path(path: String, app: AppHandle) -> Result<(), String> {
    crate::trust::trust(&app, std::path::Path::new(&path))
}

/// active vault id 변경 (어댑터용). Phase B에서 frontend가 직접 vault_id를
/// 보내게 되면 이 커맨드는 deprecated 처리 가능.
#[tauri::command]
pub async fn set_active_vault(
    vault_id: VaultId,
    state: State<'_, AppState>,
) -> VaultResult<()> {
    // 등록된 vault인지 검증
    state.vault_manager.info(&vault_id)?;
    let mut slot = state
        .active_vault
        .0
        .lock()
        .map_err(|e| VaultError::Io(format!("active_vault poisoned: {e}")))?;
    *slot = Some(vault_id);
    Ok(())
}

/// 옵셔널 vault_id를 active vault로 fallback해서 풀어준다.
pub(crate) fn resolve_id(
    state: &State<'_, AppState>,
    vault_id: Option<VaultId>,
) -> VaultResult<VaultId> {
    if let Some(id) = vault_id {
        return Ok(id);
    }
    let slot = state
        .active_vault
        .0
        .lock()
        .map_err(|e| VaultError::Io(format!("active_vault poisoned: {e}")))?;
    slot.clone().ok_or(VaultError::NotOpen)
}

use tauri::{AppHandle, State};
use tauri_plugin_opener::OpenerExt;

use crate::commands::vault::resolve_id;
use crate::error::{VaultError, VaultResult};
use crate::state::AppState;
use crate::thumbnail;
use crate::trust;
use crate::vault::{FileContent, FileNode, WriteResult};
use crate::vault_manager::VaultId;

#[tauri::command]
pub async fn list_files(
    vault_id: Option<VaultId>,
    state: State<'_, AppState>,
) -> VaultResult<Vec<FileNode>> {
    let id = resolve_id(&state, vault_id)?;
    state.vault_manager.with_vault(&id, |vault| vault.list_all())
}

#[tauri::command]
pub async fn read_file(
    rel_path: String,
    vault_id: Option<VaultId>,
    state: State<'_, AppState>,
) -> VaultResult<FileContent> {
    let id = resolve_id(&state, vault_id)?;
    state
        .vault_manager
        .with_vault(&id, |vault| vault.read_file(&rel_path))
}

#[tauri::command]
pub async fn write_file(
    rel_path: String,
    content: String,
    expected_modified: Option<i64>,
    force: Option<bool>,
    vault_id: Option<VaultId>,
    state: State<'_, AppState>,
) -> VaultResult<WriteResult> {
    let id = resolve_id(&state, vault_id)?;
    let (result, abs) = state.vault_manager.with_vault(&id, |vault| {
        let r = vault.write_file(
            &rel_path,
            &content,
            expected_modified,
            force.unwrap_or(false),
        )?;
        let abs = if !r.conflict {
            Some(vault.resolve(&rel_path)?)
        } else {
            None
        };
        Ok((r, abs))
    })?;
    if let Some(p) = abs {
        state.vault_manager.record_writes(&id, &[&p])?;
    }
    Ok(result)
}

#[tauri::command]
pub async fn create_file(
    rel_path: String,
    content: Option<String>,
    vault_id: Option<VaultId>,
    state: State<'_, AppState>,
) -> VaultResult<FileNode> {
    let id = resolve_id(&state, vault_id)?;
    let (node, abs) = state.vault_manager.with_vault(&id, |vault| {
        let n = vault.create_file(&rel_path, content.as_deref())?;
        let abs = vault.resolve(&rel_path)?;
        Ok((n, abs))
    })?;
    state.vault_manager.record_writes(&id, &[&abs])?;
    Ok(node)
}

#[tauri::command]
pub async fn create_folder(
    rel_path: String,
    vault_id: Option<VaultId>,
    state: State<'_, AppState>,
) -> VaultResult<FileNode> {
    let id = resolve_id(&state, vault_id)?;
    let (node, abs) = state.vault_manager.with_vault(&id, |vault| {
        let n = vault.create_folder(&rel_path)?;
        let abs = vault.resolve(&rel_path)?;
        Ok((n, abs))
    })?;
    state.vault_manager.record_writes(&id, &[&abs])?;
    Ok(node)
}

#[tauri::command]
pub async fn rename_entry(
    old_rel: String,
    new_rel: String,
    vault_id: Option<VaultId>,
    state: State<'_, AppState>,
) -> VaultResult<FileNode> {
    let id = resolve_id(&state, vault_id)?;
    let (node, old_abs, new_abs) = state.vault_manager.with_vault(&id, |vault| {
        let old_abs = vault.resolve(&old_rel)?;
        let n = vault.rename(&old_rel, &new_rel)?;
        let new_abs = vault.resolve(&new_rel)?;
        Ok((n, old_abs, new_abs))
    })?;
    state.vault_manager.record_writes(&id, &[&old_abs, &new_abs])?;
    Ok(node)
}

#[tauri::command]
pub async fn save_asset(
    bytes: Vec<u8>,
    ext: String,
    vault_id: Option<VaultId>,
    state: State<'_, AppState>,
) -> VaultResult<String> {
    let id = resolve_id(&state, vault_id)?;
    let (rel, abs) = state.vault_manager.with_vault(&id, |vault| {
        let rel = vault.save_asset(&bytes, &ext)?;
        let abs = vault.abs_from_rel(&rel)?;
        Ok((rel, abs))
    })?;
    state.vault_manager.record_writes(&id, &[&abs])?;
    Ok(rel)
}

#[tauri::command]
pub async fn abs_path(
    rel_path: String,
    vault_id: Option<VaultId>,
    state: State<'_, AppState>,
) -> VaultResult<String> {
    let id = resolve_id(&state, vault_id)?;
    state.vault_manager.with_vault(&id, |vault| {
        let abs = vault.abs_from_rel(&rel_path)?;
        Ok(abs.to_string_lossy().to_string())
    })
}

#[tauri::command]
pub async fn is_current_vault_trusted(
    app: AppHandle,
    vault_id: Option<VaultId>,
    state: State<'_, AppState>,
) -> VaultResult<bool> {
    let id = resolve_id(&state, vault_id)?;
    state.vault_manager.with_vault(&id, |vault| {
        trust::is_trusted(&app, vault.root()).map_err(VaultError::Io)
    })
}

#[tauri::command]
pub async fn trust_current_vault(
    app: AppHandle,
    vault_id: Option<VaultId>,
    state: State<'_, AppState>,
) -> VaultResult<()> {
    let id = resolve_id(&state, vault_id)?;
    state.vault_manager.with_vault(&id, |vault| {
        trust::trust(&app, vault.root()).map_err(VaultError::Io)
    })
}

#[tauri::command]
pub async fn reveal_in_system(
    rel_path: String,
    app: AppHandle,
    vault_id: Option<VaultId>,
    state: State<'_, AppState>,
) -> VaultResult<()> {
    let id = resolve_id(&state, vault_id)?;
    let abs = state.vault_manager.with_vault(&id, |vault| {
        if !trust::is_trusted(&app, vault.root()).map_err(VaultError::Io)? {
            return Err(VaultError::PermissionRequired(
                vault.root().to_string_lossy().to_string(),
            ));
        }
        vault.resolve(&rel_path)
    })?;

    app.opener()
        .reveal_item_in_dir(&abs)
        .map_err(|e| VaultError::Io(e.to_string()))?;
    Ok(())
}

#[tauri::command]
pub async fn delete_entry(
    rel_path: String,
    vault_id: Option<VaultId>,
    state: State<'_, AppState>,
) -> VaultResult<()> {
    let id = resolve_id(&state, vault_id)?;
    let abs = state.vault_manager.with_vault(&id, |vault| {
        let abs = vault.resolve(&rel_path)?;
        vault.delete_entry(&rel_path)?;
        Ok(abs)
    })?;
    state.vault_manager.record_writes(&id, &[&abs])?;
    Ok(())
}

#[tauri::command]
pub async fn get_thumbnail(
    rel_path: String,
    vault_id: Option<VaultId>,
    state: State<'_, AppState>,
) -> VaultResult<String> {
    let id = resolve_id(&state, vault_id)?;
    state.vault_manager.with_vault(&id, |vault| {
        let path = thumbnail::ensure_thumbnail(vault.root(), &rel_path)?;
        Ok(path.to_string_lossy().to_string())
    })
}

/// `.obsidian/types.json` 읽기. 파일 없으면 빈 맵 — 에러 X.
/// ADR-028 — Obsidian 호환 속성 타입.
#[tauri::command]
pub async fn load_property_types(
    vault_id: Option<VaultId>,
    state: State<'_, AppState>,
) -> VaultResult<std::collections::HashMap<String, String>> {
    let id = resolve_id(&state, vault_id)?;
    state
        .vault_manager
        .with_vault(&id, |vault| Ok(vault.read_property_types()))
}

/// `.obsidian/types.json` 쓰기. self-write suppression 적용.
#[tauri::command]
pub async fn save_property_types(
    types: std::collections::HashMap<String, String>,
    vault_id: Option<VaultId>,
    state: State<'_, AppState>,
) -> VaultResult<()> {
    let id = resolve_id(&state, vault_id)?;
    let abs = state
        .vault_manager
        .with_vault(&id, |vault| vault.write_property_types(&types))?;
    state.vault_manager.record_writes(&id, &[&abs])?;
    Ok(())
}

/// `.munix/workspace.json` 읽기 (ADR-031 D2). 파일 없으면 None.
#[tauri::command]
pub async fn workspace_load(
    vault_id: Option<VaultId>,
    state: State<'_, AppState>,
) -> VaultResult<Option<String>> {
    let id = resolve_id(&state, vault_id)?;
    state
        .vault_manager
        .with_vault(&id, |vault| vault.read_workspace())
}

/// `.munix/workspace.json` 쓰기. self-write suppression 적용.
#[tauri::command]
pub async fn workspace_save(
    json: String,
    vault_id: Option<VaultId>,
    state: State<'_, AppState>,
) -> VaultResult<()> {
    let id = resolve_id(&state, vault_id)?;
    let abs = state
        .vault_manager
        .with_vault(&id, |vault| vault.write_workspace(&json))?;
    state.vault_manager.record_writes(&id, &[&abs])?;
    Ok(())
}

/// `.munix/settings.json` 읽기 (ADR-031 C-3). 파일 없으면 None.
#[tauri::command]
pub async fn vault_settings_load(
    vault_id: Option<VaultId>,
    state: State<'_, AppState>,
) -> VaultResult<Option<String>> {
    let id = resolve_id(&state, vault_id)?;
    state
        .vault_manager
        .with_vault(&id, |vault| vault.read_settings())
}

/// `.munix/settings.json` 쓰기. self-write suppression 적용.
#[tauri::command]
pub async fn vault_settings_save(
    json: String,
    vault_id: Option<VaultId>,
    state: State<'_, AppState>,
) -> VaultResult<()> {
    let id = resolve_id(&state, vault_id)?;
    let abs = state
        .vault_manager
        .with_vault(&id, |vault| vault.write_settings(&json))?;
    state.vault_manager.record_writes(&id, &[&abs])?;
    Ok(())
}

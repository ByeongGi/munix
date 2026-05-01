use std::fs;
use std::io::Write;
use std::path::PathBuf;

use tauri::{AppHandle, Manager};

/// 설정 파일이 저장될 절대 경로를 돌려준다.
///
/// `app_config_dir()` 아래 `settings.json`. 디렉터리가 없으면 생성한다.
pub fn settings_path(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_config_dir()
        .map_err(|e| format!("app_config_dir failed: {e}"))?;
    if !dir.exists() {
        fs::create_dir_all(&dir)
            .map_err(|e| format!("failed to create config dir {}: {e}", dir.display()))?;
    }
    Ok(dir.join("settings.json"))
}

/// 설정 파일을 읽어 JSON 문자열을 돌려준다.
///
/// 파일이 없으면 빈 객체 `"{}"` 를 돌려준다 (마이그레이션 트리거 용).
pub fn load_settings(app: &AppHandle) -> Result<String, String> {
    let path = settings_path(app)?;
    if !path.exists() {
        return Ok("{}".to_string());
    }
    fs::read_to_string(&path).map_err(|e| format!("failed to read {}: {e}", path.display()))
}

/// JSON 문자열을 검증한 뒤 atomic write 로 저장한다.
///
/// 1. `serde_json::Value` 로 파싱이 통과해야 함 (구조 검증은 안 함).
/// 2. 같은 디렉터리에 `.tmp` 로 쓴 뒤 rename — 부분 쓰기로 인한 손상 방지.
pub fn save_settings(app: &AppHandle, json: &str) -> Result<(), String> {
    serde_json::from_str::<serde_json::Value>(json).map_err(|e| format!("invalid JSON: {e}"))?;

    let path = settings_path(app)?;
    let tmp = path.with_extension("json.tmp");

    {
        let mut f = fs::File::create(&tmp)
            .map_err(|e| format!("failed to create {}: {e}", tmp.display()))?;
        f.write_all(json.as_bytes())
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

#[tauri::command]
pub async fn settings_load(app: AppHandle) -> Result<String, String> {
    load_settings(&app)
}

#[tauri::command]
pub async fn settings_save(app: AppHandle, json: String) -> Result<(), String> {
    save_settings(&app, &json)
}

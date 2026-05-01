use std::collections::HashMap;
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use std::thread;

use portable_pty::{native_pty_system, Child, CommandBuilder, MasterPty, PtySize};
use serde::Serialize;
use tauri::{AppHandle, Emitter, State};
use uuid::Uuid;

use crate::commands::terminal_completion::{
    complete, split_command_line, TerminalCompletionSuggestion,
};
use crate::commands::vault::resolve_id;
use crate::error::{VaultError, VaultResult};
use crate::state::AppState;
use crate::vault_manager::VaultId;

const TERMINAL_DATA_EVENT: &str = "terminal:data";
const TERMINAL_EXIT_EVENT: &str = "terminal:exit";

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TerminalSpawnResult {
    pub id: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct TerminalDataPayload {
    id: String,
    data: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct TerminalExitPayload {
    id: String,
}

struct TerminalSession {
    master: Box<dyn MasterPty + Send>,
    writer: Box<dyn Write + Send>,
    child: Box<dyn Child + Send + Sync>,
    cwd: PathBuf,
    input_buffer: String,
    vault_root: PathBuf,
}

#[derive(Default)]
pub struct TerminalManager {
    sessions: Arc<Mutex<HashMap<String, TerminalSession>>>,
}

fn default_shell() -> String {
    #[cfg(target_os = "windows")]
    {
        std::env::var("COMSPEC").unwrap_or_else(|_| "powershell.exe".to_string())
    }

    #[cfg(not(target_os = "windows"))]
    {
        std::env::var("SHELL").unwrap_or_else(|_| "/bin/zsh".to_string())
    }
}

fn emit_terminal_data(app: &AppHandle, id: &str, bytes: &[u8]) {
    let data = String::from_utf8_lossy(bytes).into_owned();
    let _ = app.emit(
        TERMINAL_DATA_EVENT,
        TerminalDataPayload {
            id: id.to_string(),
            data,
        },
    );
}

fn spawn_reader(
    app: AppHandle,
    id: String,
    mut reader: Box<dyn Read + Send>,
    sessions: Arc<Mutex<HashMap<String, TerminalSession>>>,
) {
    thread::spawn(move || {
        let mut buf = [0_u8; 8192];
        loop {
            match reader.read(&mut buf) {
                Ok(0) => break,
                Ok(n) => emit_terminal_data(&app, &id, &buf[..n]),
                Err(_) => break,
            }
        }

        if let Ok(mut sessions) = sessions.lock() {
            sessions.remove(&id);
        }

        let _ = app.emit(TERMINAL_EXIT_EVENT, TerminalExitPayload { id });
    });
}

fn resolve_child_dir(cwd: &Path, raw_path: &str, vault_root: &Path) -> Option<PathBuf> {
    let stripped = raw_path.trim().trim_matches('"').trim_matches('\'');
    let candidate = if stripped.is_empty() || stripped == "~" {
        vault_root.to_path_buf()
    } else {
        let path = PathBuf::from(stripped);
        if path.is_absolute() {
            path
        } else {
            cwd.join(path)
        }
    };

    let canonical = candidate.canonicalize().ok()?;
    if canonical.is_dir() {
        Some(canonical)
    } else {
        None
    }
}

fn apply_completed_command_to_cwd(session: &mut TerminalSession) {
    let command = session.input_buffer.trim();
    if command.is_empty() {
        session.input_buffer.clear();
        return;
    }

    let tokens = split_command_line(command);
    if tokens.first().map(String::as_str) == Some("cd") {
        let target = tokens.get(1).map(String::as_str).unwrap_or("");
        if let Some(next_cwd) = resolve_child_dir(&session.cwd, target, &session.vault_root) {
            session.cwd = next_cwd;
        }
    }

    session.input_buffer.clear();
}

fn update_session_input(session: &mut TerminalSession, data: &str) {
    if data == "\r" {
        apply_completed_command_to_cwd(session);
        return;
    }
    if data == "\u{3}" || data == "\u{15}" {
        session.input_buffer.clear();
        return;
    }
    if data == "\u{7f}" || data == "\u{8}" {
        session.input_buffer.pop();
        return;
    }
    if data == "\u{17}" {
        let next = session.input_buffer.replace('\t', " ");
        session.input_buffer = next
            .trim_end()
            .rsplit_once(' ')
            .map_or_else(String::new, |(prefix, _)| format!("{prefix} "));
        return;
    }
    if data.starts_with('\u{1b}') {
        return;
    }
    if data.chars().all(|ch| (' '..='~').contains(&ch)) {
        session.input_buffer.push_str(data);
    }
}

#[tauri::command]
pub async fn terminal_complete(
    input: String,
    history: Vec<String>,
    session_id: Option<String>,
    vault_id: Option<VaultId>,
    state: State<'_, AppState>,
) -> VaultResult<Vec<TerminalCompletionSuggestion>> {
    if input.trim_start().is_empty() {
        return Ok(Vec::new());
    }

    let id = resolve_id(&state, vault_id)?;
    let vault_root: PathBuf = state
        .vault_manager
        .with_vault(&id, |vault| Ok(vault.root().to_path_buf()))?;
    let cwd = session_id
        .as_ref()
        .and_then(|id| {
            state
                .terminal_manager
                .sessions
                .lock()
                .ok()
                .and_then(|sessions| sessions.get(id).map(|session| session.cwd.clone()))
        })
        .unwrap_or_else(|| vault_root.clone());
    Ok(complete(input, history, cwd, vault_root))
}

#[tauri::command]
pub async fn terminal_spawn(
    cols: u16,
    rows: u16,
    vault_id: Option<VaultId>,
    app: AppHandle,
    state: State<'_, AppState>,
) -> VaultResult<TerminalSpawnResult> {
    let id = resolve_id(&state, vault_id)?;
    let cwd: PathBuf = state
        .vault_manager
        .with_vault(&id, |vault| Ok(vault.root().to_path_buf()))?;

    let pty_system = native_pty_system();
    let pair = pty_system
        .openpty(PtySize {
            rows,
            cols,
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|e| VaultError::Io(e.to_string()))?;

    let mut command = CommandBuilder::new(default_shell());
    command.cwd(&cwd);
    command.env("TERM", "xterm-256color");
    command.env("COLORTERM", "truecolor");

    let child = pair
        .slave
        .spawn_command(command)
        .map_err(|e| VaultError::Io(e.to_string()))?;
    let reader = pair
        .master
        .try_clone_reader()
        .map_err(|e| VaultError::Io(e.to_string()))?;
    let writer = pair
        .master
        .take_writer()
        .map_err(|e| VaultError::Io(e.to_string()))?;

    let terminal_id = Uuid::new_v4().to_string();
    spawn_reader(
        app,
        terminal_id.clone(),
        reader,
        state.terminal_manager.sessions.clone(),
    );

    let mut sessions = state
        .terminal_manager
        .sessions
        .lock()
        .map_err(|e| VaultError::Io(format!("terminal mutex poisoned: {e}")))?;
    sessions.insert(
        terminal_id.clone(),
        TerminalSession {
            master: pair.master,
            writer,
            child,
            cwd: cwd.clone(),
            input_buffer: String::new(),
            vault_root: cwd,
        },
    );

    Ok(TerminalSpawnResult { id: terminal_id })
}

#[tauri::command]
pub async fn terminal_write(
    id: String,
    data: String,
    state: State<'_, AppState>,
) -> VaultResult<()> {
    let mut sessions = state
        .terminal_manager
        .sessions
        .lock()
        .map_err(|e| VaultError::Io(format!("terminal mutex poisoned: {e}")))?;
    let session = sessions
        .get_mut(&id)
        .ok_or_else(|| VaultError::NotFound(format!("terminal session {id}")))?;
    update_session_input(session, &data);
    session
        .writer
        .write_all(data.as_bytes())
        .map_err(|e| VaultError::Io(e.to_string()))
}

#[tauri::command]
pub async fn terminal_resize(
    id: String,
    cols: u16,
    rows: u16,
    state: State<'_, AppState>,
) -> VaultResult<()> {
    let mut sessions = state
        .terminal_manager
        .sessions
        .lock()
        .map_err(|e| VaultError::Io(format!("terminal mutex poisoned: {e}")))?;
    let session = sessions
        .get_mut(&id)
        .ok_or_else(|| VaultError::NotFound(format!("terminal session {id}")))?;
    session
        .master
        .resize(PtySize {
            rows,
            cols,
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|e| VaultError::Io(e.to_string()))
}

#[tauri::command]
pub async fn terminal_kill(id: String, state: State<'_, AppState>) -> VaultResult<()> {
    let session = state
        .terminal_manager
        .sessions
        .lock()
        .map_err(|e| VaultError::Io(format!("terminal mutex poisoned: {e}")))?
        .remove(&id);

    if let Some(mut session) = session {
        session
            .child
            .kill()
            .map_err(|e| VaultError::Io(e.to_string()))?;
    }

    Ok(())
}

use std::fmt;
use std::sync::OnceLock;

use serde::{Deserialize, Serialize};

use crate::cli::CliInvocation;

pub const CLI_EVENT_NAME: &str = "munix-cli-command";
static CLI_SERVER_STARTED: OnceLock<()> = OnceLock::new();

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CliIpcResponse {
    pub ok: bool,
    pub message: String,
}

#[derive(Debug)]
pub enum CliIpcError {
    UnsupportedPlatform,
    Io(std::io::Error),
    Serde(serde_json::Error),
}

impl fmt::Display for CliIpcError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::UnsupportedPlatform => write!(f, "local CLI IPC is not implemented on this OS"),
            Self::Io(e) => write!(f, "{e}"),
            Self::Serde(e) => write!(f, "{e}"),
        }
    }
}

impl std::error::Error for CliIpcError {}

impl From<std::io::Error> for CliIpcError {
    fn from(value: std::io::Error) -> Self {
        Self::Io(value)
    }
}

impl From<serde_json::Error> for CliIpcError {
    fn from(value: serde_json::Error) -> Self {
        Self::Serde(value)
    }
}

#[cfg(unix)]
mod unix {
    use std::fs;
    use std::io::{Read, Write};
    use std::net::Shutdown;
    use std::os::unix::net::{UnixListener, UnixStream};
    use std::path::PathBuf;
    use std::thread;

    use tauri::{AppHandle, Emitter};

    use super::{CliInvocation, CliIpcError, CliIpcResponse, CLI_EVENT_NAME};

    pub fn socket_path() -> PathBuf {
        let user = std::env::var("USER")
            .or_else(|_| std::env::var("USERNAME"))
            .unwrap_or_else(|_| "default".to_string())
            .chars()
            .map(|ch| {
                if ch.is_ascii_alphanumeric() || ch == '-' || ch == '_' {
                    ch
                } else {
                    '_'
                }
            })
            .collect::<String>();
        std::env::temp_dir().join(format!("munix-{user}.sock"))
    }

    pub fn start_server(app: AppHandle) -> Result<(), CliIpcError> {
        let path = socket_path();
        if path.exists() {
            fs::remove_file(&path)?;
        }

        let listener = match UnixListener::bind(&path) {
            Ok(listener) => listener,
            Err(e) => {
                log::warn!("failed to bind munix CLI socket {}: {e}", path.display());
                return Err(e.into());
            }
        };

        thread::spawn(move || {
            for stream in listener.incoming() {
                match stream {
                    Ok(stream) => handle_stream(stream, app.clone()),
                    Err(e) => log::warn!("munix CLI socket accept failed: {e}"),
                }
            }
        });

        Ok(())
    }

    pub fn send_invocation(invocation: &CliInvocation) -> Result<CliIpcResponse, CliIpcError> {
        let path = socket_path();
        let mut stream = UnixStream::connect(&path)?;
        let request = serde_json::to_string(invocation)?;
        stream.write_all(request.as_bytes())?;
        stream.shutdown(Shutdown::Write)?;

        let mut response = String::new();
        stream.read_to_string(&mut response)?;
        Ok(serde_json::from_str::<CliIpcResponse>(&response)?)
    }

    fn handle_stream(mut stream: UnixStream, app: AppHandle) {
        let response = match read_invocation(&mut stream) {
            Ok(invocation) => match app.emit(CLI_EVENT_NAME, invocation) {
                Ok(()) => CliIpcResponse {
                    ok: true,
                    message: "accepted".to_string(),
                },
                Err(e) => CliIpcResponse {
                    ok: false,
                    message: format!("failed to emit command: {e}"),
                },
            },
            Err(e) => CliIpcResponse {
                ok: false,
                message: e.to_string(),
            },
        };

        if let Ok(raw) = serde_json::to_string(&response) {
            let _ = stream.write_all(raw.as_bytes());
        }
    }

    fn read_invocation(stream: &mut UnixStream) -> Result<CliInvocation, CliIpcError> {
        let mut request = String::new();
        stream.read_to_string(&mut request)?;
        Ok(serde_json::from_str::<CliInvocation>(&request)?)
    }
}

#[cfg(unix)]
pub fn start_server(app: tauri::AppHandle) -> Result<(), CliIpcError> {
    unix::start_server(app)
}

#[cfg(not(unix))]
pub fn start_server(_app: tauri::AppHandle) -> Result<(), CliIpcError> {
    Err(CliIpcError::UnsupportedPlatform)
}

#[tauri::command]
pub fn start_cli_ipc_server(app: tauri::AppHandle) -> Result<(), String> {
    if CLI_SERVER_STARTED.get().is_some() {
        return Ok(());
    }

    start_server(app).map_err(|e| e.to_string())?;
    let _ = CLI_SERVER_STARTED.set(());
    Ok(())
}

#[cfg(unix)]
pub fn send_invocation(invocation: &CliInvocation) -> Result<CliIpcResponse, CliIpcError> {
    unix::send_invocation(invocation)
}

#[cfg(not(unix))]
pub fn send_invocation(_invocation: &CliInvocation) -> Result<CliIpcResponse, CliIpcError> {
    Err(CliIpcError::UnsupportedPlatform)
}

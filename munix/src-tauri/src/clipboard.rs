use std::io::Write;
use std::process::{Command, Stdio};

fn run_clipboard_command(program: &str, args: &[&str], text: &str) -> Result<(), String> {
    let mut child = Command::new(program)
        .args(args)
        .stdin(Stdio::piped())
        .spawn()
        .map_err(|e| format!("failed to spawn {program}: {e}"))?;

    {
        let stdin = child
            .stdin
            .as_mut()
            .ok_or_else(|| format!("failed to open stdin for {program}"))?;
        stdin
            .write_all(text.as_bytes())
            .map_err(|e| format!("failed to write to {program}: {e}"))?;
    }

    let status = child
        .wait()
        .map_err(|e| format!("failed to wait for {program}: {e}"))?;
    if status.success() {
        Ok(())
    } else {
        Err(format!("{program} exited with status {status}"))
    }
}

pub fn write_text(text: &str) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        return run_clipboard_command("pbcopy", &[], text);
    }

    #[cfg(target_os = "windows")]
    {
        return run_clipboard_command("clip", &[], text);
    }

    #[cfg(all(unix, not(target_os = "macos")))]
    {
        run_clipboard_command("wl-copy", &[], text)
            .or_else(|_| run_clipboard_command("xclip", &["-selection", "clipboard"], text))
            .or_else(|_| run_clipboard_command("xsel", &["--clipboard", "--input"], text))
    }

    #[cfg(not(any(target_os = "macos", target_os = "windows", unix)))]
    {
        Err("clipboard is not supported on this platform".to_string())
    }
}

#[tauri::command]
pub async fn copy_text(text: String) -> Result<(), String> {
    write_text(&text)
}

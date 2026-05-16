use std::env;
use std::path::PathBuf;
use std::process;
use std::thread;
use std::time::Duration;

use munix_lib::cli::{parse_args, CliCommand, CliInvocation, CLI_HELP};
use munix_lib::cli_ipc::{send_invocation, CliIpcError, CliIpcResponse};

fn main() {
    let args = env::args().skip(1).collect::<Vec<_>>();
    let invocation = match parse_args(&args) {
        Ok(invocation) => invocation,
        Err(e) => {
            eprintln!("munix: {e}");
            eprintln!("Try `munix help`.");
            process::exit(64);
        }
    };

    match &invocation.command {
        CliCommand::Tui | CliCommand::Help { .. } => {
            print!("{CLI_HELP}");
        }
        CliCommand::Version => {
            println!("{}", env!("CARGO_PKG_VERSION"));
        }
        _ => match send_or_start_app(&invocation) {
            Ok(response) if response.ok => {}
            Ok(response) => {
                eprintln!("munix: {}", response.message);
                process::exit(69);
            }
            Err(e) => {
                eprintln!("munix: failed to connect to Munix app: {e}");
                eprintln!("Start Munix first, then retry the command.");
                process::exit(69);
            }
        },
    }
}

fn send_or_start_app(invocation: &CliInvocation) -> Result<CliIpcResponse, CliIpcError> {
    match send_invocation(invocation) {
        Ok(response) => Ok(response),
        Err(first_error) => {
            if !try_start_app() {
                return Err(first_error);
            }

            for _ in 0..100 {
                thread::sleep(Duration::from_millis(100));
                if let Ok(response) = send_invocation(invocation) {
                    return Ok(response);
                }
            }

            Err(first_error)
        }
    }
}

#[cfg(target_os = "macos")]
fn try_start_app() -> bool {
    for app_path in candidate_app_paths() {
        if app_path.exists() {
            return process::Command::new("open")
                .arg(app_path)
                .status()
                .map(|status| status.success())
                .unwrap_or(false);
        }
    }
    false
}

#[cfg(not(target_os = "macos"))]
fn try_start_app() -> bool {
    false
}

#[cfg(target_os = "macos")]
fn candidate_app_paths() -> Vec<PathBuf> {
    let mut paths = Vec::new();
    if let Ok(path) = env::var("MUNIX_APP_PATH") {
        paths.push(PathBuf::from(path));
    }
    if let Some(home) = env::var_os("HOME") {
        paths.push(PathBuf::from(home).join("Applications/munix.app"));
    }
    paths.push(PathBuf::from("/Applications/munix.app"));
    paths
}

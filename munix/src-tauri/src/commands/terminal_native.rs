#[cfg(not(feature = "native-libghostty"))]
use std::collections::HashMap;
#[cfg(not(feature = "native-libghostty"))]
use std::sync::{Mutex, OnceLock};

use serde::Serialize;
use tauri::{AppHandle, State};
use uuid::Uuid;

use crate::commands::vault::resolve_id;
use crate::error::VaultResult;
use crate::state::AppState;
use crate::vault_manager::VaultId;

const MAIN_WINDOW_LABEL: &str = "main";

#[cfg(not(feature = "native-libghostty"))]
static NATIVE_TERMINAL_VIEWS: OnceLock<Mutex<HashMap<String, usize>>> = OnceLock::new();

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NativeTerminalAvailability {
    pub available: bool,
    pub host_view_ready: bool,
    pub platform: &'static str,
    pub reason: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NativeTerminalOpenResult {
    pub id: String,
}

#[tauri::command]
pub async fn terminal_native_is_available(app: AppHandle) -> NativeTerminalAvailability {
    let host_view_ready = platform::host_view_ready(&app);
    let available = platform::native_available(host_view_ready);

    NativeTerminalAvailability {
        available,
        host_view_ready,
        platform: platform::name(),
        reason: (!available).then(|| platform::unavailable_reason(host_view_ready)),
    }
}

#[tauri::command]
pub async fn terminal_native_open(
    vault_id: Option<VaultId>,
    app: AppHandle,
    state: State<'_, AppState>,
) -> VaultResult<NativeTerminalOpenResult> {
    let id = resolve_id(&state, vault_id)?;
    let cwd = state
        .vault_manager
        .with_vault(&id, |vault| Ok(vault.root().to_path_buf()))?;

    let terminal_id = Uuid::new_v4().to_string();
    platform::open_placeholder_surface(
        &app,
        terminal_id.clone(),
        cwd.to_string_lossy().into_owned(),
    )
    .await?;
    Ok(NativeTerminalOpenResult { id: terminal_id })
}

#[tauri::command]
pub async fn terminal_native_focus(id: String, app: AppHandle) -> VaultResult<()> {
    platform::focus_placeholder_surface(&app, id).await
}

#[tauri::command]
pub async fn terminal_native_close(id: String, app: AppHandle) -> VaultResult<()> {
    platform::close_placeholder_surface(&app, id).await
}

#[tauri::command]
pub async fn terminal_native_set_bounds(
    id: String,
    x: f64,
    y: f64,
    width: f64,
    height: f64,
    app: AppHandle,
) -> VaultResult<()> {
    platform::set_placeholder_surface_bounds(&app, id, x, y, width, height).await
}

#[cfg(target_os = "macos")]
mod platform {
    use std::sync::mpsc;

    #[cfg(not(feature = "native-libghostty"))]
    use objc2::rc::Retained;
    #[cfg(not(feature = "native-libghostty"))]
    use objc2::{MainThreadMarker, MainThreadOnly};
    #[cfg(not(feature = "native-libghostty"))]
    use objc2_app_kit::{NSColor, NSView};
    #[cfg(not(feature = "native-libghostty"))]
    use objc2_foundation::{NSPoint, NSRect, NSSize};
    #[cfg(not(feature = "native-libghostty"))]
    use objc2_quartz_core::CALayer;
    use tauri::{AppHandle, Manager};

    use crate::error::{VaultError, VaultResult};

    use super::MAIN_WINDOW_LABEL;
    #[cfg(not(feature = "native-libghostty"))]
    use super::NATIVE_TERMINAL_VIEWS;

    pub fn name() -> &'static str {
        "macos"
    }

    pub fn native_available(host_view_ready: bool) -> bool {
        #[cfg(feature = "native-libghostty")]
        {
            host_view_ready
        }

        #[cfg(not(feature = "native-libghostty"))]
        {
            let _ = host_view_ready;
            false
        }
    }

    pub fn host_view_ready(app: &AppHandle) -> bool {
        let Some(window) = app.get_webview_window(MAIN_WINDOW_LABEL) else {
            return false;
        };

        let ns_window_ready = window
            .ns_window()
            .map(|handle| !handle.is_null())
            .unwrap_or(false);
        let ns_view_ready = window
            .ns_view()
            .map(|handle| !handle.is_null())
            .unwrap_or(false);

        ns_window_ready && ns_view_ready
    }

    pub fn unavailable_reason(host_view_ready: bool) -> String {
        if !host_view_ready {
            "main native host view is not available yet".to_string()
        } else {
            #[cfg(feature = "native-libghostty")]
            {
                "native libghostty terminal bridge is not available".to_string()
            }

            #[cfg(not(feature = "native-libghostty"))]
            {
                "native libghostty terminal bridge was not compiled into this build".to_string()
            }
        }
    }

    pub async fn open_placeholder_surface(
        app: &AppHandle,
        id: String,
        working_directory: String,
    ) -> VaultResult<()> {
        run_on_main(app, move |app| {
            let Some(window) = app.get_webview_window(MAIN_WINDOW_LABEL) else {
                return Err("main window is not available".to_string());
            };
            let parent = window.ns_view().map_err(|e| e.to_string())?;
            if parent.is_null() {
                return Err("main NSView is null".to_string());
            }

            #[cfg(feature = "native-libghostty")]
            {
                crate::terminal_swift_bridge::open(&app, parent.cast(), &id, &working_directory)
                    .map_err(|error| error.to_string())?;
                Ok(())
            }

            #[cfg(not(feature = "native-libghostty"))]
            {
                let _ = &working_directory;
                let mtm = MainThreadMarker::new().ok_or_else(|| {
                    "native terminal surface must be created on main thread".to_string()
                })?;
                let parent = unsafe { &*(parent.cast::<NSView>()) };
                let frame = NSRect::new(NSPoint::new(0.0, 0.0), NSSize::new(1.0, 1.0));
                let view = NSView::initWithFrame(NSView::alloc(mtm), frame);
                view.setWantsLayer(true);

                let layer = CALayer::new();
                let color = NSColor::colorWithSRGBRed_green_blue_alpha(0.02, 0.24, 0.22, 0.92);
                let cg_color = color.CGColor();
                layer.setBackgroundColor(Some(&cg_color));
                view.setLayer(Some(&layer));
                parent.addSubview(&view);

                let raw = Retained::into_raw(view) as usize;
                native_views()
                    .lock()
                    .map_err(|e| format!("native terminal registry poisoned: {e}"))?
                    .insert(id.clone(), raw);

                Ok(())
            }
        })
        .await
    }

    pub async fn focus_placeholder_surface(app: &AppHandle, id: String) -> VaultResult<()> {
        run_on_main(app, move |_app| {
            #[cfg(feature = "native-libghostty")]
            {
                crate::terminal_swift_bridge::focus(&id, true)
                    .map_err(|error| error.to_string())?;
                Ok(())
            }

            #[cfg(not(feature = "native-libghostty"))]
            {
                let view = view_ptr(&id)?;
                view.setNeedsDisplay(true);
                Ok(())
            }
        })
        .await
    }

    pub async fn close_placeholder_surface(app: &AppHandle, id: String) -> VaultResult<()> {
        run_on_main(app, move |_app| {
            #[cfg(feature = "native-libghostty")]
            {
                crate::terminal_swift_bridge::close(&id).map_err(|error| error.to_string())?;
                Ok(())
            }

            #[cfg(not(feature = "native-libghostty"))]
            {
                let raw = native_views()
                    .lock()
                    .map_err(|e| format!("native terminal registry poisoned: {e}"))?
                    .remove(&id);
                if let Some(raw) = raw {
                    let view = unsafe { Retained::from_raw(raw as *mut NSView) }
                        .ok_or_else(|| "native terminal NSView pointer is null".to_string())?;
                    view.removeFromSuperview();
                }
                Ok(())
            }
        })
        .await
    }

    pub async fn set_placeholder_surface_bounds(
        app: &AppHandle,
        id: String,
        x: f64,
        y: f64,
        width: f64,
        height: f64,
    ) -> VaultResult<()> {
        run_on_main(app, move |_app| {
            #[cfg(feature = "native-libghostty")]
            {
                crate::terminal_swift_bridge::set_bounds(&id, x, y, width, height)
                    .map_err(|error| error.to_string())?;
                Ok(())
            }

            #[cfg(not(feature = "native-libghostty"))]
            {
                let view = view_ptr(&id)?;
                let frame = NSRect::new(
                    NSPoint::new(x, y),
                    NSSize::new(width.max(1.0), height.max(1.0)),
                );
                view.setFrame(frame);
                view.setNeedsDisplay(true);

                Ok(())
            }
        })
        .await
    }

    async fn run_on_main<F>(app: &AppHandle, task: F) -> VaultResult<()>
    where
        F: FnOnce(AppHandle) -> Result<(), String> + Send + 'static,
    {
        let (tx, rx) = mpsc::channel();
        let app_for_task = app.clone();
        app.run_on_main_thread(move || {
            let result = task(app_for_task);
            let _ = tx.send(result);
        })
        .map_err(|e| VaultError::Io(e.to_string()))?;

        rx.recv()
            .map_err(|e| VaultError::Io(e.to_string()))?
            .map_err(VaultError::Io)
    }

    #[cfg(not(feature = "native-libghostty"))]
    fn native_views() -> &'static std::sync::Mutex<std::collections::HashMap<String, usize>> {
        NATIVE_TERMINAL_VIEWS.get_or_init(Default::default)
    }

    #[cfg(not(feature = "native-libghostty"))]
    fn view_ptr(id: &str) -> Result<&'static NSView, String> {
        let raw = native_views()
            .lock()
            .map_err(|e| format!("native terminal registry poisoned: {e}"))?
            .get(id)
            .copied()
            .ok_or_else(|| format!("native terminal surface {id} not found"))?;
        Ok(unsafe { &*(raw as *mut NSView) })
    }
}

#[cfg(not(target_os = "macos"))]
mod platform {
    use tauri::AppHandle;

    use crate::error::{VaultError, VaultResult};

    pub fn name() -> &'static str {
        if cfg!(target_os = "windows") {
            "windows"
        } else if cfg!(target_os = "linux") {
            "linux"
        } else {
            "unsupported"
        }
    }

    pub fn native_available(_host_view_ready: bool) -> bool {
        false
    }

    pub fn host_view_ready(_app: &AppHandle) -> bool {
        false
    }

    pub fn unavailable_reason(_host_view_ready: bool) -> String {
        "native libghostty terminal bridge will start on macOS first".to_string()
    }

    pub async fn open_placeholder_surface(
        _app: &AppHandle,
        _id: String,
        _working_directory: String,
    ) -> VaultResult<()> {
        Err(VaultError::Io(unavailable_reason(false)))
    }

    pub async fn focus_placeholder_surface(_app: &AppHandle, _id: String) -> VaultResult<()> {
        Err(VaultError::Io(unavailable_reason(false)))
    }

    pub async fn close_placeholder_surface(_app: &AppHandle, _id: String) -> VaultResult<()> {
        Err(VaultError::Io(unavailable_reason(false)))
    }

    pub async fn set_placeholder_surface_bounds(
        _app: &AppHandle,
        _id: String,
        _x: f64,
        _y: f64,
        _width: f64,
        _height: f64,
    ) -> VaultResult<()> {
        Err(VaultError::Io(unavailable_reason(false)))
    }
}

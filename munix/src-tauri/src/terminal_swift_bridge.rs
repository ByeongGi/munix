use std::ffi::{c_char, c_void, CStr, CString};
use std::sync::{Mutex, OnceLock};

use serde::Serialize;
use tauri::{AppHandle, Emitter};

use crate::error::{VaultError, VaultResult};

static TERMINAL_EVENT_APP: OnceLock<Mutex<Option<AppHandle>>> = OnceLock::new();

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct NativeTerminalEventPayload {
    id: String,
    kind: String,
    detail: Option<String>,
}

extern "C" {
    fn munix_terminal_bridge_set_event_callback(
        callback: Option<extern "C" fn(*const c_char, *const c_char, *const c_char)>,
    );
    fn munix_terminal_bridge_open(
        parent: *mut c_void,
        id: *const c_char,
        cwd: *const c_char,
    ) -> *mut c_char;
    fn munix_terminal_bridge_set_bounds(
        id: *const c_char,
        x: f64,
        y: f64,
        width: f64,
        height: f64,
    ) -> *mut c_char;
    fn munix_terminal_bridge_focus(id: *const c_char, focused: bool) -> *mut c_char;
    fn munix_terminal_bridge_close(id: *const c_char) -> *mut c_char;
    fn munix_terminal_bridge_string_free(message: *mut c_char);
}

pub fn open(app: &AppHandle, parent: *mut c_void, id: &str, cwd: &str) -> VaultResult<()> {
    register_event_app(app)?;
    let id = cstring("terminal id", id)?;
    let cwd = cstring("working directory", cwd)?;
    unsafe {
        check_bridge_error(munix_terminal_bridge_open(
            parent,
            id.as_ptr(),
            cwd.as_ptr(),
        ))
    }
}

pub fn set_bounds(id: &str, x: f64, y: f64, width: f64, height: f64) -> VaultResult<()> {
    let id = cstring("terminal id", id)?;
    unsafe {
        check_bridge_error(munix_terminal_bridge_set_bounds(
            id.as_ptr(),
            x,
            y,
            width,
            height,
        ))
    }
}

pub fn focus(id: &str, focused: bool) -> VaultResult<()> {
    let id = cstring("terminal id", id)?;
    unsafe { check_bridge_error(munix_terminal_bridge_focus(id.as_ptr(), focused)) }
}

pub fn close(id: &str) -> VaultResult<()> {
    let id = cstring("terminal id", id)?;
    unsafe { check_bridge_error(munix_terminal_bridge_close(id.as_ptr())) }
}

fn register_event_app(app: &AppHandle) -> VaultResult<()> {
    let app_slot = TERMINAL_EVENT_APP.get_or_init(Default::default);
    let mut guard = app_slot.lock().map_err(|error| {
        VaultError::Io(format!("native terminal event app lock poisoned: {error}"))
    })?;
    *guard = Some(app.clone());
    unsafe {
        munix_terminal_bridge_set_event_callback(Some(native_terminal_event_callback));
    }
    Ok(())
}

fn cstring(label: &str, value: &str) -> VaultResult<CString> {
    CString::new(value).map_err(|_| VaultError::Io(format!("{label} contains a nul byte")))
}

unsafe fn check_bridge_error(message: *mut c_char) -> VaultResult<()> {
    if message.is_null() {
        return Ok(());
    }

    let error = CStr::from_ptr(message).to_string_lossy().into_owned();
    munix_terminal_bridge_string_free(message);
    Err(VaultError::Io(error))
}

extern "C" fn native_terminal_event_callback(
    id: *const c_char,
    kind: *const c_char,
    detail: *const c_char,
) {
    let Some(payload) = (unsafe { native_terminal_event_payload(id, kind, detail) }) else {
        return;
    };

    let Some(app_slot) = TERMINAL_EVENT_APP.get() else {
        return;
    };
    let app = app_slot.lock().ok().and_then(|guard| guard.clone());
    if let Some(app) = app {
        let _ = app.emit("terminal:native-event", payload);
    }
}

unsafe fn native_terminal_event_payload(
    id: *const c_char,
    kind: *const c_char,
    detail: *const c_char,
) -> Option<NativeTerminalEventPayload> {
    if id.is_null() || kind.is_null() {
        return None;
    }

    Some(NativeTerminalEventPayload {
        id: CStr::from_ptr(id).to_string_lossy().into_owned(),
        kind: CStr::from_ptr(kind).to_string_lossy().into_owned(),
        detail: if detail.is_null() {
            None
        } else {
            Some(CStr::from_ptr(detail).to_string_lossy().into_owned())
        },
    })
}

use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use notify::{EventKind, RecursiveMode};
use notify_debouncer_full::{new_debouncer, notify, DebounceEventResult, Debouncer, FileIdMap};
use serde::Serialize;
use tauri::{AppHandle, Emitter};

use crate::error::{VaultError, VaultResult};

pub type RecentWrites = Arc<Mutex<HashMap<PathBuf, Instant>>>;

const DEBOUNCE_MS: u64 = 150;
const SELF_WRITE_SUPPRESS_MS: u128 = 1500;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileChangeEvent {
    pub vault_id: String, // ADR-031: 멀티 vault 라우팅용
    pub kind: String,     // "modified" | "created" | "deleted"
    pub path: String,     // vault root 기준 상대 경로, POSIX 구분자
}

pub struct VaultWatcher {
    // Debouncer drop 시 watcher 정지
    _debouncer: Debouncer<notify::RecommendedWatcher, FileIdMap>,
}

impl VaultWatcher {
    pub fn spawn(
        app: AppHandle,
        root: PathBuf,
        vault_id: String,
        recent_writes: RecentWrites,
    ) -> VaultResult<Self> {
        let root_for_cb = root.clone();
        let id_for_cb = vault_id.clone();
        let mut debouncer = new_debouncer(
            Duration::from_millis(DEBOUNCE_MS),
            None,
            move |result: DebounceEventResult| match result {
                Ok(events) => {
                    for event in events {
                        handle_event(&app, &id_for_cb, &root_for_cb, &recent_writes, &event);
                    }
                }
                Err(errs) => {
                    for err in errs {
                        eprintln!("[watcher] {err}");
                    }
                }
            },
        )
        .map_err(|e| VaultError::Io(format!("watcher init: {e}")))?;

        debouncer
            .watch(&root, RecursiveMode::Recursive)
            .map_err(|e| VaultError::Io(format!("watcher watch: {e}")))?;

        Ok(Self {
            _debouncer: debouncer,
        })
    }
}

pub fn record_write(recent: &RecentWrites, paths: &[&Path]) {
    let mut guard = match recent.lock() {
        Ok(g) => g,
        Err(_) => return,
    };
    let now = Instant::now();
    for p in paths {
        guard.insert((*p).to_path_buf(), now);
    }
    // 주기적 정리
    guard.retain(|_, t| now.duration_since(*t).as_millis() < 5000);
}

fn handle_event(
    app: &AppHandle,
    vault_id: &str,
    root: &Path,
    recent: &RecentWrites,
    event: &notify_debouncer_full::DebouncedEvent,
) {
    for path in &event.paths {
        if let Some(payload) = map_event(vault_id, path, root, &event.kind, recent) {
            if let Err(e) = app.emit("vault:fs-changed", &payload) {
                eprintln!("[watcher] emit failed: {e}");
            }
        }
    }
}

fn map_event(
    vault_id: &str,
    abs_path: &Path,
    root: &Path,
    kind: &EventKind,
    recent: &RecentWrites,
) -> Option<FileChangeEvent> {
    // vault 루트 밖은 무시
    let rel = abs_path.strip_prefix(root).ok()?;
    let rel_str = rel.to_string_lossy().replace('\\', "/");

    if rel_str.is_empty() {
        return None;
    }

    // `.munix/` 및 숨김 경로 무시
    if rel
        .components()
        .any(|c| c.as_os_str().to_string_lossy().starts_with('.'))
    {
        return None;
    }

    // 모든 파일/폴더 이벤트 허용 (트리 표시용). `.munix/`·숨김은 위에서 이미 필터됨

    // 자기 쓰기 echo suppression
    //
    // 동일 path에 대해 record_write 호출 후 SELF_WRITE_SUPPRESS_MS(=1500ms) 윈도우 안의
    // *모든* watcher 이벤트를 무시한다. notify-debouncer가 한 번의 atomic write에 대해
    // 여러 이벤트(임시 파일 생성/이름 바꾸기/속성 변경 등)를 발동할 수 있어, 한 이벤트만
    // 무시하면 나머지가 reload를 잘못 트리거하기 때문.
    //
    // 부작용 인지: 윈도우 안에 외부 도구가 같은 파일을 수정해도 그 이벤트 역시 묻힘.
    // 1500ms는 짧은 대신 race가 흔하지 않다는 가정. ADR-021 참조.
    //
    // GC는 윈도우의 약 3배(5000ms)로 잡아 만료된 entry를 청소.
    if let Ok(mut guard) = recent.lock() {
        let now = Instant::now();
        if let Some(t) = guard.get(abs_path) {
            if now.duration_since(*t).as_millis() < SELF_WRITE_SUPPRESS_MS {
                return None;
            }
        }
        guard.retain(|_, t| now.duration_since(*t).as_millis() < 5000);
    }

    let kind_str = match kind {
        EventKind::Create(_) => "created",
        EventKind::Modify(_) => "modified",
        EventKind::Remove(_) => "deleted",
        _ => return None,
    };

    Some(FileChangeEvent {
        vault_id: vault_id.to_string(),
        kind: kind_str.to_string(),
        path: rel_str,
    })
}

# Vault Manager 상세 설계 — Munix

> Rust 백엔드에서 파일 시스템을 추상화하는 Vault 레이어. 모든 FS 접근의 단일 진입점.

> **2026-04-26 갱신:** [ADR-031](../decisions.md#adr-031-멀티-vault-워크스페이스-cmux-스타일-좌측-세로-탭)에 따라 "여러 vault 동시 운영" 레이어가 추가된다. 본 문서는 **한 vault 안의 보안·경로·원자적 쓰기·IPC 계약** 본질에 집중하며, 멀티 vault 운영(VaultManager, vault_id 라우팅, 워크스페이스 격리, Vault Dock UX)은 [multi-vault-spec.md](./multi-vault-spec.md)에서 다룬다. §4.2 AppState와 §6 Tauri 커맨드 시그니처는 ADR-031 적용 시 갱신 예정 (현재 문서는 단일 vault 시점 기준).

---

## 1. 목적

- 사용자가 선택한 루트 폴더(= Vault)를 안전하게 관리
- 경로 traversal·심볼릭 링크 우회 등 보안 위험 차단
- 원자적 쓰기로 데이터 손실 방지
- React 쪽에 IPC로 노출되는 유일한 파일 시스템 API

## 2. 용어

| 용어 | 정의 |
|------|------|
| **Vault** | 사용자가 선택한 루트 디렉토리. 예: `~/Documents/Munix/` |
| **Note** | vault 내 `.md` 확장자 파일 |
| **Asset** | `assets/` 하위의 이미지 등 바이너리 |
| **.munix/** | 앱 메타 데이터 폴더 (설정, 캐시, 인덱스) |
| **rel_path** | vault root 기준 상대 경로. 예: `projects/2026/note.md` |

---

## 3. Vault 구조

```
vault_root/
├── .munix/
│   ├── config.json        # vault 단위 설정 (optional)
│   ├── index.db           # 검색 인덱스 (v1.1+)
│   └── cache/             # 썸네일 등 임시 파일
├── assets/
│   └── *.{png,jpg,...}
├── projects/
│   └── foo.md
└── *.md
```

- `.munix/`는 vault 첫 오픈 시 자동 생성
- 사용자가 실수로 삭제해도 다음 오픈 시 재생성
- `.gitignore`에 추가 권장 (사용자 README에 안내)

---

## 4. Rust 데이터 모델

### 4.1 Vault 구조체

```rust
// src-tauri/src/vault.rs

use std::path::{Path, PathBuf};
use std::sync::RwLock;

pub struct Vault {
    root: PathBuf,              // canonicalized absolute path
    name: String,               // 표시용 (폴더명)
    meta_dir: PathBuf,          // {root}/.munix
    assets_dir: PathBuf,        // {root}/assets
}

impl Vault {
    pub fn open(path: impl AsRef<Path>) -> Result<Self, VaultError> {
        let root = path.as_ref().canonicalize()?;
        if !root.is_dir() {
            return Err(VaultError::NotADirectory);
        }
        let vault = Self {
            name: root.file_name()
                .and_then(|s| s.to_str())
                .map(String::from)
                .unwrap_or_default(),
            meta_dir: root.join(".munix"),
            assets_dir: root.join("assets"),
            root,
        };
        vault.ensure_meta_dir()?;
        Ok(vault)
    }

    fn ensure_meta_dir(&self) -> Result<(), VaultError> {
        std::fs::create_dir_all(&self.meta_dir)?;
        Ok(())
    }
}
```

### 4.2 App State

> **🟡 ADR-031 적용 시 변경:** 아래는 단일 vault 시점 기준. 멀티 vault 운영을 위한 `VaultManager` 도입은 [multi-vault-spec.md §4.1](./multi-vault-spec.md)에서 정의. 마이그레이션 시 `Mutex<Option<Vault>>` → `VaultManager` (vault_id 키 HashMap) 로 교체.

```rust
// src-tauri/src/state.rs (단일 vault 시점 — ADR-031 이전)

use std::sync::Mutex;

pub struct AppState {
    pub vault: Mutex<Option<Vault>>,
    pub watcher: Mutex<Option<FileWatcher>>,
}

impl AppState {
    pub fn new() -> Self {
        Self {
            vault: Mutex::new(None),
            watcher: Mutex::new(None),
        }
    }
}
```

### 4.3 에러 타입

```rust
// src-tauri/src/error.rs

use serde::Serialize;
use thiserror::Error;

#[derive(Debug, Error, Serialize)]
#[serde(tag = "type", content = "message")]
pub enum VaultError {
    #[error("Not a directory")]
    NotADirectory,

    #[error("Path traversal blocked: {0}")]
    PathTraversal(String),

    #[error("Vault not open")]
    NotOpen,

    #[error("File not found: {0}")]
    NotFound(String),

    #[error("Permission denied: {0}")]
    PermissionDenied(String),

    #[error("IO error: {0}")]
    Io(String),

    #[error("Invalid file name: {0}")]
    InvalidName(String),

    #[error("File exists: {0}")]
    AlreadyExists(String),
}

impl From<std::io::Error> for VaultError {
    fn from(e: std::io::Error) -> Self {
        use std::io::ErrorKind;
        match e.kind() {
            ErrorKind::NotFound => VaultError::NotFound(e.to_string()),
            ErrorKind::PermissionDenied => VaultError::PermissionDenied(e.to_string()),
            ErrorKind::AlreadyExists => VaultError::AlreadyExists(e.to_string()),
            _ => VaultError::Io(e.to_string()),
        }
    }
}
```

---

## 5. 경로 안전성

### 5.1 상대 경로 검증

```rust
impl Vault {
    /// rel_path를 절대 경로로 변환. traversal 차단.
    fn resolve(&self, rel_path: &str) -> Result<PathBuf, VaultError> {
        // 1. 빈 문자열, 절대경로 거부
        if rel_path.is_empty() || rel_path.starts_with('/') || rel_path.starts_with('\\') {
            return Err(VaultError::PathTraversal(rel_path.into()));
        }

        // 2. .. 차단
        for comp in Path::new(rel_path).components() {
            use std::path::Component;
            match comp {
                Component::ParentDir => {
                    return Err(VaultError::PathTraversal(rel_path.into()));
                }
                Component::Normal(_) | Component::CurDir => {}
                _ => return Err(VaultError::PathTraversal(rel_path.into())),
            }
        }

        let joined = self.root.join(rel_path);

        // 3. 결과가 vault root 안에 있는지 재검증
        let canonical = joined.canonicalize().unwrap_or(joined.clone());
        if !canonical.starts_with(&self.root) {
            return Err(VaultError::PathTraversal(rel_path.into()));
        }

        Ok(joined)
    }
}
```

### 5.2 심볼릭 링크 정책

- 기본: 심볼릭 링크 따라가지 **않음** (`fs::symlink_metadata` 사용)
- 향후 설정 옵션: `follow_symlinks: bool` 기본값 false

### 5.3 파일 이름 검증

```rust
fn validate_name(name: &str) -> Result<(), VaultError> {
    if name.is_empty() || name.len() > 255 {
        return Err(VaultError::InvalidName(name.into()));
    }
    // 플랫폼별 금지 문자
    let forbidden = ['/', '\\', ':', '*', '?', '"', '<', '>', '|', '\0'];
    if name.chars().any(|c| forbidden.contains(&c)) {
        return Err(VaultError::InvalidName(name.into()));
    }
    // Windows 예약어
    let reserved = ["CON", "PRN", "AUX", "NUL", "COM1", "LPT1"];
    let base = name.split('.').next().unwrap_or("").to_uppercase();
    if reserved.contains(&base.as_str()) {
        return Err(VaultError::InvalidName(name.into()));
    }
    Ok(())
}
```

---

## 6. Tauri 커맨드

> **🟡 ADR-031 적용 시 변경:** 모든 vault-bound 커맨드 시그니처에 `vault_id: VaultId` 인자가 추가된다. 본 절의 정의는 단일 vault 시점 기준이며, 멀티 vault 마이그레이션 시 [multi-vault-spec.md §5](./multi-vault-spec.md)의 IPC 변경 원칙을 따른다.

### 6.1 Vault 수준

#### `open_vault`

```rust
#[tauri::command]
async fn open_vault(
    path: String,
    state: tauri::State<'_, AppState>,
) -> Result<VaultInfo, VaultError>;

#[derive(Serialize)]
struct VaultInfo {
    name: String,
    root: String,
    file_count: usize,
}
```

**동작:**
1. 주어진 경로로 `Vault::open` 호출
2. 기존 watcher 중단
3. 새 watcher 시작
4. 앱 설정에 `last_vault` 저장
5. `VaultInfo` 반환

#### `close_vault`

```rust
#[tauri::command]
async fn close_vault(state: tauri::State<'_, AppState>) -> Result<(), VaultError>;
```

#### `get_vault_info`

```rust
#[tauri::command]
async fn get_vault_info(state: tauri::State<'_, AppState>) -> Result<Option<VaultInfo>, VaultError>;
```

### 6.2 File 수준

#### `list_files`

```rust
#[tauri::command]
async fn list_files(state: tauri::State<'_, AppState>) -> Result<Vec<FileNode>, VaultError>;

#[derive(Serialize)]
struct FileNode {
    path: String,        // rel_path
    name: String,        // 파일/폴더 이름
    kind: FileKind,      // "file" | "directory"
    size: Option<u64>,   // 파일만
    modified: Option<i64>, // unix timestamp
    children: Option<Vec<FileNode>>, // 폴더만, lazy 가능
}

#[derive(Serialize)]
#[serde(rename_all = "lowercase")]
enum FileKind {
    File,
    Directory,
}
```

**동작:**
- `.md` 파일만 반환 (향후 설정으로 확장)
- 숨김 파일/폴더(`.`으로 시작) 제외 (단, `.munix/`는 항상 제외)
- 깊이 제한 없음 (대용량은 lazy load)
- 정렬: 폴더 먼저 → 알파벳 순

#### `read_file`

```rust
#[tauri::command]
async fn read_file(
    rel_path: String,
    state: tauri::State<'_, AppState>,
) -> Result<FileContent, VaultError>;

#[derive(Serialize)]
struct FileContent {
    content: String,
    modified: i64,  // unix timestamp, 충돌 감지용
    size: u64,
}
```

#### `write_file`

```rust
#[tauri::command]
async fn write_file(
    rel_path: String,
    content: String,
    expected_modified: Option<i64>,  // 충돌 감지
    state: tauri::State<'_, AppState>,
) -> Result<WriteResult, VaultError>;

#[derive(Serialize)]
struct WriteResult {
    modified: i64,
    size: u64,
    conflict: bool,  // expected_modified와 실제가 다르면 true (저장은 하되 경고)
}
```

**원자적 쓰기:**
```rust
fn write_atomic(path: &Path, content: &str) -> Result<(), VaultError> {
    let tmp = path.with_extension("tmp");
    std::fs::write(&tmp, content)?;
    std::fs::rename(&tmp, path)?;
    Ok(())
}
```

#### `create_file`

```rust
#[tauri::command]
async fn create_file(
    rel_path: String,
    content: Option<String>,  // 기본: 빈 문자열
    state: tauri::State<'_, AppState>,
) -> Result<FileNode, VaultError>;
```

- 부모 디렉토리 없으면 생성
- 이미 존재하면 `AlreadyExists` 에러
- 기본 frontmatter 템플릿 적용 (설정에 따라)

#### `rename_file`

```rust
#[tauri::command]
async fn rename_file(
    from: String,
    to: String,
    state: tauri::State<'_, AppState>,
) -> Result<FileNode, VaultError>;
```

- `to`가 이미 존재하면 에러
- 이동도 이걸로 처리 (폴더 변경 포함)

#### `delete_file`

```rust
#[tauri::command]
async fn delete_file(
    rel_path: String,
    state: tauri::State<'_, AppState>,
) -> Result<(), VaultError>;
```

- 휴지통으로 이동 (`trash` crate 사용)
- 영구 삭제 옵션은 별도 커맨드 `delete_file_permanent`

#### `create_directory`

```rust
#[tauri::command]
async fn create_directory(
    rel_path: String,
    state: tauri::State<'_, AppState>,
) -> Result<FileNode, VaultError>;
```

### 6.3 Asset 수준

#### `save_asset`

```rust
#[tauri::command]
async fn save_asset(
    file_name: String,   // 클라이언트가 제안, 서버가 최종 결정
    bytes: Vec<u8>,
    state: tauri::State<'_, AppState>,
) -> Result<AssetInfo, VaultError>;

#[derive(Serialize)]
struct AssetInfo {
    rel_path: String,    // "assets/20260425-a1b2c3d4.png"
    url: String,         // tauri asset URL
    size: u64,
}
```

**파일명 규칙:**
- `{yyyymmdd}-{8자리 uuid}.{ext}`
- 확장자는 입력 그대로 (화이트리스트: png/jpg/jpeg/gif/webp/svg)
- 중복 시 uuid 재생성

#### `resolve_asset_url`

```rust
#[tauri::command]
fn resolve_asset_url(
    rel_path: String,
    state: tauri::State<'_, AppState>,
) -> Result<String, VaultError>;
```

- vault 기준 상대 경로 → WebView에서 로드 가능한 URL로 변환
- Tauri의 `convertFileSrc` 또는 custom protocol 사용

---

## 7. 파일 시스템 감시 (File Watcher)

### 7.1 요구사항

- 외부에서 vault 파일 변경(git pull, Obsidian 등) 감지
- 변경 시 프론트엔드에 이벤트 송신
- 디바운스로 중복 이벤트 병합

### 7.2 구현

```rust
// src-tauri/src/commands/watch.rs

use notify::{RecommendedWatcher, RecursiveMode, Watcher};
use tokio::sync::mpsc;

pub struct FileWatcher {
    _watcher: RecommendedWatcher,
}

pub fn start_watching(
    root: PathBuf,
    app: tauri::AppHandle,
) -> Result<FileWatcher, VaultError> {
    let (tx, mut rx) = mpsc::unbounded_channel();

    let mut watcher = notify::recommended_watcher(move |res| {
        if let Ok(event) = res {
            let _ = tx.send(event);
        }
    })?;
    watcher.watch(&root, RecursiveMode::Recursive)?;

    // 디바운스 + 이벤트 송신 태스크
    let app_handle = app.clone();
    tokio::spawn(async move {
        let mut pending = Vec::new();
        let mut deadline = None;
        loop {
            tokio::select! {
                Some(event) = rx.recv() => {
                    pending.push(event);
                    deadline = Some(tokio::time::Instant::now() + std::time::Duration::from_millis(150));
                }
                _ = tokio::time::sleep_until(deadline.unwrap_or_else(|| tokio::time::Instant::now() + std::time::Duration::from_secs(86400))), if deadline.is_some() => {
                    // 디바운스 완료 → flush
                    let events = std::mem::take(&mut pending);
                    emit_fs_events(&app_handle, events);
                    deadline = None;
                }
            }
        }
    });

    Ok(FileWatcher { _watcher: watcher })
}
```

### 7.3 이벤트 스펙

프론트엔드로 송신되는 이벤트:

```ts
// Event name: 'vault:fs-changed'
interface FsChangeEvent {
  kind: 'created' | 'modified' | 'deleted' | 'renamed';
  paths: string[];      // 영향 받은 rel_path 목록
  timestamp: number;
}
```

**무시 규칙:**
- `.munix/` 하위 변경은 무시
- `.swp`, `.tmp` 등 임시 파일 무시
- 자기 자신이 쓴 변경은 무시 (선택: app-originated 플래그)

---

## 8. 디렉토리 탐색 로직

### 8.1 리스팅 규칙

```rust
impl Vault {
    pub fn list_all(&self) -> Result<Vec<FileNode>, VaultError> {
        let mut result = Vec::new();
        walk(&self.root, &self.root, &mut result, /* lazy */ false)?;
        Ok(result)
    }

    fn walk(
        base: &Path,
        current: &Path,
        out: &mut Vec<FileNode>,
        lazy: bool,
    ) -> Result<(), VaultError> {
        let mut entries = std::fs::read_dir(current)?
            .filter_map(Result::ok)
            .collect::<Vec<_>>();

        // 숨김 및 .munix 제외
        entries.retain(|e| {
            let name = e.file_name().to_string_lossy().to_string();
            !name.starts_with('.') || name == ".munix" // .munix는 바깥에서 이미 제외
        });
        entries.retain(|e| e.file_name() != ".munix");

        // 정렬: 디렉토리 먼저, 그 안에서 알파벳
        entries.sort_by(|a, b| {
            let a_dir = a.file_type().map(|t| t.is_dir()).unwrap_or(false);
            let b_dir = b.file_type().map(|t| t.is_dir()).unwrap_or(false);
            b_dir.cmp(&a_dir).then_with(|| a.file_name().cmp(&b.file_name()))
        });

        for entry in entries {
            let path = entry.path();
            let meta = entry.metadata()?;
            let rel_path = path.strip_prefix(base)
                .unwrap()
                .to_string_lossy()
                .replace('\\', "/");

            if meta.is_dir() {
                let mut node = FileNode {
                    path: rel_path,
                    name: entry.file_name().to_string_lossy().into(),
                    kind: FileKind::Directory,
                    size: None,
                    modified: None,
                    children: if lazy { None } else { Some(Vec::new()) },
                };
                if !lazy {
                    let mut children = Vec::new();
                    walk(base, &path, &mut children, false)?;
                    node.children = Some(children);
                }
                out.push(node);
            } else if path.extension().and_then(|e| e.to_str()) == Some("md") {
                out.push(FileNode {
                    path: rel_path,
                    name: entry.file_name().to_string_lossy().into(),
                    kind: FileKind::File,
                    size: Some(meta.len()),
                    modified: meta.modified().ok().and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok()).map(|d| d.as_secs() as i64),
                    children: None,
                });
            }
        }
        Ok(())
    }
}
```

### 8.2 성능 고려

| 파일 수 | 전략 |
|--------|------|
| ~500 | 전체 로드 (sync) |
| 500~5,000 | 전체 로드 + 가상 스크롤 |
| 5,000+ | lazy load (폴더 펼칠 때마다 children fetch) |

lazy load 시 별도 커맨드:

```rust
#[tauri::command]
async fn list_children(
    rel_path: String,
    state: tauri::State<'_, AppState>,
) -> Result<Vec<FileNode>, VaultError>;
```

---

## 9. 보안 체크리스트

- [ ] 모든 IPC 커맨드는 vault 오픈 상태 검증
- [ ] 모든 `rel_path`는 `resolve()` 통과
- [ ] 파일명은 `validate_name()` 통과
- [ ] Tauri `tauri.conf.json`의 `allowlist.fs`에서 직접 경로 접근 비활성화 (자체 커맨드만 사용)
- [ ] CSP 설정으로 WebView XSS 차단
- [ ] `tauri.conf.json`의 `asset_protocol.scope`는 vault 경로로 한정

---

## 10. 테스트 케이스

### 10.1 보안

- [ ] `../../../etc/passwd` 입력 → `PathTraversal` 에러
- [ ] 절대 경로 `/etc/passwd` → 거부
- [ ] 심볼릭 링크가 외부를 가리킴 → canonical 검증 통과 실패
- [ ] Windows 예약어 `CON.md` → 거부

### 10.2 동시성

- [ ] 두 탭에서 같은 파일 동시 편집 → mtime 체크로 충돌 감지
- [ ] 쓰기 도중 앱 강제 종료 → 원자적 쓰기로 파일 손상 없음

### 10.3 엣지

- [ ] 빈 vault 오픈 → `.munix/` 자동 생성
- [ ] 10,000 파일 vault → `list_files` 응답 시간
- [ ] 매우 긴 파일명 (200자) → 허용
- [ ] 한글/이모지 파일명 → 정상 처리

---

## 11. 오픈 이슈

1. **검색 인덱스**: `.munix/index.db`를 SQLite로 할지, Tantivy의 자체 포맷으로 할지
2. **이미지 미리보기 캐시**: `.munix/cache/thumbs/`에 생성 vs 매번 이미지 로드
3. ~~**멀티 vault 전환**~~ → [ADR-031](../decisions.md#adr-031-멀티-vault-워크스페이스-cmux-스타일-좌측-세로-탭) 및 [multi-vault-spec.md](./multi-vault-spec.md)로 해소 (cmux 스타일 좌측 세로 탭 + 탭 → 새 창 승격, proposed)
4. **Drive 심볼릭 링크**: 사용자가 Obsidian의 vault를 연결한 경우 허용 여부
5. **권한 요청 UX**: macOS의 폴더 접근 권한을 앱 초기화 시에 한 번에 받을 것인지

---

**문서 버전:** v0.1 (멀티 vault 갱신은 ADR-031 채택 시 v0.2로)
**작성일:** 2026-04-25
**최근 업데이트:** 2026-04-26 — ADR-031 cross-reference 추가 (AppState §4.2, Tauri 커맨드 §6, 오픈 이슈 §11)
**관련 문서:**
- [multi-vault-spec.md](./multi-vault-spec.md) — 멀티 vault 워크스페이스 (ADR-031, proposed)
- [auto-save-spec.md](./auto-save-spec.md)
- [file-tree-spec.md](./file-tree-spec.md)

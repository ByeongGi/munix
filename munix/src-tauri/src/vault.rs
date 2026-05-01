use std::path::{Path, PathBuf};
use std::time::UNIX_EPOCH;

use serde::Serialize;

use crate::error::{VaultError, VaultResult};
use crate::markdown::parse_markdown;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VaultInfo {
    pub id: String,
    pub name: String,
    pub root: String,
    pub file_count: usize,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum FileKind {
    File,
    Directory,
}

#[derive(Debug, Clone, Serialize)]
pub struct FileNode {
    pub path: String,
    pub name: String,
    pub kind: FileKind,
    pub size: Option<u64>,
    pub modified: Option<i64>,
    pub children: Option<Vec<FileNode>>,
}

#[derive(Debug, Clone, Serialize)]
pub struct FileContent {
    pub content: String,
    pub modified: i64,
    pub size: u64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MarkdownFileContent {
    pub frontmatter: Option<serde_json::Value>,
    pub body: String,
    pub modified: i64,
    pub size: u64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MarkdownBatchItem {
    pub path: String,
    pub frontmatter: Option<serde_json::Value>,
    pub body: String,
    pub modified: i64,
    pub size: u64,
}

#[derive(Debug, Clone, Serialize)]
pub struct WriteResult {
    pub modified: i64,
    pub size: u64,
    pub conflict: bool,
}

#[derive(Debug)]
pub struct Vault {
    root: PathBuf,
    name: String,
    meta_dir: PathBuf,
    #[allow(dead_code)]
    assets_dir: PathBuf,
}

impl Vault {
    pub fn open(path: impl AsRef<Path>) -> VaultResult<Self> {
        let root = path.as_ref().canonicalize()?;
        if !root.is_dir() {
            return Err(VaultError::NotADirectory);
        }

        let name = root
            .file_name()
            .and_then(|s| s.to_str())
            .map(String::from)
            .unwrap_or_default();

        let vault = Self {
            meta_dir: root.join(".munix"),
            assets_dir: root.join("assets"),
            root,
            name,
        };

        vault.ensure_meta_dir()?;
        Ok(vault)
    }

    fn ensure_meta_dir(&self) -> VaultResult<()> {
        std::fs::create_dir_all(&self.meta_dir)?;
        Ok(())
    }

    /// `.munix/workspace.json` 절대 경로 — vault 워크스페이스 영구화 (ADR-031, D2).
    pub fn workspace_path(&self) -> PathBuf {
        self.meta_dir.join("workspace.json")
    }

    /// vault 의 workspace.json 을 읽는다. 파일이 없으면 None.
    pub fn read_workspace(&self) -> VaultResult<Option<String>> {
        let p = self.workspace_path();
        if !p.exists() {
            return Ok(None);
        }
        let raw = std::fs::read_to_string(&p)?;
        Ok(Some(raw))
    }

    /// workspace.json 을 atomic 하게 쓴다. JSON 형식 검증 포함.
    /// 반환값: 쓰여진 절대 경로 (watcher self-write suppression 등록용).
    pub fn write_workspace(&self, json: &str) -> VaultResult<PathBuf> {
        serde_json::from_str::<serde_json::Value>(json)
            .map_err(|e| VaultError::Io(format!("invalid workspace JSON: {e}")))?;

        let p = self.workspace_path();
        let tmp = p.with_extension("json.tmp");
        std::fs::write(&tmp, json)?;
        std::fs::rename(&tmp, &p)?;
        Ok(p)
    }

    /// `.munix/settings.json` — vault scope 설정 override (ADR-031 C-3).
    pub fn settings_path(&self) -> PathBuf {
        self.meta_dir.join("settings.json")
    }

    pub fn read_settings(&self) -> VaultResult<Option<String>> {
        let p = self.settings_path();
        if !p.exists() {
            return Ok(None);
        }
        let raw = std::fs::read_to_string(&p)?;
        Ok(Some(raw))
    }

    /// settings.json atomic write. JSON 형식 검증 포함.
    pub fn write_settings(&self, json: &str) -> VaultResult<PathBuf> {
        serde_json::from_str::<serde_json::Value>(json)
            .map_err(|e| VaultError::Io(format!("invalid settings JSON: {e}")))?;

        self.ensure_meta_dir()?;
        let p = self.settings_path();
        let tmp = p.with_extension("json.tmp");
        std::fs::write(&tmp, json)?;
        std::fs::rename(&tmp, &p)?;
        Ok(p)
    }

    #[allow(dead_code)]
    pub fn root(&self) -> &Path {
        &self.root
    }

    #[allow(dead_code)]
    pub fn name(&self) -> &str {
        &self.name
    }

    /// rel_path를 vault 내부의 절대 경로로 변환. traversal 차단.
    pub fn resolve(&self, rel_path: &str) -> VaultResult<PathBuf> {
        resolve_path(&self.root, rel_path)
    }

    pub fn info(&self, id: &str) -> VaultResult<VaultInfo> {
        let files = self.list_all()?;
        let file_count = count_files(&files);
        Ok(VaultInfo {
            id: id.to_string(),
            name: self.name.clone(),
            root: self.root.to_string_lossy().to_string(),
            file_count,
        })
    }

    pub fn list_all(&self) -> VaultResult<Vec<FileNode>> {
        list_all_at_root(&self.root)
    }

    pub fn write_file(
        &self,
        rel_path: &str,
        content: &str,
        expected_modified: Option<i64>,
        force: bool,
    ) -> VaultResult<WriteResult> {
        validate_md_extension(rel_path)?;
        let path = self.resolve(rel_path)?;

        let current_modified = if path.exists() {
            let meta = std::fs::metadata(&path)?;
            Some(mtime_secs(&meta))
        } else {
            None
        };

        let conflict = match (expected_modified, current_modified) {
            (Some(expected), Some(current)) => (expected - current).abs() > 2,
            _ => false,
        };

        // 충돌이 감지되고 force=false면 디스크를 건드리지 않고 바로 리턴
        if conflict && !force {
            let meta = std::fs::metadata(&path)?;
            return Ok(WriteResult {
                modified: mtime_secs(&meta),
                size: meta.len(),
                conflict: true,
            });
        }

        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)?;
        }

        write_atomic(&path, content)?;

        let meta = std::fs::metadata(&path)?;
        Ok(WriteResult {
            modified: mtime_secs(&meta),
            size: meta.len(),
            conflict: false,
        })
    }

    pub fn create_file(&self, rel_path: &str, content: Option<&str>) -> VaultResult<FileNode> {
        validate_md_extension(rel_path)?;
        validate_basename(rel_path)?;
        let path = self.resolve(rel_path)?;

        if path.exists() {
            return Err(VaultError::AlreadyExists(rel_path.to_string()));
        }

        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)?;
        }

        std::fs::write(&path, content.unwrap_or(""))?;

        let meta = std::fs::metadata(&path)?;
        let name = path
            .file_name()
            .and_then(|s| s.to_str())
            .unwrap_or("")
            .to_string();

        Ok(FileNode {
            path: rel_path.to_string(),
            name,
            kind: FileKind::File,
            size: Some(meta.len()),
            modified: Some(mtime_secs(&meta)),
            children: None,
        })
    }

    pub fn create_folder(&self, rel_path: &str) -> VaultResult<FileNode> {
        if rel_path.is_empty() {
            return Err(VaultError::InvalidName(rel_path.to_string()));
        }
        validate_basename(rel_path)?;
        let path = self.resolve(rel_path)?;
        if path.exists() {
            return Err(VaultError::AlreadyExists(rel_path.to_string()));
        }
        std::fs::create_dir_all(&path)?;

        let name = path
            .file_name()
            .and_then(|s| s.to_str())
            .unwrap_or("")
            .to_string();

        Ok(FileNode {
            path: rel_path.to_string(),
            name,
            kind: FileKind::Directory,
            size: None,
            modified: None,
            children: Some(Vec::new()),
        })
    }

    pub fn rename(&self, old_rel: &str, new_rel: &str) -> VaultResult<FileNode> {
        if old_rel.is_empty() || new_rel.is_empty() {
            return Err(VaultError::InvalidName(new_rel.to_string()));
        }
        validate_basename(new_rel)?;
        let old_path = self.resolve(old_rel)?;
        let new_path = self.resolve(new_rel)?;

        if !old_path.exists() {
            return Err(VaultError::NotFound(old_rel.to_string()));
        }
        if new_path.exists() {
            return Err(VaultError::AlreadyExists(new_rel.to_string()));
        }

        // 파일이면 확장자 보존 (사용자가 의도적으로 바꿀 수 있도록 동일성 검사만 — 다른 확장자도 허용)
        // .md 강제 제거 — 비-md 파일도 vault에서 이동/이름 변경 가능하도록
        // 단, .md 파일을 .md가 아닌 이름으로 바꾸려 할 때는 경고 의도로 차단할지 추후 결정
        if old_path.is_file() {
            let old_ext = Path::new(old_rel)
                .extension()
                .and_then(|e| e.to_str())
                .unwrap_or("");
            let new_ext = Path::new(new_rel)
                .extension()
                .and_then(|e| e.to_str())
                .unwrap_or("");
            if !old_ext.eq_ignore_ascii_case("md") {
                // 비-md 파일: 그대로 허용
            } else if !new_ext.eq_ignore_ascii_case("md") {
                // .md 파일을 다른 확장자로 바꾸려 함 — 차단
                return Err(VaultError::InvalidName(new_rel.to_string()));
            }
        }

        if let Some(parent) = new_path.parent() {
            std::fs::create_dir_all(parent)?;
        }

        std::fs::rename(&old_path, &new_path)?;

        let meta = std::fs::metadata(&new_path)?;
        let name = new_path
            .file_name()
            .and_then(|s| s.to_str())
            .unwrap_or("")
            .to_string();
        let (kind, size) = if meta.is_dir() {
            (FileKind::Directory, None)
        } else {
            (FileKind::File, Some(meta.len()))
        };

        Ok(FileNode {
            path: new_rel.to_string(),
            name,
            kind,
            size,
            modified: Some(mtime_secs(&meta)),
            children: if meta.is_dir() {
                Some(Vec::new())
            } else {
                None
            },
        })
    }

    pub fn save_asset(&self, bytes: &[u8], ext: &str) -> VaultResult<String> {
        let clean_ext = ext.trim_start_matches('.').to_lowercase();
        const ALLOWED: &[&str] = &["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp", "avif"];
        if !ALLOWED.contains(&clean_ext.as_str()) {
            return Err(VaultError::InvalidName(format!("ext: {ext}")));
        }

        let date = chrono::Utc::now().format("%Y%m%d").to_string();
        let id = uuid::Uuid::new_v4().to_string();
        let short = &id[..8];
        let filename = format!("{date}-{short}.{clean_ext}");
        let rel_path = format!("assets/{filename}");

        let abs = self.root.join(&rel_path);
        if let Some(parent) = abs.parent() {
            std::fs::create_dir_all(parent)?;
        }
        std::fs::write(&abs, bytes)?;

        Ok(rel_path)
    }

    pub fn abs_from_rel(&self, rel_path: &str) -> VaultResult<PathBuf> {
        self.resolve(rel_path)
    }

    pub fn delete_entry(&self, rel_path: &str) -> VaultResult<()> {
        if rel_path.is_empty() {
            return Err(VaultError::InvalidName(rel_path.to_string()));
        }
        let path = self.resolve(rel_path)?;
        if !path.exists() {
            return Err(VaultError::NotFound(rel_path.to_string()));
        }
        trash_delete(&path)?;
        Ok(())
    }

    /// `.obsidian/types.json` 절대 경로 (vault 안에 있어도 .obsidian은 hidden 이라 list_all 에서 제외됨).
    /// ADR-028 — Obsidian 호환 속성 타입 메타데이터 위치.
    pub fn property_types_path(&self) -> PathBuf {
        self.root.join(".obsidian").join("types.json")
    }

    /// `.obsidian/types.json` 읽기. 파일 없거나 파싱 실패하면 빈 맵 반환 (에러 X).
    /// 알려지지 않은 타입 문자열은 호출 측(TS)에서 필터링.
    pub fn read_property_types(&self) -> std::collections::HashMap<String, String> {
        let path = self.property_types_path();
        let raw = match std::fs::read_to_string(&path) {
            Ok(s) => s,
            Err(_) => return std::collections::HashMap::new(),
        };
        // {"types": {field: typeName}} 파싱
        let parsed: serde_json::Value = match serde_json::from_str(&raw) {
            Ok(v) => v,
            Err(_) => return std::collections::HashMap::new(),
        };
        let inner = match parsed.get("types").and_then(|v| v.as_object()) {
            Some(obj) => obj,
            None => return std::collections::HashMap::new(),
        };
        let mut out = std::collections::HashMap::new();
        for (k, v) in inner {
            if let Some(s) = v.as_str() {
                out.insert(k.clone(), s.to_string());
            }
        }
        out
    }

    /// `.obsidian/types.json` 쓰기. `.obsidian/` 없으면 생성.
    /// pretty-print (들여쓰기 2 spaces, trailing newline) — Obsidian 출력 포맷과 일치.
    /// 호출 측에서 record_write 로 self-write suppression 보장.
    pub fn write_property_types(
        &self,
        types: &std::collections::HashMap<String, String>,
    ) -> VaultResult<PathBuf> {
        let path = self.property_types_path();
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        let wrapped = serde_json::json!({ "types": types });
        let mut json =
            serde_json::to_string_pretty(&wrapped).map_err(|e| VaultError::Io(e.to_string()))?;
        json.push('\n');
        write_atomic(&path, &json)?;
        Ok(path)
    }
}

pub fn list_all_at_root(root: &Path) -> VaultResult<Vec<FileNode>> {
    let mut result = Vec::new();
    walk(root, root, &mut result, false)?;
    Ok(result)
}

pub fn read_file_at_root(root: &Path, rel_path: &str) -> VaultResult<FileContent> {
    validate_md_extension(rel_path)?;
    let path = resolve_path(root, rel_path)?;
    let content = std::fs::read_to_string(&path)?;
    let meta = std::fs::metadata(&path)?;
    Ok(FileContent {
        content,
        modified: mtime_secs(&meta),
        size: meta.len(),
    })
}

pub fn read_markdown_file_at_root(root: &Path, rel_path: &str) -> VaultResult<MarkdownFileContent> {
    validate_md_extension(rel_path)?;
    let path = resolve_path(root, rel_path)?;
    let content = std::fs::read_to_string(&path)?;
    let meta = std::fs::metadata(&path)?;
    let parsed = parse_markdown(content);

    Ok(MarkdownFileContent {
        frontmatter: parsed.frontmatter,
        body: parsed.body,
        modified: mtime_secs(&meta),
        size: meta.len(),
    })
}

pub fn read_markdown_batch_at_root(root: &Path, rel_paths: Vec<String>) -> Vec<MarkdownBatchItem> {
    rel_paths
        .into_iter()
        .filter_map(|path| {
            let content = read_markdown_file_at_root(root, &path).ok()?;
            Some(MarkdownBatchItem {
                path,
                frontmatter: content.frontmatter,
                body: content.body,
                modified: content.modified,
                size: content.size,
            })
        })
        .collect()
}

#[cfg(target_os = "macos")]
fn trash_delete(path: &Path) -> VaultResult<()> {
    // macOS에서 기본 DeleteMethod::Finder는 AppleScript로 Finder를 호출하는데,
    // 서명되지 않은 dev 빌드는 Automation 권한이 없어서 `-1743` 오류로 실패함.
    // NsFileManager 방식은 권한 필요 없고 더 빠름 (단, "되돌리기" 메뉴는 일부 케이스 제한).
    use trash::macos::{DeleteMethod, TrashContextExtMacos};
    let mut ctx = trash::TrashContext::default();
    ctx.set_delete_method(DeleteMethod::NsFileManager);
    ctx.delete(path).map_err(|e| VaultError::Io(e.to_string()))
}

#[cfg(not(target_os = "macos"))]
fn trash_delete(path: &Path) -> VaultResult<()> {
    trash::delete(path).map_err(|e| VaultError::Io(e.to_string()))
}

fn resolve_path(root: &Path, rel_path: &str) -> VaultResult<PathBuf> {
    if rel_path.is_empty() || rel_path.starts_with('/') || rel_path.starts_with('\\') {
        return Err(VaultError::PathTraversal(rel_path.to_string()));
    }

    use std::path::Component;
    for comp in Path::new(rel_path).components() {
        match comp {
            Component::ParentDir => {
                return Err(VaultError::PathTraversal(rel_path.to_string()));
            }
            Component::Normal(_) | Component::CurDir => {}
            _ => return Err(VaultError::PathTraversal(rel_path.to_string())),
        }
    }

    let joined = root.join(rel_path);

    if let Ok(canonical) = joined.canonicalize() {
        if !canonical.starts_with(root) {
            return Err(VaultError::PathTraversal(rel_path.to_string()));
        }
    } else if let Some(parent) = joined.parent() {
        if parent.exists() {
            let canonical_parent = parent.canonicalize()?;
            if !canonical_parent.starts_with(root) {
                return Err(VaultError::PathTraversal(rel_path.to_string()));
            }
        }
    }

    Ok(joined)
}

/// 파일/폴더 이름(basename) 자체의 안전성 검증.
/// - 빈 이름 / 금지 문자 / Windows 예약어 / trailing dot/space 차단.
/// - cross-platform 안전을 위해 Windows 규칙도 macOS/Linux에서 동일하게 적용.
pub fn validate_name(name: &str) -> VaultResult<()> {
    if name.is_empty() {
        return Err(VaultError::InvalidName(String::from("(empty)")));
    }
    if name == "." || name == ".." {
        return Err(VaultError::InvalidName(name.to_string()));
    }
    // Windows + macOS 호환 금지 문자
    if name.chars().any(|c| {
        matches!(
            c,
            '\\' | '/' | ':' | '*' | '?' | '"' | '<' | '>' | '|' | '\0'
        )
    }) {
        return Err(VaultError::InvalidName(format!(
            "forbidden character: {name}"
        )));
    }
    // 제어 문자 차단
    if name.chars().any(|c| (c as u32) < 0x20) {
        return Err(VaultError::InvalidName(format!(
            "control character: {name}"
        )));
    }
    // Windows 예약어 (확장자 제거 후 비교)
    let stem_upper = name.split('.').next().unwrap_or(name).to_uppercase();
    const RESERVED: &[&str] = &[
        "CON", "PRN", "AUX", "NUL", "COM1", "COM2", "COM3", "COM4", "COM5", "COM6", "COM7", "COM8",
        "COM9", "LPT1", "LPT2", "LPT3", "LPT4", "LPT5", "LPT6", "LPT7", "LPT8", "LPT9",
    ];
    if RESERVED.contains(&stem_upper.as_str()) {
        return Err(VaultError::InvalidName(format!("reserved name: {name}")));
    }
    // Windows에서 trailing dot/space는 자동 제거되어 충돌 유발
    if name.ends_with('.') || name.ends_with(' ') {
        return Err(VaultError::InvalidName(format!(
            "trailing dot or space: {name}"
        )));
    }
    Ok(())
}

/// rel_path의 마지막 segment(basename)에 validate_name 적용.
fn validate_basename(rel_path: &str) -> VaultResult<()> {
    let base = rel_path.rsplit('/').next().unwrap_or(rel_path);
    validate_name(base)
}

fn validate_md_extension(rel_path: &str) -> VaultResult<()> {
    let ext = Path::new(rel_path)
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("");
    if ext.eq_ignore_ascii_case("md") {
        Ok(())
    } else {
        Err(VaultError::InvalidName(rel_path.to_string()))
    }
}

fn write_atomic(path: &Path, content: &str) -> VaultResult<()> {
    let tmp = path.with_extension("tmp");
    std::fs::write(&tmp, content)?;
    std::fs::rename(&tmp, path)?;
    Ok(())
}

fn mtime_secs(meta: &std::fs::Metadata) -> i64 {
    meta.modified()
        .ok()
        .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0)
}

fn count_files(nodes: &[FileNode]) -> usize {
    let mut total = 0;
    for n in nodes {
        match n.kind {
            FileKind::File => total += 1,
            FileKind::Directory => {
                if let Some(children) = &n.children {
                    total += count_files(children);
                }
            }
        }
    }
    total
}

fn walk(base: &Path, current: &Path, out: &mut Vec<FileNode>, lazy: bool) -> VaultResult<()> {
    let mut entries: Vec<_> = std::fs::read_dir(current)?.filter_map(Result::ok).collect();

    entries.retain(|e| {
        let name = e.file_name().to_string_lossy().to_string();
        !name.starts_with('.')
    });

    entries.sort_by(|a, b| {
        let a_dir = a.file_type().map(|t| t.is_dir()).unwrap_or(false);
        let b_dir = b.file_type().map(|t| t.is_dir()).unwrap_or(false);
        b_dir
            .cmp(&a_dir)
            .then_with(|| a.file_name().cmp(&b.file_name()))
    });

    for entry in entries {
        let path = entry.path();
        let meta = entry.metadata()?;
        let rel_path = path
            .strip_prefix(base)
            .map_err(|_| VaultError::PathTraversal(path.to_string_lossy().to_string()))?
            .to_string_lossy()
            .replace('\\', "/");

        if meta.is_dir() {
            let mut node = FileNode {
                path: rel_path,
                name: entry.file_name().to_string_lossy().to_string(),
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
        } else if meta.is_file() {
            // 확장자 관계없이 모든 파일 표시 (읽기/편집은 .md만, read_file에서 검증)
            out.push(FileNode {
                path: rel_path,
                name: entry.file_name().to_string_lossy().to_string(),
                kind: FileKind::File,
                size: Some(meta.len()),
                modified: Some(mtime_secs(&meta)),
                children: None,
            });
        }
    }
    Ok(())
}

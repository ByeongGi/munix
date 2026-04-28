use std::path::{Component, Path, PathBuf};

use image::codecs::jpeg::JpegEncoder;
use image::imageops::FilterType;
use image::ImageReader;
use sha1::{Digest, Sha1};

use crate::error::{VaultError, VaultResult};

/// 라스터 이미지 확장자 whitelist (svg 등 벡터는 제외).
const SUPPORTED_EXTS: &[&str] = &["png", "jpg", "jpeg", "gif", "webp", "bmp"];

/// 썸네일을 만들지 결정하는 임계값 (이보다 작으면 원본 사용 의미가 큼).
const THUMBNAIL_MIN_BYTES: u64 = 5 * 1024 * 1024;

const THUMB_MAX_DIM: u32 = 256;
const JPEG_QUALITY: u8 = 80;

/// rel_path 이미지에 대한 썸네일을 보장하고 캐시 절대 경로를 돌려준다.
///
/// 캐시 위치: `<vault_root>/.munix/cache/thumbs/<sha1>.jpg`
/// - 입력 파일이 작거나 (`< 5MB`) 지원 확장자가 아니면 절대 경로를 그대로 반환한다.
/// - 캐시 hit이면 캐시 경로를 그대로 반환한다.
/// - miss이면 256x256 fit + JPEG q80으로 인코딩하여 저장 후 경로를 반환한다.
pub fn ensure_thumbnail(vault_root: &Path, rel_path: &str) -> VaultResult<PathBuf> {
    let src = resolve_within_vault(vault_root, rel_path)?;

    if !src.is_file() {
        return Err(VaultError::NotFound(rel_path.to_string()));
    }

    let ext = src
        .extension()
        .and_then(|e| e.to_str())
        .map(|s| s.to_ascii_lowercase())
        .unwrap_or_default();

    if !SUPPORTED_EXTS.contains(&ext.as_str()) {
        // 지원하지 않는 형식은 원본 경로 그대로 — 호출 측이 원본을 사용.
        return Ok(src);
    }

    let meta = std::fs::metadata(&src)?;
    if meta.len() < THUMBNAIL_MIN_BYTES {
        // 이미 작은 이미지는 굳이 썸네일을 만들지 않는다.
        return Ok(src);
    }

    let bytes = std::fs::read(&src)?;
    let hash = sha1_hex(&bytes);

    let cache_dir = vault_root.join(".munix").join("cache").join("thumbs");
    let cache_path = cache_dir.join(format!("{hash}.jpg"));

    if cache_path.exists() {
        return Ok(cache_path);
    }

    std::fs::create_dir_all(&cache_dir)?;

    let img = ImageReader::open(&src)
        .map_err(|e| VaultError::Io(format!("thumbnail open: {e}")))?
        .with_guessed_format()
        .map_err(|e| VaultError::Io(format!("thumbnail format: {e}")))?
        .decode()
        .map_err(|e| VaultError::Io(format!("thumbnail decode: {e}")))?;

    let (w, h) = (img.width(), img.height());
    let resized = if w <= THUMB_MAX_DIM && h <= THUMB_MAX_DIM {
        img
    } else {
        // resize는 aspect ratio를 유지하면서 max dim 안에 fit (Lanczos3).
        img.resize(THUMB_MAX_DIM, THUMB_MAX_DIM, FilterType::Lanczos3)
    };

    // JPEG는 알파를 지원하지 않으므로 RGB8로 변환 후 인코딩.
    let rgb = resized.to_rgb8();

    // 임시 파일에 쓴 다음 rename — 동시에 다른 프로세스가 중간 파일을 읽는 일을 방지.
    let tmp_path = cache_path.with_extension("jpg.tmp");
    {
        let file = std::fs::File::create(&tmp_path)?;
        let mut writer = std::io::BufWriter::new(file);
        let mut encoder = JpegEncoder::new_with_quality(&mut writer, JPEG_QUALITY);
        encoder
            .encode(
                rgb.as_raw(),
                rgb.width(),
                rgb.height(),
                image::ExtendedColorType::Rgb8,
            )
            .map_err(|e| VaultError::Io(format!("thumbnail encode: {e}")))?;
    }
    std::fs::rename(&tmp_path, &cache_path)?;

    Ok(cache_path)
}

/// vault root 안의 안전한 절대 경로로 변환. path traversal 차단.
fn resolve_within_vault(vault_root: &Path, rel_path: &str) -> VaultResult<PathBuf> {
    if rel_path.is_empty() || rel_path.starts_with('/') || rel_path.starts_with('\\') {
        return Err(VaultError::PathTraversal(rel_path.to_string()));
    }
    for comp in Path::new(rel_path).components() {
        match comp {
            Component::ParentDir => {
                return Err(VaultError::PathTraversal(rel_path.to_string()));
            }
            Component::Normal(_) | Component::CurDir => {}
            _ => return Err(VaultError::PathTraversal(rel_path.to_string())),
        }
    }

    let joined = vault_root.join(rel_path);
    if let Ok(canonical) = joined.canonicalize() {
        let root_canon = vault_root
            .canonicalize()
            .unwrap_or_else(|_| vault_root.to_path_buf());
        if !canonical.starts_with(&root_canon) {
            return Err(VaultError::PathTraversal(rel_path.to_string()));
        }
        Ok(canonical)
    } else {
        Err(VaultError::NotFound(rel_path.to_string()))
    }
}

fn sha1_hex(bytes: &[u8]) -> String {
    let mut hasher = Sha1::new();
    hasher.update(bytes);
    let result = hasher.finalize();
    let mut hex = String::with_capacity(result.len() * 2);
    for b in result.iter() {
        hex.push_str(&format!("{b:02x}"));
    }
    hex
}

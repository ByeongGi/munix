use std::collections::HashSet;
use std::path::{Path, PathBuf};

use serde::Serialize;
use serde_json::Value;
use walkdir::{DirEntry, WalkDir};

const MAX_VISIBLE_SUGGESTIONS: usize = 5;
const MAX_PATH_CANDIDATES: usize = 300;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TerminalCompletionSuggestion {
    name: String,
    description: Option<String>,
    insert_value: String,
    kind: String,
    replacement_start: usize,
    replacement_end: usize,
    priority: i32,
}

struct CompletionContext {
    input: String,
    tokens: Vec<String>,
    command: String,
    query: String,
    replacement_start: usize,
    replacement_end: usize,
    cwd: PathBuf,
    vault_root: PathBuf,
    history: Vec<String>,
}

#[derive(Clone, Copy)]
struct CompletionItem {
    name: &'static str,
    description: &'static str,
    insert_value: Option<&'static str>,
}

#[derive(Clone, Copy)]
struct CompletionSpec {
    name: &'static str,
    description: &'static str,
    templates: &'static [CompletionItem],
    options: &'static [CompletionItem],
}

const GIT_TEMPLATES: &[CompletionItem] = &[
    item("git status", "Show working tree status"),
    item("git add .", "Stage all changes"),
    item("git commit -m \"\"", "Create a commit"),
    item("git checkout ", "Switch branches or restore files"),
    item("git pull", "Fetch and integrate changes"),
    item("git push", "Update remote refs"),
    item("git diff", "Show unstaged changes"),
    item("git log --oneline", "Compact commit log"),
];

const GIT_OPTIONS: &[CompletionItem] = &[
    item("--help", "Show help"),
    item("--version", "Show version"),
    item("-C", "Run as if git was started in a path"),
];

const PNPM_TEMPLATES: &[CompletionItem] = &[
    item("pnpm install", "Install dependencies"),
    item("pnpm run ", "Run a package script"),
    item("pnpm dev", "Run development server"),
    item("pnpm tauri dev", "Run Tauri app"),
    item("pnpm build", "Build frontend"),
    item("pnpm lint", "Run lint script"),
    item("pnpm test", "Run tests"),
    item("pnpm exec tsc --noEmit", "Type-check"),
];

const PNPM_OPTIONS: &[CompletionItem] = &[
    item("--filter", "Select packages"),
    item("--dir", "Change working directory"),
    item("--recursive", "Run recursively"),
];

const NPM_TEMPLATES: &[CompletionItem] = &[
    item("npm install", "Install dependencies"),
    item("npm run ", "Run a package script"),
    item("npm run dev", "Run development server"),
    item("npm run build", "Run build script"),
    item("npm test", "Run tests"),
];

const NPM_OPTIONS: &[CompletionItem] = &[
    item("--save-dev", "Save as dev dependency"),
    item("--global", "Install globally"),
    item("--help", "Show help"),
];

const CARGO_TEMPLATES: &[CompletionItem] = &[
    item("cargo check", "Check without building artifacts"),
    item("cargo test", "Run tests"),
    item("cargo clippy", "Run lints"),
    item("cargo fmt", "Format Rust code"),
    item("cargo build --release", "Build optimized artifacts"),
];

const CARGO_OPTIONS: &[CompletionItem] = &[
    item("--release", "Build optimized artifacts"),
    item("--workspace", "Use workspace packages"),
    item("--features", "Space-separated features"),
];

const LS_TEMPLATES: &[CompletionItem] = &[
    item("ls -la", "Long list including hidden files"),
    item("ls -lh", "Human-readable sizes"),
];

const LS_OPTIONS: &[CompletionItem] = &[
    item("-la", "Long list including hidden files"),
    item("-lh", "Human-readable sizes"),
    item("-R", "List recursively"),
];

const CD_TEMPLATES: &[CompletionItem] = &[item("cd ", "Change directory")];

const TAURI_TEMPLATES: &[CompletionItem] = &[
    item("tauri dev", "Run development app"),
    item("tauri build", "Build desktop app"),
    item("tauri info", "Print environment info"),
];

const YARN_TEMPLATES: &[CompletionItem] = &[
    item("yarn install", "Install dependencies"),
    item("yarn run ", "Run a package script"),
];

const BUN_TEMPLATES: &[CompletionItem] = &[
    item("bun install", "Install dependencies"),
    item("bun run ", "Run a package script"),
];

const EMPTY_ITEMS: &[CompletionItem] = &[];

const COMPLETION_SPECS: &[CompletionSpec] = &[
    CompletionSpec {
        name: "git",
        description: "Version control",
        templates: GIT_TEMPLATES,
        options: GIT_OPTIONS,
    },
    CompletionSpec {
        name: "pnpm",
        description: "Fast JavaScript package manager",
        templates: PNPM_TEMPLATES,
        options: PNPM_OPTIONS,
    },
    CompletionSpec {
        name: "npm",
        description: "Node package manager",
        templates: NPM_TEMPLATES,
        options: NPM_OPTIONS,
    },
    CompletionSpec {
        name: "cargo",
        description: "Rust package manager",
        templates: CARGO_TEMPLATES,
        options: CARGO_OPTIONS,
    },
    CompletionSpec {
        name: "ls",
        description: "List directory contents",
        templates: LS_TEMPLATES,
        options: LS_OPTIONS,
    },
    CompletionSpec {
        name: "cd",
        description: "Change directory",
        templates: CD_TEMPLATES,
        options: EMPTY_ITEMS,
    },
    CompletionSpec {
        name: "tauri",
        description: "Tauri CLI",
        templates: TAURI_TEMPLATES,
        options: EMPTY_ITEMS,
    },
    CompletionSpec {
        name: "yarn",
        description: "JavaScript package manager",
        templates: YARN_TEMPLATES,
        options: EMPTY_ITEMS,
    },
    CompletionSpec {
        name: "bun",
        description: "JavaScript runtime and package manager",
        templates: BUN_TEMPLATES,
        options: EMPTY_ITEMS,
    },
];

const fn item(name: &'static str, description: &'static str) -> CompletionItem {
    CompletionItem {
        name,
        description,
        insert_value: None,
    }
}

pub fn complete(
    input: String,
    history: Vec<String>,
    cwd: PathBuf,
    vault_root: PathBuf,
) -> Vec<TerminalCompletionSuggestion> {
    let (replacement_start, replacement_end, query) = current_token_range(&input);
    let tokens = split_command_line(&input);
    let command = tokens.first().cloned().unwrap_or_default();

    complete_with_providers(CompletionContext {
        input,
        tokens,
        command,
        query,
        replacement_start,
        replacement_end,
        cwd,
        vault_root,
        history,
    })
}

pub fn split_command_line(input: &str) -> Vec<String> {
    let mut tokens = Vec::new();
    let mut token = String::new();
    let mut quote: Option<char> = None;

    for ch in input.chars() {
        if quote.is_none() && ch.is_whitespace() {
            if !token.is_empty() {
                tokens.push(std::mem::take(&mut token));
            }
            continue;
        }

        if ch == '\'' || ch == '"' {
            match quote {
                Some(current) if current == ch => quote = None,
                None => quote = Some(ch),
                _ => token.push(ch),
            }
            continue;
        }

        token.push(ch);
    }

    if !token.is_empty() {
        tokens.push(token);
    }

    tokens
}

fn complete_with_providers(ctx: CompletionContext) -> Vec<TerminalCompletionSuggestion> {
    let mut suggestions = Vec::new();
    suggestions.extend(package_script_suggestions(&ctx));
    suggestions.extend(static_command_suggestions(&ctx));
    suggestions.extend(path_provider_suggestions(&ctx));
    sort_and_dedupe(suggestions)
}

fn matches_prefix(value: &str, query: &str) -> bool {
    value.to_lowercase().starts_with(&query.to_lowercase())
}

fn utf16_len(value: &str) -> usize {
    value.encode_utf16().count()
}

fn current_token_range(input: &str) -> (usize, usize, String) {
    let end = utf16_len(input);
    let mut token_start_byte = 0;
    let mut in_token = false;

    for (index, ch) in input.char_indices() {
        if ch.is_whitespace() {
            in_token = false;
            token_start_byte = index + ch.len_utf8();
        } else if !in_token {
            in_token = true;
            token_start_byte = index;
        }
    }

    if !in_token {
        return (end, end, String::new());
    }

    let start = utf16_len(&input[..token_start_byte]);
    (start, end, input[token_start_byte..].to_string())
}

fn completion_from_item(
    item: CompletionItem,
    kind: &str,
    replacement_start: usize,
    replacement_end: usize,
    priority: i32,
) -> TerminalCompletionSuggestion {
    TerminalCompletionSuggestion {
        name: item.name.to_string(),
        description: Some(item.description.to_string()),
        insert_value: format!("{} ", item.insert_value.unwrap_or(item.name)),
        kind: kind.to_string(),
        replacement_start,
        replacement_end,
        priority,
    }
}

fn template_suggestion(
    item: CompletionItem,
    replacement_end: usize,
    priority: i32,
) -> TerminalCompletionSuggestion {
    TerminalCompletionSuggestion {
        name: item.name.to_string(),
        description: Some(item.description.to_string()),
        insert_value: item.insert_value.unwrap_or(item.name).to_string(),
        kind: "command".to_string(),
        replacement_start: 0,
        replacement_end,
        priority,
    }
}

fn static_command_suggestions(ctx: &CompletionContext) -> Vec<TerminalCompletionSuggestion> {
    let mut suggestions = Vec::new();

    if !ctx.input.ends_with(' ') && !ctx.input.is_empty() {
        for spec in COMPLETION_SPECS {
            suggestions.extend(
                spec.templates
                    .iter()
                    .copied()
                    .filter(|item| matches_prefix(item.name, &ctx.input))
                    .map(|item| template_suggestion(item, ctx.replacement_end, 110)),
            );
        }
    }

    if ctx.tokens.len() <= 1 && !ctx.input.ends_with(' ') && !ctx.query.is_empty() {
        suggestions.extend(
            COMPLETION_SPECS
                .iter()
                .filter(|spec| matches_prefix(spec.name, &ctx.query))
                .map(|spec| {
                    completion_from_item(
                        CompletionItem {
                            name: spec.name,
                            description: spec.description,
                            insert_value: None,
                        },
                        "command",
                        ctx.replacement_start,
                        ctx.replacement_end,
                        100,
                    )
                }),
        );

        if ctx.input.len() >= 2 {
            suggestions.extend(
                ctx.history
                    .iter()
                    .filter(|entry| matches_prefix(entry, &ctx.input))
                    .take(8)
                    .map(|entry| TerminalCompletionSuggestion {
                        name: entry.clone(),
                        description: Some("Recent command".to_string()),
                        insert_value: entry.clone(),
                        kind: "history".to_string(),
                        replacement_start: 0,
                        replacement_end: ctx.replacement_end,
                        priority: 80,
                    }),
            );
        }
    }

    if let Some(spec) = COMPLETION_SPECS
        .iter()
        .find(|spec| spec.name == ctx.command)
    {
        suggestions.extend(
            spec.options
                .iter()
                .copied()
                .filter(|item| !ctx.query.is_empty() && matches_prefix(item.name, &ctx.query))
                .map(|item| {
                    completion_from_item(
                        item,
                        "option",
                        ctx.replacement_start,
                        ctx.replacement_end,
                        60,
                    )
                }),
        );
    }

    suggestions
}

fn package_script_suggestions(ctx: &CompletionContext) -> Vec<TerminalCompletionSuggestion> {
    if !matches!(ctx.command.as_str(), "pnpm" | "npm" | "yarn" | "bun") {
        return Vec::new();
    }

    let manager = ctx.command.as_str();
    let is_run_context = match manager {
        "pnpm" | "npm" | "bun" => ctx.tokens.get(1).map(String::as_str) == Some("run"),
        "yarn" => true,
        _ => false,
    };

    if !is_run_context {
        return Vec::new();
    }

    let Some(package_dir) = nearest_package_json_dir(&ctx.cwd, &ctx.vault_root) else {
        return Vec::new();
    };
    let Ok(raw) = std::fs::read_to_string(package_dir.join("package.json")) else {
        return Vec::new();
    };
    let Ok(json) = serde_json::from_str::<Value>(&raw) else {
        return Vec::new();
    };
    let Some(scripts) = json.get("scripts").and_then(Value::as_object) else {
        return Vec::new();
    };

    let input_end = utf16_len(&ctx.input);
    let run_command_without_arg = matches!(manager, "pnpm" | "npm" | "yarn" | "bun")
        && ctx.tokens.len() == 2
        && !ctx.input.ends_with(' ')
        && ctx.tokens.get(1).map(String::as_str) == Some("run");
    let yarn_without_arg = manager == "yarn" && ctx.tokens.len() == 1 && !ctx.input.ends_with(' ');
    let query = if ctx.input.ends_with(' ') || run_command_without_arg || yarn_without_arg {
        ""
    } else {
        ctx.query.as_str()
    };
    let replace_start = if ctx.input.ends_with(' ') || run_command_without_arg || yarn_without_arg {
        input_end
    } else {
        ctx.replacement_start
    };
    let replace_end = if ctx.input.ends_with(' ') || run_command_without_arg || yarn_without_arg {
        input_end
    } else {
        ctx.replacement_end
    };
    let insert_prefix = if run_command_without_arg || yarn_without_arg {
        " "
    } else {
        ""
    };

    scripts
        .iter()
        .filter(|(name, _)| query.is_empty() || matches_prefix(name, query))
        .map(|(name, command)| {
            let description = command
                .as_str()
                .map(|script| format!("package script: {script}"))
                .unwrap_or_else(|| "package script".to_string());
            TerminalCompletionSuggestion {
                name: name.to_string(),
                description: Some(description),
                insert_value: format!("{insert_prefix}{name} "),
                kind: "script".to_string(),
                replacement_start: replace_start,
                replacement_end: replace_end,
                priority: 130,
            }
        })
        .collect()
}

fn nearest_package_json_dir(cwd: &Path, vault_root: &Path) -> Option<PathBuf> {
    let canonical_vault = vault_root.canonicalize().ok()?;
    let mut current = cwd.canonicalize().ok()?;
    loop {
        if current.join("package.json").is_file() {
            return Some(current);
        }
        if current == canonical_vault {
            return None;
        }
        if !current.pop() {
            return None;
        }
    }
}

fn path_provider_suggestions(ctx: &CompletionContext) -> Vec<TerminalCompletionSuggestion> {
    if matches!(ctx.command.as_str(), "cd" | "ls" | "cat") {
        collect_path_suggestions(&ctx.cwd, &ctx.command, &ctx.input, &ctx.query)
    } else {
        Vec::new()
    }
}

fn collect_path_suggestions(
    root: &Path,
    command: &str,
    input: &str,
    token: &str,
) -> Vec<TerminalCompletionSuggestion> {
    if token.is_empty() {
        return Vec::new();
    }

    let (replacement_start, replacement_end, _) = current_token_range(input);
    let normalized_token = token.trim_start_matches(['"', '\'']);
    let directory_only = command == "cd";

    WalkDir::new(root)
        .follow_links(false)
        .into_iter()
        .filter_entry(|entry| !should_skip_path(entry))
        .filter_map(Result::ok)
        .filter(|entry| entry.path() != root)
        .filter(|entry| !directory_only || entry.file_type().is_dir())
        .filter_map(|entry| {
            let rel = entry.path().strip_prefix(root).ok()?;
            let mut rel_path = slash_path(rel);
            if entry.file_type().is_dir() {
                rel_path.push('/');
            }
            if matches_prefix(&rel_path, normalized_token) {
                Some(rel_path)
            } else {
                None
            }
        })
        .take(MAX_PATH_CANDIDATES)
        .take(MAX_VISIBLE_SUGGESTIONS)
        .map(|path| TerminalCompletionSuggestion {
            name: path.clone(),
            description: Some("Vault path".to_string()),
            insert_value: path_insert_value(&path),
            kind: "path".to_string(),
            replacement_start,
            replacement_end,
            priority: -20,
        })
        .collect()
}

fn should_skip_path(entry: &DirEntry) -> bool {
    let name = entry.file_name().to_string_lossy();
    if !entry.file_type().is_dir() {
        return false;
    }

    matches!(
        name.as_ref(),
        ".git" | ".munix" | "node_modules" | "target" | "dist" | "build"
    )
}

fn slash_path(path: &Path) -> String {
    path.components()
        .map(|component| component.as_os_str().to_string_lossy())
        .collect::<Vec<_>>()
        .join("/")
}

fn path_insert_value(path: &str) -> String {
    if path.contains(' ') {
        format!("\"{path}\" ")
    } else {
        format!("{path} ")
    }
}

fn sort_and_dedupe(
    mut suggestions: Vec<TerminalCompletionSuggestion>,
) -> Vec<TerminalCompletionSuggestion> {
    suggestions.sort_by(|a, b| b.priority.cmp(&a.priority));

    let mut seen = HashSet::new();
    let mut out = Vec::new();
    for suggestion in suggestions {
        let key = format!("{}:{}", suggestion.kind, suggestion.insert_value);
        if seen.insert(key) {
            out.push(suggestion);
        }
        if out.len() >= MAX_VISIBLE_SUGGESTIONS {
            break;
        }
    }

    out
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp_package_dir(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("munix-terminal-completion-{name}"));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).expect("create temp package dir");
        std::fs::write(
            dir.join("package.json"),
            r#"{"scripts":{"dev":"vite --host","build":"vite build","lint":"eslint ."}}"#,
        )
        .expect("write package.json");
        dir
    }

    fn context(input: &str, cwd: PathBuf, vault_root: PathBuf) -> CompletionContext {
        let (replacement_start, replacement_end, query) = current_token_range(input);
        let tokens = split_command_line(input);
        let command = tokens.first().cloned().unwrap_or_default();
        CompletionContext {
            input: input.to_string(),
            tokens,
            command,
            query,
            replacement_start,
            replacement_end,
            cwd,
            vault_root,
            history: Vec::new(),
        }
    }

    #[test]
    fn package_scripts_complete_after_pnpm_run_without_trailing_space() {
        let root = temp_package_dir("pnpm-run-exact");
        let suggestions = package_script_suggestions(&context("pnpm run", root.clone(), root));

        assert!(suggestions.iter().any(|suggestion| {
            suggestion.kind == "script"
                && suggestion.name == "dev"
                && suggestion.insert_value == " dev "
        }));
    }

    #[test]
    fn package_scripts_complete_by_script_prefix() {
        let root = temp_package_dir("pnpm-run-prefix");
        let suggestions = package_script_suggestions(&context("pnpm run b", root.clone(), root));

        assert_eq!(suggestions.len(), 1);
        assert_eq!(suggestions[0].name, "build");
        assert_eq!(suggestions[0].insert_value, "build ");
    }
}

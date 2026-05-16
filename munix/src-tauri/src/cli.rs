use std::collections::{BTreeMap, BTreeSet};
use std::error::Error;
use std::fmt;

use serde::{Deserialize, Serialize};

pub const CLI_HELP: &str = r#"Munix CLI

Usage:
  munix [vault=<name|id|path>] <command> [key=value ...] [flag ...]

Examples:
  munix vault=Work open path="daily/2026-05-16.md" line=42 newtab
  munix vault=Work create path="inbox/idea.md" content="first draft" open
  munix vault=Work append path="daily/2026-05-16.md" content="- [ ] Follow up"
  munix vault=Work search query="tauri ipc" format=json
  munix vault=Work daily:append content="- [ ] Review"
  munix vaults format=json

Commands:
  open, create, read, append, prepend, search, search:open
  daily, daily:read, daily:append, daily:prepend
  vaults, files, folders, tags, backlinks

Global:
  vault=<name|id|path>     Target vault. Must appear before the command.
  --vault <value>          Compatibility alias for vault=<value>.
  --help                   Show help.
  --version                Show version.
"#;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CliInvocation {
    pub vault: Option<String>,
    pub command: CliCommand,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum CliCommand {
    Tui,
    Help {
        topic: Option<String>,
    },
    Version,
    Vaults {
        format: OutputFormat,
    },
    Files {
        format: OutputFormat,
    },
    Folders {
        format: OutputFormat,
    },
    Open {
        target: FileTarget,
        line: Option<u32>,
        column: Option<u32>,
        new_tab: bool,
    },
    Create {
        target: CreateTarget,
        content: Option<String>,
        open: bool,
        overwrite: bool,
    },
    Read {
        target: FileTarget,
        format: OutputFormat,
    },
    Append {
        target: FileTarget,
        content: String,
        open: bool,
        inline: bool,
    },
    Prepend {
        target: FileTarget,
        content: String,
        open: bool,
        inline: bool,
    },
    Search {
        query: String,
        open: bool,
        context: bool,
        format: OutputFormat,
    },
    Daily {
        action: DailyAction,
    },
    Tags {
        counts: bool,
        format: OutputFormat,
    },
    Backlinks {
        target: FileTarget,
        format: OutputFormat,
    },
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum DailyAction {
    Open,
    Read {
        format: OutputFormat,
    },
    Append {
        content: String,
        open: bool,
        inline: bool,
    },
    Prepend {
        content: String,
        open: bool,
        inline: bool,
    },
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FileTarget {
    pub path: Option<String>,
    pub file: Option<String>,
}

impl FileTarget {
    fn new(path: Option<String>, file: Option<String>) -> Result<Self, CliParseError> {
        match (&path, &file) {
            (Some(_), Some(_)) => Err(CliParseError::InvalidTarget(
                "use either path=... or file=..., not both".to_string(),
            )),
            (None, None) => Err(CliParseError::MissingArgument(
                "expected path=... or file=...".to_string(),
            )),
            _ => Ok(Self { path, file }),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateTarget {
    pub path: Option<String>,
    pub name: Option<String>,
}

impl CreateTarget {
    fn new(path: Option<String>, name: Option<String>) -> Result<Self, CliParseError> {
        match (&path, &name) {
            (Some(_), Some(_)) => Err(CliParseError::InvalidTarget(
                "use either path=... or name=..., not both".to_string(),
            )),
            _ => Ok(Self { path, name }),
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum OutputFormat {
    Text,
    Json,
    Markdown,
    Tsv,
    Csv,
    Yaml,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum CliParseError {
    MissingCommandValue(String),
    MissingArgument(String),
    DuplicateArgument(String),
    UnknownCommand(String),
    UnknownArgument(String),
    InvalidNumber { key: String, value: String },
    InvalidFormat(String),
    InvalidTarget(String),
}

impl fmt::Display for CliParseError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::MissingCommandValue(key) => write!(f, "missing value for {key}"),
            Self::MissingArgument(message) => write!(f, "{message}"),
            Self::DuplicateArgument(key) => write!(f, "duplicate argument: {key}"),
            Self::UnknownCommand(command) => write!(f, "unknown command: {command}"),
            Self::UnknownArgument(arg) => write!(f, "unknown argument: {arg}"),
            Self::InvalidNumber { key, value } => {
                write!(f, "invalid numeric value for {key}: {value}")
            }
            Self::InvalidFormat(format) => write!(f, "invalid output format: {format}"),
            Self::InvalidTarget(message) => write!(f, "{message}"),
        }
    }
}

impl Error for CliParseError {}

pub fn parse_args(args: &[String]) -> Result<CliInvocation, CliParseError> {
    let mut index = 0;
    let mut vault = None;

    while index < args.len() {
        let arg = &args[index];
        if arg == "--help" || arg == "-h" {
            return Ok(invocation(vault, CliCommand::Help { topic: None }));
        }
        if arg == "--version" || arg == "-V" {
            return Ok(invocation(vault, CliCommand::Version));
        }
        if arg == "--vault" {
            let value = args
                .get(index + 1)
                .ok_or_else(|| CliParseError::MissingCommandValue("--vault".to_string()))?;
            vault = Some(value.clone());
            index += 2;
            continue;
        }
        if let Some(value) = arg.strip_prefix("--vault=") {
            vault = Some(value.to_string());
            index += 1;
            continue;
        }
        if let Some((key, value)) = split_assignment(arg) {
            if key == "vault" {
                vault = Some(value.to_string());
                index += 1;
                continue;
            }
        }
        break;
    }

    let Some(command) = args.get(index) else {
        return Ok(invocation(vault, CliCommand::Tui));
    };
    let tail = ParsedTail::parse(&args[index + 1..])?;
    let command = parse_command(command, tail)?;
    Ok(invocation(vault, command))
}

fn invocation(vault: Option<String>, command: CliCommand) -> CliInvocation {
    CliInvocation { vault, command }
}

fn parse_command(command: &str, tail: ParsedTail) -> Result<CliCommand, CliParseError> {
    match command {
        "help" => parse_help(tail),
        "version" => {
            tail.reject_unexpected(&[], &[], 0)?;
            Ok(CliCommand::Version)
        }
        "vaults" => {
            let format = tail.output_format(OutputFormat::Text)?;
            tail.reject_unexpected(&["format"], &["json"], 0)?;
            Ok(CliCommand::Vaults { format })
        }
        "files" => {
            let format = tail.output_format(OutputFormat::Text)?;
            tail.reject_unexpected(&["format"], &["json"], 0)?;
            Ok(CliCommand::Files { format })
        }
        "folders" => {
            let format = tail.output_format(OutputFormat::Text)?;
            tail.reject_unexpected(&["format"], &["json"], 0)?;
            Ok(CliCommand::Folders { format })
        }
        "open" => parse_open(tail),
        "create" | "new" => parse_create(tail),
        "read" => parse_read(tail),
        "append" => parse_append(tail, false),
        "prepend" => parse_append(tail, true),
        "search" => parse_search(tail, false),
        "search:open" => parse_search(tail, true),
        "daily" => parse_daily(tail, "daily"),
        "daily:read" => parse_daily(tail, "daily:read"),
        "daily:append" => parse_daily(tail, "daily:append"),
        "daily:prepend" => parse_daily(tail, "daily:prepend"),
        "tags" => {
            let format = tail.output_format(OutputFormat::Text)?;
            let counts = tail.has_flag("counts") || tail.has_flag("count");
            tail.reject_unexpected(&["format"], &["json", "counts", "count"], 0)?;
            Ok(CliCommand::Tags { counts, format })
        }
        "backlinks" => {
            let target = tail.file_target(&["json"])?;
            let format = tail.output_format(OutputFormat::Text)?;
            tail.reject_unexpected(
                &["path", "file", "format"],
                &["json"],
                tail.target_positional_limit(),
            )?;
            Ok(CliCommand::Backlinks { target, format })
        }
        other => Err(CliParseError::UnknownCommand(other.to_string())),
    }
}

fn parse_help(tail: ParsedTail) -> Result<CliCommand, CliParseError> {
    let topic = tail.positionals.first().cloned();
    tail.reject_unexpected(&[], &[], 1)?;
    Ok(CliCommand::Help { topic })
}

fn parse_open(tail: ParsedTail) -> Result<CliCommand, CliParseError> {
    let target = tail.file_target(&["newtab", "new-tab"])?;
    let line = tail.optional_u32("line")?;
    let column = tail.optional_u32("column")?;
    let new_tab = tail.has_flag("newtab") || tail.has_flag("new-tab");
    tail.reject_unexpected(
        &["path", "file", "line", "column"],
        &["newtab", "new-tab"],
        tail.target_positional_limit(),
    )?;
    Ok(CliCommand::Open {
        target,
        line,
        column,
        new_tab,
    })
}

fn parse_create(tail: ParsedTail) -> Result<CliCommand, CliParseError> {
    let target = tail.create_target(&["open", "overwrite", "newtab", "new-tab"])?;
    let content = tail.value("content").map(|value| decode_cli_text(value));
    let open = tail.has_flag("open");
    let overwrite = tail.has_flag("overwrite");
    tail.reject_unexpected(
        &["path", "name", "content"],
        &["open", "overwrite", "newtab", "new-tab"],
        tail.create_target_positional_limit(),
    )?;
    Ok(CliCommand::Create {
        target,
        content,
        open,
        overwrite,
    })
}

fn parse_read(tail: ParsedTail) -> Result<CliCommand, CliParseError> {
    let target = tail.file_target(&["json"])?;
    let format = tail.output_format(OutputFormat::Text)?;
    tail.reject_unexpected(
        &["path", "file", "format"],
        &["json"],
        tail.target_positional_limit(),
    )?;
    Ok(CliCommand::Read { target, format })
}

fn parse_append(tail: ParsedTail, prepend: bool) -> Result<CliCommand, CliParseError> {
    let target = tail.file_target(&["open", "inline"])?;
    let content = decode_cli_text(&tail.required_value("content")?);
    let open = tail.has_flag("open");
    let inline = tail.has_flag("inline");
    tail.reject_unexpected(
        &["path", "file", "content"],
        &["open", "inline"],
        tail.target_positional_limit(),
    )?;
    if prepend {
        Ok(CliCommand::Prepend {
            target,
            content,
            open,
            inline,
        })
    } else {
        Ok(CliCommand::Append {
            target,
            content,
            open,
            inline,
        })
    }
}

fn parse_search(tail: ParsedTail, force_open: bool) -> Result<CliCommand, CliParseError> {
    let bare_flags = ["open", "context", "json"];
    let query = tail
        .value("query")
        .or_else(|| tail.value("q"))
        .cloned()
        .or_else(|| {
            let words = tail
                .positionals
                .iter()
                .filter(|item| !bare_flags.contains(&item.as_str()))
                .cloned()
                .collect::<Vec<_>>();
            if words.is_empty() {
                None
            } else {
                Some(words.join(" "))
            }
        })
        .ok_or_else(|| CliParseError::MissingArgument("expected query=...".to_string()))?;
    let open = force_open || tail.has_flag("open");
    let context = tail.has_flag("context");
    let format = tail.output_format(OutputFormat::Text)?;
    let max_positionals = if tail.value("query").is_some() || tail.value("q").is_some() {
        0
    } else {
        usize::MAX
    };
    tail.reject_unexpected(
        &["query", "q", "format"],
        &["open", "context", "json"],
        max_positionals,
    )?;
    Ok(CliCommand::Search {
        query,
        open,
        context,
        format,
    })
}

fn parse_daily(tail: ParsedTail, command: &str) -> Result<CliCommand, CliParseError> {
    let action = match command {
        "daily:read" => {
            let format = tail.output_format(OutputFormat::Text)?;
            tail.reject_unexpected(&["format"], &["json"], 0)?;
            DailyAction::Read { format }
        }
        "daily:append" => {
            let content = decode_cli_text(&tail.required_value("content")?);
            let open = tail.has_flag("open");
            let inline = tail.has_flag("inline");
            tail.reject_unexpected(&["content"], &["open", "inline"], 0)?;
            DailyAction::Append {
                content,
                open,
                inline,
            }
        }
        "daily:prepend" => {
            let content = decode_cli_text(&tail.required_value("content")?);
            let open = tail.has_flag("open");
            let inline = tail.has_flag("inline");
            tail.reject_unexpected(&["content"], &["open", "inline"], 0)?;
            DailyAction::Prepend {
                content,
                open,
                inline,
            }
        }
        _ => {
            tail.reject_unexpected(&[], &["open"], 0)?;
            DailyAction::Open
        }
    };
    Ok(CliCommand::Daily { action })
}

#[derive(Debug, Default)]
struct ParsedTail {
    values: BTreeMap<String, String>,
    flags: BTreeSet<String>,
    positionals: Vec<String>,
}

impl ParsedTail {
    fn parse(args: &[String]) -> Result<Self, CliParseError> {
        let mut tail = Self::default();
        for arg in args {
            if let Some(stripped) = arg.strip_prefix("--") {
                if let Some((key, value)) = split_assignment(stripped) {
                    tail.insert_value(key, value)?;
                } else if !stripped.is_empty() {
                    tail.flags.insert(normalize_key(stripped));
                } else {
                    return Err(CliParseError::UnknownArgument(arg.clone()));
                }
            } else if let Some((key, value)) = split_assignment(arg) {
                tail.insert_value(key, value)?;
            } else {
                tail.positionals.push(arg.clone());
            }
        }
        Ok(tail)
    }

    fn insert_value(&mut self, key: &str, value: &str) -> Result<(), CliParseError> {
        let key = normalize_key(key);
        if self.values.insert(key.clone(), value.to_string()).is_some() {
            return Err(CliParseError::DuplicateArgument(key));
        }
        Ok(())
    }

    fn value(&self, key: &str) -> Option<&String> {
        self.values.get(key)
    }

    fn required_value(&self, key: &str) -> Result<String, CliParseError> {
        self.value(key)
            .cloned()
            .ok_or_else(|| CliParseError::MissingArgument(format!("expected {key}=...")))
    }

    fn has_flag(&self, flag: &str) -> bool {
        self.flags.contains(flag) || self.positionals.iter().any(|item| item == flag)
    }

    fn file_target(&self, bare_flags: &[&str]) -> Result<FileTarget, CliParseError> {
        let mut positional_paths = self
            .positionals
            .iter()
            .filter(|item| !bare_flags.contains(&item.as_str()))
            .cloned()
            .collect::<Vec<_>>();
        let positional_path = if positional_paths.len() > 1 {
            return Err(CliParseError::UnknownArgument(positional_paths.remove(1)));
        } else {
            positional_paths.pop()
        };
        FileTarget::new(
            self.value("path").cloned().or(positional_path),
            self.value("file").cloned(),
        )
    }

    fn create_target(&self, bare_flags: &[&str]) -> Result<CreateTarget, CliParseError> {
        let mut positional_paths = self
            .positionals
            .iter()
            .filter(|item| !bare_flags.contains(&item.as_str()))
            .cloned()
            .collect::<Vec<_>>();
        let positional_path = if positional_paths.len() > 1 {
            return Err(CliParseError::UnknownArgument(positional_paths.remove(1)));
        } else {
            positional_paths.pop()
        };
        CreateTarget::new(
            self.value("path").cloned().or(positional_path),
            self.value("name").cloned(),
        )
    }

    fn target_positional_limit(&self) -> usize {
        if self.value("path").is_some() || self.value("file").is_some() {
            0
        } else {
            1
        }
    }

    fn create_target_positional_limit(&self) -> usize {
        if self.value("path").is_some() || self.value("name").is_some() {
            0
        } else {
            1
        }
    }

    fn optional_u32(&self, key: &str) -> Result<Option<u32>, CliParseError> {
        let Some(value) = self.value(key) else {
            return Ok(None);
        };
        value
            .parse::<u32>()
            .map(Some)
            .map_err(|_| CliParseError::InvalidNumber {
                key: key.to_string(),
                value: value.clone(),
            })
    }

    fn output_format(&self, default: OutputFormat) -> Result<OutputFormat, CliParseError> {
        if self.has_flag("json") {
            return Ok(OutputFormat::Json);
        }
        self.value("format")
            .map(|value| parse_output_format(value))
            .unwrap_or(Ok(default))
    }

    fn reject_unexpected(
        &self,
        allowed_values: &[&str],
        allowed_flags: &[&str],
        max_positionals: usize,
    ) -> Result<(), CliParseError> {
        for key in self.values.keys() {
            if !allowed_values.iter().any(|allowed| allowed == key) {
                return Err(CliParseError::UnknownArgument(format!("{key}=...")));
            }
        }
        for flag in &self.flags {
            if !allowed_flags.iter().any(|allowed| allowed == flag) {
                return Err(CliParseError::UnknownArgument(flag.clone()));
            }
        }
        let mut positional_count = 0;
        for positional in &self.positionals {
            if allowed_flags.iter().any(|allowed| allowed == positional) {
                continue;
            }
            positional_count += 1;
            if positional_count > max_positionals {
                return Err(CliParseError::UnknownArgument(positional.clone()));
            }
        }
        Ok(())
    }
}

fn split_assignment(input: &str) -> Option<(&str, &str)> {
    let (key, value) = input.split_once('=')?;
    if key.is_empty() {
        None
    } else {
        Some((key, value))
    }
}

fn normalize_key(key: &str) -> String {
    key.to_ascii_lowercase().replace('_', "-")
}

fn decode_cli_text(input: &str) -> String {
    let mut out = String::with_capacity(input.len());
    let mut chars = input.chars();
    while let Some(ch) = chars.next() {
        if ch != '\\' {
            out.push(ch);
            continue;
        }

        match chars.next() {
            Some('n') => out.push('\n'),
            Some('t') => out.push('\t'),
            Some('\\') => out.push('\\'),
            Some(other) => {
                out.push('\\');
                out.push(other);
            }
            None => out.push('\\'),
        }
    }
    out
}

fn parse_output_format(value: &str) -> Result<OutputFormat, CliParseError> {
    match value.to_ascii_lowercase().as_str() {
        "text" | "txt" => Ok(OutputFormat::Text),
        "json" => Ok(OutputFormat::Json),
        "md" | "markdown" => Ok(OutputFormat::Markdown),
        "tsv" => Ok(OutputFormat::Tsv),
        "csv" => Ok(OutputFormat::Csv),
        "yaml" | "yml" => Ok(OutputFormat::Yaml),
        other => Err(CliParseError::InvalidFormat(other.to_string())),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn parse(input: &[&str]) -> CliInvocation {
        parse_args(
            &input
                .iter()
                .map(|item| (*item).to_string())
                .collect::<Vec<_>>(),
        )
        .expect("parse should succeed")
    }

    #[test]
    fn parses_open_with_global_vault() {
        let parsed = parse(&[
            "vault=Work",
            "open",
            "path=daily/2026-05-16.md",
            "line=42",
            "newtab",
        ]);

        assert_eq!(parsed.vault, Some("Work".to_string()));
        assert_eq!(
            parsed.command,
            CliCommand::Open {
                target: FileTarget {
                    path: Some("daily/2026-05-16.md".to_string()),
                    file: None
                },
                line: Some(42),
                column: None,
                new_tab: true
            }
        );
    }

    #[test]
    fn parses_vault_alias_and_positional_open_path() {
        let parsed = parse(&["--vault", "Work", "open", "daily/today.md"]);

        assert_eq!(parsed.vault, Some("Work".to_string()));
        assert_eq!(
            parsed.command,
            CliCommand::Open {
                target: FileTarget {
                    path: Some("daily/today.md".to_string()),
                    file: None
                },
                line: None,
                column: None,
                new_tab: false
            }
        );
    }

    #[test]
    fn parses_create_flags() {
        let parsed = parse(&[
            "vault=Work",
            "create",
            "path=inbox/idea.md",
            "content=hello\\nworld",
            "open",
            "overwrite",
        ]);

        assert_eq!(
            parsed.command,
            CliCommand::Create {
                target: CreateTarget {
                    path: Some("inbox/idea.md".to_string()),
                    name: None
                },
                content: Some("hello\nworld".to_string()),
                open: true,
                overwrite: true
            }
        );
    }

    #[test]
    fn parses_create_name_target() {
        let parsed = parse(&["create", "name=Trip to Paris", "content=hello\\tworld"]);

        assert_eq!(
            parsed.command,
            CliCommand::Create {
                target: CreateTarget {
                    path: None,
                    name: Some("Trip to Paris".to_string())
                },
                content: Some("hello\tworld".to_string()),
                open: false,
                overwrite: false
            }
        );
    }

    #[test]
    fn parses_append() {
        let parsed = parse(&[
            "append",
            "path=daily/today.md",
            "content=- [ ] Follow up",
            "open",
        ]);

        assert_eq!(
            parsed.command,
            CliCommand::Append {
                target: FileTarget {
                    path: Some("daily/today.md".to_string()),
                    file: None
                },
                content: "- [ ] Follow up".to_string(),
                open: true,
                inline: false
            }
        );
    }

    #[test]
    fn parses_append_inline() {
        let parsed = parse(&["append", "path=a.md", "content=tail", "inline"]);

        assert_eq!(
            parsed.command,
            CliCommand::Append {
                target: FileTarget {
                    path: Some("a.md".to_string()),
                    file: None
                },
                content: "tail".to_string(),
                open: false,
                inline: true
            }
        );
    }

    #[test]
    fn parses_search_open_json() {
        let parsed = parse(&["search:open", "query=tauri ipc", "format=json"]);

        assert_eq!(
            parsed.command,
            CliCommand::Search {
                query: "tauri ipc".to_string(),
                open: true,
                context: false,
                format: OutputFormat::Json
            }
        );
    }

    #[test]
    fn parses_daily_append() {
        let parsed = parse(&["daily:append", "content=- [ ] Review", "open"]);

        assert_eq!(
            parsed.command,
            CliCommand::Daily {
                action: DailyAction::Append {
                    content: "- [ ] Review".to_string(),
                    open: true,
                    inline: false
                }
            }
        );
    }

    #[test]
    fn parses_daily_prepend_inline() {
        let parsed = parse(&["daily:prepend", "content=hello", "inline"]);

        assert_eq!(
            parsed.command,
            CliCommand::Daily {
                action: DailyAction::Prepend {
                    content: "hello".to_string(),
                    open: false,
                    inline: true
                }
            }
        );
    }

    #[test]
    fn rejects_path_and_file_together() {
        let err = parse_args(&[
            "open".to_string(),
            "path=a.md".to_string(),
            "file=A".to_string(),
        ])
        .expect_err("target should be invalid");

        assert!(matches!(err, CliParseError::InvalidTarget(_)));
    }

    #[test]
    fn rejects_create_path_and_name_together() {
        let err = parse_args(&[
            "create".to_string(),
            "path=a.md".to_string(),
            "name=A".to_string(),
        ])
        .expect_err("create target should be invalid");

        assert!(matches!(err, CliParseError::InvalidTarget(_)));
    }

    #[test]
    fn rejects_unknown_argument() {
        let err = parse_args(&[
            "open".to_string(),
            "path=a.md".to_string(),
            "wat".to_string(),
        ])
        .expect_err("unknown positional should fail");

        assert!(matches!(err, CliParseError::UnknownArgument(_)));
    }
}

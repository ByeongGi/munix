use gray_matter::{engine::Engine, engine::YAML, Pod};
use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ParsedMarkdown {
    pub frontmatter: Option<serde_json::Value>,
    pub body: String,
}

pub fn parse_markdown(source: String) -> ParsedMarkdown {
    let Some((matter, body_start)) = find_frontmatter_bounds(&source) else {
        return ParsedMarkdown {
            frontmatter: None,
            body: source,
        };
    };

    let frontmatter = match YAML::parse(matter) {
        Ok(Pod::Hash(map)) if !map.is_empty() => Some(pod_hash_to_json(map)),
        Ok(_) => None,
        Err(_) => {
            return ParsedMarkdown {
                frontmatter: None,
                body: source,
            };
        }
    };

    ParsedMarkdown {
        frontmatter,
        body: source[body_start..].to_string(),
    }
}

fn find_frontmatter_bounds(source: &str) -> Option<(&str, usize)> {
    let matter_start = if source.starts_with("---\n") {
        4
    } else if source.starts_with("---\r\n") {
        5
    } else {
        return None;
    };

    let mut line_start = matter_start;
    while line_start <= source.len() {
        let next_newline = source[line_start..]
            .find('\n')
            .map(|offset| line_start + offset);
        let line_end = next_newline.unwrap_or(source.len());
        let content_end = if line_end > line_start && source.as_bytes()[line_end - 1] == b'\r' {
            line_end - 1
        } else {
            line_end
        };

        if &source[line_start..content_end] == "---" {
            let body_start = next_newline.map_or(source.len(), |idx| idx + 1);
            return Some((&source[matter_start..line_start], body_start));
        }

        let Some(next) = next_newline else {
            break;
        };
        line_start = next + 1;
    }

    None
}

fn pod_hash_to_json(map: std::collections::HashMap<String, Pod>) -> serde_json::Value {
    serde_json::Value::Object(
        map.into_iter()
            .map(|(key, value)| (key, pod_to_json(value)))
            .collect(),
    )
}

fn pod_to_json(value: Pod) -> serde_json::Value {
    match value {
        Pod::Null => serde_json::Value::Null,
        Pod::String(value) => serde_json::Value::String(value),
        Pod::Integer(value) => serde_json::Value::Number(value.into()),
        Pod::Float(value) => serde_json::Number::from_f64(value)
            .map(serde_json::Value::Number)
            .unwrap_or(serde_json::Value::Null),
        Pod::Boolean(value) => serde_json::Value::Bool(value),
        Pod::Array(values) => {
            serde_json::Value::Array(values.into_iter().map(pod_to_json).collect())
        }
        Pod::Hash(map) => pod_hash_to_json(map),
    }
}

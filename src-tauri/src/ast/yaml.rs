//! YAML AST parser with position tracking

use super::{AstNode, AstNodeType, AstParseError, AstParseResult, AstPosition, AstRange};
use yaml_rust2::{Yaml, YamlLoader};

/// Parse YAML text to AST with position information
pub fn parse(text: &str) -> AstParseResult {
    // Use YamlLoader to parse with markers
    match YamlLoader::load_from_str(text) {
        Ok(docs) => {
            if docs.is_empty() {
                return AstParseResult::success(create_empty_root(text));
            }

            // For now, handle single document
            let doc = &docs[0];
            let ast = yaml_to_ast(text, doc, "$", 0);
            AstParseResult::success(ast)
        }
        Err(e) => {
            let error = AstParseError::new(e.to_string());
            AstParseResult::failure(vec![error])
        }
    }
}

fn create_empty_root(text: &str) -> AstNode {
    let range = AstRange::new(
        AstPosition::new(1, 1, 0),
        AstPosition::new(1, 1, text.len()),
    );
    AstNode::new(
        AstNodeType::Null,
        "$".to_string(),
        "null".to_string(),
        range,
    )
}

/// Convert yaml-rust2 Yaml to AstNode
fn yaml_to_ast(text: &str, yaml: &Yaml, path: &str, start_line: usize) -> AstNode {
    // Since yaml-rust2 doesn't provide position info after parsing,
    // we need to estimate positions based on content
    // For a more accurate solution, we'd need to use a different parser
    // or implement custom parsing

    match yaml {
        Yaml::Hash(map) => {
            let mut children = Vec::new();

            for (key, value) in map {
                let key_str = yaml_key_to_string(key);
                let child_path = format!("{}.{}", path, key_str);

                // Find the line where this key appears
                let key_line = find_key_line(text, &key_str, start_line);
                let child_ast = yaml_to_ast(text, value, &child_path, key_line);

                let prop_range =
                    AstRange::new(AstPosition::new(key_line, 1, 0), child_ast.range.end);

                let mut prop_node = AstNode::new(
                    AstNodeType::Property,
                    child_path.clone(),
                    key_str.clone(),
                    prop_range,
                );

                match child_ast.node_type {
                    AstNodeType::Object | AstNodeType::Array => {
                        prop_node = prop_node.with_children(vec![child_ast]);
                    }
                    _ => {
                        prop_node.value = child_ast.value.clone();
                        prop_node.node_type = child_ast.node_type.clone();
                    }
                }

                children.push(prop_node);
            }

            let range = calculate_range(text, &children, start_line);
            let label = format!("{{}} ({} properties)", children.len());

            AstNode::new(AstNodeType::Object, path.to_string(), label, range)
                .with_children(children)
        }

        Yaml::Array(arr) => {
            let mut children = Vec::new();
            let mut current_line = start_line;

            for (index, item) in arr.iter().enumerate() {
                let child_path = format!("{}[{}]", path, index);
                let child_ast = yaml_to_ast(text, item, &child_path, current_line);
                current_line = child_ast.range.end.line;
                children.push(child_ast);
            }

            let range = calculate_range(text, &children, start_line);
            let label = format!("[] ({} items)", children.len());

            AstNode::new(AstNodeType::Array, path.to_string(), label, range).with_children(children)
        }

        Yaml::String(s) => {
            let range = estimate_value_range(text, start_line);
            let label = if s.len() > 50 {
                format!("\"{}...\"", &s[..47])
            } else {
                format!("\"{}\"", s)
            };

            AstNode::new(AstNodeType::String, path.to_string(), label, range)
                .with_value(serde_json::Value::String(s.clone()))
        }

        Yaml::Integer(n) => {
            let range = estimate_value_range(text, start_line);
            AstNode::new(AstNodeType::Number, path.to_string(), n.to_string(), range)
                .with_value(serde_json::json!(*n))
        }

        Yaml::Real(s) => {
            let range = estimate_value_range(text, start_line);
            let value: f64 = s.parse().unwrap_or(0.0);
            AstNode::new(AstNodeType::Number, path.to_string(), s.clone(), range)
                .with_value(serde_json::json!(value))
        }

        Yaml::Boolean(b) => {
            let range = estimate_value_range(text, start_line);
            let label = if *b { "true" } else { "false" };
            AstNode::new(
                AstNodeType::Boolean,
                path.to_string(),
                label.to_string(),
                range,
            )
            .with_value(serde_json::Value::Bool(*b))
        }

        Yaml::Null => {
            let range = estimate_value_range(text, start_line);
            AstNode::new(
                AstNodeType::Null,
                path.to_string(),
                "null".to_string(),
                range,
            )
            .with_value(serde_json::Value::Null)
        }

        _ => {
            let range = estimate_value_range(text, start_line);
            AstNode::new(
                AstNodeType::Unknown,
                path.to_string(),
                "?".to_string(),
                range,
            )
        }
    }
}

fn yaml_key_to_string(yaml: &Yaml) -> String {
    match yaml {
        Yaml::String(s) => s.clone(),
        Yaml::Integer(n) => n.to_string(),
        Yaml::Real(s) => s.clone(),
        Yaml::Boolean(b) => b.to_string(),
        _ => "?".to_string(),
    }
}

fn find_key_line(text: &str, key: &str, start_line: usize) -> usize {
    let lines: Vec<&str> = text.lines().collect();
    let key_patterns = [
        format!("{}:", key),
        format!("\"{}\":", key),
        format!("'{}':", key),
    ];

    for (i, line) in lines.iter().enumerate().skip(start_line.saturating_sub(1)) {
        let trimmed = line.trim();
        for pattern in &key_patterns {
            if trimmed.starts_with(pattern) {
                return i + 1; // 1-indexed
            }
        }
    }

    start_line.max(1)
}

fn estimate_value_range(text: &str, line: usize) -> AstRange {
    let lines: Vec<&str> = text.lines().collect();
    let line_idx = (line.saturating_sub(1)).min(lines.len().saturating_sub(1));

    let line_start_offset: usize = lines[..line_idx]
        .iter()
        .map(|l| l.len() + 1) // +1 for newline
        .sum();

    let line_content = lines.get(line_idx).map(|s| *s).unwrap_or("");
    let line_end_offset = line_start_offset + line_content.len();

    AstRange::new(
        AstPosition::new(line, 1, line_start_offset),
        AstPosition::new(line, line_content.len() + 1, line_end_offset),
    )
}

fn calculate_range(text: &str, children: &[AstNode], start_line: usize) -> AstRange {
    if children.is_empty() {
        return estimate_value_range(text, start_line);
    }

    let start = AstPosition::new(start_line, 1, 0);
    let end = children.last().map(|c| c.range.end).unwrap_or(start);

    AstRange::new(start, end)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_simple_yaml() {
        let yaml = "name: John\nage: 30";
        let result = parse(yaml);

        assert!(result.ast.is_some());
        let ast = result.ast.unwrap();
        assert_eq!(ast.node_type, AstNodeType::Object);
        assert!(ast.children.is_some());
        assert_eq!(ast.children.as_ref().unwrap().len(), 2);
    }

    #[test]
    fn test_parse_nested_yaml() {
        let yaml = "user:\n  name: John\n  age: 30";
        let result = parse(yaml);

        assert!(result.ast.is_some());
        let ast = result.ast.unwrap();
        let children = ast.children.unwrap();
        assert_eq!(children[0].path, "$.user");
    }

    #[test]
    fn test_parse_array() {
        let yaml = "- item1\n- item2\n- item3";
        let result = parse(yaml);

        assert!(result.ast.is_some());
        let ast = result.ast.unwrap();
        assert_eq!(ast.node_type, AstNodeType::Array);
        assert_eq!(ast.children.as_ref().unwrap().len(), 3);
    }

    #[test]
    fn test_parse_error() {
        let yaml = "key: [\nunbalanced";
        let result = parse(yaml);

        assert!(result.ast.is_none() || !result.errors.is_empty());
    }
}

//! XML AST parser with position tracking using roxmltree

use super::{AstNode, AstNodeType, AstParseError, AstParseResult, AstPosition, AstRange};
use roxmltree::{Document, Node};

/// Parse XML text to AST with position information
pub fn parse(text: &str) -> AstParseResult {
    match Document::parse(text) {
        Ok(doc) => {
            let root = doc.root_element();
            let ast = node_to_ast(root, "$");
            AstParseResult::success(ast)
        }
        Err(e) => {
            let error = create_parse_error(&e);
            AstParseResult::failure(vec![error])
        }
    }
}

fn create_parse_error(error: &roxmltree::Error) -> AstParseError {
    let pos = error.pos();
    let range = AstRange::new(
        AstPosition::new(pos.row as usize, pos.col as usize, 0),
        AstPosition::new(pos.row as usize, pos.col as usize, 0),
    );
    AstParseError::new(error.to_string()).with_range(range)
}

fn node_range(node: &Node<'_, '_>) -> AstRange {
    let pos = node.document().text_pos_at(node.range().start);
    let end_pos = node.document().text_pos_at(node.range().end);
    AstRange::new(
        AstPosition::new(pos.row as usize, pos.col as usize, node.range().start),
        AstPosition::new(end_pos.row as usize, end_pos.col as usize, node.range().end),
    )
}

fn process_text_child(child: &Node<'_, '_>, element_path: &str) -> Option<AstNode> {
    let text_content = child.text().unwrap_or("").trim();
    if text_content.is_empty() {
        return None;
    }

    let text_pos = child.document().text_pos_at(child.range().start);
    let text_end_pos = child.document().text_pos_at(child.range().end);
    let text_range = AstRange::new(
        AstPosition::new(
            text_pos.row as usize,
            text_pos.col as usize,
            child.range().start,
        ),
        AstPosition::new(
            text_end_pos.row as usize,
            text_end_pos.col as usize,
            child.range().end,
        ),
    );

    let text_label = if text_content.len() > 50 {
        format!("\"{}...\"", &text_content[..47])
    } else {
        format!("\"{text_content}\"")
    };

    Some(
        AstNode::new(
            AstNodeType::Text,
            format!("{element_path}/#text"),
            text_label,
            text_range,
        )
        .with_value(serde_json::Value::String(text_content.to_string())),
    )
}

fn process_comment_child(child: &Node<'_, '_>, element_path: &str) -> AstNode {
    let comment_text = child.text().unwrap_or("");
    let comment_pos = child.document().text_pos_at(child.range().start);
    let comment_end_pos = child.document().text_pos_at(child.range().end);
    let comment_range = AstRange::new(
        AstPosition::new(
            comment_pos.row as usize,
            comment_pos.col as usize,
            child.range().start,
        ),
        AstPosition::new(
            comment_end_pos.row as usize,
            comment_end_pos.col as usize,
            child.range().end,
        ),
    );

    let comment_label = if comment_text.len() > 50 {
        format!("<!-- {}... -->", &comment_text[..47])
    } else {
        format!("<!-- {comment_text} -->")
    };

    AstNode::new(
        AstNodeType::Comment,
        format!("{element_path}/#comment"),
        comment_label,
        comment_range,
    )
}

fn process_attributes(node: &Node<'_, '_>, element_path: &str, range: AstRange) -> Vec<AstNode> {
    node.attributes()
        .map(|attr| {
            let attr_path = format!("{element_path}[@{}]", attr.name());
            let attr_range = AstRange::new(range.start, range.start);

            AstNode::new(
                AstNodeType::Attribute,
                attr_path,
                format!("@{}", attr.name()),
                attr_range,
            )
            .with_value(serde_json::Value::String(attr.value().to_string()))
        })
        .collect()
}

fn build_element_label(tag_name: &str, attr_count: usize, element_child_count: usize) -> String {
    if attr_count > 0 {
        format!("<{tag_name}> ({attr_count} attrs, {element_child_count} children)")
    } else if element_child_count > 0 {
        format!("<{tag_name}> ({element_child_count} children)")
    } else {
        format!("<{tag_name}>")
    }
}

fn node_to_ast(node: Node<'_, '_>, path: &str) -> AstNode {
    let range = node_range(&node);

    match node.node_type() {
        roxmltree::NodeType::Element => element_to_ast(node, path, range),
        roxmltree::NodeType::Text => text_node_to_ast(node, path, range),
        _ => AstNode::new(
            AstNodeType::Unknown,
            path.to_string(),
            "?".to_string(),
            range,
        ),
    }
}

fn element_to_ast(node: Node<'_, '_>, path: &str, range: AstRange) -> AstNode {
    let tag_name = node.tag_name().name();
    let element_path = if path == "$" {
        format!("$.{tag_name}")
    } else {
        format!("{path}.{tag_name}")
    };

    let mut children = process_attributes(&node, &element_path, range);

    // Count child elements for path indexing
    let mut element_counts: std::collections::HashMap<&str, usize> =
        std::collections::HashMap::new();

    // Add child elements
    for child in node.children() {
        match child.node_type() {
            roxmltree::NodeType::Element => {
                let child_name = child.tag_name().name();
                let count = element_counts.entry(child_name).or_insert(0);
                let child_path = if *count > 0 || has_multiple_children_with_name(&node, child_name)
                {
                    format!("{element_path}.{child_name}[{count}]")
                } else {
                    format!("{element_path}.{child_name}")
                };
                *count += 1;

                let child_ast = node_to_ast(child, &element_path);
                children.push(AstNode {
                    path: child_path,
                    ..child_ast
                });
            }
            roxmltree::NodeType::Text => {
                if let Some(text_node) = process_text_child(&child, &element_path) {
                    children.push(text_node);
                }
            }
            roxmltree::NodeType::Comment => {
                children.push(process_comment_child(&child, &element_path));
            }
            _ => {}
        }
    }

    let attr_count = node.attributes().count();
    let element_child_count = children
        .iter()
        .filter(|c| c.node_type == AstNodeType::Element)
        .count();
    let label = build_element_label(tag_name, attr_count, element_child_count);

    AstNode::new(AstNodeType::Element, element_path, label, range).with_children(children)
}

fn text_node_to_ast(node: Node<'_, '_>, path: &str, range: AstRange) -> AstNode {
    let text_content = node.text().unwrap_or("").trim();
    let label = if text_content.len() > 50 {
        format!("\"{}...\"", &text_content[..47])
    } else {
        format!("\"{text_content}\"")
    };

    AstNode::new(AstNodeType::Text, path.to_string(), label, range)
        .with_value(serde_json::Value::String(text_content.to_string()))
}

fn has_multiple_children_with_name(node: &Node<'_, '_>, name: &str) -> bool {
    node.children()
        .filter(|c| c.is_element() && c.tag_name().name() == name)
        .count()
        > 1
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_simple_xml() {
        let xml = "<root><child>text</child></root>";
        let result = parse(xml);

        assert!(result.ast.is_some());
        let ast = result.ast.unwrap();
        assert_eq!(ast.node_type, AstNodeType::Element);
        assert!(ast.children.is_some());
    }

    #[test]
    fn test_parse_with_attributes() {
        let xml = r#"<root attr="value"><child /></root>"#;
        let result = parse(xml);

        assert!(result.ast.is_some());
        let ast = result.ast.unwrap();
        let children = ast.children.unwrap();

        // First child should be the attribute
        assert!(children
            .iter()
            .any(|c| c.node_type == AstNodeType::Attribute));
    }

    #[test]
    fn test_position_tracking() {
        let xml = "<root>\n  <child>text</child>\n</root>";
        let result = parse(xml);

        assert!(result.ast.is_some());
        let ast = result.ast.unwrap();
        assert_eq!(ast.range.start.line, 1);
        assert_eq!(ast.range.start.column, 1);
    }

    #[test]
    fn test_parse_error() {
        let xml = "<root><unclosed>";
        let result = parse(xml);

        assert!(result.ast.is_none());
        assert!(!result.errors.is_empty());
    }
}

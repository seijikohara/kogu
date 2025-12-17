//! AST (Abstract Syntax Tree) parsing module
//!
//! Provides unified AST parsing for multiple languages with position information
//! for tree view synchronization with Monaco Editor.

mod json;
mod sql;
mod xml;
mod yaml;

use serde::{Deserialize, Serialize};
use thiserror::Error;

/// Supported languages for AST parsing
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum AstLanguage {
    Json,
    Yaml,
    Xml,
    Sql,
}

impl std::str::FromStr for AstLanguage {
    type Err = AstError;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s.to_lowercase().as_str() {
            "json" => Ok(Self::Json),
            "yaml" => Ok(Self::Yaml),
            "xml" => Ok(Self::Xml),
            "sql" => Ok(Self::Sql),
            _ => Err(AstError::UnsupportedLanguage(s.to_string())),
        }
    }
}

/// AST node type
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum AstNodeType {
    // Common
    Root,
    Object,
    Array,
    Property,
    String,
    Number,
    Boolean,
    Null,
    // XML specific
    Element,
    Attribute,
    Text,
    Comment,
    // SQL specific
    Statement,
    Clause,
    Expression,
    Identifier,
    Literal,
    Operator,
    Keyword,
    Function,
    // Fallback
    Unknown,
}

/// Position in the source text (1-indexed)
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub struct AstPosition {
    /// Line number (1-indexed)
    pub line: usize,
    /// Column number (1-indexed)
    pub column: usize,
    /// Character offset from start of text (0-indexed)
    pub offset: usize,
}

impl AstPosition {
    pub const fn new(line: usize, column: usize, offset: usize) -> Self {
        Self {
            line,
            column,
            offset,
        }
    }
}

/// Range in the source text
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub struct AstRange {
    pub start: AstPosition,
    pub end: AstPosition,
}

impl AstRange {
    pub const fn new(start: AstPosition, end: AstPosition) -> Self {
        Self { start, end }
    }

    pub fn from_offset(text: &str, start_offset: usize, end_offset: usize) -> Self {
        Self {
            start: offset_to_position(text, start_offset),
            end: offset_to_position(text, end_offset),
        }
    }
}

/// Unified AST node structure
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct AstNode {
    /// Node type
    #[serde(rename = "type")]
    pub node_type: AstNodeType,
    /// JSONPath-like path (e.g., "$", "$.name", "$.items[0]")
    pub path: String,
    /// Display label for tree view
    pub label: String,
    /// Node value (for leaf nodes)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub value: Option<serde_json::Value>,
    /// Position range in source
    pub range: AstRange,
    /// Child nodes
    #[serde(skip_serializing_if = "Option::is_none")]
    pub children: Option<Vec<Self>>,
}

impl AstNode {
    pub const fn new(node_type: AstNodeType, path: String, label: String, range: AstRange) -> Self {
        Self {
            node_type,
            path,
            label,
            value: None,
            range,
            children: None,
        }
    }

    pub fn with_value(mut self, value: serde_json::Value) -> Self {
        self.value = Some(value);
        self
    }

    pub fn with_children(mut self, children: Vec<Self>) -> Self {
        if !children.is_empty() {
            self.children = Some(children);
        }
        self
    }
}

/// Result of AST parsing
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AstParseResult {
    /// Root AST node (null if parsing failed)
    pub ast: Option<AstNode>,
    /// Parse errors
    pub errors: Vec<AstParseError>,
}

impl AstParseResult {
    pub const fn success(ast: AstNode) -> Self {
        Self {
            ast: Some(ast),
            errors: vec![],
        }
    }

    pub const fn failure(errors: Vec<AstParseError>) -> Self {
        Self { ast: None, errors }
    }
}

/// AST parse error
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AstParseError {
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub range: Option<AstRange>,
}

impl AstParseError {
    pub fn new(message: impl Into<String>) -> Self {
        Self {
            message: message.into(),
            range: None,
        }
    }

    pub const fn with_range(mut self, range: AstRange) -> Self {
        self.range = Some(range);
        self
    }
}

/// AST parsing errors
#[derive(Debug, Error)]
pub enum AstError {
    #[error("Unsupported language: {0}")]
    UnsupportedLanguage(String),
}

impl Serialize for AstError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::ser::Serializer,
    {
        serializer.serialize_str(self.to_string().as_ref())
    }
}

/// Convert offset to position (line, column)
pub fn offset_to_position(text: &str, offset: usize) -> AstPosition {
    let offset = offset.min(text.len());
    let prefix = &text[..offset];
    let line = prefix.matches('\n').count() + 1;
    let last_newline = prefix.rfind('\n').map_or(0, |i| i + 1);
    let column = offset - last_newline + 1;

    AstPosition::new(line, column, offset)
}

/// Parse text to AST based on language
pub fn parse_to_ast(text: &str, language: AstLanguage) -> AstParseResult {
    match language {
        AstLanguage::Json => json::parse(text),
        AstLanguage::Yaml => yaml::parse(text),
        AstLanguage::Xml => xml::parse(text),
        AstLanguage::Sql => sql::parse(text),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // ========================================================================
    // Test Fixtures
    // ========================================================================

    const MULTILINE_TEXT: &str = "line1\nline2\nline3";

    fn create_test_range() -> AstRange {
        AstRange::new(AstPosition::new(1, 1, 0), AstPosition::new(1, 10, 9))
    }

    fn create_test_node(node_type: AstNodeType, path: &str) -> AstNode {
        AstNode::new(
            node_type,
            path.to_string(),
            "test".to_string(),
            create_test_range(),
        )
    }

    // Test-only helper functions (equivalent to removed public functions)
    const fn default_range() -> AstRange {
        AstRange::new(AstPosition::new(1, 1, 0), AstPosition::new(1, 1, 0))
    }

    fn truncate_label(s: &str, max_len: usize) -> String {
        if s.len() > max_len {
            format!("{}...", &s[..max_len.saturating_sub(3)])
        } else {
            s.to_string()
        }
    }

    fn format_string_label(s: &str) -> String {
        if s.len() > 50 {
            format!("\"{}...\"", &s[..47])
        } else {
            format!("\"{s}\"")
        }
    }

    fn format_object_label(count: usize) -> String {
        format!("{{}} ({count} properties)")
    }

    fn format_array_label(count: usize) -> String {
        format!("[] ({count} items)")
    }

    // ========================================================================
    // AstPosition Tests
    // ========================================================================

    mod ast_position {
        use super::*;

        #[test]
        fn test_new_creates_position_with_correct_values() {
            // Arrange & Act
            let pos = AstPosition::new(5, 10, 100);

            // Assert
            assert_eq!(pos.line, 5);
            assert_eq!(pos.column, 10);
            assert_eq!(pos.offset, 100);
        }
    }

    // ========================================================================
    // AstRange Tests
    // ========================================================================

    mod ast_range {
        use super::*;

        #[test]
        fn test_new_creates_range_with_correct_positions() {
            // Arrange
            let start = AstPosition::new(1, 1, 0);
            let end = AstPosition::new(1, 10, 9);

            // Act
            let range = AstRange::new(start, end);

            // Assert
            assert_eq!(range.start.line, 1);
            assert_eq!(range.end.column, 10);
        }

        #[test]
        fn test_from_offset_calculates_positions_correctly() {
            // Arrange
            let text = "hello\nworld";

            // Act
            let range = AstRange::from_offset(text, 0, 5);

            // Assert
            assert_eq!(range.start.line, 1);
            assert_eq!(range.start.column, 1);
            assert_eq!(range.end.line, 1);
            assert_eq!(range.end.column, 6);
        }

        #[test]
        fn test_from_offset_spans_multiple_lines() {
            // Arrange
            let text = "hello\nworld";

            // Act
            let range = AstRange::from_offset(text, 0, 11);

            // Assert
            assert_eq!(range.start.line, 1);
            assert_eq!(range.end.line, 2);
        }
    }

    // ========================================================================
    // AstNode Tests
    // ========================================================================

    mod ast_node {
        use super::*;

        #[test]
        fn test_new_creates_node_without_value_or_children() {
            // Arrange & Act
            let node = create_test_node(AstNodeType::Object, "$");

            // Assert
            assert_eq!(node.node_type, AstNodeType::Object);
            assert_eq!(node.path, "$");
            assert!(node.value.is_none());
            assert!(node.children.is_none());
        }

        #[test]
        fn test_with_value_adds_value_to_node() {
            // Arrange
            let node = create_test_node(AstNodeType::String, "$.name");

            // Act
            let node = node.with_value(serde_json::Value::String("John".to_string()));

            // Assert
            assert!(node.value.is_some());
            assert_eq!(
                node.value.unwrap(),
                serde_json::Value::String("John".to_string())
            );
        }

        #[test]
        fn test_with_children_adds_children_to_node() {
            // Arrange
            let parent = create_test_node(AstNodeType::Object, "$");
            let child = create_test_node(AstNodeType::String, "$.name");

            // Act
            let parent = parent.with_children(vec![child]);

            // Assert
            assert!(parent.children.is_some());
            assert_eq!(parent.children.as_ref().unwrap().len(), 1);
        }

        #[test]
        fn test_with_children_empty_vec_sets_none() {
            // Arrange
            let node = create_test_node(AstNodeType::Object, "$");

            // Act
            let node = node.with_children(vec![]);

            // Assert
            assert!(node.children.is_none());
        }
    }

    // ========================================================================
    // AstParseResult Tests
    // ========================================================================

    mod ast_parse_result {
        use super::*;

        #[test]
        fn test_success_creates_result_with_ast() {
            // Arrange
            let node = create_test_node(AstNodeType::Object, "$");

            // Act
            let result = AstParseResult::success(node);

            // Assert
            assert!(result.ast.is_some());
            assert!(result.errors.is_empty());
        }

        #[test]
        fn test_failure_creates_result_with_errors() {
            // Arrange
            let errors = vec![AstParseError::new("Test error")];

            // Act
            let result = AstParseResult::failure(errors);

            // Assert
            assert!(result.ast.is_none());
            assert_eq!(result.errors.len(), 1);
        }
    }

    // ========================================================================
    // AstParseError Tests
    // ========================================================================

    mod ast_parse_error {
        use super::*;

        #[test]
        fn test_new_creates_error_with_message() {
            // Act
            let error = AstParseError::new("Parse failed");

            // Assert
            assert_eq!(error.message, "Parse failed");
            assert!(error.range.is_none());
        }

        #[test]
        fn test_with_range_adds_range_to_error() {
            // Arrange
            let error = AstParseError::new("Parse failed");
            let range = create_test_range();

            // Act
            let error = error.with_range(range);

            // Assert
            assert!(error.range.is_some());
        }
    }

    // ========================================================================
    // AstLanguage Tests
    // ========================================================================

    mod ast_language {
        use super::*;

        #[test]
        fn test_from_str_json_lowercase() {
            assert_eq!("json".parse::<AstLanguage>().unwrap(), AstLanguage::Json);
        }

        #[test]
        fn test_from_str_yaml_uppercase() {
            assert_eq!("YAML".parse::<AstLanguage>().unwrap(), AstLanguage::Yaml);
        }

        #[test]
        fn test_from_str_xml_mixed_case() {
            assert_eq!("Xml".parse::<AstLanguage>().unwrap(), AstLanguage::Xml);
        }

        #[test]
        fn test_from_str_sql() {
            assert_eq!("sql".parse::<AstLanguage>().unwrap(), AstLanguage::Sql);
        }

        #[test]
        fn test_from_str_unknown_returns_error() {
            let result = "unknown".parse::<AstLanguage>();

            assert!(result.is_err());
            assert!(result
                .unwrap_err()
                .to_string()
                .contains("Unsupported language"));
        }
    }

    // ========================================================================
    // Helper Function Tests
    // ========================================================================

    mod helper_functions {
        use super::*;

        #[test]
        fn test_offset_to_position_start_of_text() {
            // Act
            let pos = offset_to_position(MULTILINE_TEXT, 0);

            // Assert
            assert_eq!(pos.line, 1);
            assert_eq!(pos.column, 1);
            assert_eq!(pos.offset, 0);
        }

        #[test]
        fn test_offset_to_position_middle_of_first_line() {
            // Act
            let pos = offset_to_position(MULTILINE_TEXT, 3);

            // Assert
            assert_eq!(pos.line, 1);
            assert_eq!(pos.column, 4);
        }

        #[test]
        fn test_offset_to_position_start_of_second_line() {
            // Act
            let pos = offset_to_position(MULTILINE_TEXT, 6);

            // Assert
            assert_eq!(pos.line, 2);
            assert_eq!(pos.column, 1);
        }

        #[test]
        fn test_offset_to_position_beyond_text_clamps() {
            // Act
            let pos = offset_to_position(MULTILINE_TEXT, 1000);

            // Assert - should clamp to end of text
            assert!(pos.offset <= MULTILINE_TEXT.len());
        }

        #[test]
        fn test_default_range_returns_origin_position() {
            // Act
            let range = default_range();

            // Assert
            assert_eq!(range.start.line, 1);
            assert_eq!(range.start.column, 1);
            assert_eq!(range.start.offset, 0);
        }

        #[test]
        fn test_truncate_label_short_string_unchanged() {
            // Act
            let result = truncate_label("short", 10);

            // Assert
            assert_eq!(result, "short");
        }

        #[test]
        fn test_truncate_label_long_string_truncated() {
            // Act
            let result = truncate_label("this is a very long string", 10);

            // Assert
            assert!(result.len() <= 10);
            assert!(result.ends_with("..."));
        }

        #[test]
        fn test_format_string_label_short_string() {
            // Act
            let result = format_string_label("hello");

            // Assert
            assert_eq!(result, "\"hello\"");
        }

        #[test]
        fn test_format_string_label_long_string_truncated() {
            // Arrange
            let long_string = "a".repeat(100);

            // Act
            let result = format_string_label(&long_string);

            // Assert
            assert!(result.len() < 100);
            assert!(result.ends_with("...\""));
        }

        #[test]
        fn test_format_object_label() {
            // Act
            let result = format_object_label(5);

            // Assert
            assert_eq!(result, "{} (5 properties)");
        }

        #[test]
        fn test_format_array_label() {
            // Act
            let result = format_array_label(3);

            // Assert
            assert_eq!(result, "[] (3 items)");
        }
    }

    // ========================================================================
    // parse_to_ast Integration Tests
    // ========================================================================

    mod parse_to_ast {
        use super::*;

        #[test]
        fn test_parse_json_language() {
            // Arrange
            let text = r#"{"key": "value"}"#;

            // Act
            let result = super::super::parse_to_ast(text, AstLanguage::Json);

            // Assert
            assert!(result.ast.is_some());
        }

        #[test]
        fn test_parse_yaml_language() {
            // Arrange
            let text = "key: value";

            // Act
            let result = super::super::parse_to_ast(text, AstLanguage::Yaml);

            // Assert
            assert!(result.ast.is_some());
        }

        #[test]
        fn test_parse_xml_language() {
            // Arrange
            let text = "<root>text</root>";

            // Act
            let result = super::super::parse_to_ast(text, AstLanguage::Xml);

            // Assert
            assert!(result.ast.is_some());
        }

        #[test]
        fn test_parse_sql_language() {
            // Arrange
            let text = "SELECT * FROM users";

            // Act
            let result = super::super::parse_to_ast(text, AstLanguage::Sql);

            // Assert
            assert!(result.ast.is_some());
        }
    }
}

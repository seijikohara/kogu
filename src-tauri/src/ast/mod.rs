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
    pub fn new(line: usize, column: usize, offset: usize) -> Self {
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
    pub fn new(start: AstPosition, end: AstPosition) -> Self {
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
    pub children: Option<Vec<AstNode>>,
}

impl AstNode {
    pub fn new(node_type: AstNodeType, path: String, label: String, range: AstRange) -> Self {
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

    pub fn with_children(mut self, children: Vec<AstNode>) -> Self {
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
    pub fn success(ast: AstNode) -> Self {
        Self {
            ast: Some(ast),
            errors: vec![],
        }
    }

    pub fn failure(errors: Vec<AstParseError>) -> Self {
        Self { ast: None, errors }
    }

    pub fn with_errors(mut self, errors: Vec<AstParseError>) -> Self {
        self.errors = errors;
        self
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

    pub fn with_range(mut self, range: AstRange) -> Self {
        self.range = Some(range);
        self
    }
}

/// AST parsing errors
#[derive(Debug, Error)]
pub enum AstError {
    #[error("Unsupported language: {0}")]
    UnsupportedLanguage(String),
    #[error("Parse error: {0}")]
    ParseError(String),
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
    let last_newline = prefix.rfind('\n').map(|i| i + 1).unwrap_or(0);
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

    #[test]
    fn test_offset_to_position() {
        let text = "line1\nline2\nline3";

        // Start of text
        let pos = offset_to_position(text, 0);
        assert_eq!(pos.line, 1);
        assert_eq!(pos.column, 1);

        // Middle of first line
        let pos = offset_to_position(text, 3);
        assert_eq!(pos.line, 1);
        assert_eq!(pos.column, 4);

        // Start of second line
        let pos = offset_to_position(text, 6);
        assert_eq!(pos.line, 2);
        assert_eq!(pos.column, 1);

        // Middle of second line
        let pos = offset_to_position(text, 8);
        assert_eq!(pos.line, 2);
        assert_eq!(pos.column, 3);
    }

    #[test]
    fn test_language_from_str() {
        assert_eq!("json".parse::<AstLanguage>().unwrap(), AstLanguage::Json);
        assert_eq!("YAML".parse::<AstLanguage>().unwrap(), AstLanguage::Yaml);
        assert_eq!("XML".parse::<AstLanguage>().unwrap(), AstLanguage::Xml);
        assert_eq!("sql".parse::<AstLanguage>().unwrap(), AstLanguage::Sql);
        assert!("unknown".parse::<AstLanguage>().is_err());
    }
}

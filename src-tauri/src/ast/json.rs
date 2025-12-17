//! JSON AST parser with position tracking

use super::{offset_to_position, AstNode, AstNodeType, AstParseError, AstParseResult, AstRange};

/// Parse JSON text to AST with position information
pub fn parse(text: &str) -> AstParseResult {
    let mut parser = JsonParser::new(text);
    match parser.parse_value("$") {
        Ok(ast) => AstParseResult::success(ast),
        Err(e) => AstParseResult::failure(vec![e]),
    }
}

struct JsonParser<'a> {
    text: &'a str,
    chars: Vec<char>,
    pos: usize,
}

impl<'a> JsonParser<'a> {
    fn new(text: &'a str) -> Self {
        Self {
            text,
            chars: text.chars().collect(),
            pos: 0,
        }
    }

    fn current(&self) -> Option<char> {
        self.chars.get(self.pos).copied()
    }

    fn advance(&mut self) {
        if self.pos < self.chars.len() {
            self.pos += 1;
        }
    }

    fn skip_whitespace(&mut self) {
        while let Some(c) = self.current() {
            if c.is_whitespace() {
                self.advance();
            } else {
                break;
            }
        }
    }

    fn byte_offset(&self) -> usize {
        self.chars[..self.pos].iter().map(|c| c.len_utf8()).sum()
    }

    fn error(&self, msg: &str) -> AstParseError {
        let offset = self.byte_offset();
        let pos = offset_to_position(self.text, offset);
        AstParseError::new(msg).with_range(AstRange::new(pos, pos))
    }

    fn parse_value(&mut self, path: &str) -> Result<AstNode, AstParseError> {
        self.skip_whitespace();
        let start_offset = self.byte_offset();

        match self.current() {
            Some('{') => self.parse_object(path, start_offset),
            Some('[') => self.parse_array(path, start_offset),
            Some('"') => self.parse_string(path, start_offset),
            Some('t') | Some('f') => self.parse_boolean(path, start_offset),
            Some('n') => self.parse_null(path, start_offset),
            Some(c) if c == '-' || c.is_ascii_digit() => self.parse_number(path, start_offset),
            Some(c) => Err(self.error(&format!("Unexpected character: '{}'", c))),
            None => Err(self.error("Unexpected end of input")),
        }
    }

    fn parse_object(&mut self, path: &str, start_offset: usize) -> Result<AstNode, AstParseError> {
        self.advance(); // consume '{'
        self.skip_whitespace();

        let mut children = Vec::new();

        if self.current() != Some('}') {
            loop {
                self.skip_whitespace();

                // Parse key
                if self.current() != Some('"') {
                    return Err(self.error("Expected string key"));
                }

                let key_start = self.byte_offset();
                let key = self.parse_string_value()?;
                let _key_end = self.byte_offset();

                self.skip_whitespace();

                // Expect colon
                if self.current() != Some(':') {
                    return Err(self.error("Expected ':'"));
                }
                self.advance();

                // Parse value
                let child_path = format!("{}.{}", path, key);
                let value_node = self.parse_value(&child_path)?;

                // Create property node
                let prop_range = AstRange::new(
                    offset_to_position(self.text, key_start),
                    value_node.range.end,
                );

                let mut prop_node = AstNode::new(
                    AstNodeType::Property,
                    child_path.clone(),
                    key.clone(),
                    prop_range,
                );

                // For leaf values, store directly; for objects/arrays, add as child
                match value_node.node_type {
                    AstNodeType::Object | AstNodeType::Array => {
                        prop_node = prop_node.with_children(vec![value_node]);
                    }
                    _ => {
                        prop_node.value = value_node.value.clone();
                        prop_node.node_type = value_node.node_type.clone();
                    }
                }

                children.push(prop_node);

                self.skip_whitespace();

                match self.current() {
                    Some(',') => {
                        self.advance();
                        continue;
                    }
                    Some('}') => break,
                    _ => return Err(self.error("Expected ',' or '}'")),
                }
            }
        }

        self.advance(); // consume '}'
        let end_offset = self.byte_offset();

        let range = AstRange::from_offset(self.text, start_offset, end_offset);
        let label = format!("{{}} ({} properties)", children.len());

        Ok(
            AstNode::new(AstNodeType::Object, path.to_string(), label, range)
                .with_children(children),
        )
    }

    fn parse_array(&mut self, path: &str, start_offset: usize) -> Result<AstNode, AstParseError> {
        self.advance(); // consume '['
        self.skip_whitespace();

        let mut children = Vec::new();
        let mut index = 0;

        if self.current() != Some(']') {
            loop {
                let child_path = format!("{}[{}]", path, index);
                let item = self.parse_value(&child_path)?;
                children.push(item);
                index += 1;

                self.skip_whitespace();

                match self.current() {
                    Some(',') => {
                        self.advance();
                        continue;
                    }
                    Some(']') => break,
                    _ => return Err(self.error("Expected ',' or ']'")),
                }
            }
        }

        self.advance(); // consume ']'
        let end_offset = self.byte_offset();

        let range = AstRange::from_offset(self.text, start_offset, end_offset);
        let label = format!("[] ({} items)", children.len());

        Ok(
            AstNode::new(AstNodeType::Array, path.to_string(), label, range)
                .with_children(children),
        )
    }

    fn parse_string(&mut self, path: &str, start_offset: usize) -> Result<AstNode, AstParseError> {
        let value = self.parse_string_value()?;
        let end_offset = self.byte_offset();

        let range = AstRange::from_offset(self.text, start_offset, end_offset);
        let label = if value.len() > 50 {
            format!("\"{}...\"", &value[..47])
        } else {
            format!("\"{}\"", value)
        };

        Ok(
            AstNode::new(AstNodeType::String, path.to_string(), label, range)
                .with_value(serde_json::Value::String(value)),
        )
    }

    fn parse_string_value(&mut self) -> Result<String, AstParseError> {
        if self.current() != Some('"') {
            return Err(self.error("Expected '\"'"));
        }
        self.advance(); // consume opening quote

        let mut result = String::new();

        loop {
            match self.current() {
                Some('"') => {
                    self.advance();
                    return Ok(result);
                }
                Some('\\') => {
                    self.advance();
                    match self.current() {
                        Some('"') => result.push('"'),
                        Some('\\') => result.push('\\'),
                        Some('/') => result.push('/'),
                        Some('b') => result.push('\x08'),
                        Some('f') => result.push('\x0c'),
                        Some('n') => result.push('\n'),
                        Some('r') => result.push('\r'),
                        Some('t') => result.push('\t'),
                        Some('u') => {
                            self.advance();
                            let mut hex = String::new();
                            for _ in 0..4 {
                                if let Some(c) = self.current() {
                                    hex.push(c);
                                    self.advance();
                                }
                            }
                            if let Ok(code) = u32::from_str_radix(&hex, 16) {
                                if let Some(c) = char::from_u32(code) {
                                    result.push(c);
                                }
                            }
                            continue;
                        }
                        _ => return Err(self.error("Invalid escape sequence")),
                    }
                    self.advance();
                }
                Some(c) => {
                    result.push(c);
                    self.advance();
                }
                None => return Err(self.error("Unterminated string")),
            }
        }
    }

    fn parse_number(&mut self, path: &str, start_offset: usize) -> Result<AstNode, AstParseError> {
        let mut num_str = String::new();

        // Optional negative sign
        if self.current() == Some('-') {
            num_str.push('-');
            self.advance();
        }

        // Integer part
        match self.current() {
            Some('0') => {
                num_str.push('0');
                self.advance();
            }
            Some(c) if c.is_ascii_digit() => {
                while let Some(c) = self.current() {
                    if c.is_ascii_digit() {
                        num_str.push(c);
                        self.advance();
                    } else {
                        break;
                    }
                }
            }
            _ => return Err(self.error("Invalid number")),
        }

        // Fractional part
        if self.current() == Some('.') {
            num_str.push('.');
            self.advance();
            while let Some(c) = self.current() {
                if c.is_ascii_digit() {
                    num_str.push(c);
                    self.advance();
                } else {
                    break;
                }
            }
        }

        // Exponent part
        if let Some('e') | Some('E') = self.current() {
            num_str.push(self.current().unwrap());
            self.advance();
            if let Some('+') | Some('-') = self.current() {
                num_str.push(self.current().unwrap());
                self.advance();
            }
            while let Some(c) = self.current() {
                if c.is_ascii_digit() {
                    num_str.push(c);
                    self.advance();
                } else {
                    break;
                }
            }
        }

        let end_offset = self.byte_offset();
        let range = AstRange::from_offset(self.text, start_offset, end_offset);

        let value: serde_json::Number = num_str
            .parse()
            .map_err(|_| self.error("Invalid number format"))?;

        Ok(AstNode::new(
            AstNodeType::Number,
            path.to_string(),
            num_str.clone(),
            range,
        )
        .with_value(serde_json::Value::Number(value)))
    }

    fn parse_boolean(&mut self, path: &str, start_offset: usize) -> Result<AstNode, AstParseError> {
        let is_true = self.current() == Some('t');

        let expected = if is_true { "true" } else { "false" };
        for expected_char in expected.chars() {
            if self.current() != Some(expected_char) {
                return Err(self.error(&format!("Expected '{}'", expected)));
            }
            self.advance();
        }

        let end_offset = self.byte_offset();
        let range = AstRange::from_offset(self.text, start_offset, end_offset);

        Ok(AstNode::new(
            AstNodeType::Boolean,
            path.to_string(),
            expected.to_string(),
            range,
        )
        .with_value(serde_json::Value::Bool(is_true)))
    }

    fn parse_null(&mut self, path: &str, start_offset: usize) -> Result<AstNode, AstParseError> {
        for expected_char in "null".chars() {
            if self.current() != Some(expected_char) {
                return Err(self.error("Expected 'null'"));
            }
            self.advance();
        }

        let end_offset = self.byte_offset();
        let range = AstRange::from_offset(self.text, start_offset, end_offset);

        Ok(AstNode::new(
            AstNodeType::Null,
            path.to_string(),
            "null".to_string(),
            range,
        )
        .with_value(serde_json::Value::Null))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_simple_object() {
        let json = r#"{"name": "John", "age": 30}"#;
        let result = parse(json);

        assert!(result.ast.is_some());
        let ast = result.ast.unwrap();
        assert_eq!(ast.node_type, AstNodeType::Object);
        assert_eq!(ast.path, "$");
        assert!(ast.children.is_some());
        assert_eq!(ast.children.as_ref().unwrap().len(), 2);
    }

    #[test]
    fn test_parse_nested_object() {
        let json = r#"{"user": {"name": "John"}}"#;
        let result = parse(json);

        assert!(result.ast.is_some());
        let ast = result.ast.unwrap();
        let children = ast.children.unwrap();
        assert_eq!(children[0].path, "$.user");
    }

    #[test]
    fn test_parse_array() {
        let json = r#"[1, 2, 3]"#;
        let result = parse(json);

        assert!(result.ast.is_some());
        let ast = result.ast.unwrap();
        assert_eq!(ast.node_type, AstNodeType::Array);
        assert_eq!(ast.children.as_ref().unwrap().len(), 3);
        assert_eq!(ast.children.as_ref().unwrap()[0].path, "$[0]");
    }

    #[test]
    fn test_position_tracking() {
        let json = "{\n  \"name\": \"John\"\n}";
        let result = parse(json);

        assert!(result.ast.is_some());
        let ast = result.ast.unwrap();

        // Root object starts at line 1, column 1
        assert_eq!(ast.range.start.line, 1);
        assert_eq!(ast.range.start.column, 1);

        // "name" property starts at line 2
        let children = ast.children.unwrap();
        assert_eq!(children[0].range.start.line, 2);
    }

    #[test]
    fn test_parse_error() {
        let json = r#"{"name": }"#;
        let result = parse(json);

        assert!(result.ast.is_none());
        assert!(!result.errors.is_empty());
    }
}

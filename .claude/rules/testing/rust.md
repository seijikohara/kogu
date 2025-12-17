---
paths: 'src-tauri/**/*.rs'
---

# Rust Testing Guidelines

## Test Structure

### Unit Tests Location

Place unit tests in the same file as the code being tested:

```rust
// src-tauri/src/ast/json.rs

pub fn parse(text: &str) -> AstParseResult {
    // implementation
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_simple_object() {
        // test implementation
    }
}
```

### Integration Tests Location

Place integration tests in the `tests/` directory:

```
src-tauri/
├── src/
│   └── lib.rs
└── tests/
    ├── common/
    │   └── mod.rs      # Shared test utilities
    └── integration.rs  # Integration tests
```

## Writing Tests

### Basic Test Pattern

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_function_name_does_expected_behavior() {
        // Arrange
        let input = "test input";

        // Act
        let result = function_under_test(input);

        // Assert
        assert_eq!(result, expected_value);
    }
}
```

### AAA Pattern (Arrange-Act-Assert)

```rust
#[test]
fn test_parse_valid_json() {
    // Arrange
    let json = r#"{"name": "John", "age": 30}"#;

    // Act
    let result = parse(json);

    // Assert
    assert!(result.ast.is_some());
    let ast = result.ast.unwrap();
    assert_eq!(ast.node_type, AstNodeType::Object);
}
```

## Assertion Macros

### Basic Assertions

| Macro                     | Usage                               |
| ------------------------- | ----------------------------------- |
| `assert!(expr)`           | Assert expression is true           |
| `assert_eq!(left, right)` | Assert equality                     |
| `assert_ne!(left, right)` | Assert inequality                   |
| `debug_assert!(...)`      | Debug-only assertion (compiled out) |

### Custom Error Messages

```rust
#[test]
fn test_with_custom_message() {
    let result = calculate(5);
    assert_eq!(
        result, 10,
        "Expected calculate(5) to return 10, got {}",
        result
    );
}
```

### Testing Result Types

```rust
#[test]
fn test_returns_error_for_invalid_input() {
    let result = parse("invalid");

    assert!(result.is_err());
    // Or use is_err_and for more specific checks
    assert!(result.is_err_and(|e| e.to_string().contains("parse")));
}

#[test]
fn test_returns_ok_for_valid_input() {
    let result = parse("{}");

    assert!(result.is_ok());
    let value = result.unwrap();
    assert_eq!(value.node_type, AstNodeType::Object);
}
```

### Testing Option Types

```rust
#[test]
fn test_returns_some() {
    let result = find_item(items, "key");

    assert!(result.is_some());
    assert_eq!(result.unwrap().name, "key");
}

#[test]
fn test_returns_none() {
    let result = find_item(items, "nonexistent");

    assert!(result.is_none());
}
```

## Testing Panics

### Using `#[should_panic]`

```rust
#[test]
#[should_panic]
fn test_panics_on_empty_input() {
    process_required_input("");
}

#[test]
#[should_panic(expected = "index out of bounds")]
fn test_panics_with_specific_message() {
    let vec = vec![1, 2, 3];
    let _ = vec[10];
}
```

### Prefer Result Over Panic Testing

```rust
// Preferred: Return Result instead of panic
fn process(input: &str) -> Result<Output, Error> {
    if input.is_empty() {
        return Err(Error::EmptyInput);
    }
    // ...
}

#[test]
fn test_error_on_empty_input() {
    let result = process("");
    assert!(result.is_err());
}
```

## Test with Result Return

```rust
#[test]
fn test_with_result() -> Result<(), Box<dyn std::error::Error>> {
    let content = std::fs::read_to_string("test.json")?;
    let result = parse(&content)?;
    assert_eq!(result.node_type, AstNodeType::Object);
    Ok(())
}
```

## Test Attributes

### Common Attributes

| Attribute         | Purpose                      |
| ----------------- | ---------------------------- |
| `#[test]`         | Mark function as test        |
| `#[ignore]`       | Skip test by default         |
| `#[should_panic]` | Test expects panic           |
| `#[cfg(test)]`    | Compile only for test builds |

### Ignored Tests

```rust
#[test]
#[ignore = "requires network connection"]
fn test_external_api() {
    // Run with: cargo test -- --ignored
    // Or: cargo test -- --include-ignored
}
```

## Test Organization

### Test Naming Convention

```rust
#[cfg(test)]
mod tests {
    use super::*;

    // Pattern: test_<function>_<scenario>_<expected>
    #[test]
    fn test_parse_valid_json_returns_ast() {}

    #[test]
    fn test_parse_invalid_json_returns_error() {}

    #[test]
    fn test_parse_empty_input_returns_empty_root() {}

    #[test]
    fn test_parse_nested_object_tracks_path() {}
}
```

### Grouping Related Tests

```rust
#[cfg(test)]
mod tests {
    use super::*;

    mod parse_object {
        use super::*;

        #[test]
        fn simple_object() {}

        #[test]
        fn nested_object() {}

        #[test]
        fn empty_object() {}
    }

    mod parse_array {
        use super::*;

        #[test]
        fn simple_array() {}

        #[test]
        fn nested_array() {}
    }

    mod error_handling {
        use super::*;

        #[test]
        fn invalid_syntax() {}

        #[test]
        fn unexpected_eof() {}
    }
}
```

## Test Helpers

### Helper Functions

```rust
#[cfg(test)]
mod tests {
    use super::*;

    fn create_test_node(node_type: AstNodeType, path: &str) -> AstNode {
        AstNode::new(
            node_type,
            path.to_string(),
            "test".to_string(),
            default_range(),
        )
    }

    #[test]
    fn test_with_helper() {
        let node = create_test_node(AstNodeType::Object, "$");
        assert_eq!(node.path, "$");
    }
}
```

### Test Fixtures

```rust
#[cfg(test)]
mod tests {
    use super::*;

    const SIMPLE_JSON: &str = r#"{"name": "John"}"#;
    const NESTED_JSON: &str = r#"{"user": {"name": "John", "age": 30}}"#;
    const ARRAY_JSON: &str = r#"[1, 2, 3]"#;

    #[test]
    fn test_simple_json() {
        let result = parse(SIMPLE_JSON);
        assert!(result.ast.is_some());
    }
}
```

## Documentation Tests

### Writing Doc Tests

````rust
/// Parses JSON text and returns an AST with position information.
///
/// # Examples
///
/// ```
/// use kogu::ast::json;
///
/// let result = json::parse(r#"{"key": "value"}"#);
/// assert!(result.ast.is_some());
/// ```
///
/// # Errors
///
/// Returns error for invalid JSON:
///
/// ```
/// use kogu::ast::json;
///
/// let result = json::parse("{invalid}");
/// assert!(!result.errors.is_empty());
/// ```
pub fn parse(text: &str) -> AstParseResult {
    // implementation
}
````

### Doc Test Attributes

````rust
/// Example that compiles but doesn't run:
/// ```no_run
/// expensive_operation();
/// ```
///
/// Example that should fail to compile:
/// ```compile_fail
/// let x: i32 = "string";
/// ```
///
/// Example that is ignored:
/// ```ignore
/// platform_specific_code();
/// ```
````

### Hiding Lines in Doc Tests

````rust
/// Calculate the sum of two numbers.
///
/// ```
/// # fn main() -> Result<(), Box<dyn std::error::Error>> {
/// let result = calculate(2, 3);
/// assert_eq!(result, 5);
/// # Ok(())
/// # }
/// ```
pub fn calculate(a: i32, b: i32) -> i32 {
    a + b
}
````

## Running Tests

### Common Commands

```bash
# Run all tests
cargo test

# Run unit tests only
cargo test --lib

# Run integration tests only
cargo test --test '*'

# Run doc tests only
cargo test --doc

# Run specific test
cargo test test_parse_simple_object

# Run tests matching pattern
cargo test parse

# Run ignored tests
cargo test -- --ignored

# Run all tests including ignored
cargo test -- --include-ignored

# Show output from passing tests
cargo test -- --nocapture

# Run tests single-threaded
cargo test -- --test-threads=1
```

### Test Filtering

```bash
# Run tests in specific module
cargo test ast::json::tests

# Run tests matching multiple patterns
cargo test parse -- --skip error
```

## Best Practices

### Do's

- Write tests as you develop (TDD when appropriate)
- Keep tests small and focused on one behavior
- Use descriptive test names that explain the scenario
- Test edge cases and error conditions
- Use `assert_eq!` over `assert!` when comparing values (better error messages)
- Derive `Debug` and `PartialEq` on types used in tests
- Keep test data close to test code

### Don'ts

- Don't test implementation details
- Don't use `.unwrap()` without first asserting the value is present
- Don't rely on test execution order
- Don't share mutable state between tests
- Don't make tests dependent on external systems (network, filesystem)
- Don't use `#[should_panic]` when `Result` error checking is possible

### Test Independence

```rust
// Good: Each test is self-contained
#[test]
fn test_one() {
    let data = create_test_data();
    // use data
}

#[test]
fn test_two() {
    let data = create_test_data();
    // use data independently
}

// Avoid: Tests sharing mutable state
static mut COUNTER: i32 = 0;  // Don't do this
```

### Prefer Assertions Over Panics

```rust
// Good: Test verifies error is returned
#[test]
fn test_invalid_input() {
    let result = process("invalid");
    assert!(result.is_err());
    assert!(result.unwrap_err().to_string().contains("invalid"));
}

// Avoid: Testing panic behavior when Result is possible
#[test]
#[should_panic]
fn test_invalid_input() {
    process("invalid").unwrap();  // Less informative
}
```

## Coverage

### Running with Coverage

```bash
# Install cargo-tarpaulin
cargo install cargo-tarpaulin

# Run with coverage
cargo tarpaulin --out Html

# Exclude test modules from coverage
cargo tarpaulin --ignore-tests
```

### Coverage Goals

- Aim for high coverage on core business logic
- Don't chase 100% coverage at the expense of meaningful tests
- Focus on testing critical paths and edge cases

## References

- [The Rust Programming Language - Test Organization](https://doc.rust-lang.org/book/ch11-03-test-organization.html)
- [Rust By Example - Unit Testing](https://doc.rust-lang.org/rust-by-example/testing/unit_testing.html)
- [Cargo Test Documentation](https://doc.rust-lang.org/cargo/commands/cargo-test.html)
- [Documentation Testing](https://doc.rust-lang.org/rust-by-example/testing/doc_testing.html)
- [rstest - Fixture-based Test Framework](https://docs.rs/rstest/latest/rstest/)

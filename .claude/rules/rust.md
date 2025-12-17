---
paths: src-tauri/**/*.rs
---

# Rust Guidelines

> **IMPORTANT**: Do not bypass compiler or linter warnings using `#[allow(...)]`, `#[expect(...)]`, or similar attributes. Fix the root cause instead.

## Linter Enforcement

The following rules are enforced by Clippy and should not be documented here to avoid duplication:

- Use `.copied()` instead of `.map(|x| *x)`
- Use `.cloned()` instead of `.map(|x| x.clone())`
- Prefix unused parameters with underscore
- Use `if let` instead of single-arm match
- Use `matches!` macro for boolean match

Run `cargo clippy -- -W clippy::all` to check compliance. See Clippy documentation for all rules.

## Fundamental Principles

### Reference Compliance

- Always follow the latest Rust official documentation and Rust API Guidelines
- Use Rust 2021 edition idioms
- Avoid deprecated patterns and unsafe code unless absolutely necessary

### Core Rules

| Rule              | Requirement                                                  |
| ----------------- | ------------------------------------------------------------ |
| Pure functions    | No side effects, deterministic output where possible         |
| Immutability      | Avoid `mut` unless necessary, prefer transformation          |
| Early returns     | Use `?` operator, guard clauses, never deep nesting          |
| Iterator chaining | Prefer `.iter().filter().map().collect()` over loops         |
| Expression style  | Use `let x = if/match` instead of mutable assignment         |
| Error propagation | Use `Result<T, E>` with `?`, avoid `.unwrap()` in production |

## Pure Functional Style

Prioritize pure functions and expression-oriented programming:

```rust
// Preferred: Pure function with expression body
pub fn calculate_total(items: &[Item]) -> f64 {
    items.iter().map(|item| item.price * item.quantity as f64).sum()
}

// Preferred: Expression-oriented with match
pub fn format_status(status: Status) -> &'static str {
    match status {
        Status::Active => "active",
        Status::Inactive => "inactive",
        Status::Pending => "pending",
    }
}

// Preferred: Transformation over mutation
pub fn process_names(names: &[String]) -> Vec<String> {
    names
        .iter()
        .filter(|name| !name.is_empty())
        .map(|name| name.to_uppercase())
        .collect()
}
```

### Immutability

```rust
// Preferred: Immutable bindings by default
let config = Config::new();
let items = vec![1, 2, 3];

// Preferred: Transform into new value instead of mutation
let updated_items: Vec<_> = items.iter().map(|x| x * 2).collect();

// Preferred: Use iterator chains for building collections
let filtered: Vec<_> = items
    .into_iter()
    .filter(|x| *x > 1)
    .collect();
```

### Expression-Oriented Programming

```rust
// Preferred: let with if expression
let status = if is_valid { "valid" } else { "invalid" };

// Preferred: let with match expression
let value = match result {
    Ok(v) => v,
    Err(_) => default_value,
};

// Preferred: Block expressions for complex initialization
let config = {
    let mut builder = ConfigBuilder::new();
    builder.set_timeout(30);
    builder.set_retries(3);
    builder.build()
};
```

## Early Returns

Always use early returns with `?` operator and guard clauses:

```rust
// Preferred: Early returns with ? operator
pub fn parse_and_process(input: &str) -> Result<Output, Error> {
    if input.is_empty() {
        return Err(Error::EmptyInput);
    }
    if input.len() > MAX_LENGTH {
        return Err(Error::TooLong);
    }

    let parsed = parse(input)?;
    let validated = validate(parsed)?;
    Ok(transform(validated))
}

// Preferred: Guard clauses with Option
pub fn find_user(id: u64, users: &[User]) -> Option<&User> {
    if id == 0 {
        return None;
    }
    users.iter().find(|u| u.id == id)
}
```

### The `?` Operator

```rust
// Preferred: Chain with ? operator
pub fn read_config(path: &str) -> Result<Config, Error> {
    let content = std::fs::read_to_string(path)?;
    let config: Config = serde_json::from_str(&content)?;
    Ok(config)
}

// Preferred: Transform errors with map_err
pub fn parse_file(path: &str) -> Result<Data, AppError> {
    let content = std::fs::read_to_string(path)
        .map_err(|e| AppError::FileRead(e.to_string()))?;

    serde_json::from_str(&content)
        .map_err(|e| AppError::Parse(e.to_string()))
}
```

## Iterator Chaining

Prefer iterator chains over explicit loops:

```rust
// Preferred: Iterator chain for transformation
let result: Vec<_> = items
    .iter()
    .filter(|item| item.active)
    .map(|item| item.value * 2)
    .collect();

// Preferred: fold/reduce for aggregation
let total: i32 = items
    .iter()
    .filter(|item| item.active)
    .map(|item| item.value)
    .sum();

// Preferred: find for single item lookup
let found = items.iter().find(|item| item.id == target_id);

// Preferred: any/all for boolean checks
let has_active = items.iter().any(|item| item.active);
let all_valid = items.iter().all(|item| item.valid);

// Preferred: flat_map for nested iteration
let all_tags: Vec<_> = items
    .iter()
    .flat_map(|item| item.tags.iter())
    .collect();
```

### Common Iterator Patterns

```rust
// Enumerate with index
items.iter().enumerate().for_each(|(i, item)| {
    println!("{}: {}", i, item);
});

// Zip two iterators
let pairs: Vec<_> = keys.iter().zip(values.iter()).collect();

// Take/Skip for slicing
let first_five: Vec<_> = items.iter().take(5).collect();
let after_first: Vec<_> = items.iter().skip(1).collect();

// Partition into two groups
let (active, inactive): (Vec<_>, Vec<_>) = items
    .into_iter()
    .partition(|item| item.active);

// Group by with fold
use std::collections::HashMap;
let grouped: HashMap<String, Vec<Item>> = items
    .into_iter()
    .fold(HashMap::new(), |mut acc, item| {
        acc.entry(item.category.clone()).or_default().push(item);
        acc
    });
```

## Option and Result Combinators

Use combinators instead of match for simple transformations:

```rust
// Preferred: map for transformation
let length = input.map(|s| s.len());

// Preferred: and_then for chained operations
let result = parse(input)
    .and_then(|parsed| validate(parsed))
    .and_then(|valid| transform(valid));

// Preferred: unwrap_or / unwrap_or_else for defaults
let value = option.unwrap_or(default);
let value = option.unwrap_or_else(|| compute_default());

// Preferred: ok_or for Option to Result conversion
let value = option.ok_or(Error::NotFound)?;

// Preferred: filter for conditional Some
let positive = number.filter(|n| *n > 0);

// Preferred: or / or_else for fallback
let result = primary.or(fallback);
let result = primary.or_else(|| compute_fallback());
```

### Chaining Option/Result

```rust
// Preferred: Chain combinators
pub fn get_user_email(id: u64) -> Option<String> {
    find_user(id)
        .filter(|u| u.active)
        .map(|u| u.email.clone())
}

// Preferred: ? with map_err chain
pub fn process_request(req: Request) -> Result<Response, Error> {
    let user = authenticate(&req).map_err(Error::Auth)?;
    let data = fetch_data(&user).map_err(Error::Data)?;
    let response = format_response(data).map_err(Error::Format)?;
    Ok(response)
}
```

## Error Handling

### Custom Error Types with thiserror

```rust
use thiserror::Error;

#[derive(Debug, Error)]
pub enum AppError {
    #[error("File not found: {0}")]
    FileNotFound(String),

    #[error("Parse error at line {line}: {message}")]
    ParseError { line: usize, message: String },

    #[error("Validation failed: {0}")]
    ValidationError(String),

    #[error(transparent)]
    Io(#[from] std::io::Error),

    #[error(transparent)]
    Json(#[from] serde_json::Error),
}
```

### Serializable Errors for Tauri

```rust
#[derive(Debug, Error)]
pub enum CommandError {
    #[error("{0}")]
    Message(String),
}

impl serde::Serialize for CommandError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::ser::Serializer,
    {
        serializer.serialize_str(self.to_string().as_ref())
    }
}
```

### Error Handling Patterns

```rust
// Preferred: Propagate with ?
pub fn process(path: &str) -> Result<Data, AppError> {
    let content = std::fs::read_to_string(path)?;
    let data: Data = serde_json::from_str(&content)?;
    Ok(data)
}

// Preferred: Context with map_err
pub fn load_config(path: &str) -> Result<Config, AppError> {
    std::fs::read_to_string(path)
        .map_err(|_| AppError::FileNotFound(path.to_string()))
        .and_then(|content| {
            serde_json::from_str(&content)
                .map_err(|e| AppError::ParseError {
                    line: 0,
                    message: e.to_string(),
                })
        })
}
```

## Ownership and Borrowing

### Prefer Borrowing Over Ownership

```rust
// Preferred: Borrow when not consuming
pub fn calculate_sum(items: &[i32]) -> i32 {
    items.iter().sum()
}

// Preferred: Take ownership only when needed
pub fn into_uppercase(s: String) -> String {
    s.to_uppercase()
}

// Preferred: Use &str for string parameters
pub fn process_text(text: &str) -> String {
    text.trim().to_uppercase()
}
```

### Lifetime Elision

```rust
// Preferred: Let compiler elide lifetimes when possible
pub fn first_word(s: &str) -> &str {
    s.split_whitespace().next().unwrap_or("")
}

// Only annotate when necessary
pub fn longest<'a>(x: &'a str, y: &'a str) -> &'a str {
    if x.len() > y.len() { x } else { y }
}
```

## Struct and Enum Patterns

### Builder Pattern

```rust
#[derive(Default)]
pub struct ConfigBuilder {
    timeout: Option<u64>,
    retries: Option<u32>,
}

impl ConfigBuilder {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn timeout(mut self, timeout: u64) -> Self {
        self.timeout = Some(timeout);
        self
    }

    pub fn retries(mut self, retries: u32) -> Self {
        self.retries = Some(retries);
        self
    }

    pub fn build(self) -> Config {
        Config {
            timeout: self.timeout.unwrap_or(30),
            retries: self.retries.unwrap_or(3),
        }
    }
}

// Usage: Method chaining
let config = ConfigBuilder::new()
    .timeout(60)
    .retries(5)
    .build();
```

### Derive Macros

```rust
// Use derive for common traits
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Item {
    pub id: String,
    pub name: String,
    pub value: i32,
}

// Default for optional initialization
#[derive(Default)]
pub struct Options {
    pub verbose: bool,
    pub timeout: u64,
}
```

## String Handling

### String vs &str

```rust
// Preferred: &str for parameters
pub fn process(text: &str) -> String {
    text.to_uppercase()
}

// Preferred: String for owned return values
pub fn build_message(name: &str, count: u32) -> String {
    format!("Hello, {}! You have {} items.", name, count)
}

// Preferred: Cow for flexible ownership
use std::borrow::Cow;

pub fn normalize(input: &str) -> Cow<'_, str> {
    if input.contains(' ') {
        Cow::Owned(input.replace(' ', "_"))
    } else {
        Cow::Borrowed(input)
    }
}
```

### Format Strings

```rust
// Preferred: format! macro for string building
let message = format!("User {} has {} items", user.name, user.items.len());

// Preferred: Named arguments for clarity
let log = format!(
    "[{level}] {timestamp}: {message}",
    level = "INFO",
    timestamp = now(),
    message = msg
);

// Preferred: concat! for compile-time concatenation
const PREFIX: &str = concat!("v", env!("CARGO_PKG_VERSION"));
```

## Naming Conventions

| Type          | Convention     | Example                             |
| ------------- | -------------- | ----------------------------------- |
| Modules       | snake_case     | `json_parser`, `ast_node`           |
| Functions     | snake_case     | `parse_json`, `calculate_total`     |
| Variables     | snake_case     | `user_count`, `is_valid`            |
| Types/Structs | PascalCase     | `UserData`, `JsonParser`            |
| Traits        | PascalCase     | `Serialize`, `Display`              |
| Constants     | SCREAMING_CASE | `MAX_SIZE`, `DEFAULT_TIMEOUT`       |
| Enum Variants | PascalCase     | `Status::Active`, `Error::NotFound` |

## Documentation

### When to Document

- Public API items (functions, structs, traits)
- Complex algorithms
- Non-obvious behavior
- Safety considerations for unsafe code

### Documentation Style

````rust
/// Parses JSON text and returns an AST with position information.
///
/// # Arguments
///
/// * `text` - The JSON string to parse
///
/// # Returns
///
/// Returns `AstParseResult` containing either the parsed AST or errors.
///
/// # Examples
///
/// ```
/// let result = parse_json(r#"{"key": "value"}"#);
/// assert!(result.ast.is_some());
/// ```
pub fn parse_json(text: &str) -> AstParseResult {
    // implementation
}
````

## Module Organization

```rust
// lib.rs or main.rs
mod ast;
mod commands;
mod error;

pub use ast::{AstNode, AstParseResult};
pub use error::AppError;

// In submodules, re-export public items
// ast/mod.rs
mod json;
mod xml;
mod yaml;

pub use json::parse as parse_json;
pub use xml::parse as parse_xml;
```

## Performance Considerations

```rust
// Preferred: Avoid allocation in hot paths
pub fn is_valid(items: &[Item]) -> bool {
    items.iter().all(|item| item.value > 0)
}

// Preferred: Use iterators instead of collecting intermediate results
let result = items
    .iter()
    .filter(|i| i.active)
    .map(|i| i.value)
    .sum::<i32>();

// Preferred: Reserve capacity for known sizes
let mut result = Vec::with_capacity(items.len());

// Preferred: Use &[T] instead of &Vec<T> in function parameters
pub fn process(items: &[Item]) -> i32 { /* ... */ }
```

## Best Practices Summary

- Avoid `.unwrap()` and `.expect()` in library code
- Use `?` operator for error propagation
- Prefer iterator chains over explicit loops
- Use expression-oriented style (`let x = if/match`)
- Prefer borrowing over ownership transfer
- Use `&str` for string parameters, `String` for owned returns
- Derive common traits (Debug, Clone, PartialEq) on public types
- Document public API with `///` comments
- Keep functions small and focused
- Never use `unsafe` without careful documentation

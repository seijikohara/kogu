//! SQL AST parser with position tracking using sqlparser-rs

use super::{AstNode, AstNodeType, AstParseError, AstParseResult, AstPosition, AstRange};
use sqlparser::ast::{
    Expr, GroupByExpr, Query, Select, SelectItem, SetExpr, Spanned, Statement, TableFactor,
    TableWithJoins,
};
use sqlparser::dialect::GenericDialect;
use sqlparser::parser::Parser;
use sqlparser::tokenizer::Span;

/// Parse SQL text to AST with position information
pub fn parse(text: &str) -> AstParseResult {
    let dialect = GenericDialect {};

    match Parser::parse_sql(&dialect, text) {
        Ok(statements) => {
            if statements.is_empty() {
                return AstParseResult::success(create_empty_root(text));
            }

            let mut children = Vec::new();
            for (i, stmt) in statements.iter().enumerate() {
                let stmt_path = format!("$[{}]", i);
                let stmt_ast = statement_to_ast(text, stmt, &stmt_path);
                children.push(stmt_ast);
            }

            if children.len() == 1 {
                // Single statement - return directly
                let mut ast = children.remove(0);
                ast.path = "$".to_string();
                AstParseResult::success(ast)
            } else {
                // Multiple statements
                let range = AstRange::new(
                    AstPosition::new(1, 1, 0),
                    AstPosition::new(1, 1, text.len()),
                );
                let label = format!("SQL ({} statements)", children.len());
                let root = AstNode::new(AstNodeType::Root, "$".to_string(), label, range)
                    .with_children(children);
                AstParseResult::success(root)
            }
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
        AstNodeType::Statement,
        "$".to_string(),
        "Empty".to_string(),
        range,
    )
}

fn span_to_range(text: &str, span: Span) -> AstRange {
    AstRange::new(
        AstPosition::new(
            span.start.line as usize,
            span.start.column as usize,
            0, // Offset is not directly available from Span
        ),
        AstPosition::new(span.end.line as usize, span.end.column as usize, 0),
    )
}

fn default_range() -> AstRange {
    AstRange::new(AstPosition::new(1, 1, 0), AstPosition::new(1, 1, 0))
}

fn statement_to_ast(text: &str, stmt: &Statement, path: &str) -> AstNode {
    let span = stmt.span();
    let range = span_to_range(text, span);

    match stmt {
        Statement::Query(query) => query_to_ast(text, query, path),

        Statement::Insert(insert) => {
            let mut children = Vec::new();

            // Table name
            let table_name = insert.table.to_string();
            children.push(AstNode::new(
                AstNodeType::Identifier,
                format!("{}.table", path),
                table_name,
                default_range(),
            ));

            // Columns
            if !insert.columns.is_empty() {
                let cols: Vec<String> = insert.columns.iter().map(|c| c.to_string()).collect();
                let cols_node = AstNode::new(
                    AstNodeType::Clause,
                    format!("{}.columns", path),
                    format!("COLUMNS ({})", cols.len()),
                    default_range(),
                )
                .with_children(
                    cols.iter()
                        .enumerate()
                        .map(|(i, col)| {
                            AstNode::new(
                                AstNodeType::Identifier,
                                format!("{}.columns[{}]", path, i),
                                col.clone(),
                                default_range(),
                            )
                        })
                        .collect(),
                );
                children.push(cols_node);
            }

            // Source (VALUES or SELECT)
            if let Some(source) = &insert.source {
                let source_ast = query_to_ast(text, source, &format!("{}.source", path));
                children.push(source_ast);
            }

            AstNode::new(
                AstNodeType::Statement,
                path.to_string(),
                "INSERT".to_string(),
                range,
            )
            .with_children(children)
        }

        Statement::Update {
            table,
            assignments,
            selection,
            ..
        } => {
            let mut children = Vec::new();

            // Table
            let table_name = table.relation.to_string();
            children.push(AstNode::new(
                AstNodeType::Identifier,
                format!("{}.table", path),
                table_name,
                default_range(),
            ));

            // SET clause
            if !assignments.is_empty() {
                let set_children: Vec<AstNode> = assignments
                    .iter()
                    .enumerate()
                    .map(|(i, assign)| {
                        let target_str = assign.target.to_string();
                        AstNode::new(
                            AstNodeType::Expression,
                            format!("{}.set[{}]", path, i),
                            format!("{} = ...", target_str),
                            default_range(),
                        )
                    })
                    .collect();

                children.push(
                    AstNode::new(
                        AstNodeType::Clause,
                        format!("{}.set", path),
                        format!("SET ({} assignments)", set_children.len()),
                        default_range(),
                    )
                    .with_children(set_children),
                );
            }

            // WHERE clause
            if let Some(where_expr) = selection {
                children.push(expr_to_ast(
                    text,
                    where_expr,
                    &format!("{}.where", path),
                    "WHERE",
                ));
            }

            AstNode::new(
                AstNodeType::Statement,
                path.to_string(),
                "UPDATE".to_string(),
                range,
            )
            .with_children(children)
        }

        Statement::Delete(delete) => {
            let mut children = Vec::new();

            // FROM clause - FromTable is an enum in sqlparser v0.53
            let from_label = match &delete.from {
                sqlparser::ast::FromTable::WithFromKeyword(tables) => tables
                    .iter()
                    .map(|t| t.relation.to_string())
                    .collect::<Vec<_>>()
                    .join(", "),
                sqlparser::ast::FromTable::WithoutKeyword(tables) => tables
                    .iter()
                    .map(|t| t.relation.to_string())
                    .collect::<Vec<_>>()
                    .join(", "),
            };
            let from_ast = AstNode::new(
                AstNodeType::Clause,
                format!("{}.from", path),
                format!("FROM {}", from_label),
                default_range(),
            );
            children.push(from_ast);

            // WHERE clause
            if let Some(where_expr) = &delete.selection {
                children.push(expr_to_ast(
                    text,
                    where_expr,
                    &format!("{}.where", path),
                    "WHERE",
                ));
            }

            AstNode::new(
                AstNodeType::Statement,
                path.to_string(),
                "DELETE".to_string(),
                range,
            )
            .with_children(children)
        }

        Statement::CreateTable(create) => {
            let mut children = Vec::new();

            // Table name
            children.push(AstNode::new(
                AstNodeType::Identifier,
                format!("{}.table", path),
                create.name.to_string(),
                default_range(),
            ));

            // Columns
            let col_children: Vec<AstNode> = create
                .columns
                .iter()
                .enumerate()
                .map(|(i, col)| {
                    AstNode::new(
                        AstNodeType::Identifier,
                        format!("{}.columns[{}]", path, i),
                        format!("{} {}", col.name, col.data_type),
                        default_range(),
                    )
                })
                .collect();

            if !col_children.is_empty() {
                children.push(
                    AstNode::new(
                        AstNodeType::Clause,
                        format!("{}.columns", path),
                        format!("COLUMNS ({})", col_children.len()),
                        default_range(),
                    )
                    .with_children(col_children),
                );
            }

            AstNode::new(
                AstNodeType::Statement,
                path.to_string(),
                "CREATE TABLE".to_string(),
                range,
            )
            .with_children(children)
        }

        Statement::Drop {
            names, object_type, ..
        } => {
            let label = format!("DROP {:?}", object_type);
            let children: Vec<AstNode> = names
                .iter()
                .enumerate()
                .map(|(i, name)| {
                    AstNode::new(
                        AstNodeType::Identifier,
                        format!("{}.names[{}]", path, i),
                        name.to_string(),
                        default_range(),
                    )
                })
                .collect();

            AstNode::new(AstNodeType::Statement, path.to_string(), label, range)
                .with_children(children)
        }

        _ => {
            // Generic fallback for other statement types
            let label = format!("{:?}", std::mem::discriminant(stmt));
            AstNode::new(AstNodeType::Statement, path.to_string(), label, range)
        }
    }
}

fn query_to_ast(text: &str, query: &Query, path: &str) -> AstNode {
    let span = query.span();
    let range = span_to_range(text, span);

    let mut children = Vec::new();

    // WITH clause (CTEs)
    if let Some(with) = &query.with {
        let cte_children: Vec<AstNode> = with
            .cte_tables
            .iter()
            .enumerate()
            .map(|(i, cte)| {
                AstNode::new(
                    AstNodeType::Clause,
                    format!("{}.with[{}]", path, i),
                    format!("CTE: {}", cte.alias.name),
                    default_range(),
                )
            })
            .collect();

        if !cte_children.is_empty() {
            children.push(
                AstNode::new(
                    AstNodeType::Clause,
                    format!("{}.with", path),
                    format!("WITH ({} CTEs)", cte_children.len()),
                    default_range(),
                )
                .with_children(cte_children),
            );
        }
    }

    // Body (SELECT, UNION, etc.)
    match query.body.as_ref() {
        SetExpr::Select(select) => {
            let select_ast = select_to_ast(text, select, &format!("{}.select", path));
            children.push(select_ast);
        }
        SetExpr::SetOperation {
            op, left, right, ..
        } => {
            let op_str = format!("{:?}", op);
            let left_ast = AstNode::new(
                AstNodeType::Clause,
                format!("{}.left", path),
                "Left".to_string(),
                default_range(),
            );
            let right_ast = AstNode::new(
                AstNodeType::Clause,
                format!("{}.right", path),
                "Right".to_string(),
                default_range(),
            );
            children.push(
                AstNode::new(
                    AstNodeType::Operator,
                    format!("{}.operation", path),
                    op_str,
                    default_range(),
                )
                .with_children(vec![left_ast, right_ast]),
            );
        }
        _ => {}
    }

    // ORDER BY
    if let Some(order_by) = &query.order_by {
        if !order_by.exprs.is_empty() {
            let order_children: Vec<AstNode> = order_by
                .exprs
                .iter()
                .enumerate()
                .map(|(i, ord)| {
                    AstNode::new(
                        AstNodeType::Expression,
                        format!("{}.orderBy[{}]", path, i),
                        ord.expr.to_string(),
                        default_range(),
                    )
                })
                .collect();

            children.push(
                AstNode::new(
                    AstNodeType::Clause,
                    format!("{}.orderBy", path),
                    format!("ORDER BY ({})", order_children.len()),
                    default_range(),
                )
                .with_children(order_children),
            );
        }
    }

    // LIMIT
    if let Some(limit) = &query.limit {
        children.push(AstNode::new(
            AstNodeType::Clause,
            format!("{}.limit", path),
            format!("LIMIT {}", limit),
            default_range(),
        ));
    }

    // OFFSET
    if let Some(offset) = &query.offset {
        children.push(AstNode::new(
            AstNodeType::Clause,
            format!("{}.offset", path),
            format!("OFFSET {}", offset.value),
            default_range(),
        ));
    }

    AstNode::new(
        AstNodeType::Statement,
        path.to_string(),
        "SELECT".to_string(),
        range,
    )
    .with_children(children)
}

fn select_to_ast(text: &str, select: &Select, path: &str) -> AstNode {
    let mut children = Vec::new();

    // DISTINCT
    if select.distinct.is_some() {
        children.push(AstNode::new(
            AstNodeType::Keyword,
            format!("{}.distinct", path),
            "DISTINCT".to_string(),
            default_range(),
        ));
    }

    // Projection (columns)
    let proj_children: Vec<AstNode> = select
        .projection
        .iter()
        .enumerate()
        .map(|(i, item)| {
            let label = match item {
                SelectItem::UnnamedExpr(expr) => expr.to_string(),
                SelectItem::ExprWithAlias { expr, alias } => format!("{} AS {}", expr, alias),
                SelectItem::QualifiedWildcard(name, _) => format!("{}.*", name),
                SelectItem::Wildcard(_) => "*".to_string(),
            };
            AstNode::new(
                AstNodeType::Expression,
                format!("{}.columns[{}]", path, i),
                label,
                default_range(),
            )
        })
        .collect();

    children.push(
        AstNode::new(
            AstNodeType::Clause,
            format!("{}.columns", path),
            format!("SELECT ({})", proj_children.len()),
            default_range(),
        )
        .with_children(proj_children),
    );

    // FROM clause
    if !select.from.is_empty() {
        let from_children: Vec<AstNode> = select
            .from
            .iter()
            .enumerate()
            .map(|(i, table)| table_to_ast(text, table, &format!("{}.from[{}]", path, i)))
            .collect();

        children.push(
            AstNode::new(
                AstNodeType::Clause,
                format!("{}.from", path),
                format!("FROM ({})", from_children.len()),
                default_range(),
            )
            .with_children(from_children),
        );
    }

    // WHERE clause
    if let Some(where_expr) = &select.selection {
        children.push(expr_to_ast(
            text,
            where_expr,
            &format!("{}.where", path),
            "WHERE",
        ));
    }

    // GROUP BY clause
    let group_exprs: Vec<&Expr> = match &select.group_by {
        GroupByExpr::All(_) => vec![],
        GroupByExpr::Expressions(exprs, _) => exprs.iter().collect(),
    };

    if !group_exprs.is_empty() {
        let group_children: Vec<AstNode> = group_exprs
            .iter()
            .enumerate()
            .map(|(i, expr)| {
                AstNode::new(
                    AstNodeType::Expression,
                    format!("{}.groupBy[{}]", path, i),
                    expr.to_string(),
                    default_range(),
                )
            })
            .collect();

        children.push(
            AstNode::new(
                AstNodeType::Clause,
                format!("{}.groupBy", path),
                format!("GROUP BY ({})", group_children.len()),
                default_range(),
            )
            .with_children(group_children),
        );
    }

    // HAVING clause
    if let Some(having_expr) = &select.having {
        children.push(expr_to_ast(
            text,
            having_expr,
            &format!("{}.having", path),
            "HAVING",
        ));
    }

    AstNode::new(
        AstNodeType::Clause,
        path.to_string(),
        "SELECT clause".to_string(),
        default_range(),
    )
    .with_children(children)
}

fn table_to_ast(text: &str, table: &TableWithJoins, path: &str) -> AstNode {
    let mut children = Vec::new();

    // Main table
    let relation_label = match &table.relation {
        TableFactor::Table { name, alias, .. } => {
            if let Some(a) = alias {
                format!("{} AS {}", name, a.name)
            } else {
                name.to_string()
            }
        }
        TableFactor::Derived { alias, .. } => {
            if let Some(a) = alias {
                format!("(subquery) AS {}", a.name)
            } else {
                "(subquery)".to_string()
            }
        }
        _ => "table".to_string(),
    };

    children.push(AstNode::new(
        AstNodeType::Identifier,
        format!("{}.table", path),
        relation_label.clone(),
        default_range(),
    ));

    // JOINs
    for (i, join) in table.joins.iter().enumerate() {
        let join_type = format!("{:?}", join.join_operator);
        let join_table = match &join.relation {
            TableFactor::Table { name, .. } => name.to_string(),
            _ => "table".to_string(),
        };

        children.push(AstNode::new(
            AstNodeType::Clause,
            format!("{}.joins[{}]", path, i),
            format!("{} {}", join_type, join_table),
            default_range(),
        ));
    }

    AstNode::new(
        AstNodeType::Clause,
        path.to_string(),
        relation_label,
        default_range(),
    )
    .with_children(children)
}

fn expr_to_ast(text: &str, expr: &Expr, path: &str, label_prefix: &str) -> AstNode {
    let label = format!(
        "{}: {}",
        label_prefix,
        truncate_string(&expr.to_string(), 50)
    );

    AstNode::new(
        AstNodeType::Expression,
        path.to_string(),
        label,
        default_range(),
    )
}

fn truncate_string(s: &str, max_len: usize) -> String {
    if s.len() > max_len {
        format!("{}...", &s[..max_len - 3])
    } else {
        s.to_string()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_simple_select() {
        let sql = "SELECT id, name FROM users WHERE age > 18";
        let result = parse(sql);

        assert!(result.ast.is_some());
        let ast = result.ast.unwrap();
        assert_eq!(ast.node_type, AstNodeType::Statement);
    }

    #[test]
    fn test_parse_insert() {
        let sql = "INSERT INTO users (name, age) VALUES ('John', 30)";
        let result = parse(sql);

        assert!(result.ast.is_some());
        let ast = result.ast.unwrap();
        assert!(ast.label.contains("INSERT"));
    }

    #[test]
    fn test_parse_join() {
        let sql = "SELECT u.name, o.total FROM users u JOIN orders o ON u.id = o.user_id";
        let result = parse(sql);

        assert!(result.ast.is_some());
    }

    #[test]
    fn test_parse_error() {
        let sql = "SELECT FROM";
        let result = parse(sql);

        assert!(result.ast.is_none() || !result.errors.is_empty());
    }

    #[test]
    fn test_multiple_statements() {
        let sql = "SELECT 1; SELECT 2;";
        let result = parse(sql);

        assert!(result.ast.is_some());
        let ast = result.ast.unwrap();
        assert!(ast.children.is_some());
        assert_eq!(ast.children.as_ref().unwrap().len(), 2);
    }
}

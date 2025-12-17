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

            let children: Vec<_> = statements
                .iter()
                .enumerate()
                .map(|(i, stmt)| statement_to_ast(stmt, &format!("$[{i}]")))
                .collect();

            if children.len() == 1 {
                let mut ast = children
                    .into_iter()
                    .next()
                    .unwrap_or_else(|| create_empty_root(text));
                ast.path = "$".to_string();
                AstParseResult::success(ast)
            } else {
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
        Err(e) => AstParseResult::failure(vec![AstParseError::new(e.to_string())]),
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

fn span_to_range(span: Span) -> AstRange {
    AstRange::new(
        AstPosition::new(
            usize::try_from(span.start.line).unwrap_or(1),
            usize::try_from(span.start.column).unwrap_or(1),
            0,
        ),
        AstPosition::new(
            usize::try_from(span.end.line).unwrap_or(1),
            usize::try_from(span.end.column).unwrap_or(1),
            0,
        ),
    )
}

fn statement_to_ast(stmt: &Statement, path: &str) -> AstNode {
    let range = span_to_range(stmt.span());

    match stmt {
        Statement::Query(query) => query_to_ast(query, path),
        Statement::Insert(insert) => insert_to_ast(insert, path),
        Statement::Update {
            table,
            assignments,
            selection,
            ..
        } => update_to_ast(table, assignments, selection.as_ref(), path, range),
        Statement::Delete(delete) => delete_to_ast(delete, path),
        Statement::CreateTable(create) => create_table_to_ast(create, path),
        Statement::Drop {
            names, object_type, ..
        } => drop_to_ast(names, *object_type, path, range),
        _ => {
            let label = format!("{:?}", std::mem::discriminant(stmt));
            AstNode::new(AstNodeType::Statement, path.to_string(), label, range)
        }
    }
}

fn insert_to_ast(insert: &sqlparser::ast::Insert, path: &str) -> AstNode {
    let range = span_to_range(insert.span());
    let table_range = span_to_range(insert.table_name.span());

    let mut children = vec![AstNode::new(
        AstNodeType::Identifier,
        format!("{path}.table"),
        insert.table_name.to_string(),
        table_range,
    )];

    if !insert.columns.is_empty() {
        children.push(columns_to_ast(&insert.columns, path));
    }

    if let Some(source) = &insert.source {
        children.push(query_to_ast(source, &format!("{path}.source")));
    }

    AstNode::new(
        AstNodeType::Statement,
        path.to_string(),
        "INSERT".to_string(),
        range,
    )
    .with_children(children)
}

fn columns_to_ast(columns: &[sqlparser::ast::Ident], path: &str) -> AstNode {
    let children: Vec<_> = columns
        .iter()
        .enumerate()
        .map(|(i, col)| {
            let col_range = span_to_range(col.span);
            AstNode::new(
                AstNodeType::Identifier,
                format!("{path}.columns[{i}]"),
                col.value.clone(),
                col_range,
            )
        })
        .collect();

    // Use span of first and last column for the columns clause
    let range = if let (Some(first), Some(last)) = (columns.first(), columns.last()) {
        AstRange::new(
            span_to_range(first.span).start,
            span_to_range(last.span).end,
        )
    } else {
        AstRange::new(AstPosition::new(1, 1, 0), AstPosition::new(1, 1, 0))
    };

    AstNode::new(
        AstNodeType::Clause,
        format!("{path}.columns"),
        format!("COLUMNS ({})", columns.len()),
        range,
    )
    .with_children(children)
}

fn update_to_ast(
    table: &sqlparser::ast::TableWithJoins,
    assignments: &[sqlparser::ast::Assignment],
    selection: Option<&Expr>,
    path: &str,
    range: AstRange,
) -> AstNode {
    let table_range = span_to_range(table.span());

    let mut children = vec![AstNode::new(
        AstNodeType::Identifier,
        format!("{path}.table"),
        table.relation.to_string(),
        table_range,
    )];

    if !assignments.is_empty() {
        children.push(assignments_to_ast(assignments, path));
    }

    if let Some(where_expr) = selection {
        children.push(expr_to_ast(where_expr, &format!("{path}.where"), "WHERE"));
    }

    AstNode::new(
        AstNodeType::Statement,
        path.to_string(),
        "UPDATE".to_string(),
        range,
    )
    .with_children(children)
}

fn assignments_to_ast(assignments: &[sqlparser::ast::Assignment], path: &str) -> AstNode {
    let children: Vec<_> = assignments
        .iter()
        .enumerate()
        .map(|(i, assign)| {
            let assign_range = span_to_range(assign.span());
            AstNode::new(
                AstNodeType::Expression,
                format!("{path}.set[{i}]"),
                format!("{} = ...", assign.target),
                assign_range,
            )
        })
        .collect();

    // Use span of first and last assignment for the SET clause
    let range = if let (Some(first), Some(last)) = (assignments.first(), assignments.last()) {
        AstRange::new(
            span_to_range(first.span()).start,
            span_to_range(last.span()).end,
        )
    } else {
        AstRange::new(AstPosition::new(1, 1, 0), AstPosition::new(1, 1, 0))
    };

    AstNode::new(
        AstNodeType::Clause,
        format!("{path}.set"),
        format!("SET ({} assignments)", children.len()),
        range,
    )
    .with_children(children)
}

fn delete_to_ast(delete: &sqlparser::ast::Delete, path: &str) -> AstNode {
    let range = span_to_range(delete.span());

    let from_label = match &delete.from {
        sqlparser::ast::FromTable::WithFromKeyword(tables)
        | sqlparser::ast::FromTable::WithoutKeyword(tables) => tables
            .iter()
            .map(|t| t.relation.to_string())
            .collect::<Vec<_>>()
            .join(", "),
    };

    let from_range = span_to_range(delete.from.span());

    let mut children = vec![AstNode::new(
        AstNodeType::Clause,
        format!("{path}.from"),
        format!("FROM {from_label}"),
        from_range,
    )];

    if let Some(where_expr) = &delete.selection {
        children.push(expr_to_ast(where_expr, &format!("{path}.where"), "WHERE"));
    }

    AstNode::new(
        AstNodeType::Statement,
        path.to_string(),
        "DELETE".to_string(),
        range,
    )
    .with_children(children)
}

fn create_table_to_ast(create: &sqlparser::ast::CreateTable, path: &str) -> AstNode {
    let range = span_to_range(create.span());
    let name_range = span_to_range(create.name.span());

    let mut children = vec![AstNode::new(
        AstNodeType::Identifier,
        format!("{path}.table"),
        create.name.to_string(),
        name_range,
    )];

    let col_children: Vec<_> = create
        .columns
        .iter()
        .enumerate()
        .map(|(i, col)| {
            let col_range = span_to_range(col.span());
            AstNode::new(
                AstNodeType::Identifier,
                format!("{path}.columns[{i}]"),
                format!("{} {}", col.name, col.data_type),
                col_range,
            )
        })
        .collect();

    if !col_children.is_empty() {
        // Use span of first and last column for the columns clause
        let cols_range =
            if let (Some(first), Some(last)) = (create.columns.first(), create.columns.last()) {
                AstRange::new(
                    span_to_range(first.span()).start,
                    span_to_range(last.span()).end,
                )
            } else {
                AstRange::new(AstPosition::new(1, 1, 0), AstPosition::new(1, 1, 0))
            };

        children.push(
            AstNode::new(
                AstNodeType::Clause,
                format!("{path}.columns"),
                format!("COLUMNS ({})", col_children.len()),
                cols_range,
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

fn drop_to_ast(
    names: &[sqlparser::ast::ObjectName],
    object_type: sqlparser::ast::ObjectType,
    path: &str,
    range: AstRange,
) -> AstNode {
    let children: Vec<_> = names
        .iter()
        .enumerate()
        .map(|(i, name)| {
            let name_range = span_to_range(name.span());
            AstNode::new(
                AstNodeType::Identifier,
                format!("{path}.names[{i}]"),
                name.to_string(),
                name_range,
            )
        })
        .collect();

    AstNode::new(
        AstNodeType::Statement,
        path.to_string(),
        format!("DROP {object_type:?}"),
        range,
    )
    .with_children(children)
}

fn query_to_ast(query: &Query, path: &str) -> AstNode {
    let range = span_to_range(query.span());
    let mut children = Vec::new();

    if let Some(with) = &query.with {
        children.extend(with_clause_to_ast(with, path));
    }

    children.extend(query_body_to_ast(&query.body, path));
    children.extend(order_by_to_ast(query.order_by.as_ref(), path));

    if let Some(limit) = &query.limit {
        let limit_range = span_to_range(limit.span());
        children.push(AstNode::new(
            AstNodeType::Clause,
            format!("{path}.limit"),
            format!("LIMIT {limit}"),
            limit_range,
        ));
    }

    if let Some(offset) = &query.offset {
        let offset_range = span_to_range(offset.span());
        children.push(AstNode::new(
            AstNodeType::Clause,
            format!("{path}.offset"),
            format!("OFFSET {}", offset.value),
            offset_range,
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

fn with_clause_to_ast(with: &sqlparser::ast::With, path: &str) -> Option<AstNode> {
    let with_range = span_to_range(with.span());

    let cte_children: Vec<_> = with
        .cte_tables
        .iter()
        .enumerate()
        .map(|(i, cte)| {
            let cte_range = span_to_range(cte.span());
            AstNode::new(
                AstNodeType::Clause,
                format!("{path}.with[{i}]"),
                format!("CTE: {}", cte.alias.name),
                cte_range,
            )
        })
        .collect();

    if cte_children.is_empty() {
        None
    } else {
        Some(
            AstNode::new(
                AstNodeType::Clause,
                format!("{path}.with"),
                format!("WITH ({} CTEs)", cte_children.len()),
                with_range,
            )
            .with_children(cte_children),
        )
    }
}

fn query_body_to_ast(body: &SetExpr, path: &str) -> Option<AstNode> {
    match body {
        SetExpr::Select(select) => Some(select_to_ast(select, &format!("{path}.select"))),
        SetExpr::SetOperation { op, .. } => {
            let body_range = span_to_range(body.span());
            let left_ast = AstNode::new(
                AstNodeType::Clause,
                format!("{path}.left"),
                "Left".to_string(),
                body_range,
            );
            let right_ast = AstNode::new(
                AstNodeType::Clause,
                format!("{path}.right"),
                "Right".to_string(),
                body_range,
            );
            Some(
                AstNode::new(
                    AstNodeType::Operator,
                    format!("{path}.operation"),
                    format!("{op:?}"),
                    body_range,
                )
                .with_children(vec![left_ast, right_ast]),
            )
        }
        _ => None,
    }
}

fn order_by_to_ast(order_by: Option<&sqlparser::ast::OrderBy>, path: &str) -> Option<AstNode> {
    let order_by = order_by?;
    if order_by.exprs.is_empty() {
        return None;
    }

    let order_range = span_to_range(order_by.span());

    let children: Vec<_> = order_by
        .exprs
        .iter()
        .enumerate()
        .map(|(i, ord)| {
            let ord_range = span_to_range(ord.span());
            AstNode::new(
                AstNodeType::Expression,
                format!("{path}.orderBy[{i}]"),
                ord.expr.to_string(),
                ord_range,
            )
        })
        .collect();

    Some(
        AstNode::new(
            AstNodeType::Clause,
            format!("{path}.orderBy"),
            format!("ORDER BY ({})", children.len()),
            order_range,
        )
        .with_children(children),
    )
}

fn select_to_ast(select: &Select, path: &str) -> AstNode {
    let select_range = span_to_range(select.span());
    let mut children = Vec::new();

    if select.distinct.is_some() {
        children.push(AstNode::new(
            AstNodeType::Keyword,
            format!("{path}.distinct"),
            "DISTINCT".to_string(),
            select_range,
        ));
    }

    children.push(projection_to_ast(&select.projection, path));
    children.extend(from_clause_to_ast(&select.from, path));

    if let Some(where_expr) = &select.selection {
        children.push(expr_to_ast(where_expr, &format!("{path}.where"), "WHERE"));
    }

    children.extend(group_by_to_ast(&select.group_by, path));

    if let Some(having_expr) = &select.having {
        children.push(expr_to_ast(
            having_expr,
            &format!("{path}.having"),
            "HAVING",
        ));
    }

    AstNode::new(
        AstNodeType::Clause,
        path.to_string(),
        "SELECT clause".to_string(),
        select_range,
    )
    .with_children(children)
}

fn projection_to_ast(projection: &[SelectItem], path: &str) -> AstNode {
    let children: Vec<_> = projection
        .iter()
        .enumerate()
        .map(|(i, item)| {
            let item_range = span_to_range(item.span());
            let label = match item {
                SelectItem::UnnamedExpr(expr) => expr.to_string(),
                SelectItem::ExprWithAlias { expr, alias } => format!("{expr} AS {alias}"),
                SelectItem::QualifiedWildcard(name, _) => format!("{name}.*"),
                SelectItem::Wildcard(_) => "*".to_string(),
            };
            AstNode::new(
                AstNodeType::Expression,
                format!("{path}.columns[{i}]"),
                label,
                item_range,
            )
        })
        .collect();

    // Use span of first and last item for the projection clause
    let range = if let (Some(first), Some(last)) = (projection.first(), projection.last()) {
        AstRange::new(
            span_to_range(first.span()).start,
            span_to_range(last.span()).end,
        )
    } else {
        AstRange::new(AstPosition::new(1, 1, 0), AstPosition::new(1, 1, 0))
    };

    AstNode::new(
        AstNodeType::Clause,
        format!("{path}.columns"),
        format!("SELECT ({})", children.len()),
        range,
    )
    .with_children(children)
}

fn from_clause_to_ast(from: &[TableWithJoins], path: &str) -> Option<AstNode> {
    if from.is_empty() {
        return None;
    }

    let children: Vec<_> = from
        .iter()
        .enumerate()
        .map(|(i, table)| table_to_ast(table, &format!("{path}.from[{i}]")))
        .collect();

    // Use span of first and last table for the FROM clause
    let range = if let (Some(first), Some(last)) = (from.first(), from.last()) {
        AstRange::new(
            span_to_range(first.span()).start,
            span_to_range(last.span()).end,
        )
    } else {
        AstRange::new(AstPosition::new(1, 1, 0), AstPosition::new(1, 1, 0))
    };

    Some(
        AstNode::new(
            AstNodeType::Clause,
            format!("{path}.from"),
            format!("FROM ({})", children.len()),
            range,
        )
        .with_children(children),
    )
}

fn group_by_to_ast(group_by: &GroupByExpr, path: &str) -> Option<AstNode> {
    let exprs: Vec<&Expr> = match group_by {
        GroupByExpr::All(_) => return None,
        GroupByExpr::Expressions(exprs, _) => exprs.iter().collect(),
    };

    if exprs.is_empty() {
        return None;
    }

    let group_range = span_to_range(group_by.span());

    let children: Vec<_> = exprs
        .iter()
        .enumerate()
        .map(|(i, expr)| {
            let expr_range = span_to_range(expr.span());
            AstNode::new(
                AstNodeType::Expression,
                format!("{path}.groupBy[{i}]"),
                expr.to_string(),
                expr_range,
            )
        })
        .collect();

    Some(
        AstNode::new(
            AstNodeType::Clause,
            format!("{path}.groupBy"),
            format!("GROUP BY ({})", children.len()),
            group_range,
        )
        .with_children(children),
    )
}

fn table_to_ast(table: &TableWithJoins, path: &str) -> AstNode {
    let table_range = span_to_range(table.span());
    let relation_range = span_to_range(table.relation.span());
    let relation_label = table_factor_label(&table.relation);

    let mut children = vec![AstNode::new(
        AstNodeType::Identifier,
        format!("{path}.table"),
        relation_label.clone(),
        relation_range,
    )];

    children.extend(table.joins.iter().enumerate().map(|(i, join)| {
        let join_range = span_to_range(join.span());
        let join_type = format!("{:?}", join.join_operator);
        let join_table = match &join.relation {
            TableFactor::Table { name, .. } => name.to_string(),
            _ => "table".to_string(),
        };
        AstNode::new(
            AstNodeType::Clause,
            format!("{path}.joins[{i}]"),
            format!("{join_type} {join_table}"),
            join_range,
        )
    }));

    AstNode::new(
        AstNodeType::Clause,
        path.to_string(),
        relation_label,
        table_range,
    )
    .with_children(children)
}

fn table_factor_label(factor: &TableFactor) -> String {
    match factor {
        TableFactor::Table { name, alias, .. } => alias
            .as_ref()
            .map_or_else(|| name.to_string(), |a| format!("{name} AS {}", a.name)),
        TableFactor::Derived { alias, .. } => alias.as_ref().map_or_else(
            || "(subquery)".to_string(),
            |a| format!("(subquery) AS {}", a.name),
        ),
        _ => "table".to_string(),
    }
}

fn expr_to_ast(expr: &Expr, path: &str, label_prefix: &str) -> AstNode {
    let expr_range = span_to_range(expr.span());
    let label = format!("{label_prefix}: {}", truncate_string(&expr.to_string(), 50));
    AstNode::new(AstNodeType::Expression, path.to_string(), label, expr_range)
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

    fn find_where_node(node: &AstNode) -> Option<&AstNode> {
        if node.path.contains("where") {
            return Some(node);
        }
        if let Some(children) = &node.children {
            for child in children {
                if let Some(found) = find_where_node(child) {
                    return Some(found);
                }
            }
        }
        None
    }

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

    #[test]
    fn test_select_has_correct_line_numbers() {
        let sql = "SELECT id,\n       name,\n       age\nFROM users\nWHERE age > 18";
        let result = parse(sql);

        assert!(result.ast.is_some());
        let ast = result.ast.unwrap();

        // Root statement should start at line 1
        assert_eq!(ast.range.start.line, 1);

        // Check that children have different line numbers
        if let Some(children) = &ast.children {
            // Find the select clause
            if let Some(select_clause) = children.first() {
                if let Some(select_children) = &select_clause.children {
                    // Check columns clause
                    for child in select_children {
                        if child.path.contains("columns") && child.children.is_some() {
                            // Individual columns should have their own line numbers
                            let cols = child.children.as_ref().unwrap();
                            if cols.len() >= 2 {
                                // Second column should be on line 2
                                assert!(
                                    cols[1].range.start.line >= 2,
                                    "Second column should be on line 2 or later, got {}",
                                    cols[1].range.start.line
                                );
                            }
                        }
                    }
                }
            }
        }
    }

    #[test]
    fn test_multiline_where_clause() {
        let sql = "SELECT *\nFROM users\nWHERE age > 18";
        let result = parse(sql);

        assert!(result.ast.is_some());
        let ast = result.ast.unwrap();

        if let Some(where_node) = find_where_node(&ast) {
            // WHERE clause should be on line 3
            assert_eq!(
                where_node.range.start.line, 3,
                "WHERE clause should be on line 3, got {}",
                where_node.range.start.line
            );
        }
    }
}

use napi_derive::napi;
use tree_sitter::{Parser, Language};

#[napi]
pub fn extract_skeleton(code: String, ext: String) -> Result<String, napi::Error> {
    let language: Language = match ext.as_str() {
        ".ts" => tree_sitter_typescript::LANGUAGE_TYPESCRIPT.into(),
        ".tsx" => tree_sitter_typescript::LANGUAGE_TSX.into(),
        ".js" => tree_sitter_javascript::LANGUAGE.into(),
        ".py" => tree_sitter_python::LANGUAGE.into(),
        _ => return Err(napi::Error::from_reason(format!("[NovAST] Unsupported language: {}", ext))),
    };

    let mut parser = Parser::new();
    parser.set_language(&language).map_err(|_| napi::Error::from_reason("[NovAST] Failed to set language"))?;

    let tree = parser.parse(&code, None).ok_or_else(|| napi::Error::from_reason("[NovAST] Failed to parse code"))?;
    
    let body_types = match ext.as_str() {
        ".ts" | ".tsx" | ".js" => vec!["statement_block"],
        ".py" => vec!["block"],
        _ => vec!["statement_block", "block"],
    };

    let mut edits = Vec::new();
    let mut cursor = tree.walk();
    traverse_node(tree.root_node(), &body_types, ext.as_str(), &mut edits, &mut cursor);

    // Apply edits in reverse order (bottom to top) to maintain byte offsets
    edits.sort_by(|a, b| b.0.cmp(&a.0));

    let mut skeleton = code.into_bytes();
    for (start, end, replacement) in edits {
        skeleton.splice(start..end, replacement.into_bytes());
    }

    String::from_utf8(skeleton).map_err(|_| napi::Error::from_reason("[NovAST] Failed to build UTF-8 string"))
}

fn traverse_node(
    node: tree_sitter::Node, 
    body_types: &[&str], 
    ext: &str, 
    edits: &mut Vec<(usize, usize, String)>,
    cursor: &mut tree_sitter::TreeCursor
) {
    if body_types.contains(&node.kind()) {
        let replacement = if ext == ".py" {
            ":\n    pass\n".to_string()
        } else {
            " { /* NovAST: Stripped */ }".to_string()
        };
        edits.push((node.start_byte(), node.end_byte(), replacement));
        return;
    }

    if cursor.goto_first_child() {
        loop {
            traverse_node(cursor.node(), body_types, ext, edits, cursor);
            if !cursor.goto_next_sibling() {
                break;
            }
        }
        cursor.goto_parent();
    }
}

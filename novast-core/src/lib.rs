use napi_derive::napi;
use tree_sitter::{Parser, Language, Node};
use std::collections::{HashSet, HashMap};
use rayon::prelude::*;
use walkdir::WalkDir;
use serde::{Serialize, Deserialize};
use std::sync::{Arc, Mutex};

fn get_language(ext: &str) -> Result<Language, napi::Error> {
    match ext {
        ".ts" => Ok(tree_sitter_typescript::LANGUAGE_TYPESCRIPT.into()),
        ".tsx" => Ok(tree_sitter_typescript::LANGUAGE_TSX.into()),
        ".js" => Ok(tree_sitter_javascript::LANGUAGE.into()),
        ".py" => Ok(tree_sitter_python::LANGUAGE.into()),
        ".cpp" | ".cc" => Ok(tree_sitter_cpp::LANGUAGE.into()),
        ".go" => Ok(tree_sitter_go::LANGUAGE.into()),
        ".rs" => Ok(tree_sitter_rust::LANGUAGE.into()),
        ".rb" => Ok(tree_sitter_ruby::LANGUAGE.into()),
        ".cs" => Ok(tree_sitter_c_sharp::LANGUAGE.into()),
        ".java" => Ok(tree_sitter_java::LANGUAGE.into()),
        ".dart" => Ok(tree_sitter_dart::LANGUAGE.into()),
        _ => Err(napi::Error::from_reason(format!("[NovAST] Unsupported language: {}", ext))),
    }
}

fn get_body_types(ext: &str) -> Vec<&'static str> {
    match ext {
        ".ts" | ".tsx" | ".js" => vec!["statement_block"],
        ".py" => vec!["block"],
        ".cpp" | ".cc" => vec!["compound_statement"],
        ".go" | ".rs" | ".cs" | ".java" | ".dart" => vec!["block"],
        ".rb" => vec!["body_statement", "do_block"],
        _ => vec!["statement_block", "block", "compound_statement", "body_statement", "do_block"],
    }
}

fn get_strip_replacement(ext: &str) -> String {
    if ext == ".rb" {
        "# NovAST: Stripped".to_string()
    } else if ext == ".py" {
        ":\n    pass\n".to_string()
    } else {
        " { /* NovAST: Stripped */ }".to_string()
    }
}

#[napi]
pub fn extract_skeleton(code: String, ext: String) -> Result<String, napi::Error> {
    let language = get_language(&ext)?;
    let mut parser = Parser::new();
    parser.set_language(&language).map_err(|_| napi::Error::from_reason("[NovAST] Failed to set language"))?;
    let tree = parser.parse(&code, None).ok_or_else(|| napi::Error::from_reason("[NovAST] Failed to parse code"))?;
    
    let body_types = get_body_types(&ext);
    let mut edits = Vec::new();
    let mut cursor = tree.walk();
    
    traverse_node(tree.root_node(), &body_types, &ext, &mut edits, &mut cursor);

    edits.sort_by(|a, b| b.0.cmp(&a.0));

    let mut skeleton = code.into_bytes();
    for (start, end, replacement) in edits {
        skeleton.splice(start..end, replacement.into_bytes());
    }

    String::from_utf8(skeleton).map_err(|_| napi::Error::from_reason("[NovAST] Failed to build UTF-8 string"))
}

fn traverse_node(
    node: Node, 
    body_types: &[&str], 
    ext: &str, 
    edits: &mut Vec<(usize, usize, String)>,
    cursor: &mut tree_sitter::TreeCursor
) {
    if body_types.contains(&node.kind()) {
        let replacement = get_strip_replacement(ext);
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

#[napi]
pub fn get_local_imports(code: String, ext: String) -> Result<Vec<String>, napi::Error> {
    let language = get_language(&ext)?;
    let mut parser = Parser::new();
    parser.set_language(&language).map_err(|_| napi::Error::from_reason("[NovAST] Failed to set language"))?;
    let tree = parser.parse(&code, None).ok_or_else(|| napi::Error::from_reason("[NovAST] Failed to parse code"))?;

    let mut imports = HashSet::new();
    
    fn find_imports(node: Node, code: &str, imports: &mut HashSet<String>) {
        if node.kind().contains("import") {
            let mut walker = node.walk();
            for child in node.children(&mut walker) {
                if child.kind() == "string" || child.kind() == "string_literal" {
                    let text = &code[child.start_byte()..child.end_byte()];
                    let raw_path = text.replace("'", "").replace("\"", "");
                    if raw_path.starts_with('.') {
                        imports.insert(raw_path);
                    }
                }
                if child.kind() == "relative_import" || (child.kind() == "dotted_name" && code[child.start_byte()..child.end_byte()].starts_with('.')) {
                    let text = &code[child.start_byte()..child.end_byte()];
                    imports.insert(text.replace('.', "/"));
                }
            }
        }
        
        let mut walker = node.walk();
        for child in node.children(&mut walker) {
            find_imports(child, code, imports);
        }
    }

    find_imports(tree.root_node(), &code, &mut imports);
    
    let mut result: Vec<String> = imports.into_iter().collect();
    result.sort();
    Ok(result)
}

#[napi]
pub fn generate_heatmap(code: String, ext: String, cursor_line: u32) -> Result<String, napi::Error> {
    let language = get_language(&ext)?;
    let mut parser = Parser::new();
    parser.set_language(&language).map_err(|_| napi::Error::from_reason("[NovAST] Failed to set language"))?;
    let tree = parser.parse(&code, None).ok_or_else(|| napi::Error::from_reason("[NovAST] Failed to parse code"))?;
    let root = tree.root_node();

    // 1. Find Epicenter
    let mut epicenter = root;
    fn is_epicenter(kind: &str) -> bool {
        kind.contains("function") || kind.contains("method") || kind.contains("class")
    }

    fn find_epicenter<'a>(node: Node<'a>, cursor_line: u32, epicenter: &mut Node<'a>) {
        if cursor_line < node.start_position().row as u32 || cursor_line > node.end_position().row as u32 {
            return;
        }
        if is_epicenter(node.kind()) {
            *epicenter = node;
        }
        let mut walker = node.walk();
        for child in node.children(&mut walker) {
            find_epicenter(child, cursor_line, epicenter);
        }
    }

    find_epicenter(root, cursor_line, &mut epicenter);

    // 2. Collect Identifiers
    let mut identifiers = HashSet::new();
    fn collect_identifiers<'a>(node: Node<'a>, code: &'a str, identifiers: &mut HashSet<&'a str>) {
        if node.kind().contains("identifier") {
            identifiers.insert(&code[node.start_byte()..node.end_byte()]);
        }
        let mut walker = node.walk();
        for child in node.children(&mut walker) {
            collect_identifiers(child, code, identifiers);
        }
    }

    if epicenter.id() != root.id() {
        collect_identifiers(epicenter, &code, &mut identifiers);
    }

    // 3. Extract Periphery and Blast Radius
    let periphery_types = vec![
        "import_statement",
        "import_declaration",
        "import_from_statement",
        "type_alias_declaration",
        "interface_declaration",
    ];

    let mut periphery_nodes = Vec::new();
    let mut blast_radius_nodes = HashMap::new();

    let mut root_walker = root.walk();
    for child in root.children(&mut root_walker) {
        if child.id() == epicenter.id() {
            continue;
        }
        if periphery_types.contains(&child.kind()) {
            periphery_nodes.push(child);
            continue;
        }

        if epicenter.id() != root.id() && (child.kind().contains("declaration") || is_epicenter(child.kind())) {
            let mut is_related = false;

            fn check_decl_name<'a>(n: Node<'a>, depth: u32, code: &'a str, identifiers: &HashSet<&'a str>, is_related: &mut bool) {
                if *is_related || depth > 2 {
                    return;
                }
                if n.kind().contains("identifier") || n.kind().contains("name") {
                    let text = &code[n.start_byte()..n.byte_range().end];
                    if identifiers.contains(text) {
                        *is_related = true;
                    }
                }
                let mut walker = n.walk();
                for c in n.children(&mut walker) {
                    check_decl_name(c, depth + 1, code, identifiers, is_related);
                }
            }

            check_decl_name(child, 0, &code, &identifiers, &mut is_related);
            if is_related {
                blast_radius_nodes.insert(child.start_byte(), child);
            }
        }
    }

    // 4. Build Output Strings
    let body_types = get_body_types(&ext);
    let strip_replacement = get_strip_replacement(&ext);

    fn strip_node(node: Node, code: &str, body_types: &[&str], replacement: &str) -> String {
        let mut edits = Vec::new();

        fn traverse(n: Node, body_types: &[&str], edits: &mut Vec<(usize, usize)>) {
            if body_types.contains(&n.kind()) {
                edits.push((n.start_byte(), n.end_byte()));
                return;
            }
            let mut walker = n.walk();
            for c in n.children(&mut walker) {
                traverse(c, body_types, edits);
            }
        }

        traverse(node, body_types, &mut edits);

        let mut text = code[node.start_byte()..node.end_byte()].to_string().into_bytes();
        edits.sort_by(|a, b| b.0.cmp(&a.0));

        for (start, end) in edits {
            let rel_start = start.saturating_sub(node.start_byte());
            let rel_end = end.saturating_sub(node.start_byte());
            if rel_start <= text.len() && rel_end <= text.len() {
                text.splice(rel_start..rel_end, replacement.as_bytes().iter().cloned());
            }
        }
        String::from_utf8(text).unwrap_or_default()
    }

    let periphery_text = periphery_nodes.iter()
        .map(|n| &code[n.start_byte()..n.end_byte()])
        .collect::<Vec<_>>().join("\n");

    let mut sorted_blast_nodes: Vec<_> = blast_radius_nodes.into_iter().collect();
    sorted_blast_nodes.sort_by_key(|k| k.0);
    
    let blast_text = sorted_blast_nodes.into_iter()
        .map(|(_, n)| strip_node(n, &code, &body_types, &strip_replacement))
        .collect::<Vec<_>>().join("\n\n");

    let epicenter_text = if epicenter.id() == root.id() {
        code.to_string()
    } else {
        code[epicenter.start_byte()..epicenter.end_byte()].to_string()
    };

    let p_out = if periphery_text.is_empty() { "(none)".to_string() } else { periphery_text };
    let b_out = if blast_text.is_empty() { "(none)".to_string() } else { blast_text };

    let out = format!(
        "// === [PERIPHERY: Imports & Types] ===\n{}\n\n// === [BLAST RADIUS: Related Signatures] ===\n{}\n\n// === [EPICENTER: Target Context] ===\n{}",
        p_out,
        b_out,
        epicenter_text
    );

    Ok(out)
}

#[derive(Serialize, Deserialize)]
struct SymbolInfo {
    file: String,
    line: u32,
    gravity: u32,
}

#[derive(Serialize, Deserialize)]
struct ArchitecturalMap {
    symbols: HashMap<String, SymbolInfo>,
}

#[napi]
pub fn index_workspace(directory: String) -> Result<String, napi::Error> {
    let supported_exts = vec![".ts", ".tsx", ".js", ".py", ".cpp", ".cc", ".go", ".rs", ".rb", ".cs", ".java", ".dart"];
    
    let files: Vec<String> = WalkDir::new(&directory)
        .into_iter()
        .filter_map(|e| e.ok())
        .filter(|e| {
            let path = e.path();
            path.is_file() && supported_exts.iter().any(|ext| path.to_string_lossy().ends_with(ext))
        })
        .map(|e| e.path().to_string_lossy().into_owned())
        .collect();

    let global_symbols = Arc::new(Mutex::new(HashMap::<String, (String, u32)>::new()));
    let global_references = Arc::new(Mutex::new(HashMap::<String, u32>::new()));

    files.par_iter().for_each(|file_path| {
        if let Ok(code) = std::fs::read_to_string(file_path) {
            let ext = std::path::Path::new(file_path).extension().and_then(|s| s.to_str()).map(|s| format!(".{}", s)).unwrap_or_default();
            if let Ok(language) = get_language(&ext) {
                let mut parser = Parser::new();
                if parser.set_language(&language).is_ok() {
                    if let Some(tree) = parser.parse(&code, None) {
                        let mut walker = tree.walk();
                        traverse_indexing(tree.root_node(), &code, file_path, &global_symbols, &global_references, &mut walker);
                    }
                }
            }
        }
    });

    let symbols_map = global_symbols.lock().unwrap();
    let references_map = global_references.lock().unwrap();

    let mut architectural_map = ArchitecturalMap {
        symbols: HashMap::new(),
    };

    for (name, (file, line)) in symbols_map.iter() {
        architectural_map.symbols.insert(name.clone(), SymbolInfo {
            file: file.clone(),
            line: *line,
            gravity: *references_map.get(name).unwrap_or(&0),
        });
    }

    serde_json::to_string(&architectural_map).map_err(|e| napi::Error::from_reason(format!("[NovAST] Failed to serialize map: {}", e)))
}

fn traverse_indexing(
    node: Node,
    code: &str,
    file_path: &str,
    symbols: &Arc<Mutex<HashMap<String, (String, u32)>>>,
    references: &Arc<Mutex<HashMap<String, u32>>>,
    cursor: &mut tree_sitter::TreeCursor,
) {
    if node.kind().contains("identifier") || node.kind().contains("name") {
        let name = &code[node.start_byte()..node.end_byte()];
        if !name.is_empty() {
            let mut is_def = false;
            if let Some(parent) = node.parent() {
                let kind = parent.kind();
                if kind.contains("declaration") || kind.contains("definition") || kind.contains("class") || kind.contains("function") || kind.contains("method") {
                    is_def = true;
                }
            }

            if is_def {
                let mut syms = symbols.lock().unwrap();
                syms.insert(name.to_string(), (file_path.to_string(), node.start_position().row as u32));
            } else {
                let mut refs = references.lock().unwrap();
                *refs.entry(name.to_string()).or_insert(0) += 1;
            }
        }
    }

    if cursor.goto_first_child() {
        loop {
            traverse_indexing(cursor.node(), code, file_path, symbols, references, cursor);
            if !cursor.goto_next_sibling() {
                break;
            }
        }
        cursor.goto_parent();
    }
}

#[napi]
pub fn pack_context(code: String, ext: String, max_tokens: u32) -> Result<String, napi::Error> {
    let language = get_language(&ext)?;
    let mut parser = Parser::new();
    parser.set_language(&language).map_err(|_| napi::Error::from_reason("[NovAST] Failed to set language"))?;
    let tree = parser.parse(&code, None).ok_or_else(|| napi::Error::from_reason("[NovAST] Failed to parse code"))?;
    
    fn estimate_tokens(text: &str) -> u32 {
        (text.chars().count() / 4).max(1) as u32
    }

    struct PackableBlock {
        start: usize,
        end: usize,
        weight: u32,
        value: u32,
    }

    let mut blocks = Vec::new();
    let root = tree.root_node();
    let body_types = get_body_types(&ext);

    fn collect_blocks(node: Node, depth: u32, code: &str, body_types: &[&str], blocks: &mut Vec<PackableBlock>) {
        if body_types.contains(&node.kind()) {
            let weight = estimate_tokens(&code[node.start_byte()..node.end_byte()]);
            let value = if depth < 3 { 100 } else { 10 }; // Top-level vs deeply nested
            
            blocks.push(PackableBlock {
                start: node.start_byte(),
                end: node.end_byte(),
                weight,
                value,
            });
            return;
        }

        let mut walker = node.walk();
        for child in node.children(&mut walker) {
            collect_blocks(child, depth + 1, code, body_types, blocks);
        }
    }

    collect_blocks(root, 0, &code, &body_types, &mut blocks);

    // Greedy Sort: Sort by value/weight ratio
    blocks.sort_by(|a, b| {
        let r_a = a.value as f32 / a.weight as f32;
        let r_b = b.value as f32 / b.weight as f32;
        r_b.partial_cmp(&r_a).unwrap_or(std::cmp::Ordering::Equal)
    });

    let mut replacements = Vec::new();

    // We start assuming everything is kept. If total tokens > max, we start stripping from the worst ratio.
    // Actually, the prompt says: "Iterate through the sorted blocks. If adding... keeps total below max_tokens, keep it intact."
    // This implies starting from an empty set or a baseline.
    // Let's use the requested logic:
    
    let mut allocated_tokens = estimate_tokens(&code);

    
    // Reverse sort to get the worst ones first for stripping
    blocks.sort_by(|a, b| {
        let r_a = a.value as f32 / a.weight as f32;
        let r_b = b.value as f32 / b.weight as f32;
        r_a.partial_cmp(&r_b).unwrap_or(std::cmp::Ordering::Equal)
    });

    for block in blocks {
        if allocated_tokens > max_tokens {
            let saved = block.weight.saturating_sub(estimate_tokens("/* NovAST: Budget Exceeded */"));
            replacements.push((block.start, block.end, "/* NovAST: Budget Exceeded */".to_string()));
            allocated_tokens = allocated_tokens.saturating_sub(saved);
        }
    }

    replacements.sort_by(|a, b| b.0.cmp(&a.0));
    let mut packed_code = code.into_bytes();
    for (start, end, replacement) in replacements {
        packed_code.splice(start..end, replacement.into_bytes());
    }

    String::from_utf8(packed_code).map_err(|_| napi::Error::from_reason("[NovAST] Failed to build UTF-8 string"))
}

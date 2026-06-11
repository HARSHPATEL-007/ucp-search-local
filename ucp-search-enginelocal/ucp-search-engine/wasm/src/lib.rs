/**
 * UCP Trie Search - WebAssembly Module
 * High-performance prefix matching for browser shell
 */

use wasm_bindgen::prelude::*;
use serde::{Serialize, Deserialize};
use std::collections::HashMap;

#[wasm_bindgen]
extern "C" {
    #[wasm_bindgen(js_namespace = console)]
    fn log(s: &str);
}

macro_rules! console_log {
    ($($t:tt)*) => (log(&format_args!($($t)*).to_string()))
}

#[derive(Serialize, Deserialize, Clone)]
pub struct TrieDocument {
    pub id: String,
    pub title: String,
    pub doc_type: String,
    pub metadata: HashMap<String, String>,
    pub score: f64,
}

#[derive(Serialize, Deserialize)]
pub struct SearchResult {
    pub document: TrieDocument,
    pub match_score: f64,
}

pub struct TrieNode {
    children: HashMap<char, TrieNode>,
    documents: Vec<TrieDocument>,
}

impl TrieNode {
    fn new() -> Self {
        TrieNode {
            children: HashMap::new(),
            documents: Vec::new(),
        }
    }
}

#[wasm_bindgen]
pub struct TrieSearch {
    root: TrieNode,
    document_index: HashMap<String, TrieDocument>,
}

#[wasm_bindgen]
impl TrieSearch {
    #[wasm_bindgen(constructor)]
    pub fn new() -> TrieSearch {
        TrieSearch {
            root: TrieNode::new(),
            document_index: HashMap::new(),
        }
    }

    pub fn insert(&mut self, key: &str, doc: JsValue) -> Result<(), JsValue> {
        let document: TrieDocument = serde_wasm_bindgen::from_value(&doc)
            .map_err(|e| JsValue::from_str(&format!("Deserialization error: {}", e)))?;

        let normalized = key.to_lowercase();
        let mut node = &mut self.root;

        for ch in normalized.chars() {
            node = node.children.entry(ch).or_insert_with(TrieNode::new);
        }

        node.documents.push(document.clone());
        self.document_index.insert(document.id.clone(), document);

        Ok(())
    }

    pub fn search(&self, prefix: &str, max_results: usize) -> JsValue {
        let normalized = prefix.to_lowercase();
        let mut node = &self.root;

        for ch in normalized.chars() {
            match node.children.get(&ch) {
                Some(child) => node = child,
                None => return serde_wasm_bindgen::to_value(&Vec::<TrieDocument>::new()).unwrap(),
            }
        }

        let results = self.collect_documents(node, max_results);
        serde_wasm_bindgen::to_value(&results).unwrap()
    }

    pub fn fuzzy_search(&self, query: &str, max_results: usize, tolerance: u32) -> JsValue {
        let mut results = Vec::new();
        self.fuzzy_collect(&self.root, query, tolerance, 0, &mut results, max_results);
        serde_wasm_bindgen::to_value(&results).unwrap()
    }

    fn collect_documents(&self, node: &TrieNode, max_results: usize) -> Vec<TrieDocument> {
        let mut results = Vec::new();
        let mut stack = vec![node];

        while let Some(current) = stack.pop() {
            if results.len() >= max_results {
                break;
            }
            results.extend(current.documents.clone());

            for child in current.children.values() {
                if results.len() < max_results {
                    stack.push(child);
                }
            }
        }

        results.truncate(max_results);
        results
    }

    fn fuzzy_collect(
        &self,
        node: &TrieNode,
        query: &str,
        tolerance: u32,
        depth: usize,
        results: &mut Vec<TrieDocument>,
        max_results: usize,
    ) {
        if results.len() >= max_results {
            return;
        }

        results.extend(node.documents.clone());

        if depth < query.len() + tolerance as usize {
            for (ch, child) in &node.children {
                let query_ch = query.chars().nth(depth);
                let new_tolerance = if query_ch == Some(*ch) { 
                    tolerance 
                } else { 
                    tolerance.saturating_sub(1) 
                };

                if new_tolerance > 0 || query_ch == Some(*ch) {
                    self.fuzzy_collect(child, query, new_tolerance, depth + 1, results, max_results);
                }
            }
        }
    }

    pub fn size(&self) -> usize {
        self.document_index.len()
    }

    pub fn clear(&mut self) {
        self.root = TrieNode::new();
        self.document_index.clear();
    }
}

#[wasm_bindgen(start)]
pub fn start() {
    console_log!("UCP Trie Search WASM module initialized");
}

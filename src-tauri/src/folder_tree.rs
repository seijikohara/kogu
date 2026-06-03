//! Folder Tree Visualizer commands.
//!
//! Walks a directory tree on disk and returns a structured representation
//! the frontend renders as an expandable tree. Cumulative folder sizes,
//! glob filtering, and hidden-file toggles are all evaluated here so the
//! IPC payload stays compact and the frontend never has to peek into
//! the filesystem twice.

use std::collections::BinaryHeap;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::time::{SystemTime, UNIX_EPOCH};

use globset::{Glob, GlobMatcher};
use serde::{Deserialize, Serialize};
use tokio_util::sync::CancellationToken;
use walkdir::{DirEntry, WalkDir};

/// Hard cap on traversal entries. Protects the IPC channel from
/// pathological directory trees that would otherwise produce gigabyte
/// payloads.
const MAX_ENTRIES: usize = 50_000;

/// Hard cap on depth, regardless of the caller-supplied `max_depth`.
/// Guards against symlink loops that `walkdir` would otherwise follow
/// indefinitely.
const MAX_TRAVERSAL_DEPTH: usize = 32;

/// Request payload for [`folder_walk`].
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WalkRequest {
    /// Absolute path of the directory to walk.
    pub root: String,
    /// Include-only glob patterns evaluated against the filename. An
    /// empty list disables include filtering.
    pub include_globs: Vec<String>,
    /// Exclude glob patterns evaluated against the filename. Matched
    /// entries are skipped for files; matched directories are pruned
    /// from descent.
    pub exclude_globs: Vec<String>,
    /// Maximum tree depth returned to the frontend. `0` means root only.
    pub max_depth: u32,
    /// When `false`, dotfiles and dot-directories are skipped.
    pub show_hidden: bool,
}

/// Single node in the returned tree.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TreeNode {
    /// Final path component (e.g. `image.png`).
    pub name: String,
    /// Absolute filesystem path.
    pub path: String,
    /// `true` for directories, `false` for regular files.
    pub is_dir: bool,
    /// File size in bytes. For directories this is the cumulative size
    /// of all files in the subtree (regardless of `max_depth`).
    pub size_bytes: u64,
    /// Modification time as Unix milliseconds (when available).
    pub modified_ms: Option<i64>,
    /// Child nodes. Empty for files or directories beyond [`max_depth`].
    pub children: Vec<Self>,
    /// `true` if children were truncated due to [`max_depth`].
    pub truncated: bool,
}

/// Single entry in the largest-files response.
#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct LargestFile {
    /// Absolute filesystem path.
    pub path: String,
    /// File size in bytes.
    pub size_bytes: u64,
}

/// Internal heap entry for the top-N largest-file selection. Ordered by
/// size descending; ties broken by lexicographic path so the result is
/// stable across runs.
#[derive(Debug, Eq, PartialEq)]
struct HeapEntry {
    size: u64,
    path: PathBuf,
}

impl Ord for HeapEntry {
    fn cmp(&self, other: &Self) -> std::cmp::Ordering {
        // `BinaryHeap` is a max-heap; we want to pop the *smallest* so the
        // top-N filter keeps the largest. Reverse the comparison.
        other
            .size
            .cmp(&self.size)
            .then_with(|| self.path.cmp(&other.path))
    }
}

impl PartialOrd for HeapEntry {
    fn partial_cmp(&self, other: &Self) -> Option<std::cmp::Ordering> {
        Some(self.cmp(other))
    }
}

fn is_hidden(entry: &DirEntry) -> bool {
    entry
        .file_name()
        .to_str()
        .is_some_and(|s| s.starts_with('.') && s != "." && s != "..")
}

fn build_matchers(patterns: &[String]) -> Result<Vec<GlobMatcher>, String> {
    patterns
        .iter()
        .filter(|p| !p.trim().is_empty())
        .map(|p| {
            Glob::new(p)
                .map(|g| g.compile_matcher())
                .map_err(|e| format!("Invalid glob \"{p}\": {e}"))
        })
        .collect()
}

fn matches_any(name: &str, matchers: &[GlobMatcher]) -> bool {
    matchers.iter().any(|m| m.is_match(name))
}

/// Decide whether a file should be reported. Files that fail include
/// filters or match exclude filters are filtered out. Directories are
/// always reported; exclude pruning happens during descent.
fn keep_file(name: &str, includes: &[GlobMatcher], excludes: &[GlobMatcher]) -> bool {
    if matches_any(name, excludes) {
        return false;
    }
    if includes.is_empty() {
        return true;
    }
    matches_any(name, includes)
}

fn system_time_to_unix_ms(time: SystemTime) -> Option<i64> {
    time.duration_since(UNIX_EPOCH)
        .ok()
        .and_then(|d| i64::try_from(d.as_millis()).ok())
}

/// Owned mirror of [`TreeNode`] used during traversal. The walker emits
/// these flat through a stack and we collapse them at the end so the
/// recursive serialisation in the response respects child order.
#[derive(Debug)]
struct Frame {
    node: TreeNode,
    depth: usize,
}

/// Returns `true` when an entry should be retained by `WalkDir::filter_entry`.
/// The root is always kept; hidden entries are filtered when `show_hidden`
/// is false; excluded directories are pruned before descent.
fn should_descend_entry(entry: &DirEntry, show_hidden: bool, excludes: &[GlobMatcher]) -> bool {
    if entry.depth() == 0 {
        return true;
    }
    if !show_hidden && is_hidden(entry) {
        return false;
    }
    if let Some(name) = entry.file_name().to_str() {
        if entry.file_type().is_dir() && matches_any(name, excludes) {
            return false;
        }
    }
    true
}

/// Roll a finished frame into its parent. Returns `true` when the popped
/// frame should remain (because it is the root), `false` otherwise.
fn merge_into_parent(stack: &mut Vec<Frame>, done: Frame, max_depth: usize) -> bool {
    let Some(parent) = stack.last_mut() else {
        // Stack empty — `done` is the root. Push it back so the caller
        // can keep iterating without losing the tree.
        stack.push(done);
        return true;
    };
    parent.node.size_bytes += done.node.size_bytes;
    if parent.depth >= max_depth {
        if !done.node.children.is_empty() || !done.node.is_dir {
            parent.node.truncated = true;
        }
    } else {
        parent.node.children.push(done.node);
    }
    false
}

/// Collapse all frames in the stack that are shallower than or equal to
/// `depth` into their parents. Stops once the top of the stack is
/// strictly less than `depth` (the parent of the soon-to-be-pushed entry).
fn collapse_to_depth(stack: &mut Vec<Frame>, depth: usize, max_depth: usize) {
    while let Some(top) = stack.last() {
        if top.depth < depth {
            break;
        }
        let Some(done) = stack.pop() else { break };
        if merge_into_parent(stack, done, max_depth) {
            break;
        }
    }
}

/// Build a [`TreeNode`] from a successful [`walkdir::DirEntry`]. Returns
/// `None` when the entry is a file and the glob filter rejects it.
fn entry_to_node(
    entry: &DirEntry,
    includes: &[GlobMatcher],
    excludes: &[GlobMatcher],
) -> Option<TreeNode> {
    let file_type = entry.file_type();
    let name = entry.file_name().to_string_lossy().into_owned();
    if file_type.is_file() && !keep_file(&name, includes, excludes) {
        return None;
    }
    let size_bytes = if file_type.is_file() {
        entry.metadata().map_or(0, |m| m.len())
    } else {
        0
    };
    let modified_ms = entry
        .metadata()
        .ok()
        .and_then(|m| m.modified().ok())
        .and_then(system_time_to_unix_ms);
    Some(TreeNode {
        name,
        path: entry.path().to_string_lossy().into_owned(),
        is_dir: file_type.is_dir(),
        size_bytes,
        modified_ms,
        children: Vec::new(),
        truncated: false,
    })
}

/// Build a synthetic root node when the stack is empty after traversal.
/// This happens only for empty / unreadable directories. `root` is the
/// caller-supplied path used both as the canonical `path` value and as a
/// fallback name when the path has no final component (e.g. `/`).
fn synthesize_root(root_path: &Path, root: &str) -> TreeNode {
    TreeNode {
        name: root_path
            .file_name()
            .map_or_else(|| root.to_owned(), |s| s.to_string_lossy().into_owned()),
        path: root.to_owned(),
        is_dir: true,
        size_bytes: 0,
        modified_ms: None,
        children: Vec::new(),
        truncated: false,
    }
}

/// Walk a folder tree and return a structured [`TreeNode`].
///
/// # Errors
///
/// Returns a stringified error when the root cannot be opened, when any
/// supplied glob fails to compile, or when an underlying walk error
/// occurs that is not silently skippable.
#[tauri::command(async)]
pub fn folder_walk(
    op_id: String,
    req: WalkRequest,
    state: tauri::State<'_, crate::cancellation::OperationRegistry>,
) -> Result<TreeNode, String> {
    let token = Arc::new(CancellationToken::new());
    state.register(op_id.clone(), token.clone());
    let result = run_folder_walk(req, &token);
    state.remove(&op_id);
    result
}

fn run_folder_walk(req: WalkRequest, token: &CancellationToken) -> Result<TreeNode, String> {
    let root_path = Path::new(&req.root);
    let metadata = std::fs::metadata(root_path)
        .map_err(|e| format!("Failed to stat \"{}\": {e}", req.root))?;
    if !metadata.is_dir() {
        return Err(format!("Not a directory: {}", req.root));
    }

    let includes = build_matchers(&req.include_globs)?;
    let excludes = build_matchers(&req.exclude_globs)?;
    let excludes_for_walker = excludes.clone();
    let max_depth = (req.max_depth as usize).min(MAX_TRAVERSAL_DEPTH);
    let show_hidden = req.show_hidden;

    let walker = WalkDir::new(root_path)
        .follow_links(false)
        .min_depth(0)
        .max_depth(MAX_TRAVERSAL_DEPTH)
        .into_iter()
        .filter_entry(move |entry| should_descend_entry(entry, show_hidden, &excludes_for_walker));

    let mut stack: Vec<Frame> = Vec::new();
    let mut total_entries = 0_usize;
    let mut truncated_root = false;

    for entry in walker {
        if token.is_cancelled() {
            return Err("Operation cancelled".to_string());
        }
        let entry = match entry {
            Ok(e) => e,
            // Skip unreadable directories silently; surface only
            // top-level access errors.
            Err(e) => {
                if stack.is_empty() {
                    return Err(format!("Failed to walk: {e}"));
                }
                continue;
            }
        };

        total_entries += 1;
        if total_entries > MAX_ENTRIES {
            truncated_root = true;
            break;
        }

        let depth = entry.depth();
        let Some(node) = entry_to_node(&entry, &includes, &excludes) else {
            continue;
        };

        collapse_to_depth(&mut stack, depth, max_depth);
        stack.push(Frame { node, depth });
    }

    // Drain any remaining frames into their parents.
    while stack.len() > 1 {
        let Some(done) = stack.pop() else { break };
        merge_into_parent(&mut stack, done, max_depth);
    }

    let mut root_node = stack
        .pop()
        .map_or_else(|| synthesize_root(root_path, &req.root), |f| f.node);
    if truncated_root {
        root_node.truncated = true;
    }
    Ok(root_node)
}

/// Walk a folder tree and return the largest individual files.
///
/// # Errors
///
/// Returns a stringified error when the root cannot be opened or when
/// any supplied glob fails to compile.
#[tauri::command(async)]
pub fn folder_largest_files(
    op_id: String,
    root: String,
    limit: u32,
    include_globs: Vec<String>,
    exclude_globs: Vec<String>,
    state: tauri::State<'_, crate::cancellation::OperationRegistry>,
) -> Result<Vec<LargestFile>, String> {
    let token = Arc::new(CancellationToken::new());
    state.register(op_id.clone(), token.clone());
    let result = run_folder_largest_files(root, limit, include_globs, exclude_globs, &token);
    state.remove(&op_id);
    result
}

fn run_folder_largest_files(
    root: String,
    limit: u32,
    include_globs: Vec<String>,
    exclude_globs: Vec<String>,
    token: &CancellationToken,
) -> Result<Vec<LargestFile>, String> {
    let root_path = Path::new(&root);
    let metadata =
        std::fs::metadata(root_path).map_err(|e| format!("Failed to stat \"{root}\": {e}"))?;
    if !metadata.is_dir() {
        return Err(format!("Not a directory: {root}"));
    }
    let includes = build_matchers(&include_globs)?;
    let excludes = build_matchers(&exclude_globs)?;
    let cap = (limit as usize).max(1);

    let mut heap: BinaryHeap<HeapEntry> = BinaryHeap::with_capacity(cap + 1);

    let walker = WalkDir::new(root_path)
        .follow_links(false)
        .min_depth(1)
        .max_depth(MAX_TRAVERSAL_DEPTH)
        .into_iter()
        .filter_entry(|entry| {
            if let Some(name) = entry.file_name().to_str() {
                if entry.file_type().is_dir() && matches_any(name, &excludes) {
                    return false;
                }
            }
            true
        });

    let mut visited = 0_usize;
    for entry in walker.flatten() {
        if token.is_cancelled() {
            return Err("Operation cancelled".to_string());
        }
        visited += 1;
        if visited > MAX_ENTRIES {
            break;
        }
        if !entry.file_type().is_file() {
            continue;
        }
        let name = entry.file_name().to_string_lossy().into_owned();
        if !keep_file(&name, &includes, &excludes) {
            continue;
        }
        let size = entry.metadata().map_or(0, |m| m.len());
        heap.push(HeapEntry {
            size,
            path: entry.path().to_path_buf(),
        });
        if heap.len() > cap {
            heap.pop();
        }
    }

    // The heap is a min-heap on size; draining and sorting descending
    // gives the natural "largest first" presentation.
    let mut out: Vec<LargestFile> = heap
        .into_iter()
        .map(|e| LargestFile {
            path: e.path.to_string_lossy().into_owned(),
            size_bytes: e.size,
        })
        .collect();
    out.sort_by(|a, b| {
        b.size_bytes
            .cmp(&a.size_bytes)
            .then_with(|| a.path.cmp(&b.path))
    });
    Ok(out)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    fn tempdir(label: &str) -> PathBuf {
        let mut dir = std::env::temp_dir();
        dir.push(format!("kogu-folder-tree-{label}-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    fn write_file(dir: &Path, name: &str, content: &[u8]) {
        let mut path = dir.to_path_buf();
        path.push(name);
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent).unwrap();
        }
        fs::write(path, content).unwrap();
    }

    #[test]
    fn walks_simple_tree_and_sums_sizes() {
        let dir = tempdir("sums");
        write_file(&dir, "a.txt", b"hello");
        write_file(&dir, "sub/b.txt", b"world!");

        let req = WalkRequest {
            root: dir.to_string_lossy().into_owned(),
            include_globs: vec![],
            exclude_globs: vec![],
            max_depth: 5,
            show_hidden: true,
        };
        let node = run_folder_walk(req, &CancellationToken::new()).unwrap();
        assert!(node.is_dir);
        assert_eq!(node.size_bytes, 11);
        assert_eq!(node.children.len(), 2);

        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn excludes_pruned_dirs() {
        let dir = tempdir("excl");
        write_file(&dir, "keep.txt", b"x");
        write_file(&dir, "node_modules/skip.txt", b"y");
        let req = WalkRequest {
            root: dir.to_string_lossy().into_owned(),
            include_globs: vec![],
            exclude_globs: vec!["node_modules".to_string()],
            max_depth: 5,
            show_hidden: true,
        };
        let node = run_folder_walk(req, &CancellationToken::new()).unwrap();
        assert_eq!(node.size_bytes, 1);
        assert_eq!(node.children.len(), 1);
        assert_eq!(node.children[0].name, "keep.txt");
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn includes_filter_by_extension() {
        let dir = tempdir("incl");
        write_file(&dir, "a.png", b"png");
        write_file(&dir, "b.txt", b"txt");
        let req = WalkRequest {
            root: dir.to_string_lossy().into_owned(),
            include_globs: vec!["*.png".to_string()],
            exclude_globs: vec![],
            max_depth: 5,
            show_hidden: true,
        };
        let node = run_folder_walk(req, &CancellationToken::new()).unwrap();
        let names: Vec<_> = node.children.iter().map(|c| c.name.clone()).collect();
        assert_eq!(names, vec!["a.png"]);
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn largest_files_returns_top_n() {
        let dir = tempdir("top");
        write_file(&dir, "small.txt", b"x");
        write_file(&dir, "big.bin", &vec![0_u8; 1024]);
        write_file(&dir, "mid.bin", &vec![0_u8; 256]);

        let out = run_folder_largest_files(
            dir.to_string_lossy().into_owned(),
            2,
            vec![],
            vec![],
            &CancellationToken::new(),
        )
        .unwrap();
        assert_eq!(out.len(), 2);
        assert_eq!(out[0].size_bytes, 1024);
        assert_eq!(out[1].size_bytes, 256);
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn rejects_non_directory_root() {
        let dir = tempdir("notdir");
        write_file(&dir, "f.txt", b"x");
        let mut path = dir.clone();
        path.push("f.txt");
        let req = WalkRequest {
            root: path.to_string_lossy().into_owned(),
            include_globs: vec![],
            exclude_globs: vec![],
            max_depth: 1,
            show_hidden: true,
        };
        assert!(run_folder_walk(req, &CancellationToken::new()).is_err());
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn hidden_files_are_skipped_by_default() {
        let dir = tempdir("hidden");
        write_file(&dir, "visible.txt", b"v");
        write_file(&dir, ".hidden.txt", b"h");
        let req = WalkRequest {
            root: dir.to_string_lossy().into_owned(),
            include_globs: vec![],
            exclude_globs: vec![],
            max_depth: 1,
            show_hidden: false,
        };
        let node = run_folder_walk(req, &CancellationToken::new()).unwrap();
        let names: Vec<_> = node.children.iter().map(|c| c.name.clone()).collect();
        assert_eq!(names, vec!["visible.txt"]);
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn cancelled_token_aborts_walk() {
        let dir = tempdir("cancel");
        write_file(&dir, "a.txt", b"x");
        let req = WalkRequest {
            root: dir.to_string_lossy().into_owned(),
            include_globs: vec![],
            exclude_globs: vec![],
            max_depth: 5,
            show_hidden: true,
        };
        let token = CancellationToken::new();
        token.cancel();
        let result = run_folder_walk(req, &token);
        assert!(result.is_err_and(|e| e.contains("cancelled")));
        let _ = fs::remove_dir_all(&dir);
    }
}

//! Shared cooperative-cancellation registry for long-running commands.
//!
//! A heavy async command registers an [`Arc<CancellationToken>`] under a
//! frontend-supplied operation id, then checks `token.is_cancelled()` at its
//! hot-loop boundaries and bails out promptly. The frontend signals
//! cancellation through the generic `cancel_op` command, which removes the
//! token from the registry and cancels it.
//!
//! This mirrors the proven `network::NetworkScannerState` registry so the two
//! can be unified later. Cancellation is cooperative: Rust threads cannot be
//! force-killed, so a cancelled operation stops at its next check point rather
//! than instantly.

use std::collections::HashMap;
use std::sync::{Arc, Mutex};

use tokio_util::sync::CancellationToken;

/// Registry of in-flight cancellable operations, keyed by operation id.
#[derive(Default)]
pub struct OperationRegistry {
    tokens: Mutex<HashMap<String, Arc<CancellationToken>>>,
}

impl OperationRegistry {
    /// Create an empty registry.
    pub fn new() -> Self {
        Self::default()
    }

    /// Register a cancellation token for an operation id.
    pub fn register(&self, operation_id: String, token: Arc<CancellationToken>) {
        self.tokens
            .lock()
            .unwrap_or_else(std::sync::PoisonError::into_inner)
            .insert(operation_id, token);
    }

    /// Cancel an active operation by signalling and removing its token.
    ///
    /// Returns `true` if a matching operation was found.
    pub fn cancel(&self, operation_id: &str) -> bool {
        let removed = self
            .tokens
            .lock()
            .unwrap_or_else(std::sync::PoisonError::into_inner)
            .remove(operation_id);
        if let Some(token) = &removed {
            token.cancel();
        }
        removed.is_some()
    }

    /// Remove a completed operation without cancelling it.
    pub fn remove(&self, operation_id: &str) {
        self.tokens
            .lock()
            .unwrap_or_else(std::sync::PoisonError::into_inner)
            .remove(operation_id);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn cancel_signals_the_registered_token() {
        let registry = OperationRegistry::new();
        let token = Arc::new(CancellationToken::new());
        registry.register("op-1".to_string(), token.clone());

        assert!(!token.is_cancelled());
        assert!(registry.cancel("op-1"));
        assert!(token.is_cancelled());
    }

    #[test]
    fn cancel_unknown_operation_returns_false() {
        let registry = OperationRegistry::new();
        assert!(!registry.cancel("missing"));
    }

    #[test]
    fn remove_drops_the_token_without_cancelling() {
        let registry = OperationRegistry::new();
        let token = Arc::new(CancellationToken::new());
        registry.register("op-2".to_string(), token.clone());

        registry.remove("op-2");
        assert!(!token.is_cancelled());
        // The token is gone, so a later cancel finds nothing.
        assert!(!registry.cancel("op-2"));
    }
}

//! BCrypt hash generation and verification

use serde::{Deserialize, Serialize};

use super::GeneratorError;

/// Result of BCrypt hash generation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BcryptHashResult {
    /// The generated BCrypt hash
    pub hash: String,
    /// Cost factor used
    pub cost: u32,
    /// BCrypt algorithm version (e.g., "2b")
    pub algorithm: String,
}

/// Result of BCrypt verification
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BcryptVerifyResult {
    /// Whether the password matches the hash
    pub valid: bool,
    /// Human-readable result message
    pub message: String,
}

/// Information about a BCrypt cost factor
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BcryptCostInfo {
    /// Cost factor value
    pub cost: u32,
    /// Estimated computation time in milliseconds
    pub estimated_time_ms: f64,
    /// Security level label
    pub security_level: String,
}

/// Minimum allowed cost factor
pub const MIN_COST: u32 = 4;
/// Maximum allowed cost factor (practical limit)
pub const MAX_COST: u32 = 20;
/// Default cost factor (reserved for frontend use)
#[allow(dead_code)]
pub const DEFAULT_COST: u32 = 10;

/// Generate a BCrypt hash from a password
///
/// # Arguments
/// * `password` - The password to hash
/// * `cost` - The cost factor (4-20)
///
/// # Returns
/// The BCrypt hash result or an error
pub fn generate_hash(password: &str, cost: u32) -> Result<BcryptHashResult, GeneratorError> {
    if !(MIN_COST..=MAX_COST).contains(&cost) {
        return Err(GeneratorError::InvalidParameter(format!(
            "Cost factor must be between {} and {}, got {}",
            MIN_COST, MAX_COST, cost
        )));
    }

    let hash = bcrypt::hash(password, cost).map_err(|e| GeneratorError::Bcrypt(e.to_string()))?;

    Ok(BcryptHashResult {
        hash,
        cost,
        algorithm: "2b".to_string(),
    })
}

/// Verify a password against a BCrypt hash
///
/// # Arguments
/// * `password` - The password to verify
/// * `hash` - The BCrypt hash to verify against
///
/// # Returns
/// The verification result
pub fn verify_hash(password: &str, hash: &str) -> Result<BcryptVerifyResult, GeneratorError> {
    match bcrypt::verify(password, hash) {
        Ok(valid) => Ok(BcryptVerifyResult {
            valid,
            message: if valid {
                "Password matches the hash".to_string()
            } else {
                "Password does not match the hash".to_string()
            },
        }),
        Err(e) => Err(GeneratorError::Bcrypt(e.to_string())),
    }
}

/// Get information about a cost factor
///
/// # Arguments
/// * `cost` - The cost factor to get info for
///
/// # Returns
/// Information about the cost factor
pub fn get_cost_info(cost: u32) -> BcryptCostInfo {
    // Approximate computation time: ~100ms at cost 10, doubles for each increment
    let base_time_ms = 100.0;
    let base_cost = 10i32;
    let estimated_time_ms = base_time_ms * 2_f64.powi(cost as i32 - base_cost);

    let security_level = match cost {
        0..=5 => "Very Low",
        6..=7 => "Low",
        8..=9 => "Medium",
        10..=11 => "Standard",
        12..=13 => "High",
        14..=15 => "Very High",
        _ => "Extreme",
    }
    .to_string();

    BcryptCostInfo {
        cost,
        estimated_time_ms,
        security_level,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_generate_hash() {
        let result = generate_hash("password123", 4);
        assert!(result.is_ok());
        let hash_result = result.unwrap();
        assert!(hash_result.hash.starts_with("$2b$04$"));
        assert_eq!(hash_result.cost, 4);
        assert_eq!(hash_result.algorithm, "2b");
    }

    #[test]
    fn test_verify_correct_password() {
        let hash_result = generate_hash("password123", 4).unwrap();
        let verify_result = verify_hash("password123", &hash_result.hash).unwrap();
        assert!(verify_result.valid);
    }

    #[test]
    fn test_verify_wrong_password() {
        let hash_result = generate_hash("password123", 4).unwrap();
        let verify_result = verify_hash("wrongpassword", &hash_result.hash).unwrap();
        assert!(!verify_result.valid);
    }

    #[test]
    fn test_invalid_cost_too_low() {
        let result = generate_hash("password", 3);
        assert!(result.is_err());
    }

    #[test]
    fn test_invalid_cost_too_high() {
        let result = generate_hash("password", 32);
        assert!(result.is_err());
    }

    #[test]
    fn test_get_cost_info() {
        let info = get_cost_info(10);
        assert_eq!(info.cost, 10);
        assert!((info.estimated_time_ms - 100.0).abs() < 0.1);
        assert_eq!(info.security_level, "Standard");

        let info_high = get_cost_info(14);
        assert_eq!(info_high.security_level, "Very High");
    }
}

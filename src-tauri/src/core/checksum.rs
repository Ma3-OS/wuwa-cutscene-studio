use sha2::{Digest, Sha256};
use std::fs::File;
use std::io::{self, Read};
use std::path::Path;
use crate::errors::AppError;

/// Verify the SHA-256 hash of a file against an expected hexadecimal string.
pub fn verify_sha256(path: &Path, expected_hex: &str) -> Result<(), AppError> {
    if !path.exists() {
        return Err(AppError::NotFound(path.display().to_string()));
    }

    let mut file = File::open(path)?;
    let mut hasher = Sha256::new();
    let mut buffer = [0u8; 65536];

    loop {
        let bytes_read = file.read(&mut buffer)?;
        if bytes_read == 0 {
            break;
        }
        hasher.update(&buffer[..bytes_read]);
    }

    let calculated = format!("{:x}", hasher.finalize());
    if !calculated.eq_ignore_ascii_case(expected_hex) {
        return Err(AppError::ChecksumMismatch {
            expected: expected_hex.to_string(),
            calculated,
        });
    }

    Ok(())
}

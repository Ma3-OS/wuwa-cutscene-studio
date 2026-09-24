use serde::Serialize;
use thiserror::Error;

#[derive(Error, Debug)]
pub enum AppError {
    #[error("I/O failure: {0}")]
    Io(#[from] std::io::Error),

    #[error("Subprocess execution failed: {command} - {reason}")]
    Process { command: String, reason: String },

    #[error("File integrity check failed: expected {expected}, calculated {calculated}")]
    ChecksumMismatch { expected: String, calculated: String },

    #[error("Security violation: {0}")]
    SecurityViolation(String),

    #[error("Resource not found: {0}")]
    NotFound(String),

    #[error("Task queue busy or full")]
    QueueFull,

    #[error("Internal error: {0}")]
    Internal(String),
}

#[derive(Serialize)]
pub struct ErrorResponse {
    pub code: String,
    pub message: String,
}

impl Serialize for AppError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        let res = ErrorResponse {
            code: match self {
                AppError::Io(_) => "IO_ERROR".into(),
                AppError::Process { .. } => "PROCESS_ERROR".into(),
                AppError::ChecksumMismatch { .. } => "CHECKSUM_ERROR".into(),
                AppError::SecurityViolation(_) => "SECURITY_VIOLATION".into(),
                AppError::NotFound(_) => "NOT_FOUND".into(),
                AppError::QueueFull => "QUEUE_FULL".into(),
                AppError::Internal(_) => "INTERNAL_ERROR".into(),
            },
            message: self.to_string(),
        };
        res.serialize(serializer)
    }
}

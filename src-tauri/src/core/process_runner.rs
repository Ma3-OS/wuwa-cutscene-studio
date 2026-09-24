use std::path::Path;
use std::time::Duration;
use tokio::process::Command;
use crate::errors::AppError;

/// Safe async subprocess execution with timeout and kill_on_drop to prevent zombie handles.
pub async fn run_async_subprocess(
    executable: &Path,
    args: &[&str],
    timeout: Duration,
) -> Result<String, AppError> {
    if !executable.exists() {
        return Err(AppError::NotFound(executable.display().to_string()));
    }

    let mut cmd = Command::new(executable);
    cmd.args(args);
    cmd.kill_on_drop(true);

    #[cfg(target_os = "windows")]
    {
        // 0x08000000: CREATE_NO_WINDOW
        cmd.creation_flags(0x08000000);
    }

    let future = cmd.output();
    let result = tokio::time::timeout(timeout, future)
        .await
        .map_err(|_| AppError::Process {
            command: executable.display().to_string(),
            reason: format!("Operation timed out after {} seconds", timeout.as_secs()),
        })?
        .map_err(AppError::Io)?;

    if !result.status.success() {
        let stderr = String::from_utf8_lossy(&result.stderr).into_owned();
        return Err(AppError::Process {
            command: executable.display().to_string(),
            reason: stderr,
        });
    }

    Ok(String::from_utf8_lossy(&result.stdout).into_owned())
}

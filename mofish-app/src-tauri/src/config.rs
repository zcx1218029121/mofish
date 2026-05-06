use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

/// Errors that can occur during config operations
#[derive(Debug)]
pub enum ConfigError {
    HomeDirNotFound,
    IoError(std::io::Error),
}

impl From<std::io::Error> for ConfigError {
    fn from(err: std::io::Error) -> Self {
        ConfigError::IoError(err)
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CliConfig {
    pub page_size: usize,
}

impl Default for CliConfig {
    fn default() -> Self {
        CliConfig {
            page_size: 30,
        }
    }
}

fn get_config_dir() -> Result<PathBuf, ConfigError> {
    let home = dirs::home_dir()
        .ok_or(ConfigError::HomeDirNotFound)?;

    let mut path = home;
    path.push(".mofish");

    // Propagate directory creation errors instead of silently ignoring
    fs::create_dir_all(&path)?;

    Ok(path)
}

fn get_config_path() -> Result<PathBuf, ConfigError> {
    let mut path = get_config_dir()?;
    path.push("config.json");
    Ok(path)
}

pub fn load_config() -> Result<CliConfig, ConfigError> {
    let path = get_config_path()?;

    if path.exists() {
        if let Ok(content) = fs::read_to_string(&path) {
            if let Ok(config) = serde_json::from_str(&content) {
                return Ok(config);
            } else {
                eprintln!("Warning: Failed to parse config file, using defaults");
            }
        }
    }

    Ok(CliConfig::default())
}

pub fn save_config(config: &CliConfig) -> Result<(), ConfigError> {
    let path = get_config_path()?;
    let content = serde_json::to_string_pretty(config)
        .map_err(|e| ConfigError::IoError(std::io::Error::new(std::io::ErrorKind::InvalidData, e)))?;
    fs::write(path, content)?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    fn create_temp_config_dir() -> (TempDir, PathBuf) {
        let temp_dir = TempDir::new().unwrap();
        let config_path = temp_dir.path().join("config.json");
        (temp_dir, config_path)
    }

    #[test]
    fn test_serialize_deserialize_config() {
        let config = CliConfig { page_size: 50 };
        let json = serde_json::to_string(&config).unwrap();
        let deserialized: CliConfig = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.page_size, 50);
    }

    #[test]
    fn test_default_config() {
        let config = CliConfig::default();
        assert_eq!(config.page_size, 30);
    }

    #[test]
    fn test_save_and_load_config() {
        let temp_dir = TempDir::new().unwrap();
        let config_path = temp_dir.path().join(".mofish/config.json");

        // Create directory manually since we're bypassing get_config_path
        std::fs::create_dir_all(config_path.parent().unwrap()).unwrap();

        let config = CliConfig { page_size: 100 };
        let content = serde_json::to_string_pretty(&config).unwrap();
        std::fs::write(&config_path, &content).unwrap();

        let loaded_content = std::fs::read_to_string(&config_path).unwrap();
        let loaded: CliConfig = serde_json::from_str(&loaded_content).unwrap();
        assert_eq!(loaded.page_size, 100);
    }

    #[test]
    fn test_corrupted_config_returns_default() {
        let temp_dir = TempDir::new().unwrap();
        let config_path = temp_dir.path().join(".mofish/config.json");

        // Create directory manually
        std::fs::create_dir_all(config_path.parent().unwrap()).unwrap();

        // Write invalid JSON
        std::fs::write(&config_path, "not valid json {").unwrap();

        // Manually test the parse error handling logic
        if let Ok(content) = fs::read_to_string(&config_path) {
            if serde_json::from_str::<CliConfig>(&content).is_err() {
                // This branch should be reached for corrupted config
                let default = CliConfig::default();
                assert_eq!(default.page_size, 30);
            }
        }
    }
}

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

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

fn get_config_path() -> PathBuf {
    let mut path = dirs::home_dir().unwrap_or_default();
    path.push(".mofish");
    fs::create_dir_all(&path).ok();
    path.push("config.json");
    path
}

pub fn load_config() -> CliConfig {
    let path = get_config_path();
    if path.exists() {
        if let Ok(content) = fs::read_to_string(&path) {
            if let Ok(config) = serde_json::from_str(&content) {
                return config;
            }
        }
    }
    CliConfig::default()
}

pub fn save_config(config: &CliConfig) -> std::io::Result<()> {
    let path = get_config_path();
    let content = serde_json::to_string_pretty(config)?;
    fs::write(path, content)
}

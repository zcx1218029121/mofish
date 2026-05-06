#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::env;

fn main() {
    let args: Vec<String> = env::args().collect();

    // 检查是否是 CLI 模式
    if args.len() >= 2 && args[1] == "cli" {
        // CLI 模式：直接运行 CLI 命令
        mofish_lib::run_cli();
    } else {
        // Bubble 模式：启动 Tauri 窗口
        mofish_lib::run();
    }
}

mod commands;
mod clipboard;
mod error;
mod settings;
mod state;
mod thumbnail;
mod trust;
mod vault;
mod vault_manager;
mod vault_registry;
mod watcher;

use state::AppState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let log_plugin = {
        use tauri_plugin_log::{Builder, Target, TargetKind};
        let mut builder = Builder::new()
            .target(Target::new(TargetKind::Stdout))
            .target(Target::new(TargetKind::LogDir { file_name: None }))
            .target(Target::new(TargetKind::Webview));
        if cfg!(debug_assertions) {
            builder = builder.level(log::LevelFilter::Debug);
        } else {
            builder = builder.level(log::LevelFilter::Info);
        }
        builder.build()
    };

    tauri::Builder::default()
        .plugin(log_plugin)
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .manage(AppState::new())
        .invoke_handler(tauri::generate_handler![
            commands::vault::open_vault,
            commands::vault::close_vault,
            commands::vault::get_vault_info,
            commands::vault::list_open_vaults,
            commands::vault::set_active_vault,
            commands::vault::path_exists,
            commands::vault::default_sample_vault_path,
            commands::vault::create_dir,
            commands::vault::is_path_trusted,
            commands::vault::trust_path,
            commands::fs::list_files,
            commands::fs::read_file,
            commands::fs::write_file,
            commands::fs::create_file,
            commands::fs::create_folder,
            commands::fs::rename_entry,
            commands::fs::delete_entry,
            commands::fs::save_asset,
            commands::fs::abs_path,
            commands::fs::is_current_vault_trusted,
            commands::fs::trust_current_vault,
            commands::fs::reveal_in_system,
            commands::fs::get_thumbnail,
            commands::fs::load_property_types,
            commands::fs::save_property_types,
            commands::fs::workspace_load,
            commands::fs::workspace_save,
            commands::fs::vault_settings_load,
            commands::fs::vault_settings_save,
            vault_registry::vault_registry_load,
            vault_registry::vault_registry_save,
            vault_registry::vault_registry_remove,
            vault_registry::vault_registry_clear,
            vault_registry::vault_registry_clear_closed,
            clipboard::copy_text,
            settings::settings_load,
            settings::settings_save,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

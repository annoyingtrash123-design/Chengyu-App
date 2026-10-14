//! Tauri shell. All logic lives in `chengyu-core`; the UI calls the single
//! `api` command, which forwards to `App::dispatch`.

use std::sync::Mutex;

use chengyu_core::App;
use serde_json::Value;
use tauri::{Manager, State};

#[tauri::command]
fn api(state: State<'_, Mutex<App>>, cmd: String, args: Value) -> Result<Value, String> {
    let mut app = state.lock().map_err(|_| "app state poisoned".to_string())?;
    app.dispatch(&cmd, &args)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_notification::init())
        .setup(|app| {
            let save = app.path().app_data_dir()?.join("progress.json");
            app.manage(Mutex::new(App::new(Some(save))));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![api])
        .run(tauri::generate_context!())
        .expect("error while running the Chengyu app");
}

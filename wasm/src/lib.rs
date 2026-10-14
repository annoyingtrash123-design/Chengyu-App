//! WebAssembly wrapper for the web (PWA) build. The UI calls `dispatch` exactly as
//! the Tauri shell does; progress is persisted by the page (localStorage), which
//! asks `take_changed()` after each call whether there is anything to save.

use chengyu_core::App;
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub struct Engine {
    app: App,
}

#[wasm_bindgen]
impl Engine {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Engine {
        Engine { app: App::new(None) }
    }

    /// Run a command with JSON arguments; returns the JSON result.
    pub fn dispatch(&mut self, cmd: &str, args: &str) -> Result<String, JsError> {
        let args: serde_json::Value =
            serde_json::from_str(if args.is_empty() { "{}" } else { args }).map_err(|e| JsError::new(&e.to_string()))?;
        let result = self.app.dispatch(cmd, &args).map_err(|e| JsError::new(&e))?;
        Ok(result.to_string())
    }

    /// True if user data changed since the last call (then reset).
    pub fn take_changed(&mut self) -> bool {
        std::mem::take(&mut self.app.changed)
    }
}

impl Default for Engine {
    fn default() -> Self {
        Self::new()
    }
}

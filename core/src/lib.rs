//! Core logic for the Chengyu dictionary app: data model, search, filters,
//! spaced repetition, quizzes, games and progress tracking.
//!
//! Everything here is plain Rust with no UI or platform code, so it is fully
//! unit-testable. The Tauri shell (`app/src-tauri`) and the browser dev
//! server (`devserver`) both talk to it through [`app::App::dispatch`].

pub mod app;
pub mod dictionary;
pub mod games;
pub mod model;
pub mod pinyin;
pub mod quiz;
pub mod rng;
pub mod srs;
pub mod user;
pub mod validate;

pub use app::App;
pub use dictionary::{Dictionary, Filters};
pub use model::Entry;

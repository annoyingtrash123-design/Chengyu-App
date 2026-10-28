//! Merges every `data/entries/*.json` file (each a JSON array of entries)
//! into a single array that is embedded into the binary, deflate-compressed (about a third
//! of the size; the app download is mostly this data).

use std::{env, fs, path::Path};

fn main() {
    let data_dir = Path::new(env!("CARGO_MANIFEST_DIR")).join("../data");
    let entries_dir = data_dir.join("entries");
    println!("cargo:rerun-if-changed={}", entries_dir.display());
    println!("cargo:rerun-if-changed={}", data_dir.join("themes.json").display());

    let mut files: Vec<_> = fs::read_dir(&entries_dir)
        .expect("data/entries directory missing")
        .filter_map(|e| e.ok().map(|e| e.path()))
        .filter(|p| p.extension().is_some_and(|x| x == "json"))
        .collect();
    files.sort();

    let mut all = Vec::new();
    for path in files {
        println!("cargo:rerun-if-changed={}", path.display());
        let text = fs::read_to_string(&path).unwrap();
        let value: serde_json::Value = serde_json::from_str(&text)
            .unwrap_or_else(|e| panic!("{}: invalid JSON: {e}", path.display()));
        match value {
            serde_json::Value::Array(items) => all.extend(items),
            _ => panic!("{}: expected a JSON array of entries", path.display()),
        }
    }

    let out = Path::new(&env::var("OUT_DIR").unwrap()).join("entries.json.deflate");
    let json = serde_json::to_string(&all).unwrap();
    fs::write(out, miniz_oxide::deflate::compress_to_vec(json.as_bytes(), 9)).unwrap();
}

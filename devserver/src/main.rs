//! Browser dev server: exposes `App::dispatch` over HTTP so the UI can be
//! developed and tested in a normal browser with the real Rust logic.
//! Vite proxies `POST /api/<command>` here. Not shipped in the app.
//!
//! Usage: `cargo run -p chengyu-devserver [port] [save-file]`

use std::io::{BufRead, BufReader, Read, Write};
use std::net::{TcpListener, TcpStream};
use std::path::PathBuf;

use chengyu_core::App;
use serde_json::{json, Value};

fn handle(stream: &mut TcpStream, app: &mut App) -> std::io::Result<()> {
    let mut reader = BufReader::new(stream.try_clone()?);
    let mut request_line = String::new();
    reader.read_line(&mut request_line)?;
    let mut content_length = 0;
    loop {
        let mut line = String::new();
        reader.read_line(&mut line)?;
        let line = line.trim();
        if line.is_empty() {
            break;
        }
        if let Some((k, v)) = line.split_once(':') {
            if k.eq_ignore_ascii_case("content-length") {
                content_length = v.trim().parse().unwrap_or(0);
            }
        }
    }
    let mut body = vec![0; content_length];
    reader.read_exact(&mut body)?;

    let path = request_line.split_whitespace().nth(1).unwrap_or("/");
    let (status, response) = match path.strip_prefix("/api/") {
        Some(cmd) => {
            let args: Value = serde_json::from_slice(&body).unwrap_or(json!({}));
            match app.dispatch(cmd, &args) {
                Ok(v) => ("200 OK", json!({ "ok": v })),
                Err(e) => ("200 OK", json!({ "error": e })),
            }
        }
        None => ("404 Not Found", json!({ "error": "not found" })),
    };
    let body = response.to_string();
    write!(
        stream,
        "HTTP/1.1 {status}\r\nContent-Type: application/json; charset=utf-8\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",
        body.len()
    )
}

fn main() {
    let mut args = std::env::args().skip(1);
    let port = args.next().unwrap_or_else(|| "8787".into());
    let save = args.next().map(PathBuf::from);
    let mut app = App::new(save);
    let listener = TcpListener::bind(format!("127.0.0.1:{port}")).expect("cannot bind port");
    println!("chengyu dev server on http://127.0.0.1:{port} ({} entries)", app.dict.len());
    for stream in listener.incoming().flatten() {
        let mut stream = stream;
        if let Err(e) = handle(&mut stream, &mut app) {
            eprintln!("request failed: {e}");
        }
    }
}

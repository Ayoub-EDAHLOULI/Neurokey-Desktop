// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use axum::{
    extract::State,
    http::{HeaderMap, StatusCode},
    routing::{get, post},
    Json, Router,
};
use local_ip_address::local_ip;
use serde::Deserialize;
use serde_json::{json, Value};
use std::net::SocketAddr;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter, Manager};

const SYNC_PORT: u16 = 8080;
/// A QR code is only valid for a few minutes, and for a single sync.
const SESSION_TTL: Duration = Duration::from_secs(5 * 60);

/// One pairing session, created when the Sync screen shows a QR code.
///
/// The Rust side never sees vault plaintext or the session key: React encrypts the
/// desktop vault with the key embedded in the QR code and hands us an opaque blob.
/// The phone proves it scanned the QR by sending the session id, and its payload is
/// encrypted + authenticated with the same key (checked again in React).
struct SyncSession {
    sid: String,
    desktop_payload: String,
    expires_at: Instant,
}

type SharedSession = Arc<Mutex<Option<SyncSession>>>;
struct SyncState(SharedSession);

#[tauri::command]
fn get_sync_connection_string() -> Result<String, String> {
    match local_ip() {
        Ok(ip) => Ok(format!("http://{}:{}", ip, SYNC_PORT)),
        Err(e) => Err(format!("Could not get local IP: {}", e)),
    }
}

/// React calls this right before showing a QR code.
#[tauri::command]
fn start_sync_session(sid: String, payload: String, state: tauri::State<SyncState>) {
    *state.0.lock().unwrap() = Some(SyncSession {
        sid,
        desktop_payload: payload,
        expires_at: Instant::now() + SESSION_TTL,
    });
}

/// Called when the Sync screen closes: no QR on screen means nobody can sync.
#[tauri::command]
fn cancel_sync_session(state: tauri::State<SyncState>) {
    *state.0.lock().unwrap() = None;
}

/// Compares secrets without exiting early on the first differing byte.
fn constant_time_eq(a: &[u8], b: &[u8]) -> bool {
    a.len() == b.len() && a.iter().zip(b).fold(0u8, |acc, (x, y)| acc | (x ^ y)) == 0
}

#[derive(Deserialize)]
struct SyncRequest {
    payload: String,
}

async fn handle_sync_data(
    State((app, session)): State<(AppHandle, SharedSession)>,
    headers: HeaderMap,
    Json(body): Json<SyncRequest>,
) -> (StatusCode, Json<Value>) {
    let presented = headers
        .get("x-neurokey-session")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("");

    // Take the session out: it can be used exactly once.
    let active = {
        let mut guard = session.lock().unwrap();
        match guard.as_ref() {
            Some(s)
                if Instant::now() < s.expires_at
                    && constant_time_eq(s.sid.as_bytes(), presented.as_bytes()) =>
            {
                guard.take()
            }
            _ => None,
        }
    };

    let Some(active) = active else {
        return (
            StatusCode::UNAUTHORIZED,
            Json(json!({ "status": "error", "message": "No active sync session." })),
        );
    };

    // React decrypts and verifies the phone's payload with the session key.
    let _ = app.emit("vault-sync-received", json!({ "payload": body.payload }));

    (
        StatusCode::OK,
        Json(json!({ "status": "success", "payload": active.desktop_payload })),
    )
}

/// Local network server. Without an active session (QR on screen) it rejects every sync.
/// No CORS layer on purpose: web pages in a browser must not be able to call it.
async fn start_local_server(app_handle: AppHandle, session: SharedSession) {
    let app = Router::new()
        .route(
            "/ping",
            get(|| async { Json(json!({ "status": "NeuroKey Desktop is ready!" })) }),
        )
        .route("/sync", post(handle_sync_data))
        .with_state((app_handle, session));

    let addr = SocketAddr::from(([0, 0, 0, 0], SYNC_PORT));
    match tokio::net::TcpListener::bind(addr).await {
        Ok(listener) => {
            println!("Sync server listening on {}", addr);
            if let Err(e) = axum::serve(listener, app).await {
                eprintln!("Sync server stopped: {}", e);
            }
        }
        Err(e) => eprintln!("Could not start sync server on {}: {}", addr, e),
    }
}

/// The app identifier changed from `com.a.neurokey-desktop` to `app.neurokey.desktop`,
/// which moves the app data folder. Bring an existing vault over before the store loads it.
fn migrate_old_vault(app: &AppHandle) {
    let Ok(new_dir) = app.path().app_data_dir() else { return };
    let Some(parent) = new_dir.parent() else { return };
    let old_file = parent.join("com.a.neurokey-desktop").join("neurokey_secure.dat");
    let new_file = new_dir.join("neurokey_secure.dat");

    if !old_file.exists() || new_file.exists() {
        return;
    }

    // Copy, don't move: the old file stays as a backup.
    // Copy to a temp file first so a half-written vault is never picked up.
    let tmp_file = new_dir.join("neurokey_secure.dat.migrating");
    let result = std::fs::create_dir_all(&new_dir)
        .and_then(|_| std::fs::copy(&old_file, &tmp_file))
        .and_then(|_| std::fs::rename(&tmp_file, &new_file));
    if let Err(e) = result {
        let _ = std::fs::remove_file(&tmp_file);
        eprintln!("Vault migration from {} failed: {}", old_file.display(), e);
    }
}

fn main() {
    let session: SharedSession = Arc::new(Mutex::new(None));

    tauri::Builder::default()
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_store::Builder::new().build())
        .manage(SyncState(session.clone()))
        .setup(|app| {
            migrate_old_vault(app.handle());

            let app_handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                start_local_server(app_handle, session).await;
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_sync_connection_string,
            start_sync_session,
            cancel_sync_session
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

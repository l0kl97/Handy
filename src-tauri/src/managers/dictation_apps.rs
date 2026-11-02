//! Which app a dictation was made in (Terminal, Slack, …), shown in history.
//!
//! Kept in its own table (`dictation_apps`, keyed by history id) rather than as
//! a new column on `transcription_history`, so this fork touches upstream's
//! schema and `HistoryEntry` as little as possible. Created idempotently, like
//! the dictation stats. Rows of pruned or deleted entries are left behind on
//! purpose: history ids are AUTOINCREMENT and never reused, so a leftover can
//! never attach to another entry, and it saves hooking upstream's deletes.

use anyhow::Result;
use rusqlite::{params, Connection};
use serde::Serialize;
use specta::Type;

/// The app a history entry was dictated into.
#[derive(Debug, Clone, Serialize, Type, PartialEq)]
pub struct DictationApp {
    pub history_id: i64,
    pub app_name: String,
}

pub fn ensure_table(conn: &Connection) -> Result<()> {
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS dictation_apps (
            history_id INTEGER PRIMARY KEY,
            app_name TEXT NOT NULL,
            bundle_id TEXT
        );",
    )?;
    Ok(())
}

/// Stores the app for a history entry. Empty names are ignored.
pub fn record_with_conn(
    conn: &Connection,
    history_id: i64,
    app_name: &str,
    bundle_id: Option<&str>,
) -> Result<()> {
    let name = app_name.trim();
    if name.is_empty() {
        return Ok(());
    }
    conn.execute(
        "INSERT INTO dictation_apps (history_id, app_name, bundle_id) VALUES (?1, ?2, ?3)
         ON CONFLICT(history_id) DO UPDATE SET app_name = excluded.app_name,
                                               bundle_id = excluded.bundle_id",
        params![history_id, name, bundle_id],
    )?;
    Ok(())
}

/// Apps for every entry that has one.
pub fn all_with_conn(conn: &Connection) -> Result<Vec<DictationApp>> {
    let mut stmt = conn.prepare("SELECT history_id, app_name FROM dictation_apps")?;
    let rows = stmt
        .query_map([], |row| {
            Ok(DictationApp {
                history_id: row.get(0)?,
                app_name: row.get(1)?,
            })
        })?
        .collect::<std::result::Result<Vec<_>, _>>()?;
    Ok(rows)
}

/// The app in front right now, as (name, bundle id). `None` when it can't be
/// told, or when it is Handy itself (e.g. a dictation into Handy's own window).
pub fn frontmost_app() -> Option<(String, Option<String>)> {
    #[cfg(target_os = "macos")]
    {
        use objc2_app_kit::NSWorkspace;
        let app = NSWorkspace::sharedWorkspace().frontmostApplication()?;
        let name = app.localizedName()?.to_string();
        let bundle = app.bundleIdentifier().map(|b| b.to_string());
        if is_own_app(bundle.as_deref()) {
            return None;
        }
        Some((name, bundle))
    }
    #[cfg(not(target_os = "macos"))]
    {
        None
    }
}

fn is_own_app(bundle_id: Option<&str>) -> bool {
    bundle_id == Some("com.pais.handy")
}

#[cfg(test)]
mod tests {
    use super::*;

    fn conn() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        ensure_table(&conn).unwrap();
        conn
    }

    #[test]
    fn records_and_lists_apps() {
        let conn = conn();
        record_with_conn(&conn, 1, "Slack", Some("com.tinyspeck.slackmacgap")).unwrap();
        record_with_conn(&conn, 2, "Terminal", None).unwrap();
        let mut all = all_with_conn(&conn).unwrap();
        all.sort_by_key(|a| a.history_id);
        assert_eq!(
            all,
            vec![
                DictationApp {
                    history_id: 1,
                    app_name: "Slack".into()
                },
                DictationApp {
                    history_id: 2,
                    app_name: "Terminal".into()
                },
            ]
        );
    }

    #[test]
    fn ignores_empty_names_and_trims() {
        let conn = conn();
        record_with_conn(&conn, 1, "   ", None).unwrap();
        record_with_conn(&conn, 2, "  Notes ", None).unwrap();
        assert_eq!(
            all_with_conn(&conn).unwrap(),
            vec![DictationApp {
                history_id: 2,
                app_name: "Notes".into()
            }]
        );
    }

    #[test]
    fn re_recording_replaces() {
        let conn = conn();
        record_with_conn(&conn, 1, "Mail", None).unwrap();
        record_with_conn(&conn, 1, "Safari", None).unwrap();
        let all = all_with_conn(&conn).unwrap();
        assert_eq!(all.len(), 1);
        assert_eq!(all[0].app_name, "Safari");
    }

    #[test]
    fn ensure_table_is_idempotent() {
        let conn = conn();
        record_with_conn(&conn, 1, "Mail", None).unwrap();
        ensure_table(&conn).unwrap();
        assert_eq!(all_with_conn(&conn).unwrap().len(), 1);
    }

    #[test]
    fn handy_itself_is_not_an_app_context() {
        assert!(is_own_app(Some("com.pais.handy")));
        assert!(!is_own_app(Some("com.apple.Terminal")));
        assert!(!is_own_app(None));
    }
}

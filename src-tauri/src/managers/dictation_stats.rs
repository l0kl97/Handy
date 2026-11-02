//! Dictation statistics: how many words were dictated, and when.
//!
//! Lives in its own table (`dictation_words`) inside history.db because the
//! history itself is pruned (the default keeps only 5 entries), and stats
//! should cover everything ever dictated. Deleting a history entry does not
//! remove its words from the stats.
//!
//! The table is created with `CREATE TABLE IF NOT EXISTS` rather than as a
//! numbered migration, so it never collides with upstream Handy's migrations
//! (this is a fork) and a released build that does not know it simply ignores
//! it. On creation it is backfilled from the dictations still in the history.

use anyhow::Result;
use log::info;
use rusqlite::{params, Connection};
use serde::Serialize;
use specta::Type;

/// One dictation's word count at a moment (Unix seconds, UTC).
#[derive(Debug, Clone, Serialize, Type, PartialEq)]
pub struct DictationWords {
    pub timestamp: i64,
    pub words: u32,
}

const TABLE: &str = "dictation_words";

/// Creates the stats table if needed. When it is new, backfills it from the
/// dictations already in `transcription_history` (files are not dictations).
pub fn ensure_table(conn: &Connection) -> Result<()> {
    let exists: bool = conn.query_row(
        "SELECT COUNT(*) > 0 FROM sqlite_master WHERE type = 'table' AND name = ?1",
        [TABLE],
        |row| row.get(0),
    )?;
    if exists {
        return Ok(());
    }

    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS dictation_words (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp INTEGER NOT NULL,
            words INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS dictation_words_timestamp
            ON dictation_words (timestamp);",
    )?;

    let mut stmt = conn.prepare(
        "SELECT timestamp, transcription_text, post_processed_text
         FROM transcription_history
         WHERE source_name IS NULL",
    )?;
    let rows = stmt
        .query_map([], |row| {
            Ok((
                row.get::<_, i64>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, Option<String>>(2)?,
            ))
        })?
        .collect::<std::result::Result<Vec<_>, _>>()?;

    let mut backfilled = 0;
    for (timestamp, text, post_processed) in rows {
        let words = count_words(delivered_text(&text, post_processed.as_deref()));
        if words > 0 {
            record_with_conn(conn, timestamp, words)?;
            backfilled += 1;
        }
    }
    info!("Created dictation stats; backfilled {backfilled} dictation(s) from history");
    Ok(())
}

/// The text the user actually got: the post-processed version when there is
/// one, otherwise the raw transcription.
pub fn delivered_text<'a>(transcription: &'a str, post_processed: Option<&'a str>) -> &'a str {
    match post_processed {
        Some(p) if !p.trim().is_empty() => p,
        _ => transcription,
    }
}

/// Counts words. Whitespace separates words; in scripts written without
/// spaces (Chinese, Japanese) each character counts as a word, which is the
/// usual convention for those languages.
pub fn count_words(text: &str) -> u32 {
    let mut words: u32 = 0;
    for token in text.split_whitespace() {
        let cjk = token.chars().filter(|c| is_cjk(*c)).count() as u32;
        let has_other = token.chars().any(|c| c.is_alphanumeric() && !is_cjk(c));
        words = words.saturating_add(cjk + u32::from(has_other));
    }
    words
}

fn is_cjk(c: char) -> bool {
    matches!(c as u32,
        0x3040..=0x30FF   // Hiragana, Katakana
        | 0x3400..=0x4DBF // CJK Extension A
        | 0x4E00..=0x9FFF // CJK Unified Ideographs
        | 0xF900..=0xFAFF // CJK Compatibility Ideographs
    )
}

/// Records a dictation. Zero-word dictations are not stored.
pub fn record_with_conn(conn: &Connection, timestamp: i64, words: u32) -> Result<()> {
    if words == 0 {
        return Ok(());
    }
    conn.execute(
        "INSERT INTO dictation_words (timestamp, words) VALUES (?1, ?2)",
        params![timestamp, words],
    )?;
    Ok(())
}

/// Every recorded dictation, oldest first.
pub fn all_with_conn(conn: &Connection) -> Result<Vec<DictationWords>> {
    let mut stmt =
        conn.prepare("SELECT timestamp, words FROM dictation_words ORDER BY timestamp ASC")?;
    let rows = stmt
        .query_map([], |row| {
            Ok(DictationWords {
                timestamp: row.get(0)?,
                words: row.get(1)?,
            })
        })?
        .collect::<std::result::Result<Vec<_>, _>>()?;
    Ok(rows)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn history_conn() -> Connection {
        let conn = Connection::open_in_memory().expect("open in-memory db");
        conn.execute_batch(
            "CREATE TABLE transcription_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                file_name TEXT NOT NULL,
                timestamp INTEGER NOT NULL,
                saved BOOLEAN NOT NULL DEFAULT 0,
                title TEXT NOT NULL,
                transcription_text TEXT NOT NULL,
                post_processed_text TEXT,
                source_name TEXT
            );",
        )
        .expect("create history table");
        conn
    }

    fn add(conn: &Connection, ts: i64, text: &str, post: Option<&str>, source: Option<&str>) {
        conn.execute(
            "INSERT INTO transcription_history
                (file_name, timestamp, title, transcription_text, post_processed_text, source_name)
             VALUES ('a.wav', ?1, 't', ?2, ?3, ?4)",
            params![ts, text, post, source],
        )
        .expect("insert history row");
    }

    #[test]
    fn counts_words_across_whitespace_and_punctuation() {
        assert_eq!(count_words("Hallo Welt, wie geht's?"), 4);
        assert_eq!(count_words("  spaced   out\nlines\t"), 3);
    }

    #[test]
    fn empty_and_punctuation_only_text_has_no_words() {
        assert_eq!(count_words(""), 0);
        assert_eq!(count_words("   \n\t "), 0);
        assert_eq!(count_words("... — !"), 0);
    }

    #[test]
    fn counts_each_cjk_character_as_a_word() {
        assert_eq!(count_words("你好世界"), 4);
        assert_eq!(count_words("こんにちは"), 5);
        assert_eq!(count_words("Handy 很好"), 3);
    }

    #[test]
    fn prefers_non_empty_post_processed_text() {
        assert_eq!(
            delivered_text("raw", Some("polished text")),
            "polished text"
        );
        assert_eq!(delivered_text("raw", Some("   ")), "raw");
        assert_eq!(delivered_text("raw", None), "raw");
    }

    #[test]
    fn backfills_dictations_but_not_files_or_empty_ones() {
        let conn = history_conn();
        add(&conn, 100, "eins zwei drei", None, None);
        add(
            &conn,
            200,
            "raw words here",
            Some("five polished words right here"),
            None,
        );
        add(
            &conn,
            300,
            "a very long file transcript",
            None,
            Some("meeting.mp3"),
        );
        add(&conn, 400, "", None, None);

        ensure_table(&conn).expect("create stats table");

        assert_eq!(
            all_with_conn(&conn).unwrap(),
            vec![
                DictationWords {
                    timestamp: 100,
                    words: 3
                },
                DictationWords {
                    timestamp: 200,
                    words: 5
                },
            ]
        );
    }

    #[test]
    fn ensure_table_is_idempotent_and_never_backfills_twice() {
        let conn = history_conn();
        add(&conn, 100, "eins zwei", None, None);
        ensure_table(&conn).unwrap();
        ensure_table(&conn).unwrap();
        assert_eq!(all_with_conn(&conn).unwrap().len(), 1);
    }

    #[test]
    fn stats_survive_history_pruning() {
        let conn = history_conn();
        ensure_table(&conn).unwrap();
        record_with_conn(&conn, 500, 7).unwrap();
        conn.execute("DELETE FROM transcription_history", [])
            .unwrap();
        assert_eq!(
            all_with_conn(&conn).unwrap(),
            vec![DictationWords {
                timestamp: 500,
                words: 7
            }]
        );
    }

    #[test]
    fn zero_word_dictations_are_not_recorded() {
        let conn = history_conn();
        ensure_table(&conn).unwrap();
        record_with_conn(&conn, 1, 0).unwrap();
        assert!(all_with_conn(&conn).unwrap().is_empty());
    }
}

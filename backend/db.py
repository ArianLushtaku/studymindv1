"""SQLite cache for generated content + topics registry."""
import sqlite3
import os
import json
from datetime import datetime

DB_PATH = os.path.join(os.path.dirname(__file__), 'studymind.db')


def get_conn():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    with get_conn() as conn:
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS topics (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                subject TEXT NOT NULL,
                topic_name TEXT NOT NULL,
                filename TEXT,
                ingested_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(subject, topic_name)
            );

            CREATE TABLE IF NOT EXISTS content_cache (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                subject TEXT NOT NULL,
                topic TEXT NOT NULL,
                content_type TEXT NOT NULL,
                data_json TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(subject, topic, content_type)
            );
        """)


def register_topic(subject: str, topic_name: str, filename: str = None):
    with get_conn() as conn:
        conn.execute(
            "INSERT OR IGNORE INTO topics (subject, topic_name, filename) VALUES (?, ?, ?)",
            (subject, topic_name, filename)
        )


def get_topics(subject: str) -> list[dict]:
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT topic_name, filename FROM topics WHERE subject = ? ORDER BY topic_name",
            (subject,)
        ).fetchall()
    return [dict(r) for r in rows]


def get_cached(subject: str, topic: str, content_type: str) -> dict | None:
    with get_conn() as conn:
        row = conn.execute(
            "SELECT data_json FROM content_cache WHERE subject=? AND topic=? AND content_type=?",
            (subject, topic, content_type)
        ).fetchone()
    if row:
        return json.loads(row['data_json'])
    return None


def set_cached(subject: str, topic: str, content_type: str, data: dict):
    with get_conn() as conn:
        conn.execute(
            """INSERT INTO content_cache (subject, topic, content_type, data_json)
               VALUES (?, ?, ?, ?)
               ON CONFLICT(subject, topic, content_type)
               DO UPDATE SET data_json=excluded.data_json, created_at=CURRENT_TIMESTAMP""",
            (subject, topic, content_type, json.dumps(data, ensure_ascii=False))
        )


init_db()

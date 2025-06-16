"""
Database & translation utility for LingoFlow backend.
Handles SQLite connections and simple language data operations.
"""

import sqlite3
import os
from typing import List, Dict

DB_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "translationapp_db", "myapp.db")

def get_db_connection():
    """Connect to the SQLite database (translationapp_db/myapp.db)"""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

# PUBLIC_INTERFACE
def get_supported_languages() -> List[Dict[str, str]]:
    """Fetch supported languages from supported_languages table."""
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT code, name FROM supported_languages")
        languages = [{"code": row["code"], "name": row["name"]} for row in cursor.fetchall()]
    except sqlite3.Error:
        languages = []
    finally:
        conn.close()
    return languages

# PUBLIC_INTERFACE
def detect_language_stub(text: str) -> str:
    """
    Basic stub for language detection.
    Returns "en" for mostly ascii, "es" for 'hola', "fr" for 'bonjour', else "en".
    Replace with AI/ML powered detection as needed.
    """
    text_lower = text.lower()
    if "hola" in text_lower:
        return "es"
    if "bonjour" in text_lower:
        return "fr"
    # Simplistic: ascii only = English
    try:
        text.encode("ascii")
        return "en"
    except UnicodeEncodeError:
        return "en"  # fallback: always English
    # Add more robust logic in real implementation

# PUBLIC_INTERFACE
def fake_translate(text: str, source: str, target: str) -> str:
    """
    Placeholder for translation - currently just echoes text with marker.
    Replace with real translation logic/AI model.
    """
    return f"[{source or 'auto'}→{target}] {text}"

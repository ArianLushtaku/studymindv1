#!/usr/bin/env python3
"""
Auto-ingest all itslearning slides into ChromaDB + register topics in SQLite.
Run after download.py pulls new files.

Usage:
  python3 auto_ingest.py
  python3 auto_ingest.py --force   # Re-ingest all (clears existing)
"""
import os
import sys
import re

# Run from backend dir
os.chdir(os.path.dirname(os.path.abspath(__file__)))

from io import BytesIO
from pypdf import PdfReader
from markitdown import MarkItDown
from rag.ingester import ingest
from rag.embedder import get_collection
import db

SLIDES_BASE = "/home/arikari/scripts/itslearning/files/CybF26A - PBA i Cybersikkerhed"

SUBJECT_DIRS = {
    'Programmering': os.path.join(SLIDES_BASE, 'Programmering'),
    'Computerarkitektur': os.path.join(SLIDES_BASE, 'Slides'),
    'Forretningsforståelse': os.path.join(SLIDES_BASE, 'Forretningsforståelse'),
}

BOOK_FILES = {
    'Forretningsforståelse': os.path.join(SLIDES_BASE, 'Forretningsforståelse', 'Cybersikkerhed_bog.pdf'),
}

SUPPORTED = {'.pdf', '.pptx', '.ppt', '.docx'}


def clean_topic_name(filename: str) -> str:
    """Convert filename to readable topic name."""
    name = os.path.splitext(filename)[0]
    # Remove leading number patterns like "01_", "02_", "1. ", "02_"
    name = re.sub(r'^\d+[_\.\s]+', '', name)
    # Replace underscores with spaces
    name = name.replace('_', ' ')
    # Remove trailing junk
    name = re.sub(r'\s*\(\d+\)\s*$', '', name)
    # Clean up extra spaces
    name = re.sub(r'\s+', ' ', name).strip()
    return name[:80]


def extract_text(filepath: str) -> str:
    ext = os.path.splitext(filepath)[1].lower()
    if ext in ('.pptx', '.ppt'):
        md = MarkItDown()
        result = md.convert(filepath, file_extension='.pptx')
        text = result.text_content
        # Clean up
        text = re.sub(r'<!--.*?-->', '', text)
        text = re.sub(r'\n{3,}', '\n\n', text)
        return text.strip()
    elif ext == '.pdf':
        reader = PdfReader(filepath)
        return '\n'.join(p.extract_text() or '' for p in reader.pages)
    return ''


def already_ingested(subject: str, topic: str) -> bool:
    topics = db.get_topics(subject)
    return any(t['topic_name'] == topic for t in topics)


def main():
    force = '--force' in sys.argv
    ingested = 0
    skipped = 0

    # Ingest slides per subject
    for subject, dir_path in SUBJECT_DIRS.items():
        if not os.path.isdir(dir_path):
            print(f"Dir not found: {dir_path}")
            continue

        for fname in sorted(os.listdir(dir_path)):
            ext = os.path.splitext(fname)[1].lower()
            if ext not in SUPPORTED:
                continue

            topic = clean_topic_name(fname)
            filepath = os.path.join(dir_path, fname)

            # Skip book file (handled separately)
            if fname == 'Cybersikkerhed_bog.pdf':
                continue

            if not force and already_ingested(subject, topic):
                skipped += 1
                continue

            print(f"  [{subject}] {topic}")
            try:
                text = extract_text(filepath)
                if not text.strip():
                    print(f"    No text extracted, skipping.")
                    continue
                result = ingest(text, subject, 'slides', topic=topic)
                db.register_topic(subject, topic, fname)
                print(f"    {result['chunks']} chunks")
                ingested += 1
            except Exception as e:
                print(f"    ERROR: {e}")

    # Ingest books
    for subject, book_path in BOOK_FILES.items():
        if not os.path.isfile(book_path):
            continue
        book_topic = '__book__'
        if not force and already_ingested(subject, book_topic):
            skipped += 1
            continue
        print(f"  [{subject}] Book: {os.path.basename(book_path)}")
        try:
            text = extract_text(book_path)
            result = ingest(text, subject, 'book', topic=book_topic)
            db.register_topic(subject, book_topic, os.path.basename(book_path))
            print(f"    {result['chunks']} chunks")
            ingested += 1
        except Exception as e:
            print(f"    ERROR: {e}")

    print(f"\nDone. Ingested: {ingested}, Skipped: {skipped}")


if __name__ == '__main__':
    main()

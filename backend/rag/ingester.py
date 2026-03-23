import uuid
from rag.embedder import embed_and_store

def ingest(text: str, subject: str, source: str) -> dict:
    doc_id = str(uuid.uuid4())
    chunk_count = embed_and_store(text, subject, source, doc_id)
    
    return {
        'doc_id': doc_id,
        'chunks': chunk_count,
        'subject': subject,
        'source': source
    }
import chromadb
from chromadb.utils.embedding_functions import DefaultEmbeddingFunction

chroma = chromadb.PersistentClient(path='./chroma_db')
ef = DefaultEmbeddingFunction()

def get_collection(subject: str):
    name = (subject.lower()
        .replace(' ', '_')
        .replace('å', 'aa')
        .replace('ø', 'oe')
        .replace('æ', 'ae'))
    return chroma.get_or_create_collection(name=name, embedding_function=ef)

def chunk_text(text: str, chunk_size: int = 500, overlap: int = 50) -> list[str]:
    words = text.split()
    chunks = []
    i = 0
    while i < len(words):
        chunk = ' '.join(words[i:i + chunk_size])
        chunks.append(chunk)
        i += chunk_size - overlap
    return chunks

def embed_and_store(text: str, subject: str, source: str, doc_id: str):
    collection = get_collection(subject)
    chunks = chunk_text(text)
    
    collection.add(
        documents=chunks,
        ids=[f'{doc_id}_chunk_{i}' for i in range(len(chunks))],
        metadatas=[{'source': source} for _ in chunks]
    )
    
    return len(chunks)
from rag.embedder import get_collection


def retrieve(query: str, subject: str, n_results: int = 5, topic: str = None) -> dict:
    collection = get_collection(subject)

    kwargs = {
        'query_texts': [query],
        'n_results': min(n_results, max(collection.count(), 1)),
        'include': ['documents', 'metadatas'],
    }
    if topic:
        kwargs['where'] = {'topic': topic}

    results = collection.query(**kwargs)

    slide_chunks = []
    book_chunks = []

    for doc, meta in zip(results['documents'][0], results['metadatas'][0]):
        if meta.get('source') == 'slides':
            slide_chunks.append(doc)
        else:
            book_chunks.append(doc)

    return {'slides': slide_chunks, 'book': book_chunks}


def get_collection_count(subject: str) -> int:
    return get_collection(subject).count()

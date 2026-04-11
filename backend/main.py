from flask import Flask, jsonify, request # type: ignore
from flask_cors import CORS # type: ignore
from pypdf import PdfReader # type: ignore
from io import BytesIO
from markitdown import MarkItDown # type: ignore
import re
import anthropic # type: ignore
from dotenv import load_dotenv # type: ignore
import os
from rag.ingester import ingest
from rag.retriever import retrieve, get_collection_count
import db


load_dotenv()
client = anthropic.Anthropic()
app = Flask(__name__)
app.config['JSON_AS_ASCII'] = False
CORS(app, origins=["http://localhost:5173", "http://127.0.0.1:5173", "https://www.cybsf26a.app", "https://cybsf26a.app"])

ALLOWED_ORIGINS = {"http://localhost:5173", "http://127.0.0.1:5173", "https://www.cybsf26a.app", "https://cybsf26a.app"}

def require_browser_origin():
    origin = request.headers.get("Origin") or request.headers.get("Referer", "")
    if not any(origin.startswith(allowed) for allowed in ALLOWED_ORIGINS):
        return jsonify({'message': 'Requests must originate from the web app'}), 403

SUBJECT_MAP = {
    'Programmering': 'programmering',
    'Forretningsforståelse': 'forretningsforstaelse',
    'Computerarkitektur': 'computerarkitektur',
    'General': 'general'
}
SUBJECTS_WITH_BOOK = ['Forretningsforståelse']

CONTENT_TYPES = {'mcq', 'flashcards', 'summary', 'concepts', 'tips', 'code'}

PROMPT_MAP = {
    'mcq': None,          # uses subject-specific prompt
    'code': None,         # uses subject-specific prompt
    'flashcards': 'flashcards',
    'summary': 'summary',
    'concepts': 'concepts',
    'tips': 'tips',
}


def clean_pptx_text(text):
    #Make it utf8
    text = re.sub(r'\\u([0-9a-fA-F]{4})', lambda m: chr(int(m.group(1), 16)), text)
    # Remove <!-- Slide number: X --> comments
    text = re.sub(r'<!--.*?-->', '', text)
    # Remove excessive blank lines
    text = re.sub(r'\n{3,}', '\n\n', text)
    text = re.sub(r'[^a-zA-Z0-9\sæøåÆØÅ]', '', text)
    text = re.sub(r' {2,}', ' ', text)
    text = re.sub(r'\n{2,}', '\n', text)
    lines = [line.strip() for line in text.splitlines()]
    text = '\n'.join(line for line in lines if line)  # also removes blank lines
    return text.strip()

def file_to_text(file):
    if file.filename.endswith('.pptx') or file.filename.endswith('.ppt'):
        md = MarkItDown()
        stream = BytesIO(file.read())
        stream.seek(0)
        result = md.convert(stream, file_extension='.pptx')
        return clean_pptx_text(result.text_content)
    elif file.filename.endswith('.pdf'):
        reader = PdfReader(file)
        print(len(reader.pages))

        text = ''
        for page in reader.pages:
            text += page.extract_text()
        return text
    else:
        raise ValueError('Unsupported file type. Please upload a PDF or PPTX file.')


def load_prompt(subject: str) -> tuple[str, str]:
    filename = SUBJECT_MAP.get(subject, 'general')
    path = os.path.join('prompts', f'{filename}.txt')
    with open(path, 'r', encoding='utf-8') as f:
        user_template = f.read().strip()
    
    system = "Du er en ekspert underviser der genererer studieopgaver til cybersikkerhedsstuderende."
    return system, user_template
    

def call_claude(text, subject = 'General'):
    system_prompt, user_template = load_prompt(subject)
    msg = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=8192,
        system=system_prompt,
        messages=[{"role": "user", "content": f"{user_template}\n\nVIGTIGT: Dit endelige output må kun indeholde den gyldige JSON struktur — ingen scratchpad, ingen markdown, ingen ekstra tekst før eller efter JSON.\n\nTekst:\n{text}"}],
    )
    raw = msg.content[0].text

    # Strip markdown fences
    raw = raw.replace('```json', '').replace('```', '').strip()

    return raw

def call_claude_rag(slide_text: str, book_context: str, subject: str) -> str:
    system_prompt, user_template = load_prompt(subject)
    
    book_section = f"\n\nBOG (dybdegående forklaring):\n{book_context}" if book_context else ""
    
    msg = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=8192,
        system=system_prompt,
        messages=[{"role": "user", "content": 
                   f'''{user_template}\n\nVIGTIGT: Dit endelige output må kun indeholde den gyldige JSON struktur — ingen scratchpad, ingen markdown, ingen ekstra tekst før eller efter JSON.VIGTIGT: Spørgsmålene må IKKE referere til "teksten", "ifølge teksten" eller "som nævnt i materialet". 
                   Spørgsmålene skal teste konceptuel forståelse, som om studerende ikke har teksten foran sig.
                   Formuler spørgsmål som om de stammer fra en eksamen — direkte og konceptuelle.\n\nSLIDES (emnestruktur):\n{slide_text}{book_section}'''}],
    )
    raw = msg.content[0].text
    raw = raw.replace('```json', '').replace('```', '').strip()
    return raw
    


@app.route('/', methods=['GET'])
def home():
    return jsonify({'data': 'hello world'})


@app.route('/upload', methods=['POST'])
def upload_file():
    blocked = require_browser_origin()
    if blocked:
        return blocked
    if 'file' not in request.files or 'subject' not in request.form:
        return jsonify({'message': 'No file part or subject in the request'}), 400

    file = request.files['file']
    subject = request.form['subject']
    if file.filename == '':
        return jsonify({'message': 'No file selected for uploading'}), 400

    try:
        text = file_to_text(file)

        if subject in SUBJECTS_WITH_BOOK:
            chunks = retrieve(query=text, subject=subject)
            book_context = '\n\n'.join(chunks['book']) if chunks['book'] else ''
            summary = call_claude_rag(text, book_context, subject)
        else:
            # No book — just use slide text directly
            summary = call_claude(text, subject)

        return jsonify({'message': 'Success', 'text': summary}), 200
    except Exception as e:
        return jsonify({'message': 'Error processing file: ' + str(e)}), 500
    
@app.route('/ingest', methods=['POST'])
def ingest_file():
    if 'file' not in request.files:
        return jsonify({'message': 'No file'}), 400

    file = request.files['file']
    subject = request.form.get('subject', 'general')
    source = request.form.get('source', 'slides')  # 'slides' or 'book'

    if file.filename == '':
        return jsonify({'message': 'No file selected'}), 400

    try:
        text = file_to_text(file)
        result = ingest(text, subject, source)
        return jsonify({'message': f'Ingested {result["chunks"]} chunks', 'result': result}), 200
    except Exception as e:
        return jsonify({'message': 'Error: ' + str(e)}), 500


@app.route('/generate', methods=['POST'])
def generate():
    blocked = require_browser_origin()
    if blocked:
        return blocked
    data = request.json
    subject = data.get('subject', 'general')
    topic = data.get('topic', '')

    query = topic if topic else f'kernebegreber i {subject}'

    try:
        count = get_collection_count(subject)
        if count == 0:
            return jsonify({'message': 'No documents ingested for this subject yet'}), 400

        chunks = retrieve(query, subject)
        slide_context = '\n\n'.join(chunks['slides']) if chunks['slides'] else 'Ingen slides fundet.'
        book_context = '\n\n'.join(chunks['book']) if chunks['book'] else 'Ingen bog fundet.'

        questions = call_claude_rag(slide_context, book_context, subject)
        return jsonify({'text': questions}), 200
    except Exception as e:
        return jsonify({'message': 'Error: ' + str(e)}), 500



def call_claude_typed(text: str, book_context: str, content_type: str, subject: str) -> str:
    """Generate content of a specific type using the matching prompt."""
    prompt_file = PROMPT_MAP.get(content_type)
    if prompt_file:
        path = os.path.join('prompts', f'{prompt_file}.txt')
        with open(path, 'r', encoding='utf-8') as f:
            user_template = f.read().strip()
        system = "Du er en ekspert underviser der hjælper cybersikkerhedsstuderende."
    else:
        system, user_template = load_prompt(subject)

    book_section = f"\n\nBOG (kontekst):\n{book_context}" if book_context else ""
    msg = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=8192,
        system=system,
        messages=[{"role": "user", "content":
            f"{user_template}\n\nVIGTIGT: Output KUN gyldigt JSON, ingen markdown, ingen ekstra tekst.\n\nMATERIALE:\n{text}{book_section}"}],
    )
    raw = msg.content[0].text.replace('```json', '').replace('```', '').strip()
    return raw


@app.route('/topics', methods=['GET'])
def get_topics():
    subject = request.args.get('subject', '')
    if not subject:
        return jsonify({'error': 'subject required'}), 400
    topics = db.get_topics(subject)
    # Filter out internal topics
    visible = [t for t in topics if not t['topic_name'].startswith('__')]
    return jsonify({'topics': visible})


@app.route('/content', methods=['POST'])
def get_content():
    blocked = require_browser_origin()
    if blocked:
        return blocked

    data = request.json or {}
    subject = data.get('subject', '')
    topic = data.get('topic', '')
    content_type = data.get('type', 'summary')

    if not subject or not topic:
        return jsonify({'error': 'subject and topic required'}), 400
    if content_type not in CONTENT_TYPES:
        return jsonify({'error': f'type must be one of {sorted(CONTENT_TYPES)}'}), 400

    # Check cache
    cached = db.get_cached(subject, topic, content_type)
    if cached:
        return jsonify({'data': cached, 'cached': True})

    # Generate from ChromaDB
    try:
        count = get_collection_count(subject)
        if count == 0:
            return jsonify({'error': 'No content ingested for this subject'}), 400

        chunks = retrieve(topic, subject, n_results=6, topic=topic)
        slide_text = '\n\n'.join(chunks['slides']) if chunks['slides'] else ''

        # Fallback: broader search if topic filter returned nothing
        if not slide_text:
            chunks = retrieve(topic, subject, n_results=6)
            slide_text = '\n\n'.join(chunks['slides']) if chunks['slides'] else 'Ingen slides fundet.'

        book_text = '\n\n'.join(chunks['book']) if chunks['book'] else ''

        raw = call_claude_typed(slide_text, book_text, content_type, subject)
        parsed = __import__('json').loads(raw)

        db.set_cached(subject, topic, content_type, parsed)
        return jsonify({'data': parsed, 'cached': False})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


if __name__ == '__main__':
    app.run(debug=True, port=5300)
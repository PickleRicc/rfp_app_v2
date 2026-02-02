# PDF Extraction Service

A FastAPI microservice for extracting text from PDF files using PyPDF.

## Features

- ✅ High-quality text extraction from PDFs
- ✅ Metadata extraction (title, author, etc.)
- ✅ Page-by-page text extraction
- ✅ CORS enabled for Next.js frontend
- ✅ Health check endpoints
- ✅ Production-ready with Docker

## Quick Start

### Option 1: Local Python Installation

1. **Install Python dependencies:**
   ```bash
   cd pdf-service
   pip install -r requirements.txt
   ```

2. **Run the service:**
   ```bash
   python main.py
   ```

   Or with uvicorn directly:
   ```bash
   uvicorn main:app --reload --port 8000
   ```

3. **Service will be available at:** `http://localhost:8000`

### Option 2: Docker

1. **Build the Docker image:**
   ```bash
   cd pdf-service
   docker build -t pdf-service .
   ```

2. **Run the container:**
   ```bash
   docker run -p 8000:8000 pdf-service
   ```

## API Endpoints

### Health Check
```bash
GET http://localhost:8000/health
```

### Extract Text from PDF
```bash
POST http://localhost:8000/extract-text
Content-Type: multipart/form-data

file: <PDF file>
```

**Response:**
```json
{
  "text": "Extracted text content...",
  "pages": 29,
  "metadata": {
    "title": "Document Title",
    "author": "Author Name"
  },
  "filename": "document.pdf",
  "character_count": 45678,
  "word_count": 8234
}
```

## Testing

Test the service with curl:

```bash
curl -X POST http://localhost:8000/extract-text \
  -F "file=@/path/to/your/document.pdf"
```

Or use the interactive API docs at: `http://localhost:8000/docs`

## Production Deployment

### Railway
```bash
railway up
```

### Fly.io
```bash
fly launch
fly deploy
```

### Google Cloud Run
```bash
gcloud run deploy pdf-service --source .
```

## Environment Variables

None required for basic operation. For production, consider adding:
- `PORT` - Server port (default: 8000)
- `ALLOWED_ORIGINS` - CORS origins (default: localhost:3000)

## Monitoring

The service includes logging for all operations:
- ✅ Successful extractions logged with file details
- ❌ Errors logged with full stack traces
- 📊 Request metrics via FastAPI

## Troubleshooting

**Issue:** CORS errors
- **Solution:** Add your frontend URL to `allow_origins` in `main.py`

**Issue:** Large PDFs timing out
- **Solution:** Increase timeout in Next.js fetch call

**Issue:** Poor text quality
- **Solution:** Try `pdfplumber` for complex layouts (see Alternative Libraries below)

## Alternative Libraries

For better extraction quality, consider:
- `pdfplumber` - Better table extraction
- `PyMuPDF` (fitz) - Faster performance
- `camelot` - Excellent table parsing
- `unstructured` - Multi-format support

## License

MIT

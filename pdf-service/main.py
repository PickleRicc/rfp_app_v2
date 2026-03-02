from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pypdf import PdfReader
import io
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="PDF Extraction Service", version="1.0.0")

# Enable CORS — the service is called server-to-server from Next.js API routes,
# not from the browser, so we allow all origins.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
async def root():
    """Health check endpoint"""
    return {
        "service": "PDF Extraction Service",
        "status": "healthy",
        "version": "1.0.0"
    }


@app.get("/health")
async def health_check():
    """Detailed health check"""
    return {
        "status": "ok",
        "service": "pdf-extraction",
        "dependencies": {
            "pypdf": "installed"
        }
    }


@app.post("/extract-text")
async def extract_text(file: UploadFile = File(...)):
    """
    Extract text from a PDF file.
    
    Returns:
        - text: Extracted text content
        - pages: Number of pages
        - metadata: PDF metadata (title, author, etc.)
        - filename: Original filename
    """
    
    # Validate file type
    if not file.content_type == "application/pdf" and not file.filename.endswith('.pdf'):
        raise HTTPException(
            status_code=400,
            detail="File must be a PDF"
        )
    
    try:
        # Read file contents
        contents = await file.read()
        logger.info(f"Processing PDF: {file.filename} ({len(contents)} bytes)")
        
        # Create BytesIO object for PDF reading
        pdf_file = io.BytesIO(contents)
        
        # Extract text using PyPDF
        reader = PdfReader(pdf_file)
        
        # Extract text from all pages
        text_content = []
        for i, page in enumerate(reader.pages, start=1):
            page_text = page.extract_text()
            if page_text.strip():  # Only add non-empty pages
                text_content.append(f"--- Page {i} ---\n{page_text}")
        
        full_text = "\n\n".join(text_content)
        
        # Extract metadata
        metadata = {}
        if reader.metadata:
            metadata = {
                "title": reader.metadata.get("/Title", ""),
                "author": reader.metadata.get("/Author", ""),
                "subject": reader.metadata.get("/Subject", ""),
                "creator": reader.metadata.get("/Creator", ""),
                "producer": reader.metadata.get("/Producer", ""),
                "creation_date": str(reader.metadata.get("/CreationDate", "")),
            }
        
        result = {
            "text": full_text,
            "pages": len(reader.pages),
            "metadata": metadata,
            "filename": file.filename,
            "character_count": len(full_text),
            "word_count": len(full_text.split()),
        }
        
        logger.info(
            f"✅ Successfully extracted {result['pages']} pages, "
            f"{result['character_count']} characters from {file.filename}"
        )
        
        return result
        
    except Exception as e:
        logger.error(f"❌ Error processing PDF {file.filename}: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to extract text from PDF: {str(e)}"
        )
    finally:
        await file.close()


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, log_level="info")

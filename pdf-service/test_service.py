#!/usr/bin/env python3
"""
Simple test script to verify the PDF extraction service is working.
"""

import sys
import requests
from pathlib import Path

def test_health():
    """Test the health endpoint"""
    try:
        response = requests.get('http://localhost:8000/health', timeout=5)
        response.raise_for_status()
        print("✅ Health check passed")
        print(f"   Response: {response.json()}")
        return True
    except requests.exceptions.ConnectionError:
        print("❌ Cannot connect to service. Is it running on port 8000?")
        print("   Run: python main.py")
        return False
    except Exception as e:
        print(f"❌ Health check failed: {e}")
        return False


def test_extraction(pdf_path=None):
    """Test PDF extraction with a sample file"""
    if pdf_path and Path(pdf_path).exists():
        print(f"\n📄 Testing PDF extraction with: {pdf_path}")
        
        try:
            with open(pdf_path, 'rb') as f:
                files = {'file': (Path(pdf_path).name, f, 'application/pdf')}
                response = requests.post(
                    'http://localhost:8000/extract-text',
                    files=files,
                    timeout=30
                )
                response.raise_for_status()
                
                result = response.json()
                print("✅ PDF extraction successful!")
                print(f"   Pages: {result['pages']}")
                print(f"   Characters: {result['character_count']}")
                print(f"   Words: {result['word_count']}")
                print(f"\n   First 200 characters of text:")
                print(f"   {result['text'][:200]}...")
                return True
                
        except Exception as e:
            print(f"❌ PDF extraction failed: {e}")
            return False
    else:
        print("\n⚠️  No PDF file provided for extraction test")
        print("   Usage: python test_service.py [path/to/test.pdf]")
        return None


def main():
    print("🧪 Testing PDF Extraction Service\n")
    print("=" * 50)
    
    # Test 1: Health check
    print("\n1. Testing health endpoint...")
    health_ok = test_health()
    
    if not health_ok:
        print("\n❌ Service is not running. Please start it first:")
        print("   python main.py")
        sys.exit(1)
    
    # Test 2: PDF extraction (if file provided)
    pdf_path = sys.argv[1] if len(sys.argv) > 1 else None
    extraction_result = test_extraction(pdf_path)
    
    # Summary
    print("\n" + "=" * 50)
    print("\n📊 Test Summary:")
    print(f"   Health Check: {'✅ PASS' if health_ok else '❌ FAIL'}")
    
    if extraction_result is not None:
        print(f"   PDF Extraction: {'✅ PASS' if extraction_result else '❌ FAIL'}")
    
    if health_ok and (extraction_result is None or extraction_result):
        print("\n✨ Service is working correctly!")
        print("\n🚀 Next steps:")
        print("   1. Start your Next.js app: npm run dev")
        print("   2. Upload a PDF through the UI")
        print("   3. Check that extraction works end-to-end")
    else:
        print("\n⚠️  Some tests failed. Check the errors above.")
        sys.exit(1)


if __name__ == '__main__':
    main()

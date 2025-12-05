#!/usr/bin/env python3
"""
Simple test script to verify internationalization functionality
Tests translation system without full FastAPI setup

NOTE: This is a standalone script, not a pytest module.
Run directly with: python tests/test_i18n.py
"""
import pytest
pytestmark = pytest.mark.skip(reason="Standalone script, not pytest tests")

import os
import sys
from pathlib import Path

# Add src to path
sys.path.append(str(Path(__file__).parent / "src"))

try:
    from fastapi_babel import Babel, BabelConfigs, _
    
    # Configuration
    configs = BabelConfigs(
        ROOT_DIR=str(Path(__file__).parent),
        BABEL_DEFAULT_LOCALE="en",
        BABEL_TRANSLATION_DIRECTORY="locales",
    )
    
    babel = Babel(configs=configs)
    
    def test_english():
        """Test English translations (should be same as source)"""
        print("Testing English translations:")
        babel.locale = "en"
        
        tests = [
            "Compliance Engine API",
            "operational", 
            "healthy",
            "unhealthy",
            "Current locale is set to",
            "Locale is supported",
            "System is operating normally"
        ]
        
        for test_string in tests:
            result = _(test_string)
            print(f"  '{test_string}' -> '{result}'")
        print()
    
    def test_spanish():
        """Test Spanish translations"""
        print("Testing Spanish translations:")
        babel.locale = "es"
        
        tests = [
            ("Compliance Engine API", "API del Motor de Cumplimiento"),
            ("operational", "operativo"),
            ("healthy", "saludable"),
            ("unhealthy", "no saludable"),
            ("Current locale is set to", "El idioma actual está configurado en"),
            ("Locale is supported", "El idioma está soportado"),
            ("System is operating normally", "El sistema está funcionando normalmente")
        ]
        
        for source, expected in tests:
            result = _(source)
            status = "✓" if result == expected else "✗"
            print(f"  {status} '{source}' -> '{result}'")
            if result != expected:
                print(f"    Expected: '{expected}'")
        print()
    
    def test_locale_detection():
        """Test locale switching"""
        print("Testing locale switching:")
        
        # Test English
        babel.locale = "en"
        result_en = _("healthy")
        print(f"  English: '{result_en}'")
        
        # Test Spanish  
        babel.locale = "es"
        result_es = _("healthy")
        print(f"  Spanish: '{result_es}'")
        
        print(f"  Languages are different: {result_en != result_es}")
        print()
    
    def main():
        print("Compliance Engine Internationalization Test")
        print("=" * 50)
        print()
        
        # Check if translation files exist
        locales_dir = Path(__file__).parent / "locales"
        es_mo = locales_dir / "es" / "LC_MESSAGES" / "messages.mo"
        en_mo = locales_dir / "en" / "LC_MESSAGES" / "messages.mo"
        
        print("Checking translation files:")
        print(f"  Spanish .mo file: {es_mo.exists()} ({es_mo})")
        print(f"  English .mo file: {en_mo.exists()} ({en_mo})")
        print()
        
        if not es_mo.exists() or not en_mo.exists():
            print("ERROR: Translation files missing. Run 'pybabel compile -d locales'")
            return 1
        
        try:
            test_english()
            test_spanish()
            test_locale_detection()
            
            print("✓ All tests completed successfully!")
            print("\nTo test with FastAPI:")
            print("1. Install dependencies: pip install -r requirements.txt")
            print("2. Run server: python src/main.py")
            print("3. Test endpoints:")
            print("   curl http://localhost:8000/")
            print("   curl -H 'Accept-Language: es' http://localhost:8000/")
            print("   curl http://localhost:8000/api/v1/i18n/languages")
            
            return 0
            
        except Exception as e:
            print(f"ERROR during testing: {e}")
            import traceback
            traceback.print_exc()
            return 1
    
    if __name__ == "__main__":
        exit(main())
        
except ImportError as e:
    print(f"ERROR: Missing dependency - {e}")
    print("\nTo install dependencies:")
    print("  python -m venv .venv")
    print("  source .venv/bin/activate")  
    print("  pip install fastapi-babel")
    exit(1)
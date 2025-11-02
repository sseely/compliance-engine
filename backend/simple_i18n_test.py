#!/usr/bin/env python3
"""
Simple test using standard gettext to verify translations work
"""

import gettext
import os
from pathlib import Path

def test_translations():
    """Test translation files using standard gettext"""
    
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
        return False
    
    # Test English translations
    print("Testing English translations:")
    try:
        en_translation = gettext.translation('messages', localedir='locales', languages=['en'])
        _ = en_translation.gettext
        
        tests = [
            "Compliance Engine API",
            "operational", 
            "healthy",
            "unhealthy"
        ]
        
        for test_string in tests:
            result = _(test_string)
            print(f"  '{test_string}' -> '{result}'")
            
    except Exception as e:
        print(f"  ERROR: {e}")
    
    print()
    
    # Test Spanish translations
    print("Testing Spanish translations:")
    try:
        es_translation = gettext.translation('messages', localedir='locales', languages=['es'])
        _ = es_translation.gettext
        
        tests = [
            ("Compliance Engine API", "API del Motor de Cumplimiento"),
            ("operational", "operativo"),
            ("healthy", "saludable"),
            ("unhealthy", "no saludable")
        ]
        
        all_passed = True
        for source, expected in tests:
            result = _(source)
            status = "✓" if result == expected else "✗"
            if result != expected:
                all_passed = False
            print(f"  {status} '{source}' -> '{result}'")
            if result != expected:
                print(f"    Expected: '{expected}'")
                
    except Exception as e:
        print(f"  ERROR: {e}")
        all_passed = False
    
    print()
    
    if all_passed:
        print("✓ All translation tests passed!")
    else:
        print("✗ Some translation tests failed")
    
    print("\nTo test with FastAPI server:")
    print("1. Install dependencies: pip install -r requirements.txt")
    print("2. Run server: python src/main.py")
    print("3. Test endpoints:")
    print("   curl http://localhost:8000/")
    print("   curl -H 'Accept-Language: es' http://localhost:8000/")
    print("   curl http://localhost:8000/api/v1/i18n/languages")
    print("   curl -H 'Accept-Language: es' http://localhost:8000/api/v1/i18n/health/localized")
    
    return all_passed

if __name__ == "__main__":
    success = test_translations()
    exit(0 if success else 1)
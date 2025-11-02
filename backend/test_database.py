#!/usr/bin/env python3
"""
Quick test script to verify database procedures work correctly
Tests the stored procedure-only architecture
"""

import asyncio
import asyncpg
import json
from datetime import datetime

DATABASE_URL = "postgresql://postgres:postgres@localhost:5432/compliance_engine"

async def test_database_procedures():
    """Test core stored procedures"""
    print("🔧 Testing Compliance Engine Database Procedures")
    print("=" * 50)
    
    try:
        # Connect to database
        conn = await asyncpg.connect(DATABASE_URL)
        print("✅ Database connection successful")
        
        # Test 1: Health check procedure
        print("\n📊 Testing health_check_database...")
        result = await conn.fetchrow("SELECT * FROM health_check_database()")
        print(f"   Status: {result['status']}")
        print(f"   Response time: {result['response_time_ms']}ms")
        print(f"   Active connections: {result['connection_count']}")
        
        # Test 2: Authentication procedure 
        print("\n🔐 Testing authentication...")
        # This will return empty since the API key doesn't exist, but tests the procedure
        result = await conn.fetch("SELECT * FROM authenticate_user('test_key_12345')")
        print(f"   Authentication test completed (empty result expected): {len(result) == 0}")
        
        # Test 3: License verification procedure
        print("\n🏢 Testing license verification...")
        result = await conn.fetch("""
            SELECT * FROM verify_business_license(
                'test_req_001',
                '550e8400-e29b-41d4-a716-446655440001'::uuid,
                'Acme Construction LLC',
                'CA',
                'business',
                NULL,
                '192.168.1.100'::inet
            )
        """)
        
        if result:
            verification = result[0]
            print(f"   Verification status: {verification['verification_status']}")
            print(f"   Confidence score: {verification['confidence_score']}")
            print(f"   Data sources: {verification['data_sources_checked']}")
            
            # Parse licenses found
            licenses_data = verification['licenses_data']
            if licenses_data:
                licenses_count = len(licenses_data) if isinstance(licenses_data, list) else 0
                print(f"   Licenses found: {licenses_count}")
            
        # Test 4: CORS settings procedure
        print("\n🌐 Testing CORS settings...")
        result = await conn.fetchrow("""
            SELECT * FROM get_customer_cors_settings('550e8400-e29b-41d4-a716-446655440001'::uuid)
        """)
        
        if result:
            print(f"   Allowed origins: {result['allowed_origins'][:2]}...") # Show first 2
            print(f"   Max age: {result['max_age']} seconds")
        
        # Test 5: Audit procedure
        print("\n📝 Testing audit logging...")
        await conn.execute("""
            SELECT audit_user_activity(
                'test_user_123',
                'database_test',
                'system',
                'test_database.py',
                '127.0.0.1'::inet,
                '{"test": "successful", "timestamp": "2024-11-02"}'::jsonb
            )
        """)
        print("   Audit log entry created successfully")
        
        await conn.close()
        print("\n🎉 All database procedures working correctly!")
        print("✅ Database foundation is ready for API integration")
        
        return True
        
    except Exception as e:
        print(f"\n❌ Database test failed: {e}")
        return False

if __name__ == "__main__":
    success = asyncio.run(test_database_procedures())
    exit(0 if success else 1)
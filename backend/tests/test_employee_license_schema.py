#!/usr/bin/env python3
"""
Tests for the employee license management schema and stored procedures.
Validates the database structure and procedures created in migration 347356455619.
"""

import asyncio
import uuid
import pytest
import asyncpg
from datetime import date, timedelta


DATABASE_URL = "postgresql://postgres:postgres@localhost:5432/compliance_engine"


@pytest.fixture
async def db_connection():
    """Create a database connection for testing."""
    conn = await asyncpg.connect(DATABASE_URL)
    yield conn
    await conn.close()


@pytest.fixture
async def test_customer(db_connection):
    """Create a test customer for employee tests."""
    customer_id = uuid.uuid4()
    await db_connection.execute("""
        INSERT INTO customers (customer_id, business_name, contact_email)
        VALUES ($1, 'Test Healthcare Company', 'test@healthcare.example')
        ON CONFLICT (contact_email) DO UPDATE SET business_name = EXCLUDED.business_name
        RETURNING customer_id
    """, customer_id)

    yield customer_id

    # Cleanup
    await db_connection.execute(
        "DELETE FROM customers WHERE customer_id = $1", customer_id
    )


class TestEmployeeSchema:
    """Tests for the employees table."""

    @pytest.mark.asyncio
    async def test_employees_table_exists(self, db_connection):
        """Verify employees table exists with expected columns."""
        result = await db_connection.fetch("""
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns
            WHERE table_name = 'employees'
            ORDER BY ordinal_position
        """)

        columns = {r['column_name'] for r in result}
        expected_columns = {
            'employee_id', 'customer_id', 'first_name', 'last_name', 'email',
            'phone', 'external_employee_id', 'position', 'department',
            'hire_date', 'termination_date', 'employment_status',
            'work_state', 'work_city', 'work_location',
            'created_at', 'updated_at', 'created_by', 'updated_by', 'metadata'
        }

        assert expected_columns.issubset(columns), \
            f"Missing columns: {expected_columns - columns}"

    @pytest.mark.asyncio
    async def test_employees_indexes_exist(self, db_connection):
        """Verify critical indexes exist on employees table."""
        result = await db_connection.fetch("""
            SELECT indexname FROM pg_indexes
            WHERE tablename = 'employees'
        """)

        index_names = {r['indexname'] for r in result}
        expected_indexes = {
            'idx_employees_customer_id',
            'idx_employees_email',
            'idx_employees_department',
            'idx_employees_status'
        }

        assert expected_indexes.issubset(index_names), \
            f"Missing indexes: {expected_indexes - index_names}"


class TestEmployeeLicensesSchema:
    """Tests for the employee_licenses table."""

    @pytest.mark.asyncio
    async def test_employee_licenses_table_exists(self, db_connection):
        """Verify employee_licenses table exists with expected columns."""
        result = await db_connection.fetch("""
            SELECT column_name, data_type
            FROM information_schema.columns
            WHERE table_name = 'employee_licenses'
            ORDER BY ordinal_position
        """)

        columns = {r['column_name'] for r in result}
        expected_columns = {
            'license_id', 'employee_id', 'license_type_id', 'license_number',
            'issuing_state', 'issuing_authority', 'issue_date', 'expiration_date',
            'license_status', 'verification_status', 'last_verified_at',
            'next_verification_due', 'verification_attempts', 'confidence_score',
            'verification_source', 'compact_privilege', 'multi_state_valid',
            'specializations', 'restrictions', 'created_at', 'updated_at',
            'created_by', 'updated_by', 'raw_verification_data'
        }

        assert expected_columns.issubset(columns), \
            f"Missing columns: {expected_columns - columns}"


class TestLicenseTypesExtension:
    """Tests for the extended license_types table."""

    @pytest.mark.asyncio
    async def test_professional_license_types_exist(self, db_connection):
        """Verify professional license types were added."""
        result = await db_connection.fetch("""
            SELECT type_name, category FROM license_types
            WHERE category IN ('medical', 'nursing', 'allied_health', 'mental_health',
                               'accounting', 'engineering', 'legal')
        """)

        types = {r['type_name'] for r in result}
        expected_types = {'RN', 'MD', 'CPA', 'PE', 'BAR', 'NP', 'LCSW'}

        assert expected_types.issubset(types), \
            f"Missing license types: {expected_types - types}"

    @pytest.mark.asyncio
    async def test_license_type_categories(self, db_connection):
        """Verify license types have correct categories."""
        result = await db_connection.fetch("""
            SELECT type_name, category FROM license_types
            WHERE type_name IN ('RN', 'MD', 'CPA', 'PE')
        """)

        categories = {r['type_name']: r['category'] for r in result}

        assert categories.get('RN') == 'nursing'
        assert categories.get('MD') == 'medical'
        assert categories.get('CPA') == 'accounting'
        assert categories.get('PE') == 'engineering'


class TestComplianceRulesSchema:
    """Tests for compliance rules tables."""

    @pytest.mark.asyncio
    async def test_department_rules_table_exists(self, db_connection):
        """Verify compliance_department_rules table exists."""
        result = await db_connection.fetch("""
            SELECT column_name FROM information_schema.columns
            WHERE table_name = 'compliance_department_rules'
        """)

        columns = {r['column_name'] for r in result}
        expected = {
            'rule_id', 'customer_id', 'department', 'license_type_id',
            'is_required', 'grace_period_days', 'advance_warning_days',
            'required_states', 'is_active'
        }

        assert expected.issubset(columns)

    @pytest.mark.asyncio
    async def test_position_rules_table_exists(self, db_connection):
        """Verify compliance_position_rules table exists."""
        result = await db_connection.fetch("""
            SELECT column_name FROM information_schema.columns
            WHERE table_name = 'compliance_position_rules'
        """)

        columns = {r['column_name'] for r in result}
        expected = {
            'rule_id', 'customer_id', 'position', 'license_type_id',
            'is_required', 'grace_period_days', 'advance_warning_days', 'is_active'
        }

        assert expected.issubset(columns)


class TestEmployeeProcedures:
    """Tests for employee-related stored procedures."""

    @pytest.mark.asyncio
    async def test_create_employee_success(self, db_connection, test_customer):
        """Test creating an employee via stored procedure."""
        result = await db_connection.fetchrow("""
            SELECT * FROM create_employee(
                $1,
                'Jane',
                'Smith',
                'jane.smith@test.example',
                '555-123-4567',
                'EMP001',
                'Registered Nurse',
                'Nursing',
                '2024-01-15',
                'CA',
                'Los Angeles',
                'Main Hospital',
                'test'
            )
        """, test_customer)

        assert result['created'] is True
        assert result['employee_id'] is not None
        assert 'successfully' in result['message'].lower()

        # Cleanup
        await db_connection.execute(
            "DELETE FROM employees WHERE employee_id = $1",
            result['employee_id']
        )

    @pytest.mark.asyncio
    async def test_create_employee_duplicate_email(self, db_connection, test_customer):
        """Test that duplicate emails are rejected."""
        email = f"duplicate-{uuid.uuid4()}@test.example"

        # Create first employee
        result1 = await db_connection.fetchrow("""
            SELECT * FROM create_employee($1, 'John', 'Doe', $2)
        """, test_customer, email)

        assert result1['created'] is True

        # Try to create second with same email
        result2 = await db_connection.fetchrow("""
            SELECT * FROM create_employee($1, 'Jane', 'Doe', $2)
        """, test_customer, email)

        assert result2['created'] is False
        assert 'already exists' in result2['message'].lower()

        # Cleanup
        await db_connection.execute(
            "DELETE FROM employees WHERE employee_id = $1",
            result1['employee_id']
        )

    @pytest.mark.asyncio
    async def test_update_employee(self, db_connection, test_customer):
        """Test updating an employee via stored procedure."""
        # Create employee
        create_result = await db_connection.fetchrow("""
            SELECT * FROM create_employee($1, 'Test', 'User', 'update-test@test.example')
        """, test_customer)

        employee_id = create_result['employee_id']

        # Update employee
        update_result = await db_connection.fetchrow("""
            SELECT * FROM update_employee(
                $1, $2,
                p_position := 'Senior Nurse',
                p_department := 'ICU'
            )
        """, employee_id, test_customer)

        assert update_result['updated'] is True

        # Verify update
        employee = await db_connection.fetchrow(
            "SELECT position, department FROM employees WHERE employee_id = $1",
            employee_id
        )

        assert employee['position'] == 'Senior Nurse'
        assert employee['department'] == 'ICU'

        # Cleanup
        await db_connection.execute(
            "DELETE FROM employees WHERE employee_id = $1", employee_id
        )

    @pytest.mark.asyncio
    async def test_deactivate_employee(self, db_connection, test_customer):
        """Test deactivating an employee."""
        # Create employee
        create_result = await db_connection.fetchrow("""
            SELECT * FROM create_employee($1, 'Leaving', 'Employee', 'leaving@test.example')
        """, test_customer)

        employee_id = create_result['employee_id']

        # Deactivate
        deactivate_result = await db_connection.fetchrow("""
            SELECT * FROM deactivate_employee($1, $2, '2024-12-31')
        """, employee_id, test_customer)

        assert deactivate_result['deactivated'] is True

        # Verify deactivation
        employee = await db_connection.fetchrow(
            "SELECT employment_status, termination_date FROM employees WHERE employee_id = $1",
            employee_id
        )

        assert employee['employment_status'] == 'terminated'
        assert employee['termination_date'] == date(2024, 12, 31)

        # Cleanup
        await db_connection.execute(
            "DELETE FROM employees WHERE employee_id = $1", employee_id
        )


class TestLicenseProcedures:
    """Tests for license-related stored procedures."""

    @pytest.mark.asyncio
    async def test_add_employee_license(self, db_connection, test_customer):
        """Test adding a license to an employee."""
        # Create employee
        emp_result = await db_connection.fetchrow("""
            SELECT * FROM create_employee($1, 'Nurse', 'Test', 'nurse-lic@test.example')
        """, test_customer)

        employee_id = emp_result['employee_id']

        # Add license
        lic_result = await db_connection.fetchrow("""
            SELECT * FROM add_employee_license(
                $1,
                'RN',
                'RN123456',
                'CA',
                'California Board of Registered Nursing',
                '2023-01-01',
                '2025-12-31'
            )
        """, employee_id)

        assert lic_result['created'] is True
        assert lic_result['license_id'] is not None

        # Verify license
        license = await db_connection.fetchrow(
            "SELECT license_status FROM employee_licenses WHERE license_id = $1",
            lic_result['license_id']
        )

        assert license['license_status'] == 'pending_verification'

        # Cleanup
        await db_connection.execute(
            "DELETE FROM employees WHERE employee_id = $1", employee_id
        )

    @pytest.mark.asyncio
    async def test_add_license_with_expired_date(self, db_connection, test_customer):
        """Test that licenses with past expiration dates are marked expired."""
        # Create employee
        emp_result = await db_connection.fetchrow("""
            SELECT * FROM create_employee($1, 'Expired', 'License', 'expired-lic@test.example')
        """, test_customer)

        employee_id = emp_result['employee_id']

        # Add license with past expiration
        yesterday = date.today() - timedelta(days=1)
        lic_result = await db_connection.fetchrow("""
            SELECT * FROM add_employee_license(
                $1, 'RN', 'RN-EXPIRED', 'CA', NULL, '2020-01-01', $2
            )
        """, employee_id, yesterday)

        assert lic_result['created'] is True

        # Verify it's marked as expired
        license = await db_connection.fetchrow(
            "SELECT license_status FROM employee_licenses WHERE license_id = $1",
            lic_result['license_id']
        )

        assert license['license_status'] == 'expired'

        # Cleanup
        await db_connection.execute(
            "DELETE FROM employees WHERE employee_id = $1", employee_id
        )

    @pytest.mark.asyncio
    async def test_record_license_verification(self, db_connection, test_customer):
        """Test recording a license verification."""
        # Create employee and license
        emp_result = await db_connection.fetchrow("""
            SELECT * FROM create_employee($1, 'Verify', 'Test', 'verify-test@test.example')
        """, test_customer)

        employee_id = emp_result['employee_id']

        future_date = date.today() + timedelta(days=365)
        lic_result = await db_connection.fetchrow("""
            SELECT * FROM add_employee_license($1, 'RN', 'RN-VERIFY', 'CA', NULL, NULL, $2)
        """, employee_id, future_date)

        license_id = lic_result['license_id']

        # Record verification
        verify_result = await db_connection.fetchrow("""
            SELECT * FROM record_license_verification(
                $1, 'api', 'verified', 0.95, 'California BRN API', NULL, NULL, 250
            )
        """, license_id)

        assert verify_result['recorded'] is True

        # Verify the license was updated
        license = await db_connection.fetchrow(
            """SELECT license_status, verification_status, confidence_score
               FROM employee_licenses WHERE license_id = $1""",
            license_id
        )

        assert license['license_status'] == 'active'
        assert license['verification_status'] == 'verified'
        assert float(license['confidence_score']) == 0.95

        # Cleanup
        await db_connection.execute(
            "DELETE FROM employees WHERE employee_id = $1", employee_id
        )


class TestComplianceReportProcedures:
    """Tests for compliance reporting stored procedures."""

    @pytest.mark.asyncio
    async def test_get_expiring_licenses(self, db_connection, test_customer):
        """Test getting expiring licenses."""
        # Create employee with expiring license
        emp_result = await db_connection.fetchrow("""
            SELECT * FROM create_employee(
                $1, 'Expiring', 'Soon', 'expiring-lic@test.example',
                NULL, NULL, 'RN', 'Nursing'
            )
        """, test_customer)

        employee_id = emp_result['employee_id']

        # Add license expiring in 30 days
        expiring_date = date.today() + timedelta(days=30)
        await db_connection.fetchrow("""
            SELECT * FROM add_employee_license($1, 'RN', 'RN-EXPIRING', 'CA', NULL, NULL, $2)
        """, employee_id, expiring_date)

        # Get expiring licenses
        results = await db_connection.fetch("""
            SELECT * FROM get_expiring_licenses($1, 90)
        """, test_customer)

        assert len(results) >= 1
        found = any(r['license_number'] == 'RN-EXPIRING' for r in results)
        assert found, "Expected to find the expiring license"

        # Cleanup
        await db_connection.execute(
            "DELETE FROM employees WHERE employee_id = $1", employee_id
        )

    @pytest.mark.asyncio
    async def test_get_employee_compliance_status(self, db_connection, test_customer):
        """Test getting employee compliance status."""
        # Create employee
        emp_result = await db_connection.fetchrow("""
            SELECT * FROM create_employee(
                $1, 'Compliance', 'Check', 'compliance-check@test.example',
                NULL, NULL, 'Registered Nurse', 'Nursing'
            )
        """, test_customer)

        employee_id = emp_result['employee_id']

        # Get compliance status
        result = await db_connection.fetchrow("""
            SELECT * FROM get_employee_compliance_status($1)
        """, employee_id)

        assert result is not None
        assert result['employee_name'] == 'Compliance Check'
        assert result['total_licenses'] == 0  # No licenses added

        # Cleanup
        await db_connection.execute(
            "DELETE FROM employees WHERE employee_id = $1", employee_id
        )


class TestBulkOperations:
    """Tests for bulk operation stored procedures."""

    @pytest.mark.asyncio
    async def test_bulk_import_employees(self, db_connection, test_customer):
        """Test bulk importing employees."""
        import json

        employees_json = json.dumps([
            {
                "first_name": "Bulk",
                "last_name": "Import1",
                "email": f"bulk1-{uuid.uuid4()}@test.example",
                "department": "Nursing"
            },
            {
                "first_name": "Bulk",
                "last_name": "Import2",
                "email": f"bulk2-{uuid.uuid4()}@test.example",
                "department": "Radiology"
            }
        ])

        result = await db_connection.fetchrow("""
            SELECT * FROM bulk_import_employees($1, $2::jsonb)
        """, test_customer, employees_json)

        assert result['total_processed'] == 2
        assert result['successful'] == 2
        assert result['failed'] == 0

        # Cleanup - delete by customer_id
        await db_connection.execute(
            "DELETE FROM employees WHERE customer_id = $1 AND first_name = 'Bulk'",
            test_customer
        )


# Run tests directly if needed
if __name__ == "__main__":
    pytest.main([__file__, "-v"])

"""add_employee_license_management_schema

Revision ID: 347356455619
Revises: 9d027107f8b3
Create Date: 2025-12-04

MIGRATION SAFETY CHECKLIST:
- [x] Changes are backward compatible with previous app version
- [x] No columns/tables are dropped that current code uses
- [x] New columns have appropriate defaults or are nullable
- [x] Stored procedure signatures maintained for existing functions
- [x] Migration can be safely rolled back
- [x] Database changes tested with current application code

ROLLBACK STRATEGY:
- Application rollback: Traffic shift to previous version
- Database rollback: Only additive changes, no breaking removals
- Emergency: Point-in-time restore available with <5min RPO

This migration adds employee license management tables and stored procedures
for tracking professional licenses (RN, MD, CPA, etc.) for employees within
customer organizations.

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '347356455619'
down_revision: Union[str, Sequence[str], None] = '9d027107f8b3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """
    Apply forward migration changes.
    Creates employee management schema, license tracking, and compliance rules.
    """

    # =============================================================================
    # PROFESSIONAL LICENSE TYPES (extend existing license_types table)
    # =============================================================================
    op.execute("""
        INSERT INTO license_types (type_name, category, description, verification_complexity, average_verification_time_ms)
        VALUES
            -- Medical Licenses
            ('MD', 'medical', 'Medical Doctor (Physician)', 'complex', 5000),
            ('DO', 'medical', 'Doctor of Osteopathic Medicine', 'complex', 5000),
            ('DDS', 'medical', 'Doctor of Dental Surgery', 'complex', 4000),
            ('DMD', 'medical', 'Doctor of Medicine in Dentistry', 'complex', 4000),
            ('DPM', 'medical', 'Doctor of Podiatric Medicine', 'complex', 4000),
            ('DC', 'medical', 'Doctor of Chiropractic', 'standard', 3000),
            ('OD', 'medical', 'Doctor of Optometry', 'standard', 3000),
            ('PharmD', 'medical', 'Doctor of Pharmacy', 'standard', 3000),

            -- Nursing Licenses
            ('RN', 'nursing', 'Registered Nurse', 'standard', 2500),
            ('LPN', 'nursing', 'Licensed Practical Nurse', 'standard', 2500),
            ('LVN', 'nursing', 'Licensed Vocational Nurse', 'standard', 2500),
            ('NP', 'nursing', 'Nurse Practitioner', 'complex', 4000),
            ('APRN', 'nursing', 'Advanced Practice Registered Nurse', 'complex', 4000),
            ('CNS', 'nursing', 'Clinical Nurse Specialist', 'complex', 4000),
            ('CRNA', 'nursing', 'Certified Registered Nurse Anesthetist', 'complex', 4000),
            ('CNM', 'nursing', 'Certified Nurse Midwife', 'complex', 4000),

            -- Allied Health
            ('PT', 'allied_health', 'Physical Therapist', 'standard', 3000),
            ('PTA', 'allied_health', 'Physical Therapist Assistant', 'simple', 2000),
            ('OT', 'allied_health', 'Occupational Therapist', 'standard', 3000),
            ('OTA', 'allied_health', 'Occupational Therapy Assistant', 'simple', 2000),
            ('SLP', 'allied_health', 'Speech-Language Pathologist', 'standard', 3000),
            ('AuD', 'allied_health', 'Doctor of Audiology', 'standard', 3000),
            ('RT', 'allied_health', 'Respiratory Therapist', 'standard', 2500),
            ('RD', 'allied_health', 'Registered Dietitian', 'standard', 2500),
            ('LCSW', 'allied_health', 'Licensed Clinical Social Worker', 'standard', 3000),

            -- Mental Health
            ('LPC', 'mental_health', 'Licensed Professional Counselor', 'standard', 3000),
            ('LMFT', 'mental_health', 'Licensed Marriage and Family Therapist', 'standard', 3000),
            ('PsyD', 'mental_health', 'Doctor of Psychology (Clinical)', 'complex', 4000),
            ('PhD_PSY', 'mental_health', 'PhD in Psychology (Licensed)', 'complex', 4000),

            -- Accounting & Finance
            ('CPA', 'accounting', 'Certified Public Accountant', 'standard', 3000),
            ('CMA', 'accounting', 'Certified Management Accountant', 'simple', 2000),
            ('CFP', 'finance', 'Certified Financial Planner', 'simple', 2000),

            -- Engineering
            ('PE', 'engineering', 'Professional Engineer', 'standard', 3000),
            ('SE', 'engineering', 'Structural Engineer', 'standard', 3000),
            ('PLS', 'engineering', 'Professional Land Surveyor', 'standard', 3000),

            -- Legal
            ('BAR', 'legal', 'Attorney (Bar Admission)', 'complex', 5000),

            -- Real Estate
            ('RE_BROKER', 'real_estate', 'Real Estate Broker', 'standard', 2500),
            ('RE_AGENT', 'real_estate', 'Real Estate Agent/Salesperson', 'simple', 2000),

            -- Insurance
            ('INS_PRODUCER', 'insurance', 'Insurance Producer/Agent', 'simple', 2000),

            -- Education
            ('TCHR', 'education', 'Teaching Credential', 'standard', 3000),
            ('ADMIN', 'education', 'Administrative Services Credential', 'standard', 3000)
        ON CONFLICT (type_name) DO UPDATE SET
            category = EXCLUDED.category,
            description = EXCLUDED.description,
            verification_complexity = EXCLUDED.verification_complexity,
            average_verification_time_ms = EXCLUDED.average_verification_time_ms;
    """)

    # =============================================================================
    # EMPLOYEES TABLE
    # =============================================================================
    op.execute("""
        CREATE TABLE IF NOT EXISTS employees (
            employee_id UUID PRIMARY KEY DEFAULT compliance_uuid(),
            customer_id UUID NOT NULL REFERENCES customers(customer_id) ON DELETE CASCADE,

            -- Personal Information
            first_name VARCHAR(100) NOT NULL,
            last_name VARCHAR(100) NOT NULL,
            email VARCHAR(255) NOT NULL,
            phone VARCHAR(20),

            -- Employment Information
            external_employee_id VARCHAR(100),  -- Customer's internal employee ID
            position VARCHAR(200),
            department VARCHAR(200),
            hire_date DATE,
            termination_date DATE,
            employment_status VARCHAR(20) NOT NULL DEFAULT 'active'
                CHECK (employment_status IN ('active', 'inactive', 'terminated', 'on_leave')),

            -- Work Location
            work_state CHAR(2),
            work_city VARCHAR(100),
            work_location VARCHAR(200),  -- Office/facility name

            -- Audit Fields
            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
            created_by VARCHAR(100),
            updated_by VARCHAR(100),

            -- Metadata
            metadata JSONB DEFAULT '{}'::jsonb,

            -- Constraints
            UNIQUE(customer_id, email),
            UNIQUE(customer_id, external_employee_id)
        );

        -- Indexes for employees
        CREATE INDEX IF NOT EXISTS idx_employees_customer_id ON employees(customer_id);
        CREATE INDEX IF NOT EXISTS idx_employees_email ON employees(email);
        CREATE INDEX IF NOT EXISTS idx_employees_department ON employees(department);
        CREATE INDEX IF NOT EXISTS idx_employees_work_state ON employees(work_state);
        CREATE INDEX IF NOT EXISTS idx_employees_status ON employees(employment_status);
        CREATE INDEX IF NOT EXISTS idx_employees_name ON employees(last_name, first_name);
        CREATE INDEX IF NOT EXISTS idx_employees_external_id ON employees(customer_id, external_employee_id);

        -- Trigger for updated_at
        CREATE TRIGGER update_employees_updated_at BEFORE UPDATE ON employees
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    """)

    # =============================================================================
    # EMPLOYEE LICENSES TABLE
    # =============================================================================
    op.execute("""
        CREATE TABLE IF NOT EXISTS employee_licenses (
            license_id UUID PRIMARY KEY DEFAULT compliance_uuid(),
            employee_id UUID NOT NULL REFERENCES employees(employee_id) ON DELETE CASCADE,
            license_type_id UUID NOT NULL REFERENCES license_types(license_type_id),

            -- License Details
            license_number VARCHAR(100) NOT NULL,
            issuing_state CHAR(2) NOT NULL,
            issuing_authority VARCHAR(200),

            -- Dates
            issue_date DATE,
            expiration_date DATE,

            -- Status
            license_status VARCHAR(20) NOT NULL DEFAULT 'pending_verification'
                CHECK (license_status IN (
                    'active', 'expired', 'suspended', 'revoked',
                    'pending_verification', 'verification_failed', 'not_found'
                )),

            -- Verification Status
            verification_status VARCHAR(20) NOT NULL DEFAULT 'unverified'
                CHECK (verification_status IN (
                    'unverified', 'verified', 'verification_pending',
                    'verification_failed', 'manual_review_required'
                )),
            last_verified_at TIMESTAMP WITH TIME ZONE,
            next_verification_due TIMESTAMP WITH TIME ZONE,
            verification_attempts INTEGER NOT NULL DEFAULT 0,

            -- Confidence and Source
            confidence_score DECIMAL(3,2),
            verification_source VARCHAR(100),

            -- Additional Data
            compact_privilege BOOLEAN DEFAULT false,  -- Nurse Licensure Compact
            multi_state_valid BOOLEAN DEFAULT false,
            specializations TEXT[],
            restrictions TEXT[],

            -- Audit Fields
            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
            created_by VARCHAR(100),
            updated_by VARCHAR(100),

            -- Raw verification response
            raw_verification_data JSONB,

            -- Constraints
            UNIQUE(employee_id, license_type_id, license_number, issuing_state)
        );

        -- Indexes for employee_licenses
        CREATE INDEX IF NOT EXISTS idx_employee_licenses_employee_id ON employee_licenses(employee_id);
        CREATE INDEX IF NOT EXISTS idx_employee_licenses_license_type ON employee_licenses(license_type_id);
        CREATE INDEX IF NOT EXISTS idx_employee_licenses_number ON employee_licenses(license_number);
        CREATE INDEX IF NOT EXISTS idx_employee_licenses_state ON employee_licenses(issuing_state);
        CREATE INDEX IF NOT EXISTS idx_employee_licenses_status ON employee_licenses(license_status);
        CREATE INDEX IF NOT EXISTS idx_employee_licenses_expiration ON employee_licenses(expiration_date);
        CREATE INDEX IF NOT EXISTS idx_employee_licenses_verification_status ON employee_licenses(verification_status);
        CREATE INDEX IF NOT EXISTS idx_employee_licenses_next_verification ON employee_licenses(next_verification_due);

        -- Composite index for expiring licenses query
        CREATE INDEX IF NOT EXISTS idx_employee_licenses_expiring
            ON employee_licenses(expiration_date, license_status)
            WHERE license_status = 'active' AND expiration_date IS NOT NULL;

        -- Trigger for updated_at
        CREATE TRIGGER update_employee_licenses_updated_at BEFORE UPDATE ON employee_licenses
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    """)

    # =============================================================================
    # LICENSE VERIFICATION HISTORY TABLE
    # =============================================================================
    op.execute("""
        CREATE TABLE IF NOT EXISTS license_verification_history (
            verification_id UUID PRIMARY KEY DEFAULT compliance_uuid(),
            license_id UUID NOT NULL REFERENCES employee_licenses(license_id) ON DELETE CASCADE,

            -- Verification Details
            verification_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
            verification_method VARCHAR(50) NOT NULL
                CHECK (verification_method IN ('api', 'manual', 'bulk_import', 'scheduled')),
            verification_source VARCHAR(100),

            -- Results
            previous_status VARCHAR(20),
            new_status VARCHAR(20) NOT NULL,
            confidence_score DECIMAL(3,2),

            -- Response Data
            api_response JSONB,
            error_message TEXT,

            -- Timing
            verification_duration_ms INTEGER,

            -- Audit
            verified_by VARCHAR(100),
            ip_address INET,
            user_agent TEXT,

            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
        );

        -- Indexes for verification history
        CREATE INDEX IF NOT EXISTS idx_verification_history_license_id ON license_verification_history(license_id);
        CREATE INDEX IF NOT EXISTS idx_verification_history_date ON license_verification_history(verification_date);
        CREATE INDEX IF NOT EXISTS idx_verification_history_status ON license_verification_history(new_status);
    """)

    # =============================================================================
    # COMPLIANCE RULES - DEPARTMENT REQUIREMENTS
    # =============================================================================
    op.execute("""
        CREATE TABLE IF NOT EXISTS compliance_department_rules (
            rule_id UUID PRIMARY KEY DEFAULT compliance_uuid(),
            customer_id UUID NOT NULL REFERENCES customers(customer_id) ON DELETE CASCADE,

            department VARCHAR(200) NOT NULL,
            license_type_id UUID NOT NULL REFERENCES license_types(license_type_id),

            -- Rule Configuration
            is_required BOOLEAN NOT NULL DEFAULT true,
            grace_period_days INTEGER DEFAULT 30,  -- Days after expiration before non-compliant
            advance_warning_days INTEGER DEFAULT 90,  -- Days before expiration to warn

            -- State Requirements
            required_states CHAR(2)[],  -- If employee works in these states

            -- Active/Inactive
            is_active BOOLEAN NOT NULL DEFAULT true,

            -- Audit
            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
            created_by VARCHAR(100),

            UNIQUE(customer_id, department, license_type_id)
        );

        CREATE INDEX IF NOT EXISTS idx_dept_rules_customer ON compliance_department_rules(customer_id);
        CREATE INDEX IF NOT EXISTS idx_dept_rules_department ON compliance_department_rules(department);
        CREATE INDEX IF NOT EXISTS idx_dept_rules_license_type ON compliance_department_rules(license_type_id);

        CREATE TRIGGER update_dept_rules_updated_at BEFORE UPDATE ON compliance_department_rules
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    """)

    # =============================================================================
    # COMPLIANCE RULES - POSITION REQUIREMENTS
    # =============================================================================
    op.execute("""
        CREATE TABLE IF NOT EXISTS compliance_position_rules (
            rule_id UUID PRIMARY KEY DEFAULT compliance_uuid(),
            customer_id UUID NOT NULL REFERENCES customers(customer_id) ON DELETE CASCADE,

            position VARCHAR(200) NOT NULL,
            license_type_id UUID NOT NULL REFERENCES license_types(license_type_id),

            -- Rule Configuration
            is_required BOOLEAN NOT NULL DEFAULT true,
            grace_period_days INTEGER DEFAULT 30,
            advance_warning_days INTEGER DEFAULT 90,

            -- Active/Inactive
            is_active BOOLEAN NOT NULL DEFAULT true,

            -- Audit
            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
            created_by VARCHAR(100),

            UNIQUE(customer_id, position, license_type_id)
        );

        CREATE INDEX IF NOT EXISTS idx_position_rules_customer ON compliance_position_rules(customer_id);
        CREATE INDEX IF NOT EXISTS idx_position_rules_position ON compliance_position_rules(position);
        CREATE INDEX IF NOT EXISTS idx_position_rules_license_type ON compliance_position_rules(license_type_id);

        CREATE TRIGGER update_position_rules_updated_at BEFORE UPDATE ON compliance_position_rules
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    """)

    # =============================================================================
    # COMPLIANCE ALERTS TABLE
    # =============================================================================
    op.execute("""
        CREATE TABLE IF NOT EXISTS compliance_alerts (
            alert_id UUID PRIMARY KEY DEFAULT compliance_uuid(),
            customer_id UUID NOT NULL REFERENCES customers(customer_id) ON DELETE CASCADE,
            employee_id UUID REFERENCES employees(employee_id) ON DELETE SET NULL,
            license_id UUID REFERENCES employee_licenses(license_id) ON DELETE SET NULL,

            -- Alert Type
            alert_type VARCHAR(50) NOT NULL
                CHECK (alert_type IN (
                    'license_expiring', 'license_expired', 'license_suspended',
                    'license_revoked', 'verification_failed', 'verification_required',
                    'compliance_violation', 'missing_license'
                )),

            -- Severity
            severity VARCHAR(20) NOT NULL DEFAULT 'warning'
                CHECK (severity IN ('info', 'warning', 'critical')),

            -- Alert Details
            title VARCHAR(200) NOT NULL,
            description TEXT,
            due_date DATE,

            -- Status
            alert_status VARCHAR(20) NOT NULL DEFAULT 'active'
                CHECK (alert_status IN ('active', 'acknowledged', 'resolved', 'dismissed')),

            -- Resolution
            acknowledged_at TIMESTAMP WITH TIME ZONE,
            acknowledged_by VARCHAR(100),
            resolved_at TIMESTAMP WITH TIME ZONE,
            resolved_by VARCHAR(100),
            resolution_notes TEXT,

            -- Notification
            notification_sent BOOLEAN DEFAULT false,
            notification_sent_at TIMESTAMP WITH TIME ZONE,

            -- Audit
            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
        );

        CREATE INDEX IF NOT EXISTS idx_alerts_customer ON compliance_alerts(customer_id);
        CREATE INDEX IF NOT EXISTS idx_alerts_employee ON compliance_alerts(employee_id);
        CREATE INDEX IF NOT EXISTS idx_alerts_license ON compliance_alerts(license_id);
        CREATE INDEX IF NOT EXISTS idx_alerts_type ON compliance_alerts(alert_type);
        CREATE INDEX IF NOT EXISTS idx_alerts_status ON compliance_alerts(alert_status);
        CREATE INDEX IF NOT EXISTS idx_alerts_severity ON compliance_alerts(severity);
        CREATE INDEX IF NOT EXISTS idx_alerts_due_date ON compliance_alerts(due_date);

        CREATE TRIGGER update_alerts_updated_at BEFORE UPDATE ON compliance_alerts
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    """)

    # =============================================================================
    # STORED PROCEDURES - EMPLOYEE OPERATIONS
    # =============================================================================
    op.execute("""
        -- Create Employee
        CREATE OR REPLACE FUNCTION create_employee(
            p_customer_id UUID,
            p_first_name VARCHAR(100),
            p_last_name VARCHAR(100),
            p_email VARCHAR(255),
            p_phone VARCHAR(20) DEFAULT NULL,
            p_external_employee_id VARCHAR(100) DEFAULT NULL,
            p_position VARCHAR(200) DEFAULT NULL,
            p_department VARCHAR(200) DEFAULT NULL,
            p_hire_date DATE DEFAULT NULL,
            p_work_state CHAR(2) DEFAULT NULL,
            p_work_city VARCHAR(100) DEFAULT NULL,
            p_work_location VARCHAR(200) DEFAULT NULL,
            p_created_by VARCHAR(100) DEFAULT 'system'
        )
        RETURNS TABLE (
            employee_id UUID,
            created BOOLEAN,
            message TEXT
        )
        LANGUAGE plpgsql
        SECURITY DEFINER
        SET search_path = public
        AS $$
        DECLARE
            v_employee_id UUID;
        BEGIN
            -- Validate customer exists
            IF NOT EXISTS (SELECT 1 FROM customers WHERE customers.customer_id = p_customer_id) THEN
                RETURN QUERY SELECT NULL::UUID, false, 'Customer not found';
                RETURN;
            END IF;

            -- Check for duplicate email
            IF EXISTS (SELECT 1 FROM employees WHERE employees.customer_id = p_customer_id AND employees.email = p_email) THEN
                RETURN QUERY SELECT NULL::UUID, false, 'Employee with this email already exists';
                RETURN;
            END IF;

            -- Insert employee
            INSERT INTO employees (
                customer_id, first_name, last_name, email, phone,
                external_employee_id, position, department, hire_date,
                work_state, work_city, work_location, created_by
            ) VALUES (
                p_customer_id, p_first_name, p_last_name, p_email, p_phone,
                p_external_employee_id, p_position, p_department, p_hire_date,
                p_work_state, p_work_city, p_work_location, p_created_by
            ) RETURNING employees.employee_id INTO v_employee_id;

            -- Log the creation
            PERFORM audit_user_activity(
                p_customer_id::TEXT,
                'employee_created',
                'employee',
                v_employee_id::TEXT,
                NULL,
                jsonb_build_object('name', p_first_name || ' ' || p_last_name, 'email', p_email)
            );

            RETURN QUERY SELECT v_employee_id, true, 'Employee created successfully';
        END;
        $$;
    """)

    op.execute("""
        -- Update Employee
        CREATE OR REPLACE FUNCTION update_employee(
            p_employee_id UUID,
            p_customer_id UUID,
            p_first_name VARCHAR(100) DEFAULT NULL,
            p_last_name VARCHAR(100) DEFAULT NULL,
            p_email VARCHAR(255) DEFAULT NULL,
            p_phone VARCHAR(20) DEFAULT NULL,
            p_external_employee_id VARCHAR(100) DEFAULT NULL,
            p_position VARCHAR(200) DEFAULT NULL,
            p_department VARCHAR(200) DEFAULT NULL,
            p_work_state CHAR(2) DEFAULT NULL,
            p_work_city VARCHAR(100) DEFAULT NULL,
            p_work_location VARCHAR(200) DEFAULT NULL,
            p_employment_status VARCHAR(20) DEFAULT NULL,
            p_termination_date DATE DEFAULT NULL,
            p_updated_by VARCHAR(100) DEFAULT 'system'
        )
        RETURNS TABLE (
            updated BOOLEAN,
            message TEXT
        )
        LANGUAGE plpgsql
        SECURITY DEFINER
        SET search_path = public
        AS $$
        BEGIN
            -- Verify employee exists and belongs to customer
            IF NOT EXISTS (
                SELECT 1 FROM employees
                WHERE employees.employee_id = p_employee_id AND employees.customer_id = p_customer_id
            ) THEN
                RETURN QUERY SELECT false, 'Employee not found';
                RETURN;
            END IF;

            -- Update employee (only non-null parameters)
            UPDATE employees SET
                first_name = COALESCE(p_first_name, first_name),
                last_name = COALESCE(p_last_name, last_name),
                email = COALESCE(p_email, email),
                phone = COALESCE(p_phone, phone),
                external_employee_id = COALESCE(p_external_employee_id, external_employee_id),
                position = COALESCE(p_position, position),
                department = COALESCE(p_department, department),
                work_state = COALESCE(p_work_state, work_state),
                work_city = COALESCE(p_work_city, work_city),
                work_location = COALESCE(p_work_location, work_location),
                employment_status = COALESCE(p_employment_status, employment_status),
                termination_date = COALESCE(p_termination_date, termination_date),
                updated_by = p_updated_by
            WHERE employees.employee_id = p_employee_id;

            RETURN QUERY SELECT true, 'Employee updated successfully';
        END;
        $$;
    """)

    op.execute("""
        -- Deactivate Employee (soft delete)
        CREATE OR REPLACE FUNCTION deactivate_employee(
            p_employee_id UUID,
            p_customer_id UUID,
            p_termination_date DATE DEFAULT CURRENT_DATE,
            p_updated_by VARCHAR(100) DEFAULT 'system'
        )
        RETURNS TABLE (
            deactivated BOOLEAN,
            message TEXT
        )
        LANGUAGE plpgsql
        SECURITY DEFINER
        SET search_path = public
        AS $$
        BEGIN
            UPDATE employees SET
                employment_status = 'terminated',
                termination_date = p_termination_date,
                updated_by = p_updated_by
            WHERE employees.employee_id = p_employee_id
                AND employees.customer_id = p_customer_id;

            IF NOT FOUND THEN
                RETURN QUERY SELECT false, 'Employee not found';
                RETURN;
            END IF;

            -- Log the deactivation
            PERFORM audit_user_activity(
                p_customer_id::TEXT,
                'employee_deactivated',
                'employee',
                p_employee_id::TEXT,
                NULL,
                jsonb_build_object('termination_date', p_termination_date)
            );

            RETURN QUERY SELECT true, 'Employee deactivated successfully';
        END;
        $$;
    """)

    # =============================================================================
    # STORED PROCEDURES - LICENSE OPERATIONS
    # =============================================================================
    op.execute("""
        -- Add License to Employee
        CREATE OR REPLACE FUNCTION add_employee_license(
            p_employee_id UUID,
            p_license_type VARCHAR(50),
            p_license_number VARCHAR(100),
            p_issuing_state CHAR(2),
            p_issuing_authority VARCHAR(200) DEFAULT NULL,
            p_issue_date DATE DEFAULT NULL,
            p_expiration_date DATE DEFAULT NULL,
            p_created_by VARCHAR(100) DEFAULT 'system'
        )
        RETURNS TABLE (
            license_id UUID,
            created BOOLEAN,
            message TEXT
        )
        LANGUAGE plpgsql
        SECURITY DEFINER
        SET search_path = public
        AS $$
        DECLARE
            v_license_id UUID;
            v_license_type_id UUID;
            v_customer_id UUID;
        BEGIN
            -- Get license type ID
            SELECT license_types.license_type_id INTO v_license_type_id
            FROM license_types
            WHERE license_types.type_name = p_license_type;

            IF NOT FOUND THEN
                RETURN QUERY SELECT NULL::UUID, false, 'Invalid license type: ' || p_license_type;
                RETURN;
            END IF;

            -- Get customer_id from employee
            SELECT employees.customer_id INTO v_customer_id
            FROM employees
            WHERE employees.employee_id = p_employee_id;

            IF NOT FOUND THEN
                RETURN QUERY SELECT NULL::UUID, false, 'Employee not found';
                RETURN;
            END IF;

            -- Check for duplicate license
            IF EXISTS (
                SELECT 1 FROM employee_licenses el
                WHERE el.employee_id = p_employee_id
                    AND el.license_type_id = v_license_type_id
                    AND el.license_number = p_license_number
                    AND el.issuing_state = p_issuing_state
            ) THEN
                RETURN QUERY SELECT NULL::UUID, false, 'License already exists for this employee';
                RETURN;
            END IF;

            -- Determine initial status based on expiration
            INSERT INTO employee_licenses (
                employee_id, license_type_id, license_number, issuing_state,
                issuing_authority, issue_date, expiration_date,
                license_status, created_by,
                next_verification_due
            ) VALUES (
                p_employee_id, v_license_type_id, p_license_number, p_issuing_state,
                p_issuing_authority, p_issue_date, p_expiration_date,
                CASE
                    WHEN p_expiration_date IS NULL THEN 'pending_verification'
                    WHEN p_expiration_date < CURRENT_DATE THEN 'expired'
                    ELSE 'pending_verification'
                END,
                p_created_by,
                NOW() -- Verify immediately
            ) RETURNING employee_licenses.license_id INTO v_license_id;

            -- Log the addition
            PERFORM audit_user_activity(
                v_customer_id::TEXT,
                'license_added',
                'employee_license',
                v_license_id::TEXT,
                NULL,
                jsonb_build_object(
                    'employee_id', p_employee_id,
                    'license_type', p_license_type,
                    'license_number', p_license_number
                )
            );

            RETURN QUERY SELECT v_license_id, true, 'License added successfully';
        END;
        $$;
    """)

    op.execute("""
        -- Record License Verification
        CREATE OR REPLACE FUNCTION record_license_verification(
            p_license_id UUID,
            p_verification_method VARCHAR(50),
            p_new_status VARCHAR(20),
            p_confidence_score DECIMAL(3,2) DEFAULT NULL,
            p_verification_source VARCHAR(100) DEFAULT NULL,
            p_api_response JSONB DEFAULT NULL,
            p_error_message TEXT DEFAULT NULL,
            p_duration_ms INTEGER DEFAULT NULL,
            p_verified_by VARCHAR(100) DEFAULT 'system',
            p_ip_address INET DEFAULT NULL
        )
        RETURNS TABLE (
            verification_id UUID,
            recorded BOOLEAN,
            message TEXT
        )
        LANGUAGE plpgsql
        SECURITY DEFINER
        SET search_path = public
        AS $$
        DECLARE
            v_verification_id UUID;
            v_previous_status VARCHAR(20);
            v_customer_id UUID;
        BEGIN
            -- Get current status and customer_id
            SELECT el.verification_status, e.customer_id
            INTO v_previous_status, v_customer_id
            FROM employee_licenses el
            JOIN employees e ON el.employee_id = e.employee_id
            WHERE el.license_id = p_license_id;

            IF NOT FOUND THEN
                RETURN QUERY SELECT NULL::UUID, false, 'License not found';
                RETURN;
            END IF;

            -- Insert verification history
            INSERT INTO license_verification_history (
                license_id, verification_method, verification_source,
                previous_status, new_status, confidence_score,
                api_response, error_message, verification_duration_ms,
                verified_by, ip_address
            ) VALUES (
                p_license_id, p_verification_method, p_verification_source,
                v_previous_status, p_new_status, p_confidence_score,
                p_api_response, p_error_message, p_duration_ms,
                p_verified_by, p_ip_address
            ) RETURNING license_verification_history.verification_id INTO v_verification_id;

            -- Update the license record
            UPDATE employee_licenses SET
                verification_status = p_new_status,
                license_status = CASE
                    WHEN p_new_status = 'verified' AND expiration_date >= CURRENT_DATE THEN 'active'
                    WHEN p_new_status = 'verified' AND expiration_date < CURRENT_DATE THEN 'expired'
                    WHEN p_new_status = 'verification_failed' THEN 'verification_failed'
                    ELSE license_status
                END,
                last_verified_at = NOW(),
                next_verification_due = NOW() + INTERVAL '30 days',  -- Verify monthly
                verification_attempts = verification_attempts + 1,
                confidence_score = COALESCE(p_confidence_score, confidence_score),
                verification_source = COALESCE(p_verification_source, verification_source),
                raw_verification_data = p_api_response,
                updated_by = p_verified_by
            WHERE employee_licenses.license_id = p_license_id;

            RETURN QUERY SELECT v_verification_id, true, 'Verification recorded';
        END;
        $$;
    """)

    op.execute("""
        -- Get Expiring Licenses
        CREATE OR REPLACE FUNCTION get_expiring_licenses(
            p_customer_id UUID,
            p_days_ahead INTEGER DEFAULT 90,
            p_department VARCHAR(200) DEFAULT NULL,
            p_license_type VARCHAR(50) DEFAULT NULL
        )
        RETURNS TABLE (
            license_id UUID,
            employee_id UUID,
            employee_name TEXT,
            employee_email VARCHAR(255),
            department VARCHAR(200),
            employee_position VARCHAR(200),
            license_type_name VARCHAR(50),
            license_number VARCHAR(100),
            issuing_state CHAR(2),
            expiration_date DATE,
            days_until_expiration INTEGER,
            license_status VARCHAR(20),
            verification_status VARCHAR(20)
        )
        LANGUAGE plpgsql
        SECURITY DEFINER
        SET search_path = public
        AS $$
        BEGIN
            RETURN QUERY
            SELECT
                el.license_id,
                e.employee_id,
                e.first_name || ' ' || e.last_name,
                e.email,
                e.department,
                e.position,
                lt.type_name,
                el.license_number,
                el.issuing_state,
                el.expiration_date,
                (el.expiration_date - CURRENT_DATE)::INTEGER,
                el.license_status,
                el.verification_status
            FROM employee_licenses el
            JOIN employees e ON el.employee_id = e.employee_id
            JOIN license_types lt ON el.license_type_id = lt.license_type_id
            WHERE e.customer_id = p_customer_id
                AND e.employment_status = 'active'
                AND el.expiration_date IS NOT NULL
                AND el.expiration_date <= CURRENT_DATE + p_days_ahead
                AND el.license_status NOT IN ('revoked', 'suspended')
                AND (p_department IS NULL OR e.department = p_department)
                AND (p_license_type IS NULL OR lt.type_name = p_license_type)
            ORDER BY el.expiration_date ASC;
        END;
        $$;
    """)

    op.execute("""
        -- Get Employee Compliance Status
        CREATE OR REPLACE FUNCTION get_employee_compliance_status(
            p_employee_id UUID
        )
        RETURNS TABLE (
            employee_id UUID,
            employee_name TEXT,
            department VARCHAR(200),
            employee_position VARCHAR(200),
            total_licenses INTEGER,
            active_licenses INTEGER,
            expiring_soon INTEGER,
            expired_licenses INTEGER,
            pending_verification INTEGER,
            is_compliant BOOLEAN,
            compliance_issues JSONB
        )
        LANGUAGE plpgsql
        SECURITY DEFINER
        SET search_path = public
        AS $$
        DECLARE
            v_employee RECORD;
            v_issues JSONB := '[]'::jsonb;
            v_total INTEGER;
            v_active INTEGER;
            v_expiring INTEGER;
            v_expired INTEGER;
            v_pending INTEGER;
        BEGIN
            -- Get employee info
            SELECT e.employee_id, e.first_name, e.last_name, e.department, e.position,
                   e.customer_id, e.work_state
            INTO v_employee
            FROM employees e
            WHERE e.employee_id = p_employee_id;

            IF NOT FOUND THEN
                RETURN;
            END IF;

            -- Count licenses by status
            SELECT
                COUNT(*),
                COUNT(*) FILTER (WHERE el.license_status = 'active'),
                COUNT(*) FILTER (WHERE el.license_status = 'active'
                    AND el.expiration_date BETWEEN CURRENT_DATE AND CURRENT_DATE + 90),
                COUNT(*) FILTER (WHERE el.license_status = 'expired'),
                COUNT(*) FILTER (WHERE el.verification_status IN ('unverified', 'verification_pending'))
            INTO v_total, v_active, v_expiring, v_expired, v_pending
            FROM employee_licenses el
            WHERE el.employee_id = p_employee_id;

            -- Check for required licenses based on department rules
            SELECT jsonb_agg(jsonb_build_object(
                'type', 'missing_required_license',
                'license_type', lt.type_name,
                'rule', 'department_requirement',
                'department', v_employee.department
            ))
            INTO v_issues
            FROM compliance_department_rules cdr
            JOIN license_types lt ON cdr.license_type_id = lt.license_type_id
            WHERE cdr.customer_id = v_employee.customer_id
                AND cdr.department = v_employee.department
                AND cdr.is_required = true
                AND cdr.is_active = true
                AND NOT EXISTS (
                    SELECT 1 FROM employee_licenses el
                    WHERE el.employee_id = p_employee_id
                        AND el.license_type_id = cdr.license_type_id
                        AND el.license_status = 'active'
                );

            v_issues := COALESCE(v_issues, '[]'::jsonb);

            -- Add expired license issues
            SELECT v_issues || COALESCE(jsonb_agg(jsonb_build_object(
                'type', 'expired_license',
                'license_type', lt.type_name,
                'license_number', el.license_number,
                'expired_date', el.expiration_date
            )), '[]'::jsonb)
            INTO v_issues
            FROM employee_licenses el
            JOIN license_types lt ON el.license_type_id = lt.license_type_id
            WHERE el.employee_id = p_employee_id
                AND el.license_status = 'expired';

            RETURN QUERY SELECT
                v_employee.employee_id,
                v_employee.first_name || ' ' || v_employee.last_name,
                v_employee.department,
                v_employee.position,
                v_total,
                v_active,
                v_expiring,
                v_expired,
                v_pending,
                (jsonb_array_length(v_issues) = 0),
                v_issues;
        END;
        $$;
    """)

    # =============================================================================
    # STORED PROCEDURES - COMPLIANCE REPORTS
    # =============================================================================
    op.execute("""
        -- Get Department Compliance Summary
        CREATE OR REPLACE FUNCTION get_department_compliance_summary(
            p_customer_id UUID,
            p_department VARCHAR(200) DEFAULT NULL
        )
        RETURNS TABLE (
            department VARCHAR(200),
            total_employees BIGINT,
            compliant_employees BIGINT,
            non_compliant_employees BIGINT,
            compliance_percentage DECIMAL(5,2),
            expiring_licenses_30_days BIGINT,
            expiring_licenses_90_days BIGINT,
            expired_licenses BIGINT,
            pending_verifications BIGINT
        )
        LANGUAGE plpgsql
        SECURITY DEFINER
        SET search_path = public
        AS $$
        BEGIN
            RETURN QUERY
            WITH employee_compliance AS (
                SELECT
                    e.department,
                    e.employee_id,
                    CASE
                        WHEN EXISTS (
                            SELECT 1 FROM employee_licenses el
                            WHERE el.employee_id = e.employee_id
                                AND el.license_status = 'expired'
                        ) THEN false
                        WHEN EXISTS (
                            SELECT 1 FROM compliance_department_rules cdr
                            WHERE cdr.customer_id = e.customer_id
                                AND cdr.department = e.department
                                AND cdr.is_required = true
                                AND cdr.is_active = true
                                AND NOT EXISTS (
                                    SELECT 1 FROM employee_licenses el
                                    WHERE el.employee_id = e.employee_id
                                        AND el.license_type_id = cdr.license_type_id
                                        AND el.license_status = 'active'
                                )
                        ) THEN false
                        ELSE true
                    END as is_compliant
                FROM employees e
                WHERE e.customer_id = p_customer_id
                    AND e.employment_status = 'active'
                    AND (p_department IS NULL OR e.department = p_department)
            )
            SELECT
                COALESCE(ec.department, 'Unassigned')::VARCHAR(200),
                COUNT(DISTINCT ec.employee_id),
                COUNT(DISTINCT ec.employee_id) FILTER (WHERE ec.is_compliant),
                COUNT(DISTINCT ec.employee_id) FILTER (WHERE NOT ec.is_compliant),
                ROUND(
                    COUNT(DISTINCT ec.employee_id) FILTER (WHERE ec.is_compliant)::DECIMAL /
                    NULLIF(COUNT(DISTINCT ec.employee_id), 0) * 100,
                    2
                ),
                (SELECT COUNT(*) FROM employee_licenses el
                 JOIN employees emp ON el.employee_id = emp.employee_id
                 WHERE emp.customer_id = p_customer_id
                     AND (p_department IS NULL OR emp.department = p_department)
                     AND el.expiration_date BETWEEN CURRENT_DATE AND CURRENT_DATE + 30),
                (SELECT COUNT(*) FROM employee_licenses el
                 JOIN employees emp ON el.employee_id = emp.employee_id
                 WHERE emp.customer_id = p_customer_id
                     AND (p_department IS NULL OR emp.department = p_department)
                     AND el.expiration_date BETWEEN CURRENT_DATE AND CURRENT_DATE + 90),
                (SELECT COUNT(*) FROM employee_licenses el
                 JOIN employees emp ON el.employee_id = emp.employee_id
                 WHERE emp.customer_id = p_customer_id
                     AND (p_department IS NULL OR emp.department = p_department)
                     AND el.license_status = 'expired'),
                (SELECT COUNT(*) FROM employee_licenses el
                 JOIN employees emp ON el.employee_id = emp.employee_id
                 WHERE emp.customer_id = p_customer_id
                     AND (p_department IS NULL OR emp.department = p_department)
                     AND el.verification_status IN ('unverified', 'verification_pending'))
            FROM employee_compliance ec
            GROUP BY ec.department
            ORDER BY ec.department;
        END;
        $$;
    """)

    op.execute("""
        -- Get Licenses Needing Verification
        CREATE OR REPLACE FUNCTION get_licenses_needing_verification(
            p_customer_id UUID,
            p_limit INTEGER DEFAULT 100
        )
        RETURNS TABLE (
            license_id UUID,
            employee_id UUID,
            employee_name TEXT,
            license_type VARCHAR(50),
            license_number VARCHAR(100),
            issuing_state CHAR(2),
            verification_status VARCHAR(20),
            last_verified_at TIMESTAMP WITH TIME ZONE,
            days_since_verification INTEGER,
            verification_attempts INTEGER,
            priority INTEGER  -- 1=highest
        )
        LANGUAGE plpgsql
        SECURITY DEFINER
        SET search_path = public
        AS $$
        BEGIN
            RETURN QUERY
            SELECT
                el.license_id,
                e.employee_id,
                e.first_name || ' ' || e.last_name,
                lt.type_name,
                el.license_number,
                el.issuing_state,
                el.verification_status,
                el.last_verified_at,
                EXTRACT(DAY FROM NOW() - COALESCE(el.last_verified_at, el.created_at))::INTEGER,
                el.verification_attempts,
                CASE
                    WHEN el.verification_status = 'unverified' THEN 1
                    WHEN el.verification_status = 'verification_failed' AND el.verification_attempts < 3 THEN 2
                    WHEN el.next_verification_due < NOW() THEN 3
                    ELSE 4
                END
            FROM employee_licenses el
            JOIN employees e ON el.employee_id = e.employee_id
            JOIN license_types lt ON el.license_type_id = lt.license_type_id
            WHERE e.customer_id = p_customer_id
                AND e.employment_status = 'active'
                AND (
                    el.verification_status IN ('unverified', 'verification_pending')
                    OR (el.verification_status = 'verification_failed' AND el.verification_attempts < 3)
                    OR el.next_verification_due < NOW()
                )
            ORDER BY
                CASE
                    WHEN el.verification_status = 'unverified' THEN 1
                    WHEN el.verification_status = 'verification_failed' THEN 2
                    ELSE 3
                END,
                el.created_at
            LIMIT p_limit;
        END;
        $$;
    """)

    # =============================================================================
    # STORED PROCEDURES - BULK OPERATIONS
    # =============================================================================
    op.execute("""
        -- Bulk Import Employees
        CREATE OR REPLACE FUNCTION bulk_import_employees(
            p_customer_id UUID,
            p_employees JSONB,  -- Array of employee objects
            p_created_by VARCHAR(100) DEFAULT 'bulk_import'
        )
        RETURNS TABLE (
            total_processed INTEGER,
            successful INTEGER,
            failed INTEGER,
            errors JSONB
        )
        LANGUAGE plpgsql
        SECURITY DEFINER
        SET search_path = public
        AS $$
        DECLARE
            v_employee JSONB;
            v_total INTEGER := 0;
            v_success INTEGER := 0;
            v_failed INTEGER := 0;
            v_errors JSONB := '[]'::jsonb;
            v_result RECORD;
        BEGIN
            FOR v_employee IN SELECT * FROM jsonb_array_elements(p_employees)
            LOOP
                v_total := v_total + 1;

                BEGIN
                    SELECT * INTO v_result FROM create_employee(
                        p_customer_id,
                        (v_employee->>'first_name')::VARCHAR(100),
                        (v_employee->>'last_name')::VARCHAR(100),
                        (v_employee->>'email')::VARCHAR(255),
                        (v_employee->>'phone')::VARCHAR(20),
                        (v_employee->>'external_employee_id')::VARCHAR(100),
                        (v_employee->>'position')::VARCHAR(200),
                        (v_employee->>'department')::VARCHAR(200),
                        (v_employee->>'hire_date')::DATE,
                        (v_employee->>'work_state')::CHAR(2),
                        (v_employee->>'work_city')::VARCHAR(100),
                        (v_employee->>'work_location')::VARCHAR(200),
                        p_created_by
                    );

                    IF v_result.created THEN
                        v_success := v_success + 1;
                    ELSE
                        v_failed := v_failed + 1;
                        v_errors := v_errors || jsonb_build_object(
                            'row', v_total,
                            'email', v_employee->>'email',
                            'error', v_result.message
                        );
                    END IF;
                EXCEPTION WHEN OTHERS THEN
                    v_failed := v_failed + 1;
                    v_errors := v_errors || jsonb_build_object(
                        'row', v_total,
                        'email', v_employee->>'email',
                        'error', SQLERRM
                    );
                END;
            END LOOP;

            -- Log the bulk import
            PERFORM audit_user_activity(
                p_customer_id::TEXT,
                'bulk_employee_import',
                'employees',
                NULL,
                NULL,
                jsonb_build_object(
                    'total', v_total,
                    'successful', v_success,
                    'failed', v_failed
                )
            );

            RETURN QUERY SELECT v_total, v_success, v_failed, v_errors;
        END;
        $$;
    """)


def downgrade() -> None:
    """
    Rollback migration changes.
    Drop tables and procedures in reverse order of dependencies.
    """
    # Drop stored procedures
    op.execute("DROP FUNCTION IF EXISTS bulk_import_employees(UUID, JSONB, VARCHAR);")
    op.execute("DROP FUNCTION IF EXISTS get_licenses_needing_verification(UUID, INTEGER);")
    op.execute("DROP FUNCTION IF EXISTS get_department_compliance_summary(UUID, VARCHAR);")
    op.execute("DROP FUNCTION IF EXISTS get_employee_compliance_status(UUID);")
    op.execute("DROP FUNCTION IF EXISTS get_expiring_licenses(UUID, INTEGER, VARCHAR, VARCHAR);")
    op.execute("DROP FUNCTION IF EXISTS record_license_verification(UUID, VARCHAR, VARCHAR, DECIMAL, VARCHAR, JSONB, TEXT, INTEGER, VARCHAR, INET);")
    op.execute("DROP FUNCTION IF EXISTS add_employee_license(UUID, VARCHAR, VARCHAR, CHAR, VARCHAR, DATE, DATE, VARCHAR);")
    op.execute("DROP FUNCTION IF EXISTS deactivate_employee(UUID, UUID, DATE, VARCHAR);")
    op.execute("DROP FUNCTION IF EXISTS update_employee(UUID, UUID, VARCHAR, VARCHAR, VARCHAR, VARCHAR, VARCHAR, VARCHAR, VARCHAR, CHAR, VARCHAR, VARCHAR, VARCHAR, DATE, VARCHAR);")
    op.execute("DROP FUNCTION IF EXISTS create_employee(UUID, VARCHAR, VARCHAR, VARCHAR, VARCHAR, VARCHAR, VARCHAR, VARCHAR, DATE, CHAR, VARCHAR, VARCHAR, VARCHAR);")

    # Drop tables (reverse order of dependencies)
    op.execute("DROP TABLE IF EXISTS compliance_alerts;")
    op.execute("DROP TABLE IF EXISTS compliance_position_rules;")
    op.execute("DROP TABLE IF EXISTS compliance_department_rules;")
    op.execute("DROP TABLE IF EXISTS license_verification_history;")
    op.execute("DROP TABLE IF EXISTS employee_licenses;")
    op.execute("DROP TABLE IF EXISTS employees;")

    # Note: We don't delete the license_types we added - they're reference data
    # and removing them could break existing records

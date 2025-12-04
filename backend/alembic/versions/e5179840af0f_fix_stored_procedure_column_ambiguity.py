"""Fix stored procedure column ambiguity

Revision ID: e5179840af0f
Revises: 8497fc5acfae
Create Date: 2025-11-02 12:52:09.492430

MIGRATION SAFETY CHECKLIST:
- [ ] Changes are backward compatible with previous app version
- [ ] No columns/tables are dropped that current code uses
- [ ] New columns have appropriate defaults or are nullable
- [ ] Stored procedure signatures maintained for existing functions
- [ ] Migration can be safely rolled back
- [ ] Database changes tested with current application code

ROLLBACK STRATEGY:
- Application rollback: Traffic shift to previous version
- Database rollback: Only additive changes, no breaking removals
- Emergency: Point-in-time restore available with <5min RPO

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e5179840af0f'
down_revision: Union[str, Sequence[str], None] = '8497fc5acfae'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """
    Apply forward migration changes.
    All changes must be backward compatible.
    """
    # Execute our updated procedures SQL file with fixes
    procedures_sql = open('src/database/procedures.sql', 'r').read()
    op.execute(procedures_sql)


def downgrade() -> None:
    """
    Rollback migration changes.
    Should only undo additive changes, never remove data.
    """
    pass

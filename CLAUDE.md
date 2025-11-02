# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a compliance engine project that is currently in its initial development phase. The repository structure and development workflow will be established as the project grows.

## Development Workflow

As this is a new project, the development commands and build process are yet to be defined. When adding build tools, testing frameworks, or development scripts, update this file with the relevant commands.

### Python Environment Management

Always use virtual environments. Global installs break things.

```bash
python -m venv .venv
source .venv/bin/activate
poetry install
```

Docker handles this automatically in containers.

## Architecture Notes

### Technology Stack Preferences

**TypeScript First**: Use TypeScript for all JavaScript/Node.js code unless there's a compelling reason not to. This includes:
- Frontend applications (Next.js, React components)
- Node.js services and utilities
- Infrastructure as Code (AWS CDK)
- Build scripts and tooling

**Benefits for Compliance Systems**:
- Type safety reduces runtime errors in critical compliance logic
- Better developer experience with IntelliSense and refactoring
- Self-documenting code through type annotations
- Easier maintenance and debugging
- Industry standard for enterprise applications

### Backend Languages
- **Python**: FastAPI for main compliance APIs (excellent LLM ecosystem)
- **TypeScript**: Infrastructure, frontend, and Node.js utilities

### Infrastructure as Code (IaC) Requirement

**No Manual Configuration**: All infrastructure must be defined in code using AWS CDK (TypeScript). This includes:
- VPC, subnets, security groups
- ECS clusters, services, and task definitions
- RDS databases and parameter groups
- ALB, CloudFront distributions
- IAM roles and policies
- CloudWatch alarms and dashboards
- S3 buckets and policies

**Benefits for Compliance**:
- Repeatable deployments across environments
- Version-controlled infrastructure changes
- Audit trail of all infrastructure modifications
- Disaster recovery through code recreation
- Security policy enforcement through code review
- No configuration drift between environments

**Deployment Pattern**: GitOps with infrastructure changes deployed via CI/CD pipeline, never manually through AWS console.

The high-level architecture and technology decisions for this compliance engine are documented in the `product-planning/` folder. Key architectural decisions should be documented here as they are made to help future contributors understand the system design.

## Planning and Documentation

For complex features or larger initiatives, sketch out plans and store them in markdown documents with an eye towards being able to resume work at a later date. The `product-planning/` folder contains strategic product documentation and roadmaps.

### Diagrams

This project uses GitHub for version control. GitHub supports several diagram types in markdown files:
- **Mermaid diagrams** (```mermaid) - For flowcharts, sequence diagrams, architecture diagrams
- **GeoJSON/TopoJSON maps** (```geojson, ```topojson) - For geographic/location data
- **ASCII STL 3D models** (```stl) - For 3D visualizations

Use Mermaid diagrams for system architecture, data flows, and process documentation.

## Research Requirements

**Do not guess about technical details, pricing, features, or implementation specifics.** When in doubt about any technical information:

1. Search the internet to find factual, current information
2. Cite sources with links to official documentation, pricing pages, or authoritative sources
3. This is especially critical for:
   - AWS service pricing and features
   - Third-party service capabilities and costs
   - Technology stack compatibility
   - Performance benchmarks
   - Security best practices

Example: "According to AWS documentation, ALB pricing is $0.0225 per hour plus $0.008 per LCU-hour (source: https://aws.amazon.com/elasticloadbalancing/pricing/)"

## Planning Directory

The `/planning` directory is **gitignored** and used for:
- Complex implementation plans that span multiple sessions
- Work-in-progress architecture decisions
- TODO lists for complex features
- Experimental code and prototypes

Files in `/planning` may be incomplete, contain half-formed thoughts, or represent multiple implementation approaches. Use this space to think through complex problems before committing final solutions to the main codebase.

**File size guideline**: Keep individual files under 1000 lines to maintain context in memory during long sessions.

## TODO Management

For complex features, create TODO lists in `/planning` to track progress across sessions. Use the TodoWrite tool frequently to maintain visibility into implementation progress.

## Code Quality Standards

### DRY Principle (Don't Repeat Yourself)
- Periodically review code for duplication and extract common functionality
- Create reusable functions, classes, or modules for repeated logic
- Use inheritance, composition, or mixins appropriately

### Constants and Magic Numbers
- **No magic numbers**: Use meaningfully named constants instead of hardcoded values
- **Consolidate constants**: Avoid creating multiple constants with the same value if they serve the same purpose
- **Group related constants**: Use enums, dataclasses, or constant modules for organization

Examples:
```python
# Bad
if user.age >= 18:  # Magic number
    timeout = 300   # Another magic number

# Good  
LEGAL_AGE = 18
DEFAULT_TIMEOUT_SECONDS = 300

if user.age >= LEGAL_AGE:
    timeout = DEFAULT_TIMEOUT_SECONDS

# Better - grouped constants
class BusinessRules:
    LEGAL_AGE = 18
    DEFAULT_TIMEOUT_SECONDS = 300
    MAX_API_CALLS_PER_MINUTE = 1000
```

### Code Review Checklist
- [ ] No duplicated code patterns
- [ ] All magic numbers replaced with named constants
- [ ] Constants grouped logically and reused appropriately
- [ ] Function and variable names clearly express intent

## Important Patterns

As development patterns emerge in this codebase, document them here to maintain consistency across the project.
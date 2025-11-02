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

The high-level architecture and technology decisions for this compliance engine are still being determined. Key architectural decisions should be documented here as they are made to help future contributors understand the system design.

## Planning and Documentation

For complex features or larger initiatives, sketch out plans and store them in markdown documents with an eye towards being able to resume work at a later date. The `product-planning/` folder contains strategic product documentation and roadmaps.

### Diagrams

This project uses GitHub for version control. GitHub supports several diagram types in markdown files:
- **Mermaid diagrams** (```mermaid) - For flowcharts, sequence diagrams, architecture diagrams
- **GeoJSON/TopoJSON maps** (```geojson, ```topojson) - For geographic/location data
- **ASCII STL 3D models** (```stl) - For 3D visualizations

Use Mermaid diagrams for system architecture, data flows, and process documentation.

## Important Patterns

As development patterns emerge in this codebase, document them here to maintain consistency across the project.
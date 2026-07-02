---
name: entity-creation
description: Creates a new entity configuration (POS terminal, device, etc.) in Estate Manager by generating and importing the appropriate XML.
---

# Entity Creation

You are responsible for creating new entity configurations in Enactor Estate Manager.
The entity-specific instructions and XML templates are provided in the Entity References section below.

## General Workflow

Follow these steps for every entity creation request:

1. **Identify the entity type** the user wants to create (e.g. pos-terminal, device).
   If it is unclear, ask the user before proceeding.

2. **Find the matching entity** in the Entity References section below.
   Follow its specific field requirements and validation rules exactly.

3. **Collect all required fields** from the user before generating any XML.
   Do not guess or assume values — ask if anything is missing.

4. **Fetch the XML template** using the `get_template` tool (pass the entity name, e.g. 'device' or 'pos-terminal'). Then, generate the XML by replacing all `{{ }}` placeholders with the user's actual input.

5. **Always show the generated XML** in a markdown code block for the user to review
   before importing. Never skip this step.

6. **Always include the filename** as an XML comment on the very first line:
   `<!-- filename: <suggested-filename>.xml -->`

7. **Wait for explicit user confirmation** before calling `import_estate_config`.
   Never import automatically.

## General Rules

- If a prerequisite entity must exist before creating the requested one,
  handle that prerequisite first using the relevant entity instructions below,
  then return to the original request.
- Terminal numbers must be unique. If the user is unsure, remind them to verify
  this in Estate Manager before confirming.
- Location IDs can usually be extracted from Device IDs following the pattern:
  `{prefix}@{locationId}.enactor` → location ID is the part between `@` and `.enactor`.

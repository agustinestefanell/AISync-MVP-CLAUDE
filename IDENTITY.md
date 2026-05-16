# AISync — Identity Doctrine

## 0. Purpose

This document defines the official identity doctrine for AISync project, team and workspace orientation.

It covers:

- project-based visual identity;
- workspace color inheritance;
- hierarchical team codes;
- documentation origin codes;
- metadata rules for traceability.

This document is doctrinal. It does not implement UI, routing, database schema or component logic by itself.

---

## 1. Core Problem

AISync currently needs a stronger orientation system across Teams Map, Workspace and Documentation Mode.

The issue is not only visual. It is structural.

When multiple main project teams use the same black identity, the user cannot quickly understand which project or team they are inside.

When a secondary team is opened, the workspace does not consistently replicate the color of the originating team box. This breaks continuity between:

```text
Teams Map box → Team Workspace
```

Documentation Mode also needs to identify the structural origin of files, checkpoints, handoffs, backups, saved selections and documents.

---

## 2. Main Decision

AISync must not solve this by creating a new global manager role.

For MVP, AISync must solve this through:

```text
Color = Project identity
Code = Structural origin
Label = Functional role or team name
Workspace ribbons = Color inherited from opened team box
```

A future `Cell Orchestrator` or `Account Orchestrator` may be considered later, but it is not part of this MVP identity solution.

---

## 3. Project Color Rule

Each project must have a base color.

Example:

```text
Project A → blue
Project B → violet
Project C → green
Project D → orange / brown
```

The color identifies the project, not the role.

Black must not be used as the permanent identity color for all main project teams.

Black should be reserved for:

* global shell;
* active focus;
* navigation;
* high-level UI contrast;
* selected state when needed.

---

## 4. Hierarchy Intensity Rule

Inside each project, color intensity may express hierarchy.

Recommended logic:

```text
Main Team / Project General Manager → strongest project color
Direct Teams → medium project color
Subteams → lighter or related project color
```

The purpose is to keep the project identity visible while still showing hierarchy.

---

## 5. Workspace Color Inheritance Rule

When a user opens a team workspace, the workspace must inherit the color identity of the team box that launched it.

This applies especially to:

```text
Top ribbon
Bottom ribbon
Workspace header accents
```

Expected behavior:

```text
Green team box → green workspace ribbons
Violet team box → violet workspace ribbons
Orange team box → orange workspace ribbons
```

This preserves visual continuity between Teams Map and the opened workspace.

---

## 6. Hierarchical Code Rule

Every project, team and subteam should have a visible hierarchical code.

Format:

```text
A-00
A-01
A-02
A-02-01
B-00
B-01
B-01-01
```

Meaning:

```text
A = Project A
B = Project B
00 = Main Project Team / General Manager
01, 02, 03 = direct teams inside the project
01-01, 02-01 = subteams derived from a parent team
```

Examples:

```text
Project A main team: A-00
First team in Project A: A-01
Second team in Project A: A-02
Subteam of A-02: A-02-01

Project B main team: B-00
First team in Project B: B-01
Subteam of B-01: B-01-01
```

---

## 7. Card Display Rule

Team cards should expose the hierarchy code clearly.

Recommended examples:

```text
A-00 · General Manager
Project A
Main Team
```

```text
A-02 · Legal Review Team
Project A
Team
```

```text
A-02-01 · Contract Analysis
Project A
Subteam of A-02
```

The code must not replace the human-readable name. It must support orientation and traceability.

---

## 8. Workspace Header Rule

When a workspace is opened, the header should include the structural code.

Recommended format:

```text
A-02 · Legal Review Team
```

The workspace ribbons should replicate the originating team color.

This allows the user to know immediately:

* which project they are in;
* which team they opened;
* whether it is a main team, team or subteam.

---

## 9. Documentation Mode Replication Rule

The same hierarchical code must be replicated in Documentation Mode.

Documentation Mode must identify the structural origin of every document, checkpoint, saved selection, handoff package, backup or derived document.

The user must be able to look at any object and understand:

```text
Which project produced this?
Which team produced this?
Which subteam produced this?
Which workspace did this come from?
```

---

## 10. Documentation Mode Surfaces

The origin code should appear where relevant in:

### Repository View

Each document card or row should show the origin code.

Example:

```text
A-02 · Legal Review Team
Document: Contract Risk Memo
Type: Derived Document
State: Draft
```

### Document Detail

The detail panel should include structural origin.

Example:

```text
Origin
Project: A · Primer Proyecto
Team Code: A-02
Team Name: Legal Review Team
Workspace: Team Workspace
Source Object: Checkpoint / Saved Selection / Handoff Package
```

### Audit View

Document-linked events should preserve origin code.

Example:

```text
checkpoint.created · A-02 · Legal Review Team
selection.saved · A-02-01 · Contract Analysis Subteam
handoff.created · B-01 · Market Research Team
```

### Investigate View

Thematic groupings must preserve origin code.

Example:

```text
Topic: Client Onboarding Risk
Related objects:
- A-01 · Intake Team · Meeting Summary
- A-02 · Legal Review Team · Risk Memo
- A-02-01 · Contract Analysis · Clause Notes
```

### Knowledge Map

Document nodes should show or filter by origin code.

Example:

```text
Node: Contract Risk Memo
Origin: A-02-01
Linked to: A-02 / A-00
```

---

## 11. Metadata Rule

The hierarchical code must not be only a visual label.

It must exist as structural metadata.

Recommended field:

```ts
originCode: string
```

Examples:

```ts
originCode: "A-00"
originCode: "A-02"
originCode: "A-02-01"
```

Optional complementary fields:

```ts
projectCode: "A"
teamCode: "A-02"
parentTeamCode: "A-02"
subteamCode: "A-02-01"
```

Doctrine:

```text
Metadata estructural = source of truth
Tags = capa secundaria de acceso, búsqueda y operación
```

Therefore, the code must belong to structural metadata, not only to tags or visual labels.

---

## 12. Relationship Between Color, Code and Label

AISync must keep these meanings separated:

```text
Color = Project identity
Code = Structural origin
Label = Functional role or team name
```

Example:

```text
A-02 · Legal Review Team
Color: Project A
Role: Team
```

---

## 13. MVP Implementation Order

This doctrine must be implemented later in separate OEs.

Recommended order:

1. Project color in Teams Map.
2. Workspace inherits color from opened team box.
3. Hierarchical code visible in cards.
4. Hierarchical code visible in workspace headers.
5. Hierarchical code replicated in Documentation Mode.
6. originCode added to document metadata.
7. Filters/search by originCode in Documentation Mode.

---

## 14. Restrictions

This document does not authorize implementation by itself.

Do not use this doctrine to modify:

* Teams Map components;
* Tree View;
* Workspace ribbons;
* Documentation Mode;
* database schema;
* routing;
* color system;
* Supabase metadata;
* saved object model.

Each implementation phase requires its own OE.

---

## 15. Final Rule

For MVP, the correct identity model is:

```text
Color = Project identity
Workspace ribbons = Opened team color
Hierarchical code = Structural origin
Documentation Mode originCode = Source traceability
```

Do not create a global General Manager or Cell Teams Manager to solve a visual identity problem.

A future `Cell Orchestrator` or `Account Orchestrator` may exist later as a global overview layer, but not as the MVP solution for this issue.

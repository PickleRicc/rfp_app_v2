# Phase 3: Exhibit Generation - Context

**Gathered:** 2026-02-05
**Status:** Ready for planning

<domain>
## Phase Boundary

Generate actual visual diagrams (org charts, process flows, timelines) that embed into Word documents as images. Replace exhibit placeholders with real generated graphics. Includes auto-numbered exhibit captions and Table of Exhibits integration.

</domain>

<decisions>
## Implementation Decisions

### Rendering Approach
- Claude has discretion on technical approach (server-side PNG/SVG, Mermaid, etc.) — pick what works best for Word compatibility
- Match proposal branding: use company colors from profile, consistent with document styling
- Screen-optimized resolution (150 DPI) for electronic submission
- Auto-numbered exhibits: "Exhibit X. [Description]" format per Framework Part 4.1
- Integrate with Table of Exhibits in TOC

### Org Chart Content
- Data source: key personnel from company data with proposed roles and reporting relationships
- Follow Framework ORGANIZATIONAL_STRUCTURE requirements: reporting relationships, interface with customer, roles
- Claude has discretion on hierarchy depth based on team size
- Box content: Name + Title + Clearance level (if available in personnel data)
- Claude has discretion on whether to show customer/COR interface box based on context

### Process Diagram Content
- Generate diagrams where Framework calls for PROCESS_EXHIBIT (not per-task-area)
- Use standard flowchart shapes: rectangles for steps, diamonds for decisions, arrows for flow
- Keep high-level (readable) — Framework doesn't specify step count, use judgment
- Claude has discretion on including role annotations where they add clarity

### Timeline/Gantt Content
- Primary use case: Transition-In Timeline per Framework TRANSITION_PLAN section
- Claude has discretion on style (Gantt bars vs milestone markers) based on content
- Claude has discretion on dependencies and time granularity based on typical transition periods
- Staffing ramp timeline as secondary use case if applicable

### Claude's Discretion
- Technical rendering approach (library choice, image format)
- Org chart hierarchy depth based on team size
- Customer interface representation
- Process diagram step count and role annotations
- Timeline visualization style (Gantt vs milestones)
- Dependency arrows inclusion
- Time granularity (days/weeks/months)

</decisions>

<specifics>
## Specific Ideas

- Framework Part 4.1 defines exhibit labeling: "Exhibit X. [Description]" format
- Cross-references use bold+italic: "as shown in ***Exhibit X***"
- ORGANIZATIONAL_STRUCTURE content includes: Org chart (Exhibit), Reporting relationships, Interface with customer, Roles and responsibilities summary
- TRANSITION_PLAN includes: TIMELINE_EXHIBIT (Gantt or milestone), reference format: "***Exhibit X*** shows our Transition-In Timeline"
- Output structure per Framework: Graphics/ folder with OrgChart.png, TransitionTimeline.png, ProcessDiagram.png

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 03-exhibit-generation*
*Context gathered: 2026-02-05*

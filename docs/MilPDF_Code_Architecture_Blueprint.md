MilPDF_Code_Architecture_Blueprint

Bridge Intelligence Engine Integration
Core Design Philosophy

MilPDF should be built as four clear layers:

User Interface Layer
        │
Application Logic Layer
        │
AI Intelligence Layer
        │
PDF Engine Layer

Each layer has strict responsibilities.

This prevents chaos as features grow.

1. User Interface Layer
(React Components)

This layer controls visual interaction only.

It does not contain business logic or AI reasoning.

Example structure:

src/
 ├ components
 │   ├ editor
 │   │   PdfCanvas.jsx
 │   │   PageNavigator.jsx
 │   │   Toolbar.jsx
 │   │
 │   ├ assistant
 │   │   AvaAssistantPanel.jsx
 │   │   AvaChat.jsx
 │   │   AvaQuickActions.jsx
 │   │
 │   ├ workspace
 │   │   Sidebar.jsx
 │   │   EvidencePanel.jsx
 │   │   TimelineView.jsx
 │   │
 │   └ layout
 │       AppShell.jsx
 │       TopBar.jsx

Responsibilities:

• display editor
• display Ava assistant
• render claim timeline
• render evidence navigator

UI never directly manipulates PDFs.

2. Application Logic Layer
(MilPDF Core Services)

This layer manages the actual app behavior.

Example folder:

src/services

Structure:

services/
 ├ documentService.js
 ├ editorService.js
 ├ evidenceService.js
 ├ claimService.js
 ├ aiService.js

Responsibilities:

documentService
    file loading
    document metadata

editorService
    calls pdf-lib functions

evidenceService
    evidence tagging
    document indexing

claimService
    claim packet assembly

aiService
    communication with Ava

Example:

User clicks "Merge Documents"
     ↓
UI calls documentService
     ↓
documentService calls editorService
     ↓
editorService runs pdf-lib
3. AI Intelligence Layer
Bridge Intelligence Engine

This is where Ava lives.

Folder:

src/ai

Structure:

ai/
 ├ engine
 │   avaAgent.js
 │   contextBuilder.js
 │   toolRouter.js
 │
 ├ providers
 │   openaiProvider.js
 │   geminiProvider.js
 │   anthropicProvider.js
 │
 ├ tools
 │   pdfTools.js
 │   evidenceTools.js
 │   claimTools.js
 │
 ├ prompts
 │   avaSystemPrompt.js
 │
 ├ memory
 │   conversationStore.js
 │
 └ intelligence
     documentIntelligence.js
     claimGraph.js
     evidenceReasoner.js

This layer is responsible for:

• Ava reasoning
• document analysis
• evidence detection
• claim graph generation

UI should never talk directly to the AI providers.

Everything goes through aiService.

4. PDF Engine Layer
The Core Document System

This layer is your true engine.

Folder:

src/editor

Structure:

editor/
 ├ pdfEngine.js
 ├ pdfLoader.js
 ├ pdfRenderer.js
 ├ pdfEditor.js
 ├ pdfRedaction.js
 ├ pdfAnnotations.js
 ├ pdfMerge.js
 ├ pdfSplit.js

Responsibilities:

pdfEngine
   central PDF controller

pdfRenderer
   PDF.js rendering

pdfEditor
   text edits

pdfMerge
   combining documents

pdfRedaction
   secure redaction boxes

This layer uses:

pdfjs-dist
pdf-lib
5. State Management

To keep the app stable, use centralized state.

Recommended:

Zustand

Store structure:

store/
 ├ documentStore.js
 ├ editorStore.js
 ├ assistantStore.js
 ├ evidenceStore.js

Example:

assistantStore
    Ava conversation history
    AI processing state

documentStore
    current file
    page data
6. Evidence Graph Storage

The Veteran Claim Graph must store relationships.

Recommended format:

graph structure

Example:

nodes:
   service event
   diagnosis
   medical record

edges:
   supports
   related to

Simple JSON example:

{
 nodes: [
   {id:"injury1991", type:"service_event"},
   {id:"diagnosis2018", type:"medical"}
 ],
 edges:[
   {from:"injury1991", to:"diagnosis2018"}
 ]
}

This powers:

timeline
evidence navigator
claim analysis
7. AI Tool Interface

AI tools must be cleanly registered.

Example:

ai/tools/index.js
export const tools = {
 mergeDocuments,
 redactArea,
 splitDocument,
 fillFormField
}

Ava never calls editor functions directly.

Everything routes through toolRouter.

8. Electron Layer

Electron should remain thin.

Structure:

electron/
 ├ main.cjs
 ├ preload.js

Responsibilities:

file system access
local AI access (future)
secure IPC

Electron should not contain business logic.

9. Future Local AI Integration

Later phases will add:

ollamaService.js

Example folder:

src/ai/local
 ├ ollamaService.js
 ├ embeddingService.js
 └ vectorStore.js

This enables:

offline AI
document embeddings
private search
10. Testing Architecture

Professional software must include testing.

Add:

tests/
 ├ editor.test.js
 ├ aiAgent.test.js
 ├ documentIntelligence.test.js

Use:

Vitest
11. Performance Strategy

Large PDFs can slow apps.

Key optimizations:

• lazy page rendering
• background AI processing
• incremental document analysis

Never block the UI.

12. Security Strategy

Critical for veteran trust.

MilPDF must:

never store documents remotely
clear memory after sessions
secure local storage
13. Final MilPDF Architecture

When complete:

MilPDF
   │
   ├ UI Layer
   │
   ├ Application Services
   │
   ├ Bridge Intelligence Engine
   │
   └ PDF Engine

This structure allows the product to grow for years without architectural collapse.
MilPDF_v3_Project_Skeleton

Bridge Intelligence Engine Edition
milpdf
│
├ electron
│   ├ main.cjs
│   ├ preload.js
│   └ ipcHandlers.js
│
├ public
│
├ src
│
│   ├ app
│   │   App.jsx
│   │   AppShell.jsx
│   │   Router.jsx
│   │
│   ├ components
│   │
│   │   ├ editor
│   │   │   PdfCanvas.jsx
│   │   │   PageNavigator.jsx
│   │   │   Toolbar.jsx
│   │   │   RedactionTool.jsx
│   │   │
│   │   ├ assistant
│   │   │   AvaAssistantPanel.jsx
│   │   │   AvaChat.jsx
│   │   │   AvaIntroCard.jsx
│   │   │
│   │   ├ intelligence
│   │   │   EvidencePanel.jsx
│   │   │   TimelineView.jsx
│   │   │   ClaimGraphView.jsx
│   │   │
│   │   └ layout
│   │       Sidebar.jsx
│   │       Topbar.jsx
│   │
│   ├ services
│   │
│   │   documentService.js
│   │   editorService.js
│   │   claimService.js
│   │   evidenceService.js
│   │   aiService.js
│
│   ├ editor
│   │
│   │   pdfEngine.js
│   │   pdfLoader.js
│   │   pdfRenderer.js
│   │   pdfEditor.js
│   │   pdfMerge.js
│   │   pdfSplit.js
│   │   pdfRedaction.js
│
│   ├ ai
│   │
│   │   ├ engine
│   │   │   avaAgent.js
│   │   │   toolRouter.js
│   │   │   contextBuilder.js
│   │   │
│   │   ├ providers
│   │   │   openaiProvider.js
│   │   │   geminiProvider.js
│   │   │   anthropicProvider.js
│   │   │   deepseekProvider.js
│   │   │
│   │   ├ prompts
│   │   │   avaSystemPrompt.js
│   │   │
│   │   ├ tools
│   │   │   pdfTools.js
│   │   │   evidenceTools.js
│   │   │   claimTools.js
│   │   │
│   │   └ intelligence
│   │       documentIntelligence.js
│   │       claimGraph.js
│   │       evidenceReasoner.js
│
│   ├ store
│   │
│   │   documentStore.js
│   │   editorStore.js
│   │   assistantStore.js
│   │   evidenceStore.js
│
│   ├ utils
│   │   pdfUtils.js
│   │   textExtraction.js
│   │
│   ├ styles
│   │   theme.css
│   │
│   └ main.jsx
│
├ tests
│   editor.test.js
│   aiAgent.test.js
│   intelligence.test.js
│
├ package.json
└ vite.config.js
Core Files (Starter Code)
Ava Assistant Panel

src/components/assistant/AvaAssistantPanel.jsx

import { useState } from "react"
import { askAva } from "../../services/aiService"

export default function AvaAssistantPanel(){

 const [messages,setMessages] = useState([])
 const [input,setInput] = useState("")

 async function send(){

  const response = await askAva(input,messages)

  setMessages([
   ...messages,
   {role:"user",content:input},
   {role:"assistant",content:response.content}
  ])

  setInput("")
 }

 return(

 <div className="ava-panel">

  <h2>Ava Bridgestone</h2>
  <p>Advocate's Bridge</p>

  <div className="ava-messages">

   {messages.map((m,i)=>(
    <div key={i} className={m.role}>
     {m.content}
    </div>
   ))}

  </div>

  <input
   value={input}
   onChange={e=>setInput(e.target.value)}
   placeholder="Ask Ava anything..."
  />

  <button onClick={send}>
   Send
  </button>

 </div>

 )

}
What is this?
Ava Intro Card

This is the first experience users see.

src/components/assistant/AvaIntroCard.jsx

export default function AvaIntroCard(){

 return(

 <div className="ava-intro">

  <h2>Hello, I'm Ava Bridgestone.</h2>

  <p>
   I volunteered from Advocate's Bridge to come over
   and help veterans here in MilPDF.
  </p>

  <p>
   I can help you organize documents,
   complete VA forms, and prepare claim evidence.
  </p>

  <div className="actions">

   <button>Upload Documents</button>
   <button>Start Claim Packet</button>
   <button>Open Editor</button>

  </div>

 </div>

 )

}
AI Service

src/services/aiService.js

import { runAvaAgent } from "../ai/engine/avaAgent"

export async function askAva(message,history){

 return runAvaAgent(message,history)

}
Ava Agent

src/ai/engine/avaAgent.js

import { runModel } from "../providers/providerInterface"
import { executeTool } from "./toolRouter"
import { avaSystemPrompt } from "../prompts/avaSystemPrompt"

export async function runAvaAgent(message,history){

 const messages = [
  {role:"system",content:avaSystemPrompt},
  ...history,
  {role:"user",content:message}
 ]

 const response = await runModel({
  provider:"openai",
  messages
 })

 if(response.tool_calls){

  return await executeTool(response.tool_calls[0])

 }

 return {
  content: response.choices[0].message.content
 }

}
PDF Merge Tool

src/ai/tools/pdfTools.js

export const mergeDocuments = {

 name: "merge_documents",

 description: "Merge multiple PDF files",

 execute: async ({files}) => {

   return editorService.merge(files)

 }

}
Claim Graph Structure

src/ai/intelligence/claimGraph.js

export function buildClaimGraph(events){

 return {
  nodes: events,
  edges: events.map((e,i)=>({
   from: events[i],
   to: events[i+1]
  }))
 }

}
Document Intelligence Hook

src/ai/intelligence/documentIntelligence.js

export function classifyDocument(text){

 if(text.includes("DD FORM 214")){
  return "DD214"
 }

 if(text.includes("VA FORM 21-526EZ")){
  return "VA Claim Form"
 }

 if(text.includes("Medical Record")){
  return "Medical Record"
 }

 return "Unknown"

}
Zustand Store Example

src/store/assistantStore.js

import { create } from "zustand"

export const useAssistantStore = create((set)=>({

 messages:[],

 addMessage:(msg)=>
  set(state=>({
   messages:[...state.messages,msg]
  }))

}))
Professional Theme Starter

src/styles/theme.css

Example palette:

background: #0f172a
panel: #1e293b
accent: #2563eb
text: #f8fafc

Clean.

Calm.

Professional.

Development Stack

Recommended additions:

Zustand
Vitest
Framer Motion
React Query
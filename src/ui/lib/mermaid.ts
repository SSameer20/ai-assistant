// mermaid.ts
import mermaid from "mermaid";

mermaid.initialize({
  startOnLoad: false,
  theme: "default", // or "dark"
  securityLevel: "strict", // IMPORTANT
  flowchart: { htmlLabels: true, curve: "linear" },
  sequence: { showSequenceNumbers: true },
});

export default mermaid;

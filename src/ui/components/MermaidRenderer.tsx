import { useEffect, useRef, useState } from "react";
import mermaid from "../lib/mermaid";
import { CodeBlock } from "./ui/code-block";

function cleanMermaidCode(rawCode: string): string {
  let clean = rawCode.trim();
  // Remove markdown code block syntax if present
  if (clean.startsWith("```mermaid")) {
    clean = clean.substring(10);
  } else if (clean.startsWith("```")) {
    clean = clean.substring(3);
  }
  if (clean.endsWith("```")) {
    clean = clean.substring(0, clean.length - 3);
  }

  // Unescape common HTML entities that might break parsing
  clean = clean
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");

  return clean.trim();
}

export function MermaidRenderer({ code }: { code: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!code || !ref.current) return;
    setFailed(false);

    const render = async () => {
      try {
        const cleanedCode = cleanMermaidCode(code);

        // Try to parse first. If it's invalid, we don't render at all.
        // We cast to any to avoid TS errors with newer mermaid versions' configuration options
        const isValid = await (mermaid.parse(cleanedCode, { suppressErrors: true } as any) as Promise<boolean>);
        if (!isValid) {
          setFailed(true);
          return;
        }

        const { svg } = await mermaid.render(`mermaid-${Date.now()}`, cleanedCode);
        if (ref.current) {
          ref.current.innerHTML = svg;
        }
      } catch (err) {
        // If anything fails, don't output the error, just "ignore" it.
        setFailed(true);
      }
    };

    render();
  }, [code]);

  if (failed) {
    return (
      <CodeBlock
        language="mermaid"
        filename="Diagram Source (Rendering Failed)"
        code={code}
      />
    );
  }

  return <div ref={ref} />;
}

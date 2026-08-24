import React from "react";
import { CodeBlock } from "./ui/code-block";
import type { ChatMessage } from "../store/types";
import { TypographyBlockquote } from "./ui/typography";
const MermaidRenderer = React.lazy(() =>
  import("./MermaidRenderer").then((m) => ({ default: m.MermaidRenderer })),
);
import { parseMarkdownBold } from "../lib/types";

interface MessageComponentProps {
  message: ChatMessage;
  onSuggestionClick?: (suggestion: string) => void;
}

export const TopicMessageComponent: React.FC<MessageComponentProps> = ({ message }) => {
  if (message.type !== "topic") return null;

  console.log("Rendering topic message:", message);

  return (
    <div className="mb-4">
      <strong className="text-blue-400 text-base">{message.content}</strong>
    </div>
  );
};

export const AnswerMessageComponent: React.FC<MessageComponentProps> = ({ message }) => {
  if (message.type !== "answer") return null;

  console.log("Rendering answer message:", message);

  // Split by existing newlines first, then split after every period using lookbehind
  const lines = message.content
    .split("\n")
    .flatMap((line) => line.split(/(?<=\.)\s*/))
    .filter((line) => line.trim().length > 0);

  return (
    <div className="mb-3 text-white/90 leading-relaxed">
      <ul className="list-disc pl-5 space-y-2">
        {lines.map((line, index) => (
          <li key={index} className="marker:text-blue-400">
            <span dangerouslySetInnerHTML={{ __html: parseMarkdownBold(line.trim()) }} />
          </li>
        ))}
      </ul>
    </div>
  );
};

export const ThoughtMessageComponent: React.FC<MessageComponentProps> = ({ message }) => {
  if (message.type !== "thought") return null;

  return (
    <div className="mb-3 text-white/40 italic text-xs border-l border-white/10 pl-3">
      {message.content}
    </div>
  );
};

export const CodeMessageComponent: React.FC<MessageComponentProps> = ({ message }) => {
  if (message.type !== "code") return null;

  console.log("Rendering code message:", message);

  return (
    <div className="mb-4 w-full" style={{ maxWidth: "80vw" }}>
      <CodeBlock
        language={message.language || "text"}
        filename={message.language || "Code"}
        code={message.content}
      />
    </div>
  );
};

export const MermaidMessageComponent: React.FC<MessageComponentProps> = ({ message }) => {
  if (message.type !== "mermaid") return null;

  console.log("Rendering code message:", message);

  return (
    <div className="mb-4 w-full overflow-auto" style={{ maxWidth: "80vw" }}>
      <React.Suspense fallback={<div className="text-gray-400">Rendering diagram...</div>}>
        <MermaidRenderer code={message.content} />
      </React.Suspense>
    </div>
  );
};

export const SuggestionMessageComponent: React.FC<MessageComponentProps> = ({
  message,
  onSuggestionClick,
}) => {
  if (message.type !== "suggestion") return null;

  console.log("Rendering suggestion message:", message);

  const handleClick = () => {
    if (onSuggestionClick) {
      onSuggestionClick(message.content);
    }
  };

  return (
    <div onClick={handleClick} className="cursor-pointer">
      {TypographyBlockquote(message.content)}
    </div>
  );
};

export const MessageRenderer: React.FC<MessageComponentProps> = ({
  message,
  onSuggestionClick,
}) => {
  console.log("MessageRenderer called with:", message);

  switch (message.type) {
    case "topic":
      return <TopicMessageComponent message={message} />;
    case "answer":
      return <AnswerMessageComponent message={message} />;
    case "code":
      return <CodeMessageComponent message={message} />;
    case "mermaid":
      return <MermaidMessageComponent message={message} />;
    case "suggestion":
      return <SuggestionMessageComponent message={message} onSuggestionClick={onSuggestionClick} />;
    case "thought":
      return <ThoughtMessageComponent message={message} />;
    default:
      console.warn("Unknown message type:", message);
      // Fallback to answer component for unknown types to ensure content is visible
      return <AnswerMessageComponent message={{ ...(message as any), type: "answer" } as any} />;
  }
};

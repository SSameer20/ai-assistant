import DOMPurify from "dompurify";
import { marked } from "marked";

/* =======================
   STREAMING NORMALIZER
======================= */
export function normalizeStreamingText(chunk: string): string {
  if (!chunk || typeof chunk !== "string") return "";

  return (
    chunk
      // Only remove truly dangerous control characters
      .replace(
        /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u2028\u2029]/g,
        "",
      )
      // Add word break opportunities for long URLs or code
      .replace(
        /(https?:\/\/[^\s]{50,})/g,
        '<span class="ai-long-url">$1</span>',
      )
      // Handle very long words that might break layout (but preserve Q&A format)
      .replace(
        /(?!Q\d+:)([a-zA-Z0-9_-]{30,})/g,
        '<span class="ai-long-word">$1</span>',
      )
  );
}

/* =======================
   Q&A CONTENT DETECTOR
======================= */
export function isQAContent(text: string): boolean {
  // Check if content contains multiple Q1:, Q2: pattern with either "Option X" or just "X"
  const qaPatternOption = /Q\d+:\s*Option\s*[A-Z]\s*[–-]/g;
  const qaPatternLetter = /Q\d+:\s*[a-zA-Z]\s*[–-]/g;

  const optionMatches = text.match(qaPatternOption) || [];
  const letterMatches = text.match(qaPatternLetter) || [];
  const totalMatches = optionMatches.length + letterMatches.length;

  console.log("Q&A Detection:", {
    text: text.substring(0, 200),
    optionMatches,
    letterMatches,
    totalMatches,
  });

  return totalMatches >= 2;
}

/* =======================
   FINAL MARKDOWN RENDERER
======================= */

export async function renderFinalContent(markdown: string): Promise<string> {
  // Check if this is Q&A content first
  if (isQAContent(markdown)) {
    return renderQAContent(markdown);
  }

  let raw = await marked.parse(markdown);

  // Map HTML → AI UI classes
  raw = raw
    .replace(/<h1>/g, '<h1 class="ai-heading-1">')
    .replace(/<h2>/g, '<h2 class="ai-heading-2">')
    .replace(/<h3>/g, '<h3 class="ai-heading-3">')

    .replace(/<p>/g, '<p class="ai-paragraph">')

    .replace(/<blockquote>/g, '<blockquote class="ai-blockquote">')

    .replace(/<ul>/g, '<ul class="ai-list-unordered">')
    .replace(/<ol>/g, '<ol class="ai-list-ordered">')
    .replace(/<li>/g, '<li class="ai-list-item">')

    // Code blocks with overflow handling
    .replace(
      /<pre><code(?: class="language-[^"]*")?>/g,
      '<pre class="ai-code-block"><code class="ai-code-content">',
    )

    // Inline code
    .replace(/<code>(?!\s)/g, '<code class="ai-code-inline">')

    // Add container wrapper to handle overall width
    .replace(/^(.*)$/s, '<div class="ai-response-container">$1</div>');

  return DOMPurify.sanitize(raw, {
    ALLOWED_TAGS: [
      "h1",
      "h2",
      "h3",
      "h4",
      "p",
      "blockquote",
      "ul",
      "ol",
      "li",
      "pre",
      "code",
      "br",
      "span",
      "strong",
      "em",
      "a",
      "div",
    ],
    ALLOWED_ATTR: ["class", "href", "target", "style"],
  });
}

/* =======================
   Q&A SPECIFIC RENDERER
======================= */
export function renderQAContent(text: string): string {
  console.log("Rendering Q&A content:", text);

  // Split by Q pattern more aggressively to capture all questions
  let lines = text.split(/(?=Q\d+:)/).filter((line) => line.trim());

  console.log("Split lines:", lines);
  const qaItems: string[] = [];

  for (const line of lines) {
    const trimmedLine = line.trim();
    if (!trimmedLine) continue;

    // More flexible regex - capture everything until next Q or end
    const qaMatch = trimmedLine.match(
      /^(Q\d+):\s*(Option\s*[A-Z]|[a-zA-Z])\s*[–-]\s*(.+?)(?=\s*Q\d+:|$)/s,
    );

    if (qaMatch) {
      const [, questionNum, optionText, answerText] = qaMatch;
      console.log("Matched Q&A:", {
        questionNum,
        optionText,
        answerText: answerText.substring(0, 100),
      });

      qaItems.push(`
        <div class="qa-item-simple">
          <span class="question-number">${questionNum}.</span>
          <span class="answer-option">${optionText}</span>
          <span class="answer-text">${answerText.trim()}</span>
        </div>
      `);
    } else {
      // Handle non-Q&A lines as regular paragraphs
      qaItems.push(`<p class="ai-paragraph">${trimmedLine}</p>`);
    }
  }

  const content = `
    <div class="ai-response-container qa-content">
      ${qaItems.join("")}
    </div>
  `;

  return DOMPurify.sanitize(content, {
    ALLOWED_TAGS: ["div", "span", "p", "br"],
    ALLOWED_ATTR: ["class"],
  });
}

export function TypographyH1(text: string) {
  return (
    <h1 className="scroll-m-20 text-center text-4xl font-extrabold tracking-tight text-balance">
      {text}
    </h1>
  );
}

export function TypographyH2(text: string) {
  return (
    <h2 className="scroll-m-20 border-b pb-2 text-3xl font-semibold tracking-tight first:mt-0">
      {text}
    </h2>
  );
}

export function TypographyH3(text: string) {
  return <h3 className="scroll-m-20 text-2xl font-semibold tracking-tight">{text}</h3>;
}

export function TypographyH4(text: string) {
  return <h4 className="scroll-m-20 text-xl font-semibold tracking-tight">{text}</h4>;
}

export function TypographyP(text: string) {
  return <p className="leading-7 [&:not(:first-child)]:mt-6">{text}</p>;
}

export function TypographyBlockquote(text: string) {
  return <blockquote className="mt-6 border-l-2 pl-6 italic">{text}</blockquote>;
}

interface TableData {
  headers: string[];
  rows: string[][];
}

export function TypographyTable({ headers, rows }: TableData) {
  return (
    <div className="my-6 w-full overflow-y-auto">
      <table className="w-full">
        <thead>
          <tr className="even:bg-muted m-0 border-t p-0">
            {headers.map((header, index) => (
              <th
                key={index}
                className="border px-4 py-2 text-left font-bold [&[align=center]]:text-center [&[align=right]]:text-right"
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex} className="even:bg-muted m-0 border-t p-0">
              {row.map((cell, cellIndex) => (
                <td
                  key={cellIndex}
                  className="border px-4 py-2 text-left [&[align=center]]:text-center [&[align=right]]:text-right"
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function TypographyList(items: string[]) {
  return (
    <ul className="my-6 ml-6 list-disc [&>li]:mt-2">
      {items.map((item, index) => (
        <li key={index}>{item}</li>
      ))}
    </ul>
  );
}

export function TypographyInlineCode(code: string) {
  return (
    <code className="bg-muted relative rounded px-[0.3rem] py-[0.2rem] font-mono text-sm font-semibold">
      {code}
    </code>
  );
}

export function TypographyLead(text: string) {
  return <p className="text-muted-foreground text-xl">{text}</p>;
}

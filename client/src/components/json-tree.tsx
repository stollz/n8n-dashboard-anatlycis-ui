import { useState, useCallback, type ReactNode } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

/**
 * Highlight matching substrings in text with <mark> tags.
 * Exported for reuse in node names, error messages, etc.
 */
export function highlightText(text: string, term: string): ReactNode {
  if (!term || term.length < 2) return text;
  const idx = text.toLowerCase().indexOf(term.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-yellow-300/50 dark:bg-yellow-500/30 rounded px-0.5">
        {text.slice(idx, idx + term.length)}
      </mark>
      {highlightText(text.slice(idx + term.length), term)}
    </>
  );
}

function JsonValue({ value, highlight }: { value: unknown; highlight?: string }) {
  if (value === null) {
    return <span className="text-gray-400 italic">null</span>;
  }
  if (typeof value === "boolean") {
    return <span className="text-orange-500 dark:text-orange-400">{value ? "true" : "false"}</span>;
  }
  if (typeof value === "number") {
    const str = String(value);
    return (
      <span className="text-purple-600 dark:text-purple-400">
        {highlight ? highlightText(str, highlight) : str}
      </span>
    );
  }
  if (typeof value === "string") {
    return (
      <span className="text-emerald-600 dark:text-emerald-400">
        &quot;{highlight ? highlightText(value, highlight) : value}&quot;
      </span>
    );
  }
  return <span className="text-foreground">{String(value)}</span>;
}

function JsonNode({
  keyName,
  value,
  highlight,
  defaultExpanded,
  isLast,
}: {
  keyName?: string;
  value: unknown;
  highlight?: string;
  defaultExpanded: boolean;
  isLast: boolean;
}) {
  const isObject = value !== null && typeof value === "object" && !Array.isArray(value);
  const isArray = Array.isArray(value);
  const isExpandable = isObject || isArray;

  const [expanded, setExpanded] = useState(defaultExpanded);

  const toggle = useCallback(() => setExpanded((e) => !e), []);

  if (!isExpandable) {
    return (
      <div className="flex items-start pl-4">
        {keyName !== undefined && (
          <>
            <span className="text-blue-600 dark:text-blue-400">&quot;{keyName}&quot;</span>
            <span className="text-foreground mr-1">: </span>
          </>
        )}
        <JsonValue value={value} highlight={highlight} />
        {!isLast && <span className="text-foreground">,</span>}
      </div>
    );
  }

  const entries = isArray ? (value as unknown[]) : Object.entries(value as Record<string, unknown>);
  const bracketOpen = isArray ? "[" : "{";
  const bracketClose = isArray ? "]" : "}";
  const isEmpty = entries.length === 0;

  if (isEmpty) {
    return (
      <div className="flex items-start pl-4">
        {keyName !== undefined && (
          <>
            <span className="text-blue-600 dark:text-blue-400">&quot;{keyName}&quot;</span>
            <span className="text-foreground mr-1">: </span>
          </>
        )}
        <span className="text-foreground">{bracketOpen}{bracketClose}</span>
        {!isLast && <span className="text-foreground">,</span>}
      </div>
    );
  }

  return (
    <div>
      <button
        className="flex items-center gap-0.5 pl-0.5 hover:bg-muted/50 rounded transition-colors w-full text-left"
        onClick={toggle}
      >
        {expanded ? (
          <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" />
        ) : (
          <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />
        )}
        {keyName !== undefined && (
          <>
            <span className="text-blue-600 dark:text-blue-400">&quot;{keyName}&quot;</span>
            <span className="text-foreground mr-1">: </span>
          </>
        )}
        <span className="text-foreground">{bracketOpen}</span>
        {!expanded && (
          <span className="text-muted-foreground ml-1">
            {isArray ? `${entries.length} items` : `${entries.length} keys`}
            {bracketClose}
            {!isLast && ","}
          </span>
        )}
      </button>
      {expanded && (
        <div className="ml-3 border-l border-border/50">
          {isArray
            ? (entries as unknown[]).map((item, i) => (
                <JsonNode
                  key={i}
                  value={item}
                  highlight={highlight}
                  defaultExpanded={false}
                  isLast={i === entries.length - 1}
                />
              ))
            : (entries as [string, unknown][]).map(([k, v], i) => (
                <JsonNode
                  key={k}
                  keyName={k}
                  value={v}
                  highlight={highlight}
                  defaultExpanded={false}
                  isLast={i === entries.length - 1}
                />
              ))}
          <div className="pl-4">
            <span className="text-foreground">{bracketClose}</span>
            {!isLast && <span className="text-foreground">,</span>}
          </div>
        </div>
      )}
    </div>
  );
}

export function JsonTree({
  data,
  highlight,
  defaultExpanded = true,
}: {
  data: unknown;
  highlight?: string;
  defaultExpanded?: boolean;
}) {
  return (
    <div className="bg-muted rounded-md p-2 text-xs font-mono max-h-[400px] overflow-auto">
      <JsonNode
        value={data}
        highlight={highlight}
        defaultExpanded={defaultExpanded}
        isLast={true}
      />
    </div>
  );
}

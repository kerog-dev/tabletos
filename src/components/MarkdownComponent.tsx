import insane from "insane";
import { marked, type MarkedExtension } from "marked";
import { useMemo } from "react";

export function MarkdownComponent(
  { src, extensions = [] }: { src: string; extensions?: MarkedExtension[] | undefined },
) {
  const markedInstance = useMemo(() => marked.use(...extensions), [extensions]);
  const parsed = useMemo(() => markedInstance.parse(src), [src]);
  const sanitized = useMemo(() => {
    if (typeof parsed !== "string") return `<span>Unexpected marked parsing result type: ${typeof parsed}</span>`;
    return insane(parsed);
  }, [parsed]);
  return <p dangerouslySetInnerHTML={{ __html: sanitized }} />;
}

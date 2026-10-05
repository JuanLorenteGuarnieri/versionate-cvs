import type { CSSProperties, ReactNode } from "react";
import type { RichTextBlock, RichTextDoc, RichTextRun } from "../../../domain/model/types.js";

/**
 * Renderiza el AST de RichTextDoc a JSX real (párrafos, listas, negrita,
 * cursiva, enlaces). El editor de la Fase 3 solo produce párrafos sin
 * formato (ver domain/richtext.ts), pero el modelo de datos soporta el AST
 * completo desde la Fase 1 — este renderer ya lo soporta todo, para no
 * tener que volver a tocarlo cuando exista un editor de texto enriquecido
 * de verdad.
 */
export function RichTextView({ doc, linkStyle }: { doc: RichTextDoc; linkStyle?: CSSProperties }) {
  const elements: ReactNode[] = [];
  let bulletBuffer: RichTextBlock[] = [];

  function flushBullets() {
    if (bulletBuffer.length === 0) return;
    const items = bulletBuffer;
    bulletBuffer = [];
    elements.push(
      <ul key={`ul-${elements.length}`} className="cv-preview__bullets">
        {items.map((block, i) => (
          <li key={i}>{renderRuns(block.runs, linkStyle)}</li>
        ))}
      </ul>
    );
  }

  doc.blocks.forEach((block, index) => {
    if (block.kind === "bullet") {
      bulletBuffer.push(block);
      return;
    }
    flushBullets();
    if (block.runs.length > 0) {
      elements.push(<p key={`p-${index}`}>{renderRuns(block.runs, linkStyle)}</p>);
    }
  });
  flushBullets();

  return <>{elements}</>;
}

function renderRuns(runs: RichTextRun[], linkStyle?: CSSProperties): ReactNode {
  return runs.map((run, i) => {
    let node: ReactNode = run.text;
    if (run.bold) node = <strong>{node}</strong>;
    if (run.italic) node = <em>{node}</em>;
    if (run.href) node = (
      <a href={run.href} target="_blank" rel="noopener noreferrer" style={linkStyle}>
        {node}
      </a>
    );
    return <span key={i}>{node}</span>;
  });
}

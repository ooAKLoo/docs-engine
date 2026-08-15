'use client';

import type {ReactNode} from 'react';
import type {DocBlock} from '../model.js';
import {Annotation} from './Annotation.js';
import {Board} from './Board.js';
import {Callout} from './Callout.js';
import {CodeBlock} from './CodeBlock.js';
import {Formula} from './Formula.js';
import {MarkdownInline} from './MarkdownInline.js';
import {Table} from './Table.js';
import {Video} from './Video.js';

export type DocumentBlockProps = {
  block: DocBlock;
  headingId?: string;
  renderInline?: (text: string) => ReactNode;
  renderBlock?: (block: DocBlock, fallback: ReactNode) => ReactNode;
};

export function DocumentBlock({
  block,
  headingId,
  renderInline,
  renderBlock,
}: DocumentBlockProps) {
  const fallback = renderStandardBlock(block, headingId, renderInline ?? defaultInline);
  return renderBlock ? renderBlock(block, fallback) : fallback;
}

function defaultInline(text: string) {
  return <MarkdownInline text={text} />;
}

function renderStandardBlock(
  block: DocBlock,
  headingId: string | undefined,
  renderInline: (text: string) => ReactNode,
): ReactNode {
  switch (block.type) {
    case 'heading': {
      const Tag = `h${Math.min(block.level + 1, 4)}` as 'h2' | 'h3' | 'h4';
      return (
        <Tag id={headingId}>
          {renderInline(block.text)}
        </Tag>
      );
    }
    case 'paragraph':
      return (
        <p data-tone={block.tone}>
          {renderInline(block.text)}
        </p>
      );
    case 'list':
      return (
        <ul>
          {block.items.map((item, index) => (
            <li
              key={`${item.text}-${index}`}
              data-muted={item.muted ? 'true' : undefined}
              data-strong={item.strong ? 'true' : undefined}
            >
              {item.strong ? <strong>{renderInline(item.text)}</strong> : renderInline(item.text)}
            </li>
          ))}
        </ul>
      );
    case 'code':
      return <CodeBlock code={block.code} language={block.language} />;
    case 'formula':
      return <Formula latex={block.latex} compact={block.compact} />;
    case 'image':
      return (
        <figure className="de-image">
          <img src={block.src} alt={block.alt} loading="lazy" />
          {block.caption ? <figcaption>{block.caption}</figcaption> : null}
        </figure>
      );
    case 'imageGrid':
      return (
        <div className="de-image-grid" data-image-count={block.images.length}>
          {block.images.map((image, index) => (
            <figure key={`${image.src}-${index}`} className="de-image-grid__item">
              <img src={image.src} alt={image.alt} loading="lazy" />
              {image.caption || image.alt ? (
                <figcaption>{image.caption || image.alt}</figcaption>
              ) : null}
            </figure>
          ))}
        </div>
      );
    case 'video':
      return <Video src={block.src} title={block.title} poster={block.poster} />;
    case 'diagram':
      return (
        <Board
          aria-label={block.title}
          importSource={{format: 'mermaid', source: block.source}}
          viewerTitle={block.title}
        />
      );
    case 'annotation':
      return <Annotation label={block.label}>{renderInline(block.text)}</Annotation>;
    case 'callout':
      if (block.variant === 'annotation') {
        const lines = [block.title, ...block.body].filter(Boolean);
        return (
          <blockquote>
            {lines.map((line, index) => (
              <p key={`${line}-${index}`}>{renderInline(line)}</p>
            ))}
          </blockquote>
        );
      }
      return (
        <Callout variant={block.variant}>
          {block.title ? <p><strong>{renderInline(block.title)}</strong></p> : null}
          {block.body.map((line, index) => (
            <p key={`${line}-${index}`}>{renderInline(line)}</p>
          ))}
        </Callout>
      );
    case 'table':
      return (
        <Table>
          <thead>
            <tr>
              {block.headers.map((header) => (
                <th key={header}>{renderInline(header)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {block.rows.map((row, rowIndex) => (
              <tr key={rowIndex}>
                {block.headers.map((header, cellIndex) => (
                  <td key={`${header}-${cellIndex}`}>{renderInline(row[cellIndex] ?? '')}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </Table>
      );
    case 'timeline':
      return null;
    default:
      return null;
  }
}

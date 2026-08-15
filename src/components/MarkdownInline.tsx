import type {ReactNode} from 'react';
import {ResourceLink} from './ResourceLink.js';

const inlineTokenPattern =
  /(\*\*[^*\n]+?\*\*|\[[^\]\n]+\]\((?:https?:\/\/|\/|#)[^)]+\)|`[^`\n]+`|https?:\/\/[^\s<>"']+)/gi;
const markdownLinkPattern = /^\[([^\]\n]+)\]\(((?:https?:\/\/|\/|#)[^)]+)\)$/i;
const trailingUrlPunctuation = /[),.;:!?，。；：！？、）\]]+$/;

export function MarkdownInline({text}: {text: string}): ReactNode {
  const tokens = Array.from(text.matchAll(inlineTokenPattern));
  if (tokens.length === 0) return text;

  let lastIndex = 0;
  return (
    <>
      {tokens.map((match, index) => {
        const token = match[0];
        const start = match.index ?? 0;
        const prefix = text.slice(lastIndex, start);
        lastIndex = start + token.length;

        if (token.startsWith('`') && token.endsWith('`')) {
          return (
            <span key={`${token}-${index}`}>
              {prefix}
              <code>{token.slice(1, -1)}</code>
            </span>
          );
        }

        if (token.startsWith('**') && token.endsWith('**')) {
          return (
            <span key={`${token}-${index}`}>
              {prefix}
              <strong>
                <MarkdownInline text={token.slice(2, -2)} />
              </strong>
            </span>
          );
        }

        const markdownLink = token.match(markdownLinkPattern);
        if (markdownLink) {
          const [, label, href] = markdownLink;
          return (
            <span key={`${href}-${index}`}>
              {prefix}
              {/^https?:\/\//i.test(href) ? (
                <ResourceLink href={href} target="_blank" rel="noopener noreferrer" title={href}>
                  {label}
                </ResourceLink>
              ) : (
                <a href={href} title={href}>
                  {label}
                </a>
              )}
            </span>
          );
        }

        const trailingMatch = token.match(trailingUrlPunctuation);
        const trailing = trailingMatch?.[0] ?? '';
        const href = trailing ? token.slice(0, -trailing.length) : token;
        return (
          <span key={`${href}-${index}`}>
            {prefix}
            <ResourceLink href={href} target="_blank" rel="noopener noreferrer" title={href}>
              {formatLinkLabel(href)}
            </ResourceLink>
            {trailing}
          </span>
        );
      })}
      {text.slice(lastIndex)}
    </>
  );
}

function formatLinkLabel(url: string) {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, '');
    const pathParts = parsed.pathname.split('/').filter(Boolean);
    const compactPath =
      pathParts.length > 0
        ? `/${pathParts.slice(0, 2).join('/')}${pathParts.length > 2 ? '/...' : ''}`
        : '';
    return `${host}${compactPath}`;
  } catch {
    return url.length > 54 ? `${url.slice(0, 51)}...` : url;
  }
}

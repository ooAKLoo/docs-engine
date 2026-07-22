'use client';

import {Check, Copy} from 'lucide-react';
import {
  Children,
  isValidElement,
  useEffect,
  useRef,
  useState,
  type HTMLAttributes,
  type ReactNode,
} from 'react';
export type CodeBlockProps = Omit<HTMLAttributes<HTMLPreElement>, 'children'> & {
  children?: ReactNode;
  code?: string;
  copiedLabel?: string;
  copyLabel?: string;
  language?: string;
  onCopy?: (code: string) => void;
};

function readText(node: ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(readText).join('');
  if (isValidElement<{children?: ReactNode}>(node)) return readText(node.props.children);
  return '';
}

function languageFromClassName(className?: string) {
  return className?.match(/(?:lang(?:uage)?)-([\w#+.-]+)/i)?.[1];
}

function inferLanguage(children: ReactNode, className?: string) {
  const codeElement = Children.toArray(children).find(
    (child) => isValidElement<{className?: string}>(child) && child.type === 'code',
  );
  const childClassName =
    isValidElement<{className?: string}>(codeElement) && typeof codeElement.props.className === 'string'
      ? codeElement.props.className
      : undefined;

  return languageFromClassName(childClassName) ?? languageFromClassName(className);
}

async function copyText(value: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }

  const textarea = document.createElement('textarea');
  textarea.value = value;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand('copy');
  textarea.remove();
}

export function CodeBlock({
  children,
  className,
  code,
  copiedLabel = '已复制',
  copyLabel = '复制代码',
  language,
  onCopy,
  tabIndex = 0,
  ...props
}: CodeBlockProps) {
  const [copied, setCopied] = useState(false);
  const resetTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const codeText = code ?? readText(children).replace(/\n$/, '');
  const languageLabel = language ?? inferLanguage(children, className) ?? 'Code';

  useEffect(
    () => () => {
      if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    },
    [],
  );

  const handleCopy = async () => {
    await copyText(codeText);
    onCopy?.(codeText);
    setCopied(true);
    if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    resetTimerRef.current = setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="de-code-block" data-language={languageLabel.toLowerCase()}>
      <div className="de-code-block__toolbar">
        <span className="de-code-block__language">{languageLabel}</span>
        <button
          aria-label={copied ? copiedLabel : copyLabel}
          className="de-code-block__copy"
          onClick={handleCopy}
          type="button"
        >
          {copied ? <Check aria-hidden="true" size={14} /> : <Copy aria-hidden="true" size={14} />}
          <span aria-live="polite">{copied ? copiedLabel : copyLabel}</span>
        </button>
      </div>
      <pre className="de-code-block__pre" tabIndex={tabIndex} {...props}>
        <code>{codeText}</code>
      </pre>
    </div>
  );
}

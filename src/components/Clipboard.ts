function writeWithLegacyClipboard(value: string) {
  if (typeof document === 'undefined' || typeof document.execCommand !== 'function') {
    throw new Error('No clipboard write implementation is available');
  }
  const textarea = document.createElement('textarea');
  textarea.value = value;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  try {
    textarea.select();
    if (!document.execCommand('copy')) {
      throw new Error('Legacy clipboard copy was rejected');
    }
  } finally {
    textarea.remove();
  }
}

export async function writeClipboardText(value: string) {
  let modernClipboardError: unknown;
  const clipboard =
    typeof navigator === 'undefined' ? undefined : navigator.clipboard;

  if (typeof clipboard?.writeText === 'function') {
    try {
      await clipboard.writeText(value);
      return;
    } catch (error) {
      modernClipboardError = error;
    }
  }

  try {
    writeWithLegacyClipboard(value);
  } catch (legacyClipboardError) {
    throw new AggregateError(
      [modernClipboardError, legacyClipboardError].filter(
        (error): error is NonNullable<typeof error> => error != null,
      ),
      'Unable to write clipboard text',
    );
  }
}

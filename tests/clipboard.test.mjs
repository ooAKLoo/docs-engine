import assert from 'node:assert/strict';
import test from 'node:test';

import {writeClipboardText} from '../dist/components/Clipboard.js';

const navigatorDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
const documentDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'document');

function installGlobal(name, value) {
  Object.defineProperty(globalThis, name, {
    configurable: true,
    value,
    writable: true,
  });
}

function restoreGlobal(name, descriptor) {
  if (descriptor) {
    Object.defineProperty(globalThis, name, descriptor);
  } else {
    delete globalThis[name];
  }
}

function createLegacyClipboard({copyResult = true} = {}) {
  const events = [];
  const textarea = {
    remove() {
      events.push('remove');
    },
    select() {
      events.push('select');
    },
    setAttribute(name, value) {
      events.push(`attribute:${name}:${value}`);
    },
    style: {},
    value: '',
  };
  return {
    document: {
      body: {
        appendChild(element) {
          assert.equal(element, textarea);
          events.push('append');
        },
      },
      createElement(tagName) {
        assert.equal(tagName, 'textarea');
        return textarea;
      },
      execCommand(command) {
        assert.equal(command, 'copy');
        events.push('copy');
        return copyResult;
      },
    },
    events,
    textarea,
  };
}

test.afterEach(() => {
  restoreGlobal('navigator', navigatorDescriptor);
  restoreGlobal('document', documentDescriptor);
});

test('uses the asynchronous Clipboard API when it succeeds', async () => {
  const writes = [];
  installGlobal('navigator', {
    clipboard: {
      async writeText(value) {
        writes.push(value);
      },
    },
  });
  installGlobal('document', undefined);

  await writeClipboardText('current document');

  assert.deepEqual(writes, ['current document']);
});

test('falls back when the Clipboard API exists but rejects the write', async () => {
  const legacy = createLegacyClipboard();
  installGlobal('navigator', {
    clipboard: {
      async writeText() {
        throw new Error('permission denied');
      },
    },
  });
  installGlobal('document', legacy.document);

  await writeClipboardText('semantic markdown');

  assert.equal(legacy.textarea.value, 'semantic markdown');
  assert.deepEqual(legacy.events, [
    'attribute:readonly:',
    'append',
    'select',
    'copy',
    'remove',
  ]);
});

test('reports failure when both clipboard implementations reject the write', async () => {
  const legacy = createLegacyClipboard({copyResult: false});
  installGlobal('navigator', {
    clipboard: {
      async writeText() {
        throw new Error('permission denied');
      },
    },
  });
  installGlobal('document', legacy.document);

  await assert.rejects(
    writeClipboardText('semantic markdown'),
    /Unable to write clipboard text/,
  );
  assert.equal(legacy.events.at(-1), 'remove');
});

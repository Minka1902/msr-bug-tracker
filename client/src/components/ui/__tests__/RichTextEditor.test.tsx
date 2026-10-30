import { fireEvent, render, waitFor } from '@testing-library/react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { RichTextEditor, type UploadedFile } from '../RichTextEditor';

const SHOT: UploadedFile = { url: '/api/attachments/f1', name: 'shot [1].png', mime: 'image/png' };

const pasteImage = async (container: HTMLElement) => {
  await waitFor(() => expect(container.querySelector('.ProseMirror')).not.toBeNull());
  const file = new File(['png'], 'shot.png', { type: 'image/png' });
  fireEvent.paste(container.querySelector('.ProseMirror')!, {
    clipboardData: { files: [file], types: ['Files'], getData: () => '' },
  });
};

const HOSTILE = [
  '[click me](javascript:alert(1))',
  '<img src="x" onerror="alert(1)">',
  '<script>alert(1)</script>',
  '<a href="javascript:alert(1)">raw link</a>',
  '<iframe src="https://evil.example"></iframe>',
  '![pic](javascript:alert(1))',
].join('\n\n');

beforeAll(() => {
  Range.prototype.getClientRects = () => [] as unknown as DOMRectList;
  Range.prototype.getBoundingClientRect = () => new DOMRect();
});

describe('RichTextEditor', () => {
  it('neutralizes scripts, event handlers and javascript: URLs in stored markdown', async () => {
    const { container } = render(<RichTextEditor value={HOSTILE} editable={false} />);
    await waitFor(() => expect(container.querySelector('.rich-text')).not.toBeNull());
    const html = container.innerHTML;

    expect(container.querySelector('script, iframe')).toBeNull();
    expect(html).not.toMatch(/onerror/i);
    expect(html).not.toMatch(/javascript:/i);
  });

  it('is not exposed as a text box when read-only', async () => {
    const { container } = render(<RichTextEditor value="Hello" editable={false} aria-label="Comment body" />);
    await waitFor(() => expect(container.querySelector('.rich-text')).not.toBeNull());
    expect(container.querySelector('[role="textbox"]')).toBeNull();
  });

  it('saves a pasted image as soon as its upload finishes, without waiting for blur', async () => {
    const onSave = vi.fn();
    const { container } = render(
      <RichTextEditor value="Steps" onSave={onSave} onUpload={async () => [SHOT]} aria-label="Description" />,
    );
    await pasteImage(container);
    await waitFor(() => expect(onSave).toHaveBeenCalledWith(expect.stringContaining(`](${SHOT.url})`)));
  });

  it('still saves the image when the editor closed before the upload finished', async () => {
    const onSave = vi.fn();
    let finish!: (files: UploadedFile[]) => void;
    const { container, unmount } = render(
      <RichTextEditor
        value="Steps"
        onSave={onSave}
        onUpload={() => new Promise((resolve) => (finish = resolve))}
        aria-label="Description"
      />,
    );
    await pasteImage(container);
    unmount();
    await new Promise((resolve) => setTimeout(resolve, 50));
    finish([SHOT]);
    await waitFor(() => expect(onSave).toHaveBeenCalledWith(`Steps\n\n![shot 1.png](${SHOT.url})`));
  });

  it('does not save when it closes without an edit', async () => {
    const onSave = vi.fn();
    const { container, unmount } = render(
      <RichTextEditor value={'* one\n* two'} onSave={onSave} aria-label="Description" />,
    );
    await waitFor(() => expect(container.querySelector('.ProseMirror')).not.toBeNull());
    unmount();
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(onSave).not.toHaveBeenCalled();
  });
});

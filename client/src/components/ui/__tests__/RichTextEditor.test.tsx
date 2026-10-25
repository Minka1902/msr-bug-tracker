import { render, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { RichTextEditor } from '../RichTextEditor';

const HOSTILE = [
  '[click me](javascript:alert(1))',
  '<img src="x" onerror="alert(1)">',
  '<script>alert(1)</script>',
  '<a href="javascript:alert(1)">raw link</a>',
  '<iframe src="https://evil.example"></iframe>',
  '![pic](javascript:alert(1))',
].join('\n\n');

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
});

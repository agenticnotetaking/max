const xRenderer = {
  heading({ tokens, depth }) {
    const text = this.parser.parseInline(tokens);
    // X supports h2 and h3 via paste; h1 is reserved for article title
    const tag = depth <= 1 ? 'h2' : depth <= 2 ? 'h2' : 'h3';
    return `<${tag}>${text}</${tag}>\n`;
  },

  paragraph({ tokens }) {
    const text = this.parser.parseInline(tokens);
    return `<p>${text}</p>\n`;
  },

  strong({ tokens }) {
    const text = this.parser.parseInline(tokens);
    return `<strong>${text}</strong>`;
  },

  em({ tokens }) {
    const text = this.parser.parseInline(tokens);
    return `<em>${text}</em>`;
  },

  del({ tokens }) {
    const text = this.parser.parseInline(tokens);
    return `<s>${text}</s>`;
  },

  list({ ordered, items }) {
    const tag = ordered ? 'ol' : 'ul';
    const body = items.map(item => {
      const text = this.parser.parse(item.tokens, !!this.options.pedantic);
      return `<li>${text}</li>`;
    }).join('');
    return `<${tag}>${body}</${tag}>\n`;
  },

  listitem({ tokens }) {
    const text = this.parser.parse(tokens, !!this.options.pedantic);
    return `<li>${text}</li>`;
  },

  blockquote({ tokens }) {
    const body = this.parser.parse(tokens);
    return `<blockquote>${body}</blockquote>\n`;
  },

  link({ href, tokens }) {
    const text = this.parser.parseInline(tokens);
    return `<a href="${href}">${text}</a>`;
  },

  image({ href, text }) {
    const mediaMatch = href.match(/^media:(\d+)$/);
    if (mediaMatch) {
      return `<!--IMG:${mediaMatch[1]}-->`;
    }
    return `<a href="${href}">[Image: ${text || 'image'}]</a>`;
  },

  // X code blocks only work via toolbar, not paste.
  // Best fallback: blockquote preserves the block structure.
  code({ text }) {
    const escaped = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const lines = escaped.split('\n').map(l => `<p>${l || '<br>'}</p>`).join('');
    return `<blockquote>${lines}</blockquote>\n`;
  },

  codespan({ text }) {
    return `<strong>${text}</strong>`;
  },

  // X separators only work via toolbar, not paste.
  // Fallback: centered dot separator.
  hr() {
    return `<p>· · ·</p>\n`;
  },

  br() {
    return '<br>';
  },

  html({ text }) {
    return text;
  },

  space() {
    return '';
  }
};

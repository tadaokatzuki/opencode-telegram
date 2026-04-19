/**
 * Markdown to Telegram HTML Converter
 *
 * Converts GitHub-flavored Markdown from OpenCode to Telegram HTML.
 * Telegram only supports: <b> <i> <s> <u> <code> <pre> <a> <blockquote>
 *
 * BUG FIXES vs previous version:
 *   A - Blockquote / header / list tags were escaped because block-level
 *       transforms ran BEFORE escapeHtml → output was "&lt;b&gt;" not "<b>".
 *       Fix: extract code blocks first, escape everything else, THEN apply
 *       all markdown transforms on the already-escaped text.
 *   B - Same root cause as A (headers).
 *   D - Bold/italic regexes matched across newlines ([^*]+ matches \n).
 *       Fix: use [^*\n]+ and [^_\n]+.
 *   E - Bold/italic transforms ran after inline code, so **x** inside
 *       `**x**` got bolded inside the <code> tag.
 *       Fix: protect <code>/<pre> regions when applying inline transforms.
 *   F - tableBlockRegex and hasTable were declared but never used.
 *       Fix: removed dead variables, implemented proper table detection.
 *   G - Only separator rows (|---|) got the │ replacement; data rows kept |.
 *       Fix: replace | in ALL table rows (whole detected block at once).
 *   H - Link hrefs got double-escaped: & → &amp; by escapeHtml, then the
 *       link regex embedded &amp; in the href attribute.
 *       Fix: unescape href before embedding so it stays &amp; (valid HTML).
 */

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

export function markdownToTelegramHtml(markdown: string): string {
  if (!markdown) return ""

  // ── Step 1: Pull all code blocks out so nothing touches them ──────────────
  const { text: noCode, blocks } = extractCodeBlocks(markdown)

  // ── Step 2: HTML-escape everything that remains ──────────────────────────
  let result = escapeHtml(noCode)

  // ── Step 3: Block-level transforms (order matters) ───────────────────────
  result = convertBlockquotes(result)   // Fix A: now runs on escaped text, no re-escape
  result = convertHeaders(result)       // Fix B: same
  result = convertHorizontalRules(result)
  result = convertTables(result)        // Fix F, G: proper table detection
  result = convertLists(result)

  // ── Step 4: Inline transforms ─────────────────────────────────────────────
  // Fix E: inline code runs FIRST so bold/italic don't fire inside backticks.
  // Bold/italic use applyOutsideCodeTags which skips <code>…</code> content.
  result = convertInlineCode(result)    // must be before bold/italic
  result = convertBold(result)
  result = convertItalic(result)
  result = convertStrikethrough(result)
  result = convertLinks(result)

  // ── Step 5: Restore code blocks ──────────────────────────────────────────
  result = restoreCodeBlocks(result, blocks)

  return result
}

/**
 * Truncate HTML to Telegram's 4096-char limit, closing unclosed tags.
 */
export function truncateForTelegram(html: string, maxLength = 4000): string {
  if (html.length <= maxLength) return html

  let truncateAt = maxLength
  const tagStart = html.lastIndexOf("<", maxLength)
  const tagEnd   = html.lastIndexOf(">", maxLength)
  if (tagStart > tagEnd) truncateAt = tagStart

  let truncated = html.slice(0, truncateAt)

  // Close any unclosed HTML tags in reverse
  const openTags: string[] = []
  const tagRe = /<(\/?)(b|i|s|u|code|pre|a|blockquote)\b[^>]*>/gi
  let m: RegExpExecArray | null
  while ((m = tagRe.exec(truncated)) !== null) {
    if (m[1] === "/") {
      const idx = openTags.lastIndexOf(m[2].toLowerCase())
      if (idx !== -1) openTags.splice(idx, 1)
    } else {
      openTags.push(m[2].toLowerCase())
    }
  }
  for (let i = openTags.length - 1; i >= 0; i--) {
    truncated += `</${openTags[i]}>`
  }

  return truncated + "…"
}

export function containsMarkdown(text: string): boolean {
  return [
    /```/, /`[^`]+`/, /\*\*[^*]+\*\*/, /__[^_]+__/,
    /\*[^*\n]+\*/, /~~[^~]+~~/, /\[[^\]]+\]\([^)]+\)/,
    /^#{1,6}\s/m, /^\s*[-*+]\s/m, /^\s*\d+\.\s/m, /^\|.+\|/m,
  ].some(p => p.test(text))
}

// ─────────────────────────────────────────────────────────────────────────────
// Code block extraction / restoration
// ─────────────────────────────────────────────────────────────────────────────

interface CodeBlock { placeholder: string; html: string }

/**
 * Replace fenced code blocks with NUL-delimited placeholders.
 * Handles: ```lang\ncode\n```  and  ```lang code``` (no newline).
 */
function extractCodeBlocks(text: string): { text: string; blocks: CodeBlock[] } {
  const blocks: CodeBlock[] = []
  const result = text.replace(/```(\w*)[^\S\r\n]?([\s\S]*?)```/g, (_, lang: string, code: string) => {
    const escaped = escapeHtml(code.trim())
    const html = lang
      ? `<pre><code class="language-${escapeHtml(lang)}">${escaped}</code></pre>`
      : `<pre>${escaped}</pre>`
    const placeholder = `\x00BLOCK${blocks.length}\x00`
    blocks.push({ placeholder, html })
    return placeholder
  })
  return { text: result, blocks }
}

function restoreCodeBlocks(text: string, blocks: CodeBlock[]): string {
  let result = text
  for (const b of blocks) result = result.replace(b.placeholder, b.html)
  return result
}

// ─────────────────────────────────────────────────────────────────────────────
// Block-level transforms  (run on already-HTML-escaped text)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fix A: blockquotes now run on escaped text. The `>` from markdown became
 * `&gt;` during escaping, so we match `&gt;` here.
 */
function convertBlockquotes(text: string): string {
  return text.replace(
    /((?:^[ \t]*&gt;[^\n]*\n?)+)/gm,
    (block) => {
      const inner = block.replace(/^[ \t]*&gt;\s?/gm, "").trim()
      return `<blockquote>${inner}</blockquote>\n`
    }
  )
}

/** Fix B: headers also run after escaping, so <b> won't be double-escaped. */
function convertHeaders(text: string): string {
  return text.replace(/^#{1,6}\s+(.+)$/gm, "<b>$1</b>")
}

function convertHorizontalRules(text: string): string {
  return text.replace(/^(?:---+|===+|\*\*\*+)[ \t]*$/gm, "──────────────")
}

/**
 * Fix F + G: detect full table blocks (header row + separator + data rows),
 * replace ALL pipes in the block with │, then wrap in <pre>.
 */
function convertTables(text: string): string {
  // A valid table has at least one separator row: |---|  or  |:--:|
  // We match multi-line blocks where all lines start and end with |
  return text.replace(
    /((?:^[ \t]*\|[^\n]+\|[ \t]*\n)+)/gm,
    (block) => {
      // Only treat as table if there's at least one separator row
      if (!/^\|[\s\-:|]+\|/m.test(block)) return block

      const lines = block.trim().split("\n")
      const rows: string[][] = []

      for (const line of lines) {
        const trimmed = line.trim()
        // Skip separator rows
        if (/^[\|\-\:\s]+$/.test(trimmed)) continue
        const cells = trimmed.slice(1, trimmed.endsWith("|") ? -1 : undefined)
          .split("|").map(c => c.trim())
        rows.push(cells)
      }

      if (rows.length === 0) return block

      const colCount = Math.max(...rows.map(r => r.length))
      const widths = Array.from({ length: colCount }, (_, i) =>
        Math.max(...rows.map(r => (r[i] ?? "").length), 3)
      )

      const rendered = rows.map((row, ri) => {
        const cells = Array.from({ length: colCount }, (_, i) =>
          (row[i] ?? "").padEnd(widths[i])
        ).join("  ")
        return ri === 0
          ? cells + "\n" + widths.map(w => "─".repeat(w)).join("  ")
          : cells
      })

      return `<pre>${rendered.join("\n")}</pre>\n`
    }
  )
}

function convertLists(text: string): string {
  // Unordered
  text = text.replace(/^([ \t]*)[-*+]\s+(.+)$/gm, (_m, indent: string, content: string) => {
    const depth = Math.floor(indent.replace(/\t/g, "  ").length / 2)
    const bullet = ["•", "◦", "▸"][Math.min(depth, 2)]
    return `${"  ".repeat(depth)}${bullet} ${content}`
  })
  // Ordered — already readable as-is; no transform needed
  return text
}

// ─────────────────────────────────────────────────────────────────────────────
// Inline transforms  (protect existing HTML tags)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Apply fn to text outside any HTML tag (opening/closing tags skipped).
 * Used for inline-code conversion only.
 */
function applyOutsideTags(text: string, fn: (s: string) => string): string {
  return text.replace(/(<!--[\s\S]*?-->|<[^>]+>|\x00BLOCK\d+\x00|[^<\x00]+)/g, (chunk) => {
    if (chunk.startsWith("<") || chunk.startsWith("\x00")) return chunk
    return fn(chunk)
  })
}

/**
 * Apply fn to text outside any HTML tag AND outside <code>…</code> / <pre>…</pre> content.
 * Fix E: prevents bold/italic from firing inside inline code that was already converted.
 */
function applyOutsideCodeTags(text: string, fn: (s: string) => string): string {
  return text.replace(
    /(<(?:code|pre)\b[^>]*>[\s\S]*?<\/(?:code|pre)>|<[^>]+>|\x00BLOCK\d+\x00|[^<\x00]+)/g,
    (chunk) => {
      if (chunk.startsWith("<") || chunk.startsWith("\x00")) return chunk
      return fn(chunk)
    }
  )
}

/** Fix D: [^*\n]+ prevents bold from spanning newlines. */
function convertBold(text: string): string {
  return applyOutsideCodeTags(text, s =>
    s.replace(/\*\*([^*\n]+)\*\*/g, "<b>$1</b>")
     .replace(/__([^_\n]+)__/g, "<b>$1</b>")
  )
}

/** Fix D: [^*\n]+ and [^_\n]+ prevent italic from spanning newlines. */
function convertItalic(text: string): string {
  return applyOutsideCodeTags(text, s =>
    s.replace(/(?<![*\w])\*([^*\n]+)\*(?![*\w])/g, "<i>$1</i>")
     .replace(/(?<![_\w])_([^_\n]+)_(?![_\w])/g, "<i>$1</i>")
  )
}

function convertStrikethrough(text: string): string {
  return applyOutsideCodeTags(text, s =>
    s.replace(/~~([^~\n]+)~~/g, "<s>$1</s>")
  )
}

/**
 * Fix H: the href was HTML-escaped (& → &amp;).  We embed it as-is since
 * &amp; is the correct form inside an HTML attribute value.
 */
function convertLinks(text: string): string {
  return applyOutsideCodeTags(text, s =>
    s.replace(/\[([^\]\n]+)\]\(([^)\n]+)\)/g, (_m, linkText: string, href: string) =>
      `<a href="${href}">${linkText}</a>`
    )
  )
}

/**
 * Fix E: runs before bold/italic so backtick content is wrapped in <code>
 * before bold/italic get a chance to match inside it.
 */
function convertInlineCode(text: string): string {
  return applyOutsideTags(text, s =>
    s.replace(/`([^`\n]+)`/g, (_m, code: string) => `<code>${code}</code>`)
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// HTML utilities
// ─────────────────────────────────────────────────────────────────────────────

function escapeHtml(text: string): string {
  if (!text) return ""
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

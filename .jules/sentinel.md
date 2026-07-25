## 2024-05-24 - [Fix XSS in AsciiDoc Renderer]
**Vulnerability:** AsciiDoc files were rendered using `dangerouslySetInnerHTML` while Asciidoctor's safe mode was set to `'safe'`, allowing execution of malicious scripts via attributes or macros (e.g., `+++<script>alert(1)</script>+++`).
**Learning:** Asciidoctor's `'safe'` mode is not sufficient to prevent XSS when rendering user-provided content. While setting safe mode to `'secure'` would disable dangerous macros, it also breaks necessary features like `include::[]` directives which are required by our custom processor to retrieve documents.
**Prevention:** Since we must use `safe: 'safe'` for Asciidoctor to support document includes, we must consistently apply a sanitization library like DOMPurify on any HTML string before rendering it with `dangerouslySetInnerHTML`.

## 2024-05-24 - Allow external links to open in new tabs securely
**Vulnerability:** External links created in AsciiDoc could not open in new tabs because DOMPurify removes `target` attributes by default to prevent "Reverse Tabnabbing" (where the opened tab gets access to `window.opener` and can navigate the original tab).
**Learning:** We can securely allow `target="_blank"` by using `ADD_ATTR: ['target']` and a `DOMPurify.addHook('afterSanitizeAttributes')` to ensure external links automatically get `target="_blank"` alongside `rel="noopener noreferrer"`.
**Prevention:** Always pair `target="_blank"` with `rel="noopener noreferrer"` and enforce it strictly via hooks rather than leaving it to the user. Remove `target` attribute for any non-external link to prevent abuse.
## 2024-07-25 - Fix Path Traversal in AsciiDoc Path Resolution
**Vulnerability:** Path traversal vulnerability in `resolvePath` within `src/components/AsciiDocRenderer.tsx`. The function naively returned target paths that started with `/` without sanitizing them, allowing malicious input like `/../../../../etc/passwd` to bypass the directory traversal check and resolve to unintended absolute paths.
**Learning:** Returning absolute paths directly without running them through stack-based path resolution (which filters out `..` directories) breaks security constraints because a path beginning with `/` can still contain `..` segments meant to traverse back from root (often mapping into unexpected territories like system files when read serverside or injected into fetches on the client).
**Prevention:** Normalize both relative and absolute paths through a strict stack-based loop, popping the stack on `..` and warning/blocking when trying to go above the permitted root depth.

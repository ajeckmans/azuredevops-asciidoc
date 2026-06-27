## 2024-05-24 - [Fix XSS in AsciiDoc Renderer]
**Vulnerability:** AsciiDoc files were rendered using `dangerouslySetInnerHTML` while Asciidoctor's safe mode was set to `'safe'`, allowing execution of malicious scripts via attributes or macros (e.g., `+++<script>alert(1)</script>+++`).
**Learning:** Asciidoctor's `'safe'` mode is not sufficient to prevent XSS when rendering user-provided content. While setting safe mode to `'secure'` would disable dangerous macros, it also breaks necessary features like `include::[]` directives which are required by our custom processor to retrieve documents.
**Prevention:** Since we must use `safe: 'safe'` for Asciidoctor to support document includes, we must consistently apply a sanitization library like DOMPurify on any HTML string before rendering it with `dangerouslySetInnerHTML`.

## 2024-05-24 - Allow external links to open in new tabs securely
**Vulnerability:** External links created in AsciiDoc could not open in new tabs because DOMPurify removes `target` attributes by default to prevent "Reverse Tabnabbing" (where the opened tab gets access to `window.opener` and can navigate the original tab).
**Learning:** We can securely allow `target="_blank"` by using `ADD_ATTR: ['target']` and a `DOMPurify.addHook('afterSanitizeAttributes')` to ensure external links automatically get `target="_blank"` alongside `rel="noopener noreferrer"`.
**Prevention:** Always pair `target="_blank"` with `rel="noopener noreferrer"` and enforce it strictly via hooks rather than leaving it to the user. Remove `target` attribute for any non-external link to prevent abuse.

## 2024-06-27 - [Fix Path Traversal in AsciiDoc Path Resolution]
**Vulnerability:** The `resolvePath` function in `AsciiDocRenderer.tsx` naively trusted any target path starting with `/`, returning it without evaluating `..` segments. This allowed path traversal (e.g., `/../../etc/passwd`) to bypass traversal blocking since the absolute path was not subjected to normalization.
**Learning:** Checking for an absolute path (`startsWith('/')`) is not sufficient to guarantee it's safe. Absolute paths can still contain traversal segments (`..`) that try to escape the intended directory root. Path normalization (collapsing `..` and `.`) must happen for ALL paths, whether they are absolute or relative.
**Prevention:** Normalize all paths by splitting them into segments and using a stack to resolve `..` and `.`, ensuring the stack never pops below its base level. Only treat paths as absolute after they've been fully resolved.

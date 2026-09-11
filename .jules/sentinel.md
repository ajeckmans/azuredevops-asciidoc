## 2024-05-24 - [Fix XSS in AsciiDoc Renderer]
**Vulnerability:** AsciiDoc files were rendered using `dangerouslySetInnerHTML` while Asciidoctor's safe mode was set to `'safe'`, allowing execution of malicious scripts via attributes or macros (e.g., `+++<script>alert(1)</script>+++`).
**Learning:** Asciidoctor's `'safe'` mode is not sufficient to prevent XSS when rendering user-provided content. While setting safe mode to `'secure'` would disable dangerous macros, it also breaks necessary features like `include::[]` directives which are required by our custom processor to retrieve documents.
**Prevention:** Since we must use `safe: 'safe'` for Asciidoctor to support document includes, we must consistently apply a sanitization library like DOMPurify on any HTML string before rendering it with `dangerouslySetInnerHTML`.

## 2024-05-24 - Allow external links to open in new tabs securely
**Vulnerability:** External links created in AsciiDoc could not open in new tabs because DOMPurify removes `target` attributes by default to prevent "Reverse Tabnabbing" (where the opened tab gets access to `window.opener` and can navigate the original tab).
**Learning:** We can securely allow `target="_blank"` by using `ADD_ATTR: ['target']` and a `DOMPurify.addHook('afterSanitizeAttributes')` to ensure external links automatically get `target="_blank"` alongside `rel="noopener noreferrer"`.
**Prevention:** Always pair `target="_blank"` with `rel="noopener noreferrer"` and enforce it strictly via hooks rather than leaving it to the user. Remove `target` attribute for any non-external link to prevent abuse.

## 2024-05-30 - Fix Path Traversal in resolvePath
**Vulnerability:** The `resolvePath` function for AsciiDoc includes naively trusted any path starting with `/`, bypassing directory traversal checks (`..`). An attacker could provide a path like `/../../etc/passwd` to include sensitive files or escape the intended directory root.
**Learning:** Checking for an absolute path prefix (`/`) is not sufficient for path safety if the remainder of the path is not normalized or validated against traversal sequences. Absolute paths must still be subjected to the same stack-based normalization and traversal blocking as relative paths.
**Prevention:** When implementing or modifying custom path resolution logic, ensure absolute paths are properly normalized and subjected to directory traversal checks (e.g., blocking out-of-bounds `..` segments) rather than naively trusting paths simply because they start with `/`.

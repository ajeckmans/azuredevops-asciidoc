## 2024-05-24 - [Fix XSS in AsciiDoc Renderer]
**Vulnerability:** AsciiDoc files were rendered using `dangerouslySetInnerHTML` while Asciidoctor's safe mode was set to `'safe'`, allowing execution of malicious scripts via attributes or macros (e.g., `+++<script>alert(1)</script>+++`).
**Learning:** Asciidoctor's `'safe'` mode is not sufficient to prevent XSS when rendering user-provided content. While setting safe mode to `'secure'` would disable dangerous macros, it also breaks necessary features like `include::[]` directives which are required by our custom processor to retrieve documents.
**Prevention:** Since we must use `safe: 'safe'` for Asciidoctor to support document includes, we must consistently apply a sanitization library like DOMPurify on any HTML string before rendering it with `dangerouslySetInnerHTML`.

## 2024-05-24 - Allow external links to open in new tabs securely
**Vulnerability:** External links created in AsciiDoc could not open in new tabs because DOMPurify removes `target` attributes by default to prevent "Reverse Tabnabbing" (where the opened tab gets access to `window.opener` and can navigate the original tab).
**Learning:** We can securely allow `target="_blank"` by using `ADD_ATTR: ['target']` and a `DOMPurify.addHook('afterSanitizeAttributes')` to ensure external links automatically get `target="_blank"` alongside `rel="noopener noreferrer"`.
**Prevention:** Always pair `target="_blank"` with `rel="noopener noreferrer"` and enforce it strictly via hooks rather than leaving it to the user. Remove `target` attribute for any non-external link to prevent abuse.

## 2024-05-24 - [Path Traversal in resolvePath via Absolute Paths]
**Vulnerability:** The custom `resolvePath` function for AsciiDoc includes and links allowed path traversal (e.g. `../../../etc/passwd`) if the `target` parameter started with `/` (an absolute path).
**Learning:** The previous implementation `if (target.startsWith('/')) return target;` immediately returned absolute paths verbatim without processing them through the directory traversal (`..`) checks, enabling traversal outside the repository bounds. Alternatively, simply setting `dir` to empty allowed `/../../../` to evade the stack boundary if the code only checked for `dir + '/' + target` but failed to properly block it inside the loop.
**Prevention:** Always pass all resolved path components, whether they start with absolute or relative roots, through directory traversal checks (`..` boundary limits) to ensure they cannot escape the intended scope.

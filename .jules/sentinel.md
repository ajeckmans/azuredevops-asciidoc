## 2024-05-24 - [Fix XSS in AsciiDoc Renderer]
**Vulnerability:** AsciiDoc files were rendered using `dangerouslySetInnerHTML` while Asciidoctor's safe mode was set to `'safe'`, allowing execution of malicious scripts via attributes or macros (e.g., `+++<script>alert(1)</script>+++`).
**Learning:** Asciidoctor's `'safe'` mode is not sufficient to prevent XSS when rendering user-provided content. While setting safe mode to `'secure'` would disable dangerous macros, it also breaks necessary features like `include::[]` directives which are required by our custom processor to retrieve documents.
**Prevention:** Since we must use `safe: 'safe'` for Asciidoctor to support document includes, we must consistently apply a sanitization library like DOMPurify on any HTML string before rendering it with `dangerouslySetInnerHTML`.

## 2024-05-24 - Allow external links to open in new tabs securely
**Vulnerability:** External links created in AsciiDoc could not open in new tabs because DOMPurify removes `target` attributes by default to prevent "Reverse Tabnabbing" (where the opened tab gets access to `window.opener` and can navigate the original tab).
**Learning:** We can securely allow `target="_blank"` by using `ADD_ATTR: ['target']` and a `DOMPurify.addHook('afterSanitizeAttributes')` to ensure external links automatically get `target="_blank"` alongside `rel="noopener noreferrer"`.
**Prevention:** Always pair `target="_blank"` with `rel="noopener noreferrer"` and enforce it strictly via hooks rather than leaving it to the user. Remove `target` attribute for any non-external link to prevent abuse.

## 2024-05-24 - [Fix Absolute Path Traversal in resolvePath]
**Vulnerability:** In `resolvePath`, absolute paths (starting with `/`) were returned directly without being processed through the `..` block check. This allowed attackers to use paths like `/../../../etc/passwd` to bypass the traversal check and access restricted system files.
**Learning:** Checking for traversal blocks (`..`) must apply equally to both absolute and relative paths. Bypassing validation logic simply because a path is absolute relies on an insecure assumption about what an absolute path looks like from an untrusted source.
**Prevention:** Always normalize and validate paths through the same robust check logic, irrespective of whether they start as absolute or relative, to ensure traversal mechanisms are systematically blocked.

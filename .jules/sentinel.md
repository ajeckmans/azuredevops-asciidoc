## 2024-05-24 - [Fix XSS in AsciiDoc Renderer]
**Vulnerability:** AsciiDoc files were rendered using `dangerouslySetInnerHTML` while Asciidoctor's safe mode was set to `'safe'`, allowing execution of malicious scripts via attributes or macros (e.g., `+++<script>alert(1)</script>+++`).
**Learning:** Asciidoctor's `'safe'` mode is not sufficient to prevent XSS when rendering user-provided content. While setting safe mode to `'secure'` would disable dangerous macros, it also breaks necessary features like `include::[]` directives which are required by our custom processor to retrieve documents.
**Prevention:** Since we must use `safe: 'safe'` for Asciidoctor to support document includes, we must consistently apply a sanitization library like DOMPurify on any HTML string before rendering it with `dangerouslySetInnerHTML`.

## 2024-05-24 - Allow external links to open in new tabs securely
**Vulnerability:** External links created in AsciiDoc could not open in new tabs because DOMPurify removes `target` attributes by default to prevent "Reverse Tabnabbing" (where the opened tab gets access to `window.opener` and can navigate the original tab).
**Learning:** We can securely allow `target="_blank"` by using `ADD_ATTR: ['target']` and a `DOMPurify.addHook('afterSanitizeAttributes')` to ensure external links automatically get `target="_blank"` alongside `rel="noopener noreferrer"`.
**Prevention:** Always pair `target="_blank"` with `rel="noopener noreferrer"` and enforce it strictly via hooks rather than leaving it to the user. Remove `target` attribute for any non-external link to prevent abuse.

## 2024-05-24 - Absolute Path Traversal in Custom Path Resolver
**Vulnerability:** A path traversal vulnerability existed in the `resolvePath` function where absolute target paths (starting with `/`) were returned immediately without bounds checking (`if (target.startsWith('/')) return target;`), allowing an attacker to bypass directory root restrictions using payloads like `include::/../../etc/passwd[]`.
**Learning:** Naively trusting absolute paths is dangerous when building custom virtual path resolvers. Standard relative path traversal safeguards (e.g. tracking directories in a stack) are bypassed if the input begins with an unvalidated root slash.
**Prevention:** Absolute paths must still be subjected to traversal validation. Treat absolute target paths similarly to relative ones by stripping the initial slash and splitting them into normal segments, then verify that `..` segments do not escape the stack boundary.

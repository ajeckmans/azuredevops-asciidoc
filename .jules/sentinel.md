## 2024-05-24 - [Fix XSS in AsciiDoc Renderer]
**Vulnerability:** AsciiDoc files were rendered using `dangerouslySetInnerHTML` while Asciidoctor's safe mode was set to `'safe'`, allowing execution of malicious scripts via attributes or macros (e.g., `+++<script>alert(1)</script>+++`).
**Learning:** Asciidoctor's `'safe'` mode is not sufficient to prevent XSS when rendering user-provided content. While setting safe mode to `'secure'` would disable dangerous macros, it also breaks necessary features like `include::[]` directives which are required by our custom processor to retrieve documents.
**Prevention:** Since we must use `safe: 'safe'` for Asciidoctor to support document includes, we must consistently apply a sanitization library like DOMPurify on any HTML string before rendering it with `dangerouslySetInnerHTML`.

## 2024-05-24 - Allow external links to open in new tabs securely
**Vulnerability:** External links created in AsciiDoc could not open in new tabs because DOMPurify removes `target` attributes by default to prevent "Reverse Tabnabbing" (where the opened tab gets access to `window.opener` and can navigate the original tab).
**Learning:** We can securely allow `target="_blank"` by using `ADD_ATTR: ['target']` and a `DOMPurify.addHook('afterSanitizeAttributes')` to ensure external links automatically get `target="_blank"` alongside `rel="noopener noreferrer"`.
**Prevention:** Always pair `target="_blank"` with `rel="noopener noreferrer"` and enforce it strictly via hooks rather than leaving it to the user. Remove `target` attribute for any non-external link to prevent abuse.

## 2024-05-27 - Fix path traversal bypassing checks via absolute paths
**Vulnerability:** The `resolvePath` function in `src/components/AsciiDocRenderer.tsx` bypassed path normalization and directory traversal (`..`) checks for targets starting with a forward slash `/` (absolute paths). This allowed malicious paths like `/../../etc/passwd` to bypass the traversal restrictions, leading to potential path traversal vulnerabilities.
**Learning:** Naively trusting paths simply because they are "absolute" (start with `/`) is a security risk. A malicious user can supply an absolute path that contains relative directory traversal elements (e.g., `/../`) to escape intended directory bounds.
**Prevention:** Always subject both relative and absolute paths to the same strict path normalization and directory traversal check logic. Do not early-return absolute paths without first normalizing them and validating that they do not traverse out of expected bounds.

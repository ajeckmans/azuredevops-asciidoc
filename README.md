# Azure DevOps AsciiDoc Viewer

A native-feeling Azure DevOps extension that seamlessly renders AsciiDoc (`.adoc`, `.asciidoc`) files directly in Pull Requests and the Repository Hub.

## Features
- **Pull Request Integration:** Adds a dedicated "AsciiDoc" tab in your Pull Requests showing rendered `.adoc` files that were modified.
- **Repository Hub Integration:** Browse and render `.adoc` files natively within the Repos Hub.
- **`include::[]` Support:** Fully supports recursive Asciidoctor includes using Azure DevOps REST APIs, bounded securely to your repository.
- **Native Look & Feel:** Perfect integration with Azure DevOps themes, including seamless Dark Mode support and native ADO tree/discussion components.
- **Syntax Highlighting:** Integrated code block highlighting via highlight.js.
- **Admonitions:** Native font-based icons for standard AsciiDoc admonitions (NOTE, TIP, WARNING, CAUTION, IMPORTANT).

## Installation
You can install this extension from the Visual Studio Marketplace.

## Development & Building Locally
1. Clone the repository.
2. Run `npm install --legacy-peer-deps`.
3. Run `npm run test` to run the Jest test suite.
4. Run `npm run build` to build the production VSIX bundle assets.

## Disclaimer
This extension is a third-party open-source project and is **not** officially affiliated with, endorsed by, or sponsored by the Eclipse Foundation or the AsciiDoc Working Group.

## License
MIT

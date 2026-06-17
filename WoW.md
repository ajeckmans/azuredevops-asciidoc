# Ways of Working (WoW)

## 1. Development Principles
- **Iterative & Incremental:** Build features iteratively. Start with displaying the PR tab, then adding the treeview, then rendering AsciiDoc, and finally adding the commenting capability.
- **Code Quality:** Ensure all code is typed using TypeScript. Use strict mode.
- **Modern UI:** Use `azure-devops-ui` to match the native Azure DevOps look and feel natively.

## 2. Tech Stack & Tools
- **Framework:** React + TypeScript.
- **Bundler:** Webpack or Vite for building the extension bundle.
- **Azure DevOps SDK:** Use `azure-devops-extension-sdk` for iframe initialization and context retrieval, and `azure-devops-extension-api` for making API calls.
- **AsciiDoc Engine:** `@asciidoctor/core`.
- **Testing:** Jest + `ts-jest` for unit testing.

## 3. Workflow & CI/CD
- **Branching Strategy:** Feature branches off `main` (e.g., `feature/pr-tab`, `feature/asciidoc-renderer`).
- **Release Process:** Use GitHub Actions to automate versioning and publishing to the Azure DevOps Marketplace (following the inspiration from `format-check-task`).

## 4. Agent Instructions
- The AI agent should continuously refer back to `requirements.md` and this `WoW.md` to align with the project goals.
- When generating code, prioritize clean, readable, and functional components.

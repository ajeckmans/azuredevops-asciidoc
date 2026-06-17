# Azure DevOps AsciiDoc PR Extension - Requirements

This document tracks all the requested features and requirements for the AsciiDoc Viewer extension, acting as a historical record and a reference for future development.

## Core Requirements
- [x] **New PR Tab**: Introduce a custom "AsciiDoc" tab/view in the Azure DevOps Pull Request page.
- [x] **AsciiDoc Rendering**: Render `.adoc` and `.asciidoc` files accurately using the `@asciidoctor/core` JavaScript library.
- [x] **PlantUML/Diagram Support**: Support advanced diagram rendering (e.g., PlantUML) by integrating with the Kroki extension (`asciidoctor-kroki`).

## UI / Layout (Native Alignment)
- [x] **Native Feel**: The extension's UI must closely mimic the native Azure DevOps "Files" tab.
- [x] **Tree View**: Display the repository's AsciiDoc files in a collapsible, hierarchical folder tree on the left side, rather than a flat list.
- [x] **Document View**: The right pane should display the file's path as a header, followed by the rendered HTML content.

## PR Commenting Integration
- [x] **Add Comments**: Users must be able to leave PR comments directly on an AsciiDoc file.
- [x] **Hover Actions**: Hovering over a file in the tree view should reveal a "More" (three-dots) menu, containing an "Add comment" action.
- [x] **Tree View Thread Bubbles**: Active PR comments must be rendered directly underneath their respective file nodes in the left-hand tree view (with an author avatar and comment snippet).
- [x] **Document View Threads**: Active PR threads must be rendered above the document content in the right pane.
- [x] **Thread Replies**: Users must be able to read entire threads and reply directly to existing comments seamlessly from within the AsciiDoc view.

## Extension Architecture & Publishing
- [x] **Tech Stack**: Use React, TypeScript, Webpack, and the `azure-devops-extension-api` / `azure-devops-ui` libraries.
- [x] **Marketplace Updates**: Increment the `version` in `vss-extension.json` for new features so the extension updates automatically across shared organizations without requiring manual re-installation.
- [x] **Inspiration Reference**: Use `ajeckmans/format-check-task` as a structural inspiration for building extensions.

## Project Hub Tab (AsciiDoc Repository Viewer)
- [x] **New Hub Tab**: Introduce a project-level "AsciiDoc" Hub tab under the Repos section to view AsciiDoc files across all repositories.
- [x] **Multi-Repo File Tree**: Display a top-level node for each repository, with a nested file tree for the `.adoc` files in their `main` (default) branch.
- [x] **Empty Repo Filtering**: Repositories that do not contain AsciiDoc files on their default branch must be completely hidden from the UI to avoid clutter.
- [x] **Global Background Caching**: To achieve empty repo filtering without crippling the API or spamming the browser console with restricted access errors, the extension must maintain a global, project-wide cache using `ExtensionDataService`.
- [x] **Hourly Auto-Scan**: The global cache must be automatically refreshed once every hour by the first user who opens the page, running a background scan of all repositories.
- [x] **Smart New Repo Detection**: The caching logic must automatically detect newly created repositories and scan them instantly, bypassing the 1-hour global timer.

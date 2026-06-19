## 2024-06-19 - Added accessibility attributes to clickable UI elements
**Learning:** Found an accessibility issue pattern in the app's components where clickable `div` elements acting as buttons were missing `role="button"`, `tabIndex`, and keyboard event handlers. Also, some icon-only buttons lacked `aria-label` and `title` attributes.
**Action:** When implementing custom interactive elements, ensure they include `role="button"`, `tabIndex={0}`, an `aria-label`, a `title` tooltip, and an `onKeyDown` handler to support standard keyboard interactions (Enter/Space) and screen readers.

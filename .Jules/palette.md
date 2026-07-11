## 2024-06-25 - Tooltips for Icon-Only Buttons
**Learning:** Sighted users often struggle with icon-only buttons as their purpose isn't always immediately clear, even with ARIA labels present for screen readers. Any new `azure-devops-ui` components introduced (like `TooltipEx`) must be properly mocked in `src/setupTests.tsx` to prevent Jest test failures.
**Action:** Always wrap icon-only buttons with a visual `<Tooltip>` component (from `azure-devops-ui/TooltipEx`) using the `text` prop to provide accessible context on hover/focus, and remember to mock the component in test setups.

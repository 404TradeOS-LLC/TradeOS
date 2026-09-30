One-line: A rounded monospace pill for status flags and small tags (e.g. "Status: Online", a timeline chip); pairs with the diagnostic aesthetic.

```jsx
<StatusPill tone="online">Status: Online</StatusPill>
<StatusPill tone="copper" dot={false}>Week 1–2</StatusPill>
<StatusPill tone="neutral" dot={false}>v2.4</StatusPill>
```

Notes: green `online` only for success. Set `dot={false}` for label-style chips.

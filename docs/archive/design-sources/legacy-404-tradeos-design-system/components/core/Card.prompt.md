One-line: The base surface container — forge-dark fill, 1px rust border, small radius; wrap any grouped content in it.

```jsx
<Card>
  <h3>Website design</h3>
  <p>Fast, mobile-first sites built to convert.</p>
</Card>
<Card variant="panel">…roomier padding + radius…</Card>
```

Notes: no drop shadow by default — the border carries the edge. Use `panel` for hero/feature blocks.

One-line: The brand button in three weights — copper `primary`, copper-outline `outline`, and low-emphasis `ghost`; use `primary` for the single main CTA per view.

```jsx
<Button variant="primary" iconRight={<ArrowRight size={16} />}>Get a quote</Button>
<Button variant="outline" as="a" href="/work">See our work</Button>
<Button variant="ghost">See pricing</Button>
```

Notes:
- Copper is the only fill. Do not create colored button variants.
- `as="a"` + `href` renders a link that looks identical.

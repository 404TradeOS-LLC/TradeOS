One-line: A service or feature framed as an installed "OS module" — copper icon tile, `MOD-0X` id, RUNNING status footer, hover corner-brackets; the marketing services grid is built from these.

```jsx
<OSModuleCard
  icon={<Search size={18} />}
  id="MOD-02"
  title="Local SEO"
  body="Get found on Google Maps when customers search your trade."
  href="/services/local-seo"
/>
```

Variants: pass `from` + `time` to add a price/timeline row (used on /services). `as="div"` for non-link contexts.

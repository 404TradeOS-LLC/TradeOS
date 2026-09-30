One-line: A pulsing LED dot with a monospace label for system/diagnostic status — use in terminal frame headers, module footers, and status strips.

```jsx
<StatusLED status="online" label="ONLINE" />
<StatusLED status="processing" label="BUILDING" />
<StatusLED status="error" label="404 NOT FOUND" />
<StatusLED status="idle" label="IDLE" />
```

Notes: `online` = green (the only green-allowed state). `idle` does not pulse.

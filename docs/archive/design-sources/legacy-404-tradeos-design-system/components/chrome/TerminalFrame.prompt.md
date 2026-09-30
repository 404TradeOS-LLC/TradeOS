One-line: The signature diagnostic window shell — squared "traffic lights" (2 dim + 1 copper), a mono title, and a StatusLED header; wrap dashboards, metrics, and demo panels in it.

```jsx
<TerminalFrame title="TradeOS // Control Center" status="online" statusLabel="ONLINE">
  …dashboard content…
</TerminalFrame>
```

Variants:
- `status` drives the header LED color (online/processing/error/idle).
- Pass `actions` to replace the LED with your own header controls (toggles, filters).

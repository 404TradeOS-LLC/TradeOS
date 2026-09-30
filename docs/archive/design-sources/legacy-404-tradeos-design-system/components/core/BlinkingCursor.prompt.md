One-line: A copper blinking block cursor for terminal/diagnostic text — place it after a line of mono copy to imply a live prompt.

```jsx
<span className="mono-label">SCANNING…<BlinkingCursor /></span>
```

Notes: decorative (`aria-hidden`); blink halts under reduced-motion.

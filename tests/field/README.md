# Field photos

Drop real 360 exports here — the ones with somebody underfoot pointing at
something — and run:

```bash
python tests/field_check.py
```

It prints, per photo, which signal the profiler read (arm, face, hi-vis
person, or nothing) and the bearing it produced, so a heuristic tuned on
synthetic fixtures can be checked against the site it was built for.

Nothing here is committed: this folder is for photos that are yours.

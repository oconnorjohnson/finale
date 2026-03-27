---
title: "Sampling Tiers"
---

# Sampling Tiers

## `DROP`

- not emitted to the sink
- fields are effectively discarded for sink output
- counts as sampled out when caused by sampling policy

Use when:

- the event is low-value steady-state traffic and policy intentionally removes it

## `KEEP_MINIMAL`

- keeps only `core` fields
- keeps only critical-looking sub-events

Use when:

- the event is worth retaining, but only in its smallest useful form

## `KEEP_NORMAL`

- keeps `core` and `domain` fields
- keeps sub-events

Use when:

- you want routine production visibility without full debug payloads

## `KEEP_DEBUG`

- keeps all field groups
- keeps all sub-events

Use when:

- the event contains errors or unusual conditions
- operators need the fullest available detail

## Notes

- Sampling tier affects verbosity, not just retention.
- Queue backpressure is separate from sampling and can still drop retained events.

# Video Learning

This context describes lesson content synchronized with video playback.

## Language

**Intervention**:
A coaching moment that becomes current at its start time and may remain current only until an optional end time. Without an end time, it remains current until a later intervention or the containing phase ends.
_Avoid_: Interaction

The same rule is implemented twice, once per authoring surface, because the two
have separate schemas:

| Surface                                | Start          | Optional end | Selector                              |
| -------------------------------------- | -------------- | ------------ | ------------------------------------- |
| Lesson model (Prisma / API / Next app) | `timestampSec` | `endTimeSec` | `lib/active-intervention.ts`          |
| Injected runtime (`[data-vp-config]`)  | `t`            | `end`        | `runtime-src/common/interventions.ts` |

Both treat the end as **exclusive**, and in both a completed latest intervention
never hands control back to an earlier one. Change one, change the other.

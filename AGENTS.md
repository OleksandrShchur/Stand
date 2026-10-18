# Application UI rules

- Every UI action that deletes application records or removes schedule intervals must open an in-app confirmation modal before changing state or calling a deletion API. This includes individual deletion, clearing all intervals, removing a location's intervals from a day's schedule, and replacing existing intervals with copied times.
- Identify what will be removed and explain its effect. For schedule drafts, explain that the change takes effect after saving the day and that existing bookings remain valid.
- Cancel, Escape, and backdrop dismissal must leave data unchanged. Focus Cancel by default, and prevent repeated submissions or dismissal while a deletion request is running.
- Use the shared `ConfirmDeleteDialog` for new deletion flows, or retain an existing confirmation dialog that follows these rules. Clearing filters and deselecting copy-target dates are selection changes, not deletion of application data.

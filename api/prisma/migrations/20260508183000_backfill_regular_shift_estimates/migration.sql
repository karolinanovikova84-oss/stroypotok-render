UPDATE "Shift"
SET
  "shiftHours" = CASE
    WHEN "shiftHours" <= 0 THEN 8.00
    ELSE "shiftHours"
  END,
  "estimatedShiftCount" = GREATEST(
    1,
    CEIL(EXTRACT(EPOCH FROM ("endsAt" - "startsAt")) / 86400.0)::integer
  )
WHERE "kind" = 'REGULAR'
  AND "estimatedShiftCount" IS NULL;

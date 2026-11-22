DROP POLICY IF EXISTS "Anyone can add a report" ON public.roof_reports;

CREATE POLICY "Anyone can add a valid report" ON public.roof_reports
FOR INSERT TO anon, authenticated
WITH CHECK (
  created_at BETWEEN now() - interval '5 minutes' AND now() + interval '5 minutes'
  AND latitude IS NOT NULL AND latitude BETWEEN -90 AND 90
  AND longitude IS NOT NULL AND longitude BETWEEN -180 AND 180
  AND roof_area IS NOT NULL AND roof_area >= 0 AND roof_area <= 10000000
  AND usable_area IS NOT NULL AND usable_area >= 0 AND usable_area <= roof_area
  AND (best_option IS NULL OR best_option IN ('solar', 'green', 'reflective', 'rainwater', 'hybrid'))
  AND CASE WHEN answers IS NULL THEN true
           WHEN jsonb_typeof(answers) = 'object' THEN octet_length(answers::text) <= 4000
           ELSE false END
  AND CASE WHEN scores IS NULL THEN true
           WHEN jsonb_typeof(scores) = 'array' THEN jsonb_array_length(scores) <= 10 AND octet_length(scores::text) <= 2000
           ELSE false END
  AND CASE WHEN estimates IS NULL THEN true
           WHEN jsonb_typeof(estimates) = 'object' THEN octet_length(estimates::text) <= 2000
           ELSE false END
);
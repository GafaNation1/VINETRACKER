-- Restrict chat-media reads to authenticated users only (no anonymous listing).
-- Direct file fetches via known URL still work for signed-in users.
DROP POLICY IF EXISTS "Chat media is publicly readable" ON storage.objects;

CREATE POLICY "Chat media readable by authenticated users"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'chat-media');

-- Mark bucket as non-public so listing endpoint requires auth+policy
UPDATE storage.buckets SET public = false WHERE id = 'chat-media';
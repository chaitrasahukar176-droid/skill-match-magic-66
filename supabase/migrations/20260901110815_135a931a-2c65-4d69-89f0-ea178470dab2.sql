CREATE POLICY "resumes read own" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'resumes' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "resumes insert own" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'resumes' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "resumes update own" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'resumes' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "resumes delete own" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'resumes' AND (storage.foldername(name))[1] = auth.uid()::text);
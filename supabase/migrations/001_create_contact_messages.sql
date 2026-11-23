-- ==============================================================================
-- Migration: 001_create_contact_messages.sql
-- Description: Creates contact_messages table with strict constraints, RLS,
--              automated updated_at trigger, and Supabase Realtime publication.
-- ==============================================================================

-- 1. Ensure required extensions exist
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Create the contact_messages table
CREATE TABLE IF NOT EXISTS public.contact_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL CHECK (char_length(trim(name)) >= 2 AND char_length(name) <= 100),
    email TEXT NOT NULL CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
    message TEXT NOT NULL CHECK (char_length(trim(message)) >= 5 AND char_length(message) <= 5000),
    status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'read', 'replied')),
    ip_address TEXT DEFAULT NULL,
    user_agent TEXT DEFAULT NULL,
    reply_notes TEXT DEFAULT NULL,
    replied_at TIMESTAMPTZ DEFAULT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 3. Comment on table and columns for documentation
COMMENT ON TABLE public.contact_messages IS 'Portfolio contact form submissions and status tracking.';
COMMENT ON COLUMN public.contact_messages.status IS 'Status of the message: new, read, or replied.';

-- 4. Create trigger to automatically maintain updated_at on modification
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_contact_messages_updated ON public.contact_messages;
CREATE TRIGGER on_contact_messages_updated
    BEFORE UPDATE ON public.contact_messages
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- 5. Performance Indexes
CREATE INDEX IF NOT EXISTS idx_contact_messages_created_at ON public.contact_messages (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_contact_messages_status ON public.contact_messages (status);
CREATE INDEX IF NOT EXISTS idx_contact_messages_email ON public.contact_messages (email);

-- 6. Row Level Security (RLS) Setup
ALTER TABLE public.contact_messages ENABLE ROW LEVEL SECURITY;

-- Revoke all default public permissions
REVOKE ALL ON public.contact_messages FROM PUBLIC;
REVOKE ALL ON public.contact_messages FROM anon;

-- Policy 1: Authenticated admin accounts can view all contact messages
DROP POLICY IF EXISTS "Allow authenticated admin select" ON public.contact_messages;
CREATE POLICY "Allow authenticated admin select"
    ON public.contact_messages
    FOR SELECT
    TO authenticated
    USING (true);

-- Policy 2: Authenticated admin accounts can update contact messages (mark read, replied, reply notes)
DROP POLICY IF EXISTS "Allow authenticated admin update" ON public.contact_messages;
CREATE POLICY "Allow authenticated admin update"
    ON public.contact_messages
    FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- Policy 3: Authenticated admin accounts can delete contact messages
DROP POLICY IF EXISTS "Allow authenticated admin delete" ON public.contact_messages;
CREATE POLICY "Allow authenticated admin delete"
    ON public.contact_messages
    FOR DELETE
    TO authenticated
    USING (true);

-- NOTE: Public (anon) INSERT is purposely NOT granted via RLS.
-- Public submissions are routed strictly through the backend API endpoint
-- using the Supabase Service Role Key after passing Cloudflare Turnstile,
-- rate limiting, honeypot checks, and server-side XSS sanitization.
-- This guarantees zero direct unverified spam injection into your database.

-- 7. Supabase Realtime Publication
-- Enables live dashboard notifications when new messages arrive.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND schemaname = 'public' 
        AND tablename = 'contact_messages'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.contact_messages;
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        -- If supabase_realtime publication is managed by Supabase dashboard, ignore error
        NULL;
END $$;

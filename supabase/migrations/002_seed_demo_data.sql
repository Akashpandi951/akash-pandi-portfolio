-- ==============================================================================
-- Migration: 002_seed_demo_data.sql (Optional Sample Messages for Admin Testing)
-- ==============================================================================

INSERT INTO public.contact_messages (name, email, message, status, created_at)
VALUES 
    (
        'Sarah Jenkins',
        'sarah.jenkins@fintechsolutions.com',
        'Hi Akash, we came across your portfolio and were really impressed by your data analytics projects and SQL background. We are expanding our data team and would love to schedule a preliminary conversation with you this week.',
        'new',
        timezone('utc'::text, now()) - interval '2 hours'
    ),
    (
        'David Kumar',
        'david.k@analyticsinsights.io',
        'Hello Akash, great work on the AI-assisted development project! I had a quick question regarding the prompt engineering workflows you used. Let me know if you are open to discussing.',
        'read',
        timezone('utc'::text, now()) - interval '1 day'
    ),
    (
        'Elena Rostova',
        'elena@moderntechlabs.org',
        'Hi Akash, following up on our discussion regarding the junior data analyst position. We sent over the initial technical assessment to your email.',
        'replied',
        timezone('utc'::text, now()) - interval '3 days'
    )
ON CONFLICT DO NOTHING;

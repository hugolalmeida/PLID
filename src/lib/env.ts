# Ensure the environment variables are loaded correctly
if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    throw new Error('Missing env var: NEXT_PUBLIC_SUPABASE_URL');
}
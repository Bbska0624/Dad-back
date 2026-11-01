-- Only the backend database role may access saved profiles, including hidden ones.
ALTER TABLE "site_sections" ENABLE ROW LEVEL SECURITY;

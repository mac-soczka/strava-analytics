-- Migration: 20250720160000_add_fake_table.sql
-- Description: Add fake table for testing migration system
-- This migration creates a test table with sample data

-- Create fake users table for testing
CREATE TABLE IF NOT EXISTS fake_users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  username VARCHAR(100) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  full_name VARCHAR(200),
  age INTEGER CHECK (age > 0 AND age < 150),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create fake posts table for testing
CREATE TABLE IF NOT EXISTS fake_posts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES fake_users(id) ON DELETE CASCADE,
  title VARCHAR(300) NOT NULL,
  content TEXT,
  likes_count INTEGER DEFAULT 0,
  published_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create fake categories table
CREATE TABLE IF NOT EXISTS fake_categories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(100) UNIQUE NOT NULL,
  description TEXT,
  color VARCHAR(7) DEFAULT '#000000',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create junction table for posts and categories
CREATE TABLE IF NOT EXISTS fake_post_categories (
  post_id UUID REFERENCES fake_posts(id) ON DELETE CASCADE,
  category_id UUID REFERENCES fake_categories(id) ON DELETE CASCADE,
  PRIMARY KEY (post_id, category_id)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_fake_users_username ON fake_users(username);
CREATE INDEX IF NOT EXISTS idx_fake_users_email ON fake_users(email);
CREATE INDEX IF NOT EXISTS idx_fake_posts_user_id ON fake_posts(user_id);
CREATE INDEX IF NOT EXISTS idx_fake_posts_published_at ON fake_posts(published_at);
CREATE INDEX IF NOT EXISTS idx_fake_categories_name ON fake_categories(name);

-- Enable Row Level Security (RLS)
ALTER TABLE fake_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE fake_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE fake_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE fake_post_categories ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Fake users can view all" ON fake_users
  FOR SELECT USING (true);

CREATE POLICY "Fake users can insert their own" ON fake_users
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Fake posts can view all" ON fake_posts
  FOR SELECT USING (true);

CREATE POLICY "Fake posts can insert by owner" ON fake_posts
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Fake categories can view all" ON fake_categories
  FOR SELECT USING (true);

CREATE POLICY "Fake categories can insert by admin" ON fake_categories
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Fake post categories can view all" ON fake_post_categories
  FOR SELECT USING (true);

-- Insert sample data
INSERT INTO fake_categories (name, description, color) VALUES
  ('Technology', 'Tech-related posts', '#3B82F6'),
  ('Sports', 'Sports and fitness content', '#10B981'),
  ('Food', 'Culinary adventures', '#F59E0B'),
  ('Travel', 'Travel experiences', '#8B5CF6'),
  ('Music', 'Music and entertainment', '#EF4444')
ON CONFLICT (name) DO NOTHING;

-- Insert sample users
INSERT INTO fake_users (username, email, full_name, age, is_active) VALUES
  ('john_doe', 'john@example.com', 'John Doe', 28, true),
  ('jane_smith', 'jane@example.com', 'Jane Smith', 32, true),
  ('bob_wilson', 'bob@example.com', 'Bob Wilson', 25, false),
  ('alice_brown', 'alice@example.com', 'Alice Brown', 29, true),
  ('charlie_davis', 'charlie@example.com', 'Charlie Davis', 35, true)
ON CONFLICT (username) DO NOTHING;

-- Insert sample posts
INSERT INTO fake_posts (user_id, title, content, likes_count) 
SELECT 
  u.id,
  'My first post about ' || c.name,
  'This is a sample post about ' || c.name || '. It contains some interesting content for testing purposes.',
  FLOOR(RANDOM() * 100) + 1
FROM fake_users u
CROSS JOIN fake_categories c
WHERE u.is_active = true
LIMIT 15;

-- Insert sample post-category relationships
INSERT INTO fake_post_categories (post_id, category_id)
SELECT 
  p.id,
  c.id
FROM fake_posts p
CROSS JOIN fake_categories c
WHERE RANDOM() < 0.3  -- 30% chance of association
LIMIT 20;

-- Create a view for easy querying
CREATE OR REPLACE VIEW fake_posts_with_details AS
SELECT 
  p.id,
  p.title,
  p.content,
  p.likes_count,
  p.published_at,
  u.username,
  u.full_name,
  STRING_AGG(c.name, ', ') as categories
FROM fake_posts p
JOIN fake_users u ON p.user_id = u.id
LEFT JOIN fake_post_categories pc ON p.id = pc.post_id
LEFT JOIN fake_categories c ON pc.category_id = c.id
GROUP BY p.id, p.title, p.content, p.likes_count, p.published_at, u.username, u.full_name;

-- Add comments
COMMENT ON TABLE fake_users IS 'Fake users table for testing migration system';
COMMENT ON TABLE fake_posts IS 'Fake posts table for testing migration system';
COMMENT ON TABLE fake_categories IS 'Fake categories table for testing migration system';
COMMENT ON TABLE fake_post_categories IS 'Junction table for posts and categories';
COMMENT ON VIEW fake_posts_with_details IS 'View combining posts with user and category information'; 
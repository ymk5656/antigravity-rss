-- This file: Run in Supabase SQL Editor
-- Or use: npx supabase db push (if CLI is linked)

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Profiles table
CREATE TABLE public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  username VARCHAR(100) UNIQUE NOT NULL,
  avatar_url TEXT,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Feeds table
CREATE TABLE public.feeds (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  url VARCHAR(2048) NOT NULL,
  title VARCHAR(500),
  description TEXT,
  favicon TEXT,
  site_url VARCHAR(2048),
  category VARCHAR(100) DEFAULT 'general',
  refresh_interval INTEGER DEFAULT 3600,
  last_fetched TIMESTAMPTZ,
  error_count INTEGER DEFAULT 0,
  last_error TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, url)
);

-- Articles table
CREATE TABLE public.articles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  feed_id UUID REFERENCES public.feeds(id) ON DELETE CASCADE NOT NULL,
  guid VARCHAR(2048) NOT NULL,
  title TEXT NOT NULL,
  content TEXT,
  content_html TEXT,
  summary TEXT,
  author VARCHAR(500),
  link VARCHAR(2048),
  image_url TEXT,
  pub_date TIMESTAMPTZ,
  is_read BOOLEAN DEFAULT FALSE,
  is_starred BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(feed_id, guid)
);

-- Indexes
CREATE INDEX idx_feeds_user_id ON feeds(user_id);
CREATE INDEX idx_feeds_last_fetched ON feeds(last_fetched);
CREATE INDEX idx_articles_feed_id ON articles(feed_id);
CREATE INDEX idx_articles_pub_date ON articles(pub_date DESC);

-- RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE feeds ENABLE ROW LEVEL SECURITY;
ALTER TABLE articles ENABLE ROW LEVEL SECURITY;

-- Profile policies
CREATE POLICY "Users can read own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Feed policies
CREATE POLICY "Users can read own feeds" ON feeds FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own feeds" ON feeds FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own feeds" ON feeds FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own feeds" ON feeds FOR DELETE USING (auth.uid() = user_id);

-- Article policies
CREATE POLICY "Users can read own articles" ON articles FOR SELECT USING (feed_id IN (SELECT id FROM feeds WHERE user_id = auth.uid()));
CREATE POLICY "Users can update own articles" ON articles FOR UPDATE USING (feed_id IN (SELECT id FROM feeds WHERE user_id = auth.uid()));

-- Trigger for auto-profile
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, username)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'username', 'user_' || LEFT(NEW.id::TEXT, 8)));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          username: string
          avatar_url: string | null
          settings: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          username: string
          avatar_url?: string | null
          settings?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          username?: string
          avatar_url?: string | null
          settings?: Json
          created_at?: string
          updated_at?: string
        }
      }
      feeds: {
        Row: {
          id: string
          user_id: string
          url: string
          title: string | null
          description: string | null
          favicon: string | null
          site_url: string | null
          category: string
          refresh_interval: number
          last_fetched: string | null
          error_count: number
          last_error: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          url: string
          title?: string | null
          description?: string | null
          favicon?: string | null
          site_url?: string | null
          category?: string
          refresh_interval?: number
          last_fetched?: string | null
          error_count?: number
          last_error?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          url?: string
          title?: string | null
          description?: string | null
          favicon?: string | null
          site_url?: string | null
          category?: string
          refresh_interval?: number
          last_fetched?: string | null
          error_count?: number
          last_error?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      articles: {
        Row: {
          id: string
          feed_id: string
          guid: string
          title: string
          content: string | null
          content_html: string | null
          summary: string | null
          author: string | null
          link: string | null
          image_url: string | null
          pub_date: string | null
          is_read: boolean
          is_starred: boolean
          read_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          feed_id: string
          guid: string
          title: string
          content?: string | null
          content_html?: string | null
          summary?: string | null
          author?: string | null
          link?: string | null
          image_url?: string | null
          pub_date?: string | null
          is_read?: boolean
          is_starred?: boolean
          read_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          feed_id?: string
          guid?: string
          title?: string
          content?: string | null
          content_html?: string | null
          summary?: string | null
          author?: string | null
          link?: string | null
          image_url?: string | null
          pub_date?: string | null
          is_read?: boolean
          is_starred?: boolean
          read_at?: string | null
          created_at?: string
        }
      }
    }
  }
}

export type Profile = Database['public']['Tables']['profiles']['Row']
export type Feed = Database['public']['Tables']['feeds']['Row']
export type Article = Database['public']['Tables']['articles']['Row']

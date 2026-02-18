'use client'

import { createClient } from '@/lib/supabase/client'
import { useCallback, useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import type { Feed, Article } from '@/lib/supabase/types'

function SkeletonLoader() {
  return (
    <div className="space-y-4">
      {[1, 2, 3].map((i) => (
        <div key={i} className="p-4 bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 animate-pulse">
          <div className="h-5 bg-zinc-200 dark:bg-zinc-800 rounded w-3/4 mb-3"></div>
          <div className="h-4 bg-zinc-200 dark:bg-zinc-800 rounded w-full mb-2"></div>
          <div className="h-4 bg-zinc-200 dark:bg-zinc-800 rounded w-2/3"></div>
        </div>
      ))}
    </div>
  )
}

function EmptyState({ onAddFeed }: { onAddFeed: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <svg className="w-24 h-24 text-zinc-300 dark:text-zinc-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
      </svg>
      <p className="text-zinc-500 dark:text-zinc-400 mb-4">No articles yet</p>
      <button
        onClick={onAddFeed}
        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
      >
        Add Your First Feed
      </button>
    </div>
  )
}

function ArticleModal({ article, onClose }: { article: Article; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-zinc-900 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white dark:bg-zinc-900 p-4 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-start">
          <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-50 pr-4">{article.title}</h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-6">
          <div className="flex items-center gap-3 text-sm text-zinc-500 mb-4">
            {article.author && <span>{article.author}</span>}
            {article.pub_date && (
              <>
                <span>&bull;</span>
                <span>{new Date(article.pub_date).toLocaleDateString()}</span>
              </>
            )}
          </div>
          <div
            className="prose prose-zinc dark:prose-invert max-w-none"
            dangerouslySetInnerHTML={{ __html: article.content_html || article.content || '' }}
          />
          <div className="mt-6 pt-4 border-t border-zinc-200 dark:border-zinc-800">
            <a
              href={article.link || '#'}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-700 dark:text-blue-400"
            >
              Read original article &rarr;
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function Home() {
  const [session, setSession] = useState<any>(null)
  const [feeds, setFeeds] = useState<Feed[]>([])
  const [articles, setArticles] = useState<Article[]>([])
  const [selectedFeed, setSelectedFeed] = useState<Feed | null>(null)
  const [loading, setLoading] = useState(true)
  const [articlesLoading, setArticlesLoading] = useState(false)
  const [showAddFeed, setShowAddFeed] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [newFeedUrl, setNewFeedUrl] = useState('')
  const [addingFeed, setAddingFeed] = useState(false)
  const [error, setError] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()
  const supabase = createClient()

  const fetchFeeds = useCallback(async () => {
    const res = await fetch('/api/feeds')
    if (res.ok) {
      const data = await res.json()
      setFeeds(data.feeds || [])
    }
  }, [])

  const fetchArticles = useCallback(async (feedId: string, showLoading = true) => {
    if (showLoading) setArticlesLoading(true)
    const res = await fetch(`/api/articles?feed_id=${feedId}`)
    if (res.ok) {
      const data = await res.json()
      setArticles(data.articles || [])
    }
    if (showLoading) setArticlesLoading(false)
  }, [])

  useEffect(() => {
    const getSession = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push('/login')
        return
      }
      setSession(session)
      const res = await fetch('/api/feeds')
      if (res.ok) {
        const data = await res.json()
        setFeeds(data.feeds || [])
        if (data.feeds?.length > 0) {
          setSelectedFeed(data.feeds[0])
        }
      }
      setLoading(false)
    }

    getSession()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event: string, session: any) => {
      setSession(session)
      if (!session) {
        router.push('/login')
      }
    })

    return () => subscription.unsubscribe()
  }, [router, supabase])

  useEffect(() => {
    if (selectedFeed) {
      fetchArticles(selectedFeed.id)
    }
  }, [selectedFeed, fetchArticles])

  const handleRefresh = async () => {
    setIsRefreshing(true)
    await fetchFeeds()
    if (selectedFeed) {
      await fetchArticles(selectedFeed.id)
    }
    setIsRefreshing(false)
  }

  const handleAddFeed = async (e: React.FormEvent) => {
    e.preventDefault()
    setAddingFeed(true)
    setError('')

    try {
      const res = await fetch('/api/feeds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: newFeedUrl }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Failed to add feed')
        setAddingFeed(false)
        return
      }

      setNewFeedUrl('')
      setShowAddFeed(false)
      await fetchFeeds()
    } catch (err) {
      setError('Failed to add feed')
    }

    setAddingFeed(false)
  }

  const handleDeleteFeed = async (feedId: string) => {
    if (!confirm('Delete this feed?')) return

    const res = await fetch(`/api/feeds/${feedId}`, { method: 'DELETE' })
    if (res.ok) {
      await fetchFeeds()
      if (selectedFeed?.id === feedId) {
        setSelectedFeed(null)
        setArticles([])
      }
    }
  }

  const handleToggleRead = async (article: Article) => {
    const res = await fetch(`/api/articles/${article.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_read: !article.is_read }),
    })

    if (res.ok) {
      setArticles(articles.map(a =>
        a.id === article.id ? { ...a, is_read: !a.is_read } : a
      ))
    }
  }

  const handleToggleStar = async (article: Article) => {
    const res = await fetch(`/api/articles/${article.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_starred: !article.is_starred }),
    })

    if (res.ok) {
      setArticles(articles.map(a =>
        a.id === article.id ? { ...a, is_starred: !article.is_starred } : a
      ))
    }
  }

  const handleExportOPML = async () => {
    const res = await fetch('/api/opml')
    if (res.ok) {
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'subscriptions.opml'
      a.click()
      URL.revokeObjectURL(url)
    }
  }

  const handleImportOPML = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const formData = new FormData()
    formData.append('file', file)

    const res = await fetch('/api/opml', {
      method: 'POST',
      body: formData,
    })

    const data = await res.json()

    if (res.ok) {
      alert(`Imported ${data.imported} feeds. ${data.failed} failed.`)
      await fetchFeeds()
    } else {
      alert(data.error || 'Failed to import OPML')
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const filteredArticles = searchQuery
    ? articles.filter(a =>
        a.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        a.summary?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : articles

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex bg-zinc-50 dark:bg-black">
      <aside className="w-72 bg-white dark:bg-zinc-900 border-r border-zinc-200 dark:border-zinc-800 flex flex-col">
        <div className="p-4 border-b border-zinc-200 dark:border-zinc-800">
          <h1 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">RSS Reader</h1>
        </div>

        <div className="p-2 border-b border-zinc-200 dark:border-zinc-800">
          <button
            onClick={() => setShowAddFeed(true)}
            className="w-full mb-2 py-2 px-3 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            + Add Feed
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          <div className="space-y-1">
            {feeds.map(feed => (
              <div
                key={feed.id}
                className={`group flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors ${
                  selectedFeed?.id === feed.id
                    ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                    : 'hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300'
                }`}
                onClick={() => setSelectedFeed(feed)}
              >
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{feed.title || 'Untitled Feed'}</p>
                  <p className="text-xs text-zinc-500 truncate">{feed.url}</p>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); handleDeleteFeed(feed.id) }}
                  className="opacity-0 group-hover:opacity-100 p-1 text-zinc-400 hover:text-red-500 transition-opacity"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            ))}
          </div>

          {feeds.length === 0 && (
            <div className="text-center py-8">
              <p className="text-sm text-zinc-500 mb-4">No feeds yet</p>
              <button
                onClick={() => setShowAddFeed(true)}
                className="text-blue-600 hover:text-blue-700 text-sm font-medium"
              >
                Add your first RSS feed
              </button>
            </div>
          )}
        </div>

        <div className="p-2 border-t border-zinc-200 dark:border-zinc-800">
          <button
            onClick={() => setShowSettings(true)}
            className="w-full py-2 px-3 text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Settings
          </button>
          <button
            onClick={handleLogout}
            className="w-full py-2 px-3 text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
          >
            Sign Out
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto">
        {selectedFeed ? (
          <div className="max-w-3xl mx-auto p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
                {selectedFeed.title || 'Articles'}
              </h2>
              <button
                onClick={handleRefresh}
                disabled={isRefreshing}
                className={`p-2 text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors ${isRefreshing ? 'animate-spin' : ''}`}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
            </div>

            <div className="mb-4">
              <input
                type="text"
                placeholder="Search articles..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div className="space-y-4">
              {articlesLoading ? (
                <SkeletonLoader />
              ) : filteredArticles.length === 0 ? (
                <EmptyState onAddFeed={() => setShowAddFeed(true)} />
              ) : (
                filteredArticles.map(article => (
                  <article
                    key={article.id}
                    className={`p-4 bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors cursor-pointer ${
                      article.is_read ? 'opacity-60' : ''
                    }`}
                    onClick={() => setSelectedArticle(article)}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 mb-1">
                          {article.title}
                        </h3>
                        {article.summary && (
                          <p className="text-sm text-zinc-600 dark:text-zinc-400 line-clamp-2 mb-2">
                            {article.summary}
                          </p>
                        )}
                        <div className="flex items-center gap-3 text-xs text-zinc-500">
                          {article.author && <span>{article.author}</span>}
                          {article.pub_date && (
                            <span>{new Date(article.pub_date).toLocaleDateString()}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => handleToggleRead(article)}
                          className={`p-2 rounded-lg transition-colors ${
                            article.is_read
                                ? 'text-blue-600 bg-blue-50 dark:bg-blue-900/20'
                                : 'text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300'
                          }`}
                          title={article.is_read ? 'Mark as unread' : 'Mark as read'}
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleToggleStar(article)}
                          className={`p-2 rounded-lg transition-colors ${
                            article.is_starred
                                ? 'text-yellow-500 bg-yellow-50 dark:bg-yellow-900/20'
                                : 'text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300'
                          }`}
                          title={article.is_starred ? 'Remove bookmark' : 'Bookmark'}
                        >
                          <svg className="w-5 h-5" fill={article.is_starred ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </article>
                ))
              )}
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <svg className="w-24 h-24 text-zinc-300 dark:text-zinc-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
              </svg>
              <p className="text-zinc-500 mb-4">Select a feed to view articles</p>
              <button
                onClick={() => setShowAddFeed(true)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
              >
                Add Your First Feed
              </button>
            </div>
          </div>
        )}
      </main>

      {showAddFeed && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-zinc-900 rounded-lg p-6 w-full max-w-md mx-4">
            <h2 className="text-xl font-bold mb-4 text-zinc-900 dark:text-zinc-50">
              Add RSS Feed
            </h2>

            {error && (
              <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg text-sm">
                {error}
              </div>
            )}

            <form onSubmit={handleAddFeed}>
              <input
                type="url"
                value={newFeedUrl}
                onChange={(e) => setNewFeedUrl(e.target.value)}
                placeholder="https://example.com/feed.xml"
                className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent mb-4"
                required
              />

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => { setShowAddFeed(false); setError(''); }}
                  className="flex-1 py-2 px-4 border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addingFeed}
                  className="flex-1 py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50"
                >
                  {addingFeed ? 'Adding...' : 'Add Feed'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showSettings && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-zinc-900 rounded-lg p-6 w-full max-w-md mx-4">
            <h2 className="text-xl font-bold mb-4 text-zinc-900 dark:text-zinc-50">
              Settings
            </h2>

            <div className="space-y-4">
              <div>
                <h3 className="font-medium text-zinc-900 dark:text-zinc-50 mb-2">OPML</h3>
                <div className="flex gap-2">
                  <button
                    onClick={handleExportOPML}
                    className="flex-1 py-2 px-4 border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors text-sm"
                  >
                    Export OPML
                  </button>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="flex-1 py-2 px-4 border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors text-sm"
                  >
                    Import OPML
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".opml,.xml"
                    onChange={handleImportOPML}
                    className="hidden"
                  />
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setShowSettings(false)}
                className="py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedArticle && (
        <ArticleModal article={selectedArticle} onClose={() => setSelectedArticle(null)} />
      )}
    </div>
  )
}

export const dynamic = 'force-dynamic'

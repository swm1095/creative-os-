'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { ToolId, ViewId, Creative } from '@/lib/types'
import { TOOLS } from '@/lib/constants'
import { useBrands } from '@/lib/hooks/use-brands'
import { useCreatives } from '@/lib/hooks/use-creatives'
import { useToast } from '@/lib/hooks/use-toast'
import Sidebar from '@/components/layout/Sidebar'
import Topbar from '@/components/layout/Topbar'
import ToastContainer from '@/components/ui/Toast'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import EmptyState from '@/components/ui/EmptyState'
import TaskBar from '@/components/ui/TaskBar'
import { useBackgroundTasks, BackgroundTask } from '@/lib/hooks/use-background-tasks'
import { useAuth } from '@/lib/hooks/use-auth'
import LoginView from '@/components/views/LoginView'

// Views
import HubView from '@/components/views/HubView'
import ImageDashboardView from '@/components/views/ImageDashboardView'
import GenerateView from '@/components/views/GenerateView'
import QCView from '@/components/views/QCView'
import BrandView from '@/components/views/BrandView'
import ChatView from '@/components/views/ChatView'
import CopyView from '@/components/views/CopyView'
import PerformanceView from '@/components/views/PerformanceView'
import ResizeView from '@/components/views/ResizeView'
import DataConnectionsView from '@/components/views/DataConnectionsView'
import ListeningView from '@/components/views/ListeningView'
import UGCTeamView from '@/components/views/UGCTeamView'
import BrandResearchView from '@/components/views/BrandResearchView'
import SavedInsightsView from '@/components/views/SavedInsightsView'

export default function DashboardPage() {
  const { user, loading: authLoading, login, loginWithGoogle, logout, isAdmin } = useAuth()
  const { brands, activeBrand, setActiveBrand, createBrand, updateBrand, refreshBrands } = useBrands()
  const { creatives, addCreatives } = useCreatives(activeBrand?.id)
  const { toasts, addToast, dismissToast } = useToast()
  const { tasks, addTask, dismissTask } = useBackgroundTasks()

  const isClient = user?.role === 'client'
  const [currentTool, setCurrentTool] = useState<ToolId>(isClient ? 'hypeimage' : null)
  const [activeView, setActiveView] = useState<ViewId>(isClient ? 'brand' : 'hub')

  // Auto-select the client's brand when they log in
  useEffect(() => {
    if (isClient && user?.brand_id && brands.length && !activeBrand) {
      const clientBrand = brands.find(b => b.id === user.brand_id)
      if (clientBrand) setActiveBrand(clientBrand)
    }
  }, [isClient, user?.brand_id, brands, activeBrand, setActiveBrand])
  const [showBrandModal, setShowBrandModal] = useState(false)
  const [showAddBrandForm, setShowAddBrandForm] = useState(false)
  const [newBrandName, setNewBrandName] = useState('')
  const [newBrandUrl, setNewBrandUrl] = useState('')
  const [addingBrand, setAddingBrand] = useState(false)
  const [selectedCreative, setSelectedCreative] = useState<Creative | null>(null)
  const [lastGeneratedFormats, setLastGeneratedFormats] = useState<Record<string, string>>({})
  const [lastGeneratedHeadline, setLastGeneratedHeadline] = useState('')
  const [globalDragging, setGlobalDragging] = useState(false)
  const [droppedFiles, setDroppedFiles] = useState<File[]>([])
  const dragCounter = useRef(0)

  const handleGlobalDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    dragCounter.current++
    if (e.dataTransfer.items?.length) setGlobalDragging(true)
  }, [])

  const handleGlobalDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    dragCounter.current--
    if (dragCounter.current === 0) setGlobalDragging(false)
  }, [])

  const handleGlobalDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
  }, [])

  const handleGlobalDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setGlobalDragging(false)
    dragCounter.current = 0
    const files = Array.from(e.dataTransfer.files)
    if (!files.length) return
    setDroppedFiles(files)

    const imageFiles = files.filter(f => f.type.startsWith('image/'))
    const pdfFiles = files.filter(f => f.type === 'application/pdf')

    if (activeView === 'generate' && imageFiles.length) {
      addToast(`${imageFiles.length} image${imageFiles.length > 1 ? 's' : ''} ready for reference`, 'success')
    } else if (activeView === 'brand' && (imageFiles.length || pdfFiles.length)) {
      addToast(`${files.length} file${files.length > 1 ? 's' : ''} dropped - use the upload buttons to process`, 'success')
    } else if (imageFiles.length) {
      addToast(`${imageFiles.length} image${imageFiles.length > 1 ? 's' : ''} dropped. Go to HyperImage > Generate to use as reference, or Brand Kit to add to product library.`, 'info')
    } else {
      addToast('Drop images (PNG, JPG) or PDFs to upload', 'info')
    }
  }, [activeView, addToast])

  const navigate = useCallback((tool: ToolId, view: ViewId) => {
    setCurrentTool(tool)
    setActiveView(view)
  }, [])

  // Get topbar title based on current view
  const getTopbar = () => {
    if (activeView === 'hub') return { title: 'HyperCreate', subtitle: `Welcome back, ${user?.name || 'there'} · ${brands.length} brands active` }
    const tool = TOOLS.find(t => t.id === currentTool)
    const viewDef = tool?.views.find(v => v.id === activeView)
    const brandPrefix = activeBrand ? `${activeBrand.name} ` : ''
    return {
      title: `${brandPrefix}${tool?.name || viewDef?.label || 'Dashboard'}`,
      subtitle: viewDef?.label || '',
    }
  }

  const topbar = getTopbar()

  // Render active view
  const renderView = () => {
    switch (activeView) {
      case 'hub':
        return <HubView onNavigate={navigate} />
      case 'image-dashboard':
        return (
          <ImageDashboardView
            creatives={creatives}
            onNavigate={(view) => navigate(currentTool, view)}
            onSelectCreative={(c) => { setSelectedCreative(c); navigate(currentTool, 'qc') }}
          />
        )
      case 'generate':
        return (
          <GenerateView
            brandId={activeBrand?.id}
            brand={activeBrand}
            onToast={addToast}
            droppedFiles={droppedFiles}
            onDroppedFilesConsumed={() => setDroppedFiles([])}
            onGenerated={(results) => {
              const newCreatives: Creative[] = results
                .filter(r => r.imageUrl)
                .map(r => ({
                  id: crypto.randomUUID(),
                  brand_id: activeBrand?.id || '',
                  title: `${r.persona.name} - ${r.persona.angle.slice(0, 30)}`,
                  image_url: r.imageUrl,
                  format: '9x16' as const,
                  generator: 'gemini' as const,
                  qc_spelling: 'pending' as const,
                  qc_brand: 'pending' as const,
                  qc_claims: 'pending' as const,
                  created_at: new Date().toISOString(),
                }))
              addCreatives(newCreatives)

              // Store format URLs for resize view
              const firstResult = results[0]
              if (firstResult?.formats) {
                setLastGeneratedFormats(firstResult.formats as Record<string, string>)
                setLastGeneratedHeadline(firstResult.persona?.hook || firstResult.persona?.angle || '')
              }
            }}
          />
        )
      case 'resize':
        return <ResizeView formats={lastGeneratedFormats} headline={lastGeneratedHeadline} onToast={addToast} />
      case 'qc':
        return <QCView imageUrl={selectedCreative?.image_url} onToast={addToast} />
      case 'integrations':
        return <DataConnectionsView onToast={addToast} />
      case 'brand':
        return <BrandView brand={activeBrand} onToast={addToast} onBrandUpdate={isClient ? () => {} : updateBrand} isClient={isClient} />
      case 'chat':
        return <ChatView brandId={activeBrand?.id} brand={activeBrand} onToast={addToast} />
      case 'copy':
        return <CopyView brandId={activeBrand?.id} brand={activeBrand} onToast={addToast} onBrandUpdate={updateBrand} />
      case 'listening':
        return <ListeningView brand={activeBrand} onToast={addToast} onNavigate={navigate} onBrandUpdate={isClient ? undefined : updateBrand} addBackgroundTask={isClient ? undefined : addTask} isClient={isClient} />
      case 'brand-research':
        return (
          <BrandResearchView
            brand={activeBrand}
            onToast={addToast}
            onBrandUpdate={isClient ? () => {} : updateBrand}
            onCreateBrand={createBrand}
            onRefreshBrands={refreshBrands}
            onSetActiveBrand={setActiveBrand}
            activeTab="research"
            onChangeTab={(tab) => navigate(null, tab === 'research' ? 'brand-research' : 'saved-insights')}
            addBackgroundTask={isClient ? undefined : addTask}
            isClient={isClient}
          />
        )
      case 'saved-insights':
        // Show saved insights with tab bar (works for both brand-research context and hyperlistening context)
        if (currentTool === 'hyperlistening') {
          return <SavedInsightsView brand={activeBrand} onToast={addToast} onNavigate={navigate} />
        }
        return (
          <div>
            <div className="flex items-center gap-1 mb-6 border-b border-border">
              <button
                onClick={() => navigate(null, 'brand-research')}
                className="px-4 py-2.5 text-sm font-bold border-b-2 -mb-px transition-colors border-transparent text-text-dim hover:text-text-primary"
              >
                Brand Research
              </button>
              <button
                className="px-4 py-2.5 text-sm font-bold border-b-2 -mb-px transition-colors border-fulton text-fulton"
              >
                📁 Saved Insights
              </button>
            </div>
            <SavedInsightsView brand={activeBrand} onToast={addToast} onNavigate={navigate} />
          </div>
        )
      case 'tracker':
        return <UGCTeamView onToast={addToast} />
      case 'performance':
        return <PerformanceView />
      case 'coming-soon':
        return (
          <div className="animate-fadeIn">
            <EmptyState
              emoji="🚧"
              title="Coming Soon"
              subtitle="This tool is under development. Check back soon."
              size="lg"
            />
          </div>
        )
      default:
        return <HubView onNavigate={navigate} />
    }
  }

  // Show login if not authenticated
  if (authLoading) return <div className="h-screen bg-page" />
  if (!user) return <LoginView onLogin={login} onGoogleLogin={loginWithGoogle} />

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar
        currentTool={currentTool}
        activeView={activeView}
        activeBrand={activeBrand}
        brands={brands}
        onNavigate={navigate}
        onBrandSelect={setActiveBrand}
        onShowBrandModal={() => setShowBrandModal(true)}
        userName={user?.name}
        userEmail={user?.email}
        userRole={user?.role}
        onLogout={logout}
      />

      <main
        className="ml-sidebar flex-1 h-screen overflow-y-auto flex flex-col relative"
        onDragEnter={handleGlobalDragEnter}
        onDragLeave={handleGlobalDragLeave}
        onDragOver={handleGlobalDragOver}
        onDrop={handleGlobalDrop}
      >
        {globalDragging && (
          <div className="absolute inset-0 z-40 bg-fulton/10 border-4 border-dashed border-fulton rounded-lg flex items-center justify-center pointer-events-none">
            <div className="bg-surface px-6 py-4 rounded-xl shadow-2xl text-center">
              <div className="text-3xl mb-2">📁</div>
              <div className="text-sm font-bold">Drop files here</div>
              <div className="text-2xs text-text-dim mt-1">Images, PDFs, brand assets</div>
            </div>
          </div>
        )}
        <Topbar
          title={topbar.title}
          subtitle={topbar.subtitle}
          actions={
            activeView === 'image-dashboard' ? (
              <Button onClick={() => navigate(currentTool, 'generate')}>+ New Generation</Button>
            ) : undefined
          }
        />

        <div className="flex-1 px-7 py-6">
          {renderView()}
        </div>
      </main>

      {/* Brand selector modal */}
      <Modal
        open={showBrandModal}
        onClose={() => { setShowBrandModal(false); setShowAddBrandForm(false); setNewBrandName(''); setNewBrandUrl('') }}
        title={showAddBrandForm ? 'Add New Brand' : 'Switch Brand'}
        subtitle={showAddBrandForm ? 'Claude will research the brand automatically' : 'Select active client'}
        maxWidth="max-w-sm"
      >
        {showAddBrandForm ? (
          <div className="space-y-3">
            <div>
              <label className="block text-2xs font-bold tracking-wider uppercase text-text-muted mb-1.5">Brand Name</label>
              <input
                type="text"
                placeholder="e.g. Fulton"
                value={newBrandName}
                onChange={e => setNewBrandName(e.target.value)}
                className="w-full px-3 py-2.5 text-base text-text-primary bg-page border border-border rounded focus:border-fulton focus:outline-none transition-colors font-medium"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-2xs font-bold tracking-wider uppercase text-text-muted mb-1.5">Website URL</label>
              <input
                type="text"
                placeholder="https://walkfulton.com"
                value={newBrandUrl}
                onChange={e => setNewBrandUrl(e.target.value)}
                className="w-full px-3 py-2.5 text-base text-text-primary bg-page border border-border rounded focus:border-fulton focus:outline-none transition-colors font-medium"
              />
              <div className="text-2xs text-text-dim mt-1.5">Required - Claude will scrape this site to build the brand profile</div>
            </div>
            <div className="flex gap-2 pt-2">
              <Button
                variant="ghost"
                className="flex-1 justify-center"
                onClick={() => { setShowAddBrandForm(false); setNewBrandName(''); setNewBrandUrl('') }}
                disabled={addingBrand}
              >
                Cancel
              </Button>
              <Button
                className="flex-1 justify-center"
                disabled={!newBrandName.trim() || !newBrandUrl.trim() || addingBrand}
                onClick={async () => {
                  if (!newBrandName.trim() || !newBrandUrl.trim()) return
                  setAddingBrand(true)
                  addToast(`Researching ${newBrandName}... (30 sec)`, 'info')
                  try {
                    const res = await fetch('/api/brand-research', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ brandName: newBrandName, websiteUrl: newBrandUrl }),
                    })
                    const data = await res.json()
                    if (data.error) throw new Error(data.error)
                    await refreshBrands()
                    // Find the new brand and set it as active
                    const listRes = await fetch('/api/brands')
                    const listData = await listRes.json()
                    const newBrand = (listData.brands || []).find((b: { id: string }) => b.id === data.brandId)
                    if (newBrand) setActiveBrand(newBrand)
                    addToast(`${newBrandName} researched successfully`, 'success')
                    setShowBrandModal(false)
                    setShowAddBrandForm(false)
                    setNewBrandName('')
                    setNewBrandUrl('')
                  } catch (err: unknown) {
                    addToast(`Failed: ${err instanceof Error ? err.message : String(err)}`, 'error')
                  }
                  setAddingBrand(false)
                }}
              >
                {addingBrand ? 'Researching...' : 'Add + Research'}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {brands.map(b => (
              <div
                key={b.id}
                className={`group w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all ${
                  activeBrand?.id === b.id ? 'bg-fulton-light border border-fulton' : 'bg-page border border-border hover:border-text-subtle'
                }`}
              >
                <button
                  onClick={() => { setActiveBrand(b); setShowBrandModal(false) }}
                  className="flex items-center gap-3 flex-1 text-left"
                >
                  <div className="w-6 h-6 rounded-md flex items-center justify-center text-2xs font-black text-white" style={{ background: b.color }}>
                    {b.name.charAt(0)}
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-bold">{b.name}</div>
                    <div className="text-2xs text-text-dim">{b.url || 'No website'}</div>
                  </div>
                  {activeBrand?.id === b.id && <span className="text-2xs font-bold text-fulton">Active</span>}
                </button>
                <button
                  onClick={async (e) => {
                    e.stopPropagation()
                    if (!confirm(`Delete "${b.name}"? This cannot be undone.`)) return
                    try {
                      const res = await fetch('/api/brands', {
                        method: 'DELETE',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ brandId: b.id }),
                      })
                      const data = await res.json()
                      if (data.error) throw new Error(data.error)
                      addToast(`${b.name} deleted`, 'success')
                      if (activeBrand?.id === b.id) setActiveBrand(null)
                      await refreshBrands()
                    } catch (err: unknown) {
                      addToast(`Delete failed: ${err instanceof Error ? err.message : String(err)}`, 'error')
                    }
                  }}
                  className="w-7 h-7 rounded flex items-center justify-center text-text-dim hover:text-red hover:bg-red-light transition-all text-base shrink-0"
                  title={`Delete ${b.name}`}
                >
                  ×
                </button>
              </div>
            ))}
            <button
              onClick={() => setShowAddBrandForm(true)}
              className="w-full px-3 py-2.5 border border-dashed border-border rounded-lg text-sm text-text-dim hover:text-text-primary hover:border-text-subtle transition-all text-center"
            >
              + Add Brand
            </button>
          </div>
        )}
      </Modal>

      <TaskBar
        tasks={tasks}
        onDismiss={dismissTask}
        onViewResult={(task: BackgroundTask) => {
          if (task.type === 'research' || task.type === 'competitor-analysis') navigate(null, 'brand-research')
          else if (task.type === 'scan') navigate('hyperlistening', 'listening')
        }}
      />
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  )
}

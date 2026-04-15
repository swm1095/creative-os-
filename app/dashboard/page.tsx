'use client'

import { useState, useCallback, useRef } from 'react'
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

export default function DashboardPage() {
  const { brands, activeBrand, setActiveBrand, createBrand, updateBrand } = useBrands()
  const { creatives, addCreatives } = useCreatives(activeBrand?.id)
  const { toasts, addToast, dismissToast } = useToast()

  const [currentTool, setCurrentTool] = useState<ToolId>(null)
  const [activeView, setActiveView] = useState<ViewId>('hub')
  const [showBrandModal, setShowBrandModal] = useState(false)
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
    if (activeView === 'hub') return { title: 'HyperCreate', subtitle: `Welcome back, Sam · ${brands.length} brands active` }
    const tool = TOOLS.find(t => t.id === currentTool)
    const viewDef = tool?.views.find(v => v.id === activeView)
    const brandPrefix = activeBrand ? `${activeBrand.name} ` : ''
    return {
      title: `${brandPrefix}${tool?.name || viewDef?.label || 'Dashboard'}`,
      subtitle: viewDef?.label || '',
    }
  }

  const topbar = getTopbar()

  // Brand context string for AI features
  const brandContext = activeBrand
    ? `Brand: ${activeBrand.name}. ${activeBrand.tone_notes || ''} Colors: ${(activeBrand.brand_colors || []).join(', ')}`
    : ''

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
      case 'brand':
        return <BrandView brand={activeBrand} onToast={addToast} onBrandUpdate={updateBrand} />
      case 'chat':
        return <ChatView brandContext={brandContext} onToast={addToast} />
      case 'copy':
        return <CopyView brandContext={brandContext} onToast={addToast} />
      case 'performance':
        return <PerformanceView />
      case 'coming-soon':
        return (
          <div className="animate-fadeIn flex flex-col items-center justify-center py-24 text-center">
            <div className="text-5xl mb-4">🚧</div>
            <h2 className="text-2xl font-black mb-2">Coming Soon</h2>
            <p className="text-sm text-text-dim max-w-md">This tool is under development. Check back soon.</p>
          </div>
        )
      default:
        return <HubView onNavigate={navigate} />
    }
  }

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
            activeView === 'hub' ? (
              <Button onClick={() => navigate('hypeimage', 'generate')}>Launch HyperImage →</Button>
            ) : activeView === 'image-dashboard' ? (
              <Button onClick={() => navigate(currentTool, 'generate')}>+ New Generation</Button>
            ) : undefined
          }
        />

        <div className="flex-1 px-7 py-6">
          {renderView()}
        </div>
      </main>

      {/* Brand selector modal */}
      <Modal open={showBrandModal} onClose={() => setShowBrandModal(false)} title="Switch Brand" subtitle="Select active client" maxWidth="max-w-sm">
        <div className="space-y-2">
          {brands.map(b => (
            <button
              key={b.id}
              onClick={() => { setActiveBrand(b); setShowBrandModal(false) }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-left ${
                activeBrand?.id === b.id ? 'bg-fulton-light border border-fulton' : 'bg-page border border-border hover:border-text-subtle'
              }`}
            >
              <div className="w-6 h-6 rounded-md flex items-center justify-center text-2xs font-black text-white" style={{ background: b.color }}>
                {b.name.charAt(0)}
              </div>
              <div className="flex-1">
                <div className="text-sm font-bold">{b.name}</div>
                <div className="text-2xs text-text-dim">{b.creative_count || 0} creatives</div>
              </div>
              {activeBrand?.id === b.id && <span className="text-2xs font-bold text-fulton">Active</span>}
            </button>
          ))}
          <button
            onClick={async () => {
              const brand = await createBrand('New Brand')
              if (brand) { setShowBrandModal(false); addToast('Brand created', 'success') }
            }}
            className="w-full px-3 py-2.5 border border-dashed border-border rounded-lg text-sm text-text-dim hover:text-text-primary hover:border-text-subtle transition-all text-center"
          >
            + Add Brand
          </button>
        </div>
      </Modal>

      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  )
}

'use client'

import { ToolId, ViewId, Brand } from '@/lib/types'
import { TOOLS } from '@/lib/constants'
import NavItem from './NavItem'

interface SidebarProps {
  currentTool: ToolId
  activeView: ViewId
  activeBrand: Brand | null
  brands: Brand[]
  onNavigate: (tool: ToolId, view: ViewId) => void
  onBrandSelect: (brand: Brand) => void
  onShowBrandModal: () => void
}

export default function Sidebar({ currentTool, activeView, activeBrand, brands, onNavigate, onBrandSelect, onShowBrandModal }: SidebarProps) {
  const activeTool = TOOLS.find(t => t.id === currentTool)

  return (
    <nav className="w-sidebar min-w-sidebar bg-[#060c16] border-r border-border flex flex-col h-screen fixed left-0 top-0 z-10">
      {/* Logo */}
      <div className="px-4 pt-4 pb-3 border-b border-border">
        <button onClick={() => onNavigate(null, 'hub')} className="text-left flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-blue flex items-center justify-center">
            <span className="text-white font-black text-xs">H10</span>
          </div>
          <div>
            <div className="text-lg font-black tracking-tight text-text-primary">HyperCreate</div>
            <div className="text-2xs text-blue font-bold tracking-wider uppercase">by Hype10</div>
          </div>
        </button>
      </div>

      {/* Brand selector */}
      <div className="px-3.5 py-3">
        <div className="text-2xs font-bold tracking-wider uppercase text-text-muted mb-1.5 px-1">Active Client</div>
        <button
          onClick={onShowBrandModal}
          className="w-full px-2.5 py-2 bg-page border border-border rounded-lg flex items-center gap-2 hover:border-fulton transition-colors text-left"
        >
          <div
            className="w-[22px] h-[22px] rounded-md flex items-center justify-center text-2xs font-black text-white shrink-0"
            style={{ background: activeBrand?.color || '#2d7a54' }}
          >
            {activeBrand?.name?.charAt(0) || 'F'}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-bold truncate">{activeBrand?.name || 'Select brand'}</div>
          </div>
          <span className="text-text-dim text-xs">▾</span>
        </button>
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto px-2.5 py-1">
        {currentTool === null ? (
          // Hub navigation
          <>
            <div className="text-2xs font-bold tracking-wider uppercase text-text-muted px-2 py-1.5 mb-0.5">Platform</div>
            <NavItem label="Home" emoji="🏠" active={activeView === 'hub'} onClick={() => onNavigate(null, 'hub')} />
            <NavItem label="Connections" emoji="🔌" active={activeView === 'integrations'} onClick={() => onNavigate(null, 'integrations' as ViewId)} />

            <div className="text-2xs font-bold tracking-wider uppercase text-text-muted px-2 py-1.5 mt-3 mb-0.5">Your Tools</div>
            {TOOLS.map(tool => (
              <NavItem
                key={tool.id}
                label={tool.name}
                emoji={tool.emoji}
                badge={!tool.implemented ? 'Soon' : undefined}
                badgeVariant={!tool.implemented ? 'gold' : 'green'}
                onClick={() => {
                  if (tool.implemented) {
                    onNavigate(tool.id, tool.defaultView)
                  }
                }}
              />
            ))}
          </>
        ) : (
          // Tool navigation
          <>
            <button
              onClick={() => onNavigate(null, 'hub')}
              className="w-full flex items-center gap-2 px-2.5 py-2 text-xs font-bold text-blue hover:bg-blue-light rounded transition-colors mb-2"
            >
              ← Back to HyperCreate
            </button>
            <div className="text-2xs font-bold tracking-wider uppercase text-text-muted px-2 py-1.5 mb-0.5">
              {activeTool?.name || 'Tool'}
            </div>
            {activeTool?.views.map(view => (
              <NavItem
                key={view.id}
                label={view.label}
                active={activeView === view.id}
                onClick={() => onNavigate(currentTool, view.id)}
              />
            ))}
          </>
        )}
      </div>

      {/* User footer */}
      <div className="px-3.5 py-3 border-t border-border">
        <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-surface cursor-pointer">
          <div className="w-7 h-7 rounded-full bg-fulton text-white text-xs font-black flex items-center justify-center shrink-0">S</div>
          <div className="min-w-0">
            <div className="text-sm font-bold truncate">Sam Wolf</div>
            <div className="text-2xs text-text-muted truncate">sam@hype10agency.com</div>
          </div>
        </div>
      </div>
    </nav>
  )
}

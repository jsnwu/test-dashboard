import {useState, useEffect} from 'react'
import {useNavigate, useLocation} from 'react-router-dom'
import {useTheme} from '@/hooks/useTheme'
import {authGet} from '@features/authentication/utils/authFetch'
import {config} from '@config/environment.config'

interface HeaderProps {
    currentView: 'dashboard' | 'tests' | 'results'
    onViewChange: (view: 'dashboard' | 'tests' | 'results') => void
    wsConnected?: boolean
    user?: (() => {email: string; role?: string}) | {email: string; role?: string}
    onOpenSettings?: () => void
}

function NavButtons(props: {
    currentView: 'dashboard' | 'tests' | 'results'
    onSelect: (view: 'dashboard' | 'tests' | 'results') => void
}) {
    const {currentView, onSelect} = props
    const baseBtn = 'w-full text-left px-3 py-3 text-sm font-medium rounded-lg transition-colors'
    const active = 'bg-primary-100 dark:bg-primary-900 text-primary-700 dark:text-primary-300'
    const idle =
        'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700'

    return (
        <nav className="flex flex-col gap-1">
            <button
                type="button"
                onClick={() => onSelect('dashboard')}
                className={`${baseBtn} ${currentView === 'dashboard' ? active : idle}`}>
                📊 Dashboard
            </button>
            <button
                type="button"
                onClick={() => onSelect('results')}
                className={`${baseBtn} ${currentView === 'results' ? active : idle}`}>
                📄 Results
            </button>
            <button
                type="button"
                onClick={() => onSelect('tests')}
                className={`${baseBtn} ${currentView === 'tests' ? active : idle}`}>
                🧪 Tests
            </button>
        </nav>
    )
}

export default function Header({
    currentView,
    onViewChange,
    wsConnected = false,
    user,
    onOpenSettings,
}: HeaderProps) {
    const {isDark, themeMode, setThemeMode} = useTheme()
    const navigate = useNavigate()
    const location = useLocation()
    const [showUserMenu, setShowUserMenu] = useState(false)
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
    const [projects, setProjects] = useState<string[]>([])

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as Element
            if (showUserMenu && !target.closest('[data-user-menu]')) {
                setShowUserMenu(false)
            }
        }

        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [showUserMenu])

    useEffect(() => {
        setMobileMenuOpen(false)
    }, [location.pathname])

    useEffect(() => {
        if (mobileMenuOpen) {
            document.body.style.overflow = 'hidden'
        } else {
            document.body.style.overflow = ''
        }
        return () => {
            document.body.style.overflow = ''
        }
    }, [mobileMenuOpen])

    useEffect(() => {
        const loadProjects = async () => {
            try {
                const response = await authGet(`${config.api.baseUrl}/tests/projects`)
                if (!response.ok) return
                const data = await response.json()
                if (data?.success && Array.isArray(data.data)) {
                    setProjects(data.data)
                }
            } catch {
                // ignore
            }
        }

        loadProjects()
    }, [])

    const handleLogout = () => {
        localStorage.removeItem('_auth')
        sessionStorage.removeItem('_auth')
        setShowUserMenu(false)
        setMobileMenuOpen(false)
        window.location.reload()
    }

    const getUserData = () => {
        if (typeof user === 'function') {
            return user()
        }
        return user || null
    }

    const handleViewChange = (view: 'dashboard' | 'tests' | 'results') => {
        const params = new URLSearchParams(location.search)
        if (view === 'tests') {
            navigate(params.toString() ? `/tests?${params.toString()}` : '/tests')
        } else if (view === 'results') {
            navigate(params.toString() ? `/results?${params.toString()}` : '/results')
        } else {
            navigate(params.toString() ? `/dashboard?${params.toString()}` : '/dashboard')
        }
        onViewChange(view)
        setMobileMenuOpen(false)
    }

    const cycleTheme = () => {
        const order: Array<'auto' | 'light' | 'dark'> = ['auto', 'light', 'dark']
        const i = order.indexOf(themeMode)
        setThemeMode(order[(i + 1) % order.length])
    }

    const selectedProject = new URLSearchParams(location.search).get('project') || ''
    const setSelectedProject = (nextProject: string) => {
        const params = new URLSearchParams(location.search)
        if (!nextProject) {
            params.delete('project')
        } else {
            params.set('project', nextProject)
        }
        const qs = params.toString()
        navigate(qs ? `${location.pathname}?${qs}` : location.pathname)
    }

    const selectedTargetEnv = new URLSearchParams(location.search).get('env') || ''
    const setSelectedTargetEnv = (nextEnv: string) => {
        const params = new URLSearchParams(location.search)
        if (!nextEnv) {
            params.delete('env')
        } else {
            params.set('env', nextEnv)
        }
        const qs = params.toString()
        navigate(qs ? `${location.pathname}?${qs}` : location.pathname)
    }

    const renderBrand = (variant: 'sidebar' | 'header') => (
        <div
            className={
                variant === 'sidebar'
                    ? 'flex min-w-0 flex-wrap items-center justify-center gap-2 text-center'
                    : 'flex min-w-0 items-center gap-2'
            }>
            <div
                className="flex h-8 w-8 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white ring-1 ring-gray-200 dark:bg-gray-900 dark:ring-gray-600"
                aria-hidden="true">
                <img
                    src="/header-logo.png"
                    alt=""
                    className="h-7 w-7 object-contain"
                    width={28}
                    height={28}
                    decoding="async"
                />
            </div>
            <div className={variant === 'sidebar' ? 'min-w-0' : 'min-w-0 flex-1'}>
                <h1
                    className={
                        variant === 'sidebar'
                            ? 'text-balance text-center text-xl font-bold leading-tight text-gray-900 dark:text-white'
                            : 'truncate text-base font-bold text-gray-900 dark:text-white md:text-lg'
                    }>
                    Test Dashboard
                </h1>
            </div>
        </div>
    )

    const projectBlock = (fullWidthSelect: boolean) => (
        <div className="space-y-2">
            <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                Project
            </p>
            <select
                value={selectedProject}
                onChange={(e) => setSelectedProject(e.target.value)}
                className={
                    fullWidthSelect
                        ? 'w-full text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md px-2 py-2 text-gray-700 dark:text-gray-200'
                        : 'w-full text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md px-2 py-1.5 text-gray-700 dark:text-gray-200'
                }>
                <option value="">All</option>
                {projects.map((p) => (
                    <option key={p} value={p}>
                        {p}
                    </option>
                ))}
            </select>
        </div>
    )

    const targetEnvBlock = (fullWidthSelect: boolean) => (
        <div className="space-y-2">
            <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                Target env
            </p>
            <select
                value={selectedTargetEnv}
                onChange={(e) => setSelectedTargetEnv(e.target.value)}
                className={
                    fullWidthSelect
                        ? 'w-full text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md px-2 py-2 text-gray-700 dark:text-gray-200'
                        : 'w-full text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md px-2 py-1.5 text-gray-700 dark:text-gray-200'
                }>
                <option value="">All</option>
                <option value="local">Local</option>
                <option value="staging">Staging</option>
                <option value="prod">Prod</option>
            </select>
        </div>
    )

    const statusBlock = (compact: boolean) => (
        <div className={compact ? 'space-y-3' : 'space-y-4'}>
            <div className="space-y-2">
                <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                    Appearance
                </p>
                <button
                    type="button"
                    onClick={cycleTheme}
                    className="w-full flex items-center justify-between gap-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 px-3 py-2 text-left text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                    <span className="flex items-center gap-2 min-w-0">
                        <span aria-hidden="true">{isDark ? '🌙' : '☀️'}</span>
                        <span className="truncate">
                            {themeMode === 'auto'
                                ? 'System'
                                : themeMode === 'dark'
                                  ? 'Dark'
                                  : 'Light'}
                        </span>
                    </span>
                    <span className="text-xs text-gray-500 dark:text-gray-400 flex-shrink-0">
                        Cycle
                    </span>
                </button>
            </div>
            <div className="space-y-2">
                <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                    Connection
                </p>
                <div className="flex items-center gap-2 rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2 text-sm text-gray-600 dark:text-gray-300">
                    <div
                        className={`w-2 h-2 rounded-full flex-shrink-0 ${
                            wsConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'
                        }`}
                    />
                    <span>{wsConnected ? 'Live Updates' : 'Disconnected'}</span>
                </div>
            </div>
        </div>
    )

    const userMenuBlock = (variant: 'sidebar' | 'drawer') => {
        if (!user) return null
        const wrapClass = 'relative'
        const menuPosition =
            variant === 'sidebar'
                ? 'absolute left-full bottom-0 ml-2 w-48 z-50'
                : 'absolute left-0 right-0 top-full mt-1 w-full z-50'

        return (
            <div className={wrapClass} data-user-menu>
                <button
                    type="button"
                    onClick={() => setShowUserMenu(!showUserMenu)}
                    className="w-full flex items-center gap-2 text-sm bg-gray-100 dark:bg-gray-700 rounded-md px-3 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">
                    <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
                        <span className="text-white text-xs font-medium">
                            {getUserData()?.email?.[0]?.toUpperCase() || 'U'}
                        </span>
                    </div>
                    <span className="flex-1 text-left truncate">
                        {getUserData()?.email || 'User'}
                    </span>
                    <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path
                            fillRule="evenodd"
                            d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                            clipRule="evenodd"
                        />
                    </svg>
                </button>

                {showUserMenu && (
                    <div
                        className={`${menuPosition} bg-white dark:bg-gray-800 rounded-md shadow-lg border border-gray-200 dark:border-gray-700`}>
                        <div className="py-1">
                            <div className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 border-b border-gray-200 dark:border-gray-700">
                                <div className="font-medium truncate">
                                    {getUserData()?.email || 'User'}
                                </div>
                                {getUserData()?.role && (
                                    <div className="text-xs text-gray-500 dark:text-gray-400 capitalize">
                                        {getUserData()?.role}
                                    </div>
                                )}
                            </div>
                            {onOpenSettings && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        onOpenSettings()
                                        setShowUserMenu(false)
                                    }}
                                    className="block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                                    ⚙️ Settings
                                </button>
                            )}
                            <button
                                type="button"
                                onClick={handleLogout}
                                className="block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                                🔓 Sign out
                            </button>
                        </div>
                    </div>
                )}
            </div>
        )
    }

    return (
        <>
            {/* Desktop: left panel */}
            <aside className="relative z-10 hidden h-full min-h-0 w-[210px] flex-shrink-0 flex-col border-r border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800 md:flex">
                <div className="flex h-full min-h-0 flex-1 flex-col overflow-y-auto px-2 pt-4 pb-3">
                    <div className="mb-5 flex-shrink-0">{renderBrand('sidebar')}</div>

                    <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">
                        Navigation
                    </p>
                    <div className="mb-5 flex-shrink-0">
                        <NavButtons currentView={currentView} onSelect={handleViewChange} />
                    </div>

                    <div className="mb-5 flex-shrink-0">{projectBlock(false)}</div>

                    <div className="mb-5 flex-shrink-0">{targetEnvBlock(false)}</div>

                    <div className="mt-auto flex-shrink-0 border-t border-gray-200 pt-4 dark:border-gray-700">
                        {statusBlock(false)}
                    </div>
                </div>

                <div className="flex-shrink-0 border-t border-gray-200 px-2 pb-4 pt-3 dark:border-gray-700">
                    {userMenuBlock('sidebar')}
                </div>
            </aside>

            {/* Mobile: top bar */}
            <header className="md:hidden sticky top-0 z-50 flex-shrink-0 bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
                <div className="flex h-14 items-center justify-between gap-3 px-4">
                    <button
                        type="button"
                        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                        className="p-2 rounded-md text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex-shrink-0"
                        aria-label="Open menu"
                        aria-expanded={mobileMenuOpen}>
                        {mobileMenuOpen ? (
                            <svg
                                className="w-6 h-6"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24">
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M6 18L18 6M6 6l12 12"
                                />
                            </svg>
                        ) : (
                            <svg
                                className="w-6 h-6"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24">
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M4 6h16M4 12h16M4 18h16"
                                />
                            </svg>
                        )}
                    </button>
                    <div className="min-w-0 flex-1">{renderBrand('header')}</div>
                </div>
            </header>

            {/* Mobile: slide-in from left */}
            {mobileMenuOpen && (
                <div className="fixed inset-0 z-40 md:hidden">
                    <div
                        className="fixed inset-0 bg-black/50 backdrop-blur-sm"
                        onClick={() => setMobileMenuOpen(false)}
                        aria-hidden="true"
                    />
                    <div className="fixed top-14 left-0 bottom-0 w-[min(20rem,88vw)] bg-white dark:bg-gray-800 shadow-xl border-r border-gray-200 dark:border-gray-700 overflow-y-auto">
                        <div className="p-4 space-y-5">
                            <div>
                                <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider px-1 pb-2">
                                    Navigation
                                </p>
                                <NavButtons currentView={currentView} onSelect={handleViewChange} />
                            </div>
                            <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                                {projectBlock(true)}
                            </div>
                            <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                                {targetEnvBlock(true)}
                            </div>
                            <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                                {statusBlock(true)}
                            </div>
                            {user && (
                                <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                                    <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider px-1 pb-2">
                                        Account
                                    </p>
                                    {userMenuBlock('drawer')}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </>
    )
}

/**
 * OpenCode Instance Discovery
 * 
 * Discovers running OpenCode instances on the local machine by:
 * 1. Finding opencode processes via `ps`
 * 2. Getting their listening ports via `lsof`
 * 3. Querying their REST API for session info
 */

import rt from "../runtime"

// =============================================================================
// Types
// =============================================================================

/**
 * A discovered OpenCode instance
 */
export interface DiscoveredInstance {
  /** Process ID */
  pid: number
  /** HTTP port the instance is listening on */
  port: number
  /** Working directory of the process */
  workDir: string
  /** Whether this is a TUI instance (vs serve mode) */
  isTui: boolean
  /** Sessions available on this instance */
  sessions: DiscoveredSession[]
}

/**
 * A session discovered from an OpenCode instance
 */
export interface DiscoveredSession {
  /** Session ID */
  id: string
  /** Session title (if available) */
  title?: string
  /** Project directory */
  directory: string
  /** Project ID */
  projectId?: string
  /** Last updated timestamp */
  updatedAt?: Date
  /** The instance this session belongs to */
  instance: {
    pid: number
    port: number
    workDir: string
    /** Whether this is a TUI instance (vs opencode serve) */
    isTui: boolean
  }
}

// =============================================================================
// Discovery Functions
// =============================================================================

/**
 * Discover all running OpenCode instances on the local machine
 */
export async function discoverInstances(): Promise<DiscoveredInstance[]> {
  const instances: DiscoveredInstance[] = []

  try {
    // Find all opencode processes - use ps with proper column selection
    const psResult = await $`ps -eo pid,comm,args`.text()
    const lines = psResult.split('\n')

    for (const line of lines) {
      // Skip header
      if (line.startsWith('PID')) continue
      
      // Parse: PID COMMAND ARGS
      const parts = line.trim().split(/\s+/)
      if (parts.length < 2) continue
      
      const pid = parseInt(parts[0], 10)
      if (isNaN(pid) || pid === 0) continue
      
      // Match opencode binary more precisely
      const command = parts[1] || ''
      const args = parts.slice(2).join(' ')
      
      // Must contain 'opencode' in command or args, exclude grep and 'opencode run'
      const isOpencode = (command.includes('opencode') || args.includes('opencode')) &&
                         !line.includes('grep') && 
                         !args.includes('opencode run')
      
      if (!isOpencode) continue

      // Check if this is a serve or TUI instance
      const isTui = !args.includes('serve')

      // Get the listening port using lsof
      const port = await getListeningPort(pid)
      if (!port) continue

      // Get working directory
      const workDir = await getWorkingDirectory(pid)
      if (!workDir) continue

      // Get sessions from the API
      const sessions = await getSessionsFromApi(port, pid, workDir, isTui)

      instances.push({
        pid,
        port,
        workDir,
        isTui,
        sessions,
      })
    }
  } catch (error) {
    console.error('[Discovery] Error discovering instances:', error)
  }

  return instances
}

/**
 * Discover all sessions across all running OpenCode instances
 * 
 * By default, returns only the most recent (active) session per instance.
 * Each running OpenCode instance typically has one "active" session that the user
 * is currently working with.
 * 
 * @param options.onlyActive - If true, only return the most recent session per instance (default: true)
 */
export async function discoverSessions(options?: {
  onlyActive?: boolean
}): Promise<DiscoveredSession[]> {
  const { onlyActive = true } = options ?? {}
  const instances = await discoverInstances()
  const sessions: DiscoveredSession[] = []

  for (const instance of instances) {
    let instanceSessions = instance.sessions

    if (onlyActive && instanceSessions.length > 0) {
      // Sort by updatedAt descending and take the most recent (active) session
      const sorted = [...instanceSessions].sort((a, b) => {
        const aTime = a.updatedAt?.getTime() ?? 0
        const bTime = b.updatedAt?.getTime() ?? 0
        return bTime - aTime
      })
      instanceSessions = sorted.slice(0, 1)
    }

    sessions.push(...instanceSessions)
  }

  // Deduplicate sessions by ID (same session may appear on multiple instances)
  const seen = new Set<string>()
  return sessions.filter(s => {
    if (seen.has(s.id)) return false
    seen.add(s.id)
    return true
  })
}

/**
 * Check if a session is still alive (its instance is running and responsive)
 */
export async function isSessionAlive(port: number, sessionId: string): Promise<boolean> {
  try {
    const response = await fetch(`http://localhost:${port}/session`, {
      signal: AbortSignal.timeout(2000),
    })
    
    if (!response.ok) return false
    
    const sessions = await response.json() as Array<{ id: string }>
    return sessions.some(s => s.id === sessionId)
  } catch {
    return false
  }
}

/**
 * Check if a port has a running OpenCode instance
 */
export async function isPortAlive(port: number): Promise<boolean> {
  try {
    const response = await fetch(`http://localhost:${port}/global/health`, {
      signal: AbortSignal.timeout(2000),
    })
    return response.ok
  } catch {
    return false
  }
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Get the listening port for a process
 */
async function getListeningPort(pid: number): Promise<number | null> {
  try {
    const result = await rt.$.textDirect(`lsof -p ${pid} 2>/dev/null`)
    
    // Expandida lista de puertos conocidos para discovery (4096-4200)
    const knownPorts = [
      4096,  // External OpenCode
      4100, 4101, 4102, 4103, 4104, 4105, 4106, 4107, 4108, 4109, // Pool default
      4110, 4111, 4112, 4113, 4114, 4115, 4116, 4117, 4118, 4119, // Pool extended
      4120, 4121, 4122, 4123, 4124, 4125, 4126, 4127, 4128, 4129, // Pool extended
      4130, 4131, 4132, 4133, 4134, 4135, 4136, 4137, 4138, 4139,
      4140, 4141, 4142, 4143, 4144, 4145, 4146, 4147, 4148, 4149,
      4150, 4151, 4152, 4153, 4154, 4155, 4156, 4157, 4158, 4159,
      4160, 4161, 4162, 4163, 4164, 4165, 4166, 4167, 4168, 4169,
      4170, 4171, 4172, 4173, 4174, 4175, 4176, 4177, 4178, 4179,
      4180, 4181, 4182, 4183, 4184, 4185, 4186, 4187, 4188, 4189,
      4190, 4191, 4192, 4193, 4194, 4195, 4196, 4197, 4198, 4199,
      4200  // API server default
    ]
    
    // First, try to find a known OpenCode port
    for (const port of knownPorts) {
      if (result.includes(`:${port}`) && result.includes('LISTEN')) {
        return port
      }
    }
    
    // Fallback: look for any TCP LISTEN entry (rango válido para OpenCode)
    for (const line of result.split('\n')) {
      if (line.includes('TCP') && line.includes('LISTEN')) {
        const match = line.match(/(?:localhost|127\.0\.0\.1|\*):(\d+)/)
        if (match) {
          const port = parseInt(match[1], 10)
          // Aceptar puertos en rango válido de OpenCode (3000-4200)
          if (port >= 3000 && port <= 4200) {
            return port
          }
        }
      }
    }
  } catch {
    // Process may have exited
  }
  
  return null
}

/**
 * Get the working directory for a process
 */
async function getWorkingDirectory(pid: number): Promise<string | null> {
  try {
    const result = await rt.$.textDirect(`lsof -p ${pid} 2>/dev/null`)
    
    // Look for cwd entry
    for (const line of result.split('\n')) {
      if (line.includes('cwd')) {
        // The path is the last column
        const parts = line.trim().split(/\s+/)
        const path = parts[parts.length - 1]
        // Resolve /private/tmp to /tmp on macOS
        return path.replace(/^\/private/, '')
      }
    }
  } catch {
    // Process may have exited
  }
  
  return null
}

/**
 * Get sessions from an OpenCode instance's API
 */
async function getSessionsFromApi(
  port: number, 
  pid: number, 
  workDir: string,
  isTui: boolean
): Promise<DiscoveredSession[]> {
  try {
    const response = await fetch(`http://localhost:${port}/session`, {
      signal: AbortSignal.timeout(2000),
    })
    
    if (!response.ok) return []
    
    const data = await response.json() as Array<{
      id: string
      title?: string
      directory: string
      projectID?: string
      time?: {
        updated?: number
      }
    }>

    return data.map(s => ({
      id: s.id,
      title: s.title,
      directory: s.directory,
      projectId: s.projectID,
      updatedAt: s.time?.updated ? new Date(s.time.updated) : undefined,
      instance: {
        pid,
        port,
        workDir,
        isTui,
      },
    }))
  } catch {
    return []
  }
}

/**
 * Find a discovered session by name, ID, or directory
 */
export function findSession(
  sessions: DiscoveredSession[],
  query: string
): DiscoveredSession | undefined {
  const normalizedQuery = query.toLowerCase().trim()
  
  return sessions.find(s => 
    // Match by session ID (prefix match)
    s.id.toLowerCase().startsWith(normalizedQuery) ||
    // Match by title
    s.title?.toLowerCase().includes(normalizedQuery) ||
    // Match by directory name
    s.directory.toLowerCase().includes(normalizedQuery) ||
    // Match by directory basename
    s.directory.split('/').pop()?.toLowerCase() === normalizedQuery
  )
}

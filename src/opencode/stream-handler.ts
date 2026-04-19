/**
 * Stream Handler
 * 
 * Bridges OpenCode SSE events to Telegram progress messages.
 * Handles throttling, formatting, and state management for streaming responses.
 */

import type {
  SSEEvent,
  StreamingState,
  StreamHandlerConfig,
  TelegramSendCallback,
  TelegramDeleteCallback,
  Part,
  TextPart,
  ToolInvocationPart,
  Permission,
  InlineKeyboardButton,
  TokenUsage,
  MessageInfo,
} from "./types"
import { DEFAULT_STREAM_HANDLER_CONFIG } from "./types"
import { markdownToTelegramHtml, truncateForTelegram } from "./telegram-markdown"

/**
 * Pending permission request info
 */
export interface PendingPermission {
  permission: Permission
  telegramMessageId?: number
  chatId: number
  topicId: number
}

/**
 * Callback fired when a session goes idle (response complete)
 */
export type SessionIdleCallback = (
  sessionId: string,
  chatId: number,
  topicId: number
) => void | Promise<void>

/**
 * Streaming state for a session
 */
export class StreamHandler {
  private readonly config: StreamHandlerConfig
  private readonly states: Map<string, StreamingState> = new Map()
  private readonly sendCallback: TelegramSendCallback
  private readonly deleteCallback?: TelegramDeleteCallback
  private readonly debugCallback?: (text: string) => void | Promise<void>

  /** Mapping from sessionId to Telegram chat/topic info */
  private readonly sessionToTelegram: Map<string, { chatId: number; topicId: number }> = new Map()

  /** Mapping from sessionId to streaming enabled state */
  private readonly sessionStreamingEnabled: Map<string, boolean> = new Map()

  /** Pending permission requests - keyed by permissionId */
  private readonly pendingPermissions: Map<string, PendingPermission> = new Map()

  /** Track message roles: messageId -> role */
  private readonly messageRoles: Map<string, "user" | "assistant"> = new Map()

  /** Track which user messages we've already sent to Telegram (to prevent duplicates) */
  private readonly sentUserMessages: Set<string> = new Set()

  /** Track messages that originated from Telegram (so we don't echo them back) */
  private readonly messagesFromTelegram: Set<string> = new Set()

  /** Callback fired when a session goes idle */
  private onSessionIdleCallback?: SessionIdleCallback

  constructor(
    sendCallback: TelegramSendCallback,
    deleteCallback?: TelegramDeleteCallback,
    config?: Partial<StreamHandlerConfig>
  ) {
    this.sendCallback = sendCallback
    this.deleteCallback = deleteCallback
    this.debugCallback = config?.debugCallback
    this.config = { ...DEFAULT_STREAM_HANDLER_CONFIG, ...config }
  }

  /**
   * Set callback for when a session goes idle (response complete)
   * Useful for updating topic names after first message
   */
  setOnSessionIdle(callback: SessionIdleCallback): void {
    this.onSessionIdleCallback = callback
  }

  // ===========================================================================
  // Session Registration
  // ===========================================================================

  /**
   * Register a session with its Telegram destination
   */
  registerSession(sessionId: string, chatId: number, topicId: number, streamingEnabled = false): void {
    this.sessionToTelegram.set(sessionId, { chatId, topicId })
    this.sessionStreamingEnabled.set(sessionId, streamingEnabled)
  }

  /**
   * Unregister a session - clean up all associated state
   */
  unregisterSession(sessionId: string): void {
    this.sessionToTelegram.delete(sessionId)
    this.sessionStreamingEnabled.delete(sessionId)
    this.states.delete(sessionId)
    this.pendingPermissions.delete(sessionId)
    this.messageRoles.delete(sessionId)
    this.sentUserMessages.delete(sessionId)
    this.messagesFromTelegram.delete(sessionId)
  }

  /**
   * Update streaming preference for a session
   */
  setStreamingEnabled(sessionId: string, enabled: boolean): void {
    this.sessionStreamingEnabled.set(sessionId, enabled)
  }

  /**
   * Check if streaming is enabled for a session
   */
  isStreamingEnabled(sessionId: string): boolean {
    return this.sessionStreamingEnabled.get(sessionId) ?? false
  }

  /**
   * Get Telegram destination for a session
   */
  getTelegramDestination(sessionId: string): { chatId: number; topicId: number } | undefined {
    return this.sessionToTelegram.get(sessionId)
  }

  /**
   * Mark a message text as originating from Telegram (so we don't echo it back)
   * Call this when sending a message from Telegram to OpenCode
   */
  markMessageFromTelegram(sessionId: string, messageText: string): void {
    // Use a composite key of sessionId + normalized text to identify the message
    const key = `${sessionId}:${messageText.trim()}`
    this.messagesFromTelegram.add(key)
    
    // Clean up old entries to prevent memory leak (keep last 100)
    if (this.messagesFromTelegram.size > 100) {
      const entries = Array.from(this.messagesFromTelegram)
      this.messagesFromTelegram.clear()
      for (const entry of entries.slice(-50)) {
        this.messagesFromTelegram.add(entry)
      }
    }
  }

  /**
   * Check if a message originated from Telegram
   */
  private isMessageFromTelegram(sessionId: string, messageText: string): boolean {
    const key = `${sessionId}:${messageText.trim()}`
    if (this.messagesFromTelegram.has(key)) {
      // Remove it after checking (one-time use)
      this.messagesFromTelegram.delete(key)
      return true
    }
    return false
  }

  // ===========================================================================
  // Event Handling
  // ===========================================================================

  /**
   * Handle an SSE event from OpenCode
   */
  async handleEvent(event: SSEEvent): Promise<void> {
    // Extract sessionID from various possible locations in the event
    const props = event.properties as Record<string, any>
    const sessionId = 
      props.sessionID ||                    // session.idle, session.status, session.diff
      props.info?.sessionID ||              // message.updated
      props.part?.sessionID ||              // message.part.updated
      (event.type === 'session.updated' ? props.info?.id : null) ||  // session.updated has id not sessionID
      null
    
    if (!sessionId) {
      // Only log for events that should have sessionID (skip heartbeat, server.connected)
      if (!['server.heartbeat', 'server.connected'].includes(event.type)) {
        console.log(`[StreamHandler] Event ${event.type} has no sessionID`)
      }
      return
    }

    const destination = this.sessionToTelegram.get(sessionId)
    if (!destination) {
      console.log(`[StreamHandler] Session ${sessionId} not registered, registered sessions:`, Array.from(this.sessionToTelegram.keys()))
      return // Session not registered with us
    }

    switch (event.type) {
      case "message.part.updated":
        await this.handlePartUpdated(sessionId, event, destination)
        break

      case "message.updated":
        await this.handleMessageUpdated(sessionId, event, destination)
        break

      case "tool.execute":
        await this.handleToolExecute(sessionId, event, destination)
        break

      case "tool.result":
        await this.handleToolResult(sessionId, event, destination)
        break

      case "session.idle":
        await this.handleSessionIdle(sessionId, destination)
        break

      case "session.error":
        await this.handleSessionError(sessionId, event, destination)
        break

      case "session.updated":
        await this.handleSessionUpdated(sessionId, event, destination)
        break

      case "permission.updated":
      case "permission.asked":
        await this.handlePermissionUpdated(event, destination)
        break

      case "permission.replied":
        await this.handlePermissionReplied(event)
        break
    }
  }

  /**
   * Handle message part updates (streaming text)
   */
  private async handlePartUpdated(
    sessionId: string,
    event: SSEEvent,
    destination: { chatId: number; topicId: number }
  ): Promise<void> {
    const props = event.properties as Record<string, any>
    const part = props.part as Record<string, any>
    const messageId = part.messageID || props.messageID

    // Check if this is a user message
    const messageRole = messageId ? this.messageRoles.get(messageId) : undefined
    if (messageRole === "user") {
      // For user messages, send as a separate "echo" message (once per message)
      if (part.type === "text" && part.text && messageId && !this.sentUserMessages.has(messageId)) {
        this.sentUserMessages.add(messageId)
        const userText = part.text.trim()
        if (userText) {
          // Check if this message originated from Telegram - if so, don't echo it
          if (this.isMessageFromTelegram(sessionId, userText)) {
            // Message came from Telegram, no need to echo
            return
          }
          
          try {
            // Send user message with a prefix to distinguish it (from TUI)
            await this.sendCallback(
              destination.chatId,
              destination.topicId,
              `<b>📝 From TUI:</b>\n${this.escapeHtml(userText)}`,
              { parseMode: "HTML" }
            )
          } catch (error) {
            console.error(`[StreamHandler] Failed to echo user message:`, error)
          }
        }
      }
      return // Don't process user messages as streaming state
    }

    let state = this.states.get(sessionId)
    if (!state) {
      state = this.createState(sessionId)
      this.states.set(sessionId, state)
    }

    state.messageId = messageId
    state.isProcessing = true

    // Handle text parts (type: "text")
    if (part.type === "text" && part.text) {
      state.currentText = part.text
    }
    
    // Handle reasoning/thinking parts
    if (part.type === "reasoning" && (part as any).reasoning) {
      const reasoningText = (part as any).reasoning as string
      state.reasoning = reasoningText
      // Debug: show thinking preview
      const thinkingPreview = reasoningText.slice(-150).replace(/\n/g, ' ')
      this.debugCallback?.(`🧠 <b>Thinking:</b> ${thinkingPreview}...`)
    }

    // Handle tool parts (type: "tool") - OpenCode uses "tool" not "tool-invocation"
    if (part.type === "tool" && part.callID && part.tool) {
      const existingTool = state.toolsInvoked.find(t => t.callId === part.callID)
      if (!existingTool) {
        state.toolsInvoked.push({
          name: part.tool,
          callId: part.callID,
          startedAt: new Date(),
          args: (part as any).args,  // Guardar args para contexto
        })
      }
      // Check if tool has result (state field or result field)
      if (part.state === "result" || part.result !== undefined) {
        const tool = state.toolsInvoked.find(t => t.callId === part.callID)
        if (tool && !tool.completedAt) {
          tool.completedAt = new Date()
        }
      }
    }

    // Handle step-finish (marks end of a tool execution step)
    if (part.type === "step-finish") {
      // Mark all running tools as completed
      for (const tool of state.toolsInvoked) {
        if (!tool.completedAt) {
          tool.completedAt = new Date()
        }
      }
    }

    // Handle legacy tool-invocation format (in case it's still used)
    if (part.type === "tool-invocation" && part.toolInvocation) {
      const { toolInvocation } = part
      if (toolInvocation.state === "call") {
        const existingTool = state.toolsInvoked.find(
          (t) => t.callId === toolInvocation.toolCallId
        )
        if (!existingTool) {
          state.toolsInvoked.push({
            name: toolInvocation.toolName,
            callId: toolInvocation.toolCallId,
            startedAt: new Date(),
          })
        }
      } else if (toolInvocation.state === "result") {
        const tool = state.toolsInvoked.find(
          (t) => t.callId === toolInvocation.toolCallId
        )
        if (tool) {
          tool.completedAt = new Date()
        }
      }
    }

    // Throttled update to Telegram
    await this.maybeUpdateTelegram(sessionId, state, destination)
  }

  /**
   * Handle message updates (contains token info)
   */
  private async handleMessageUpdated(
    sessionId: string,
    event: SSEEvent,
    destination: { chatId: number; topicId: number }
  ): Promise<void> {
    const props = event.properties as Record<string, any>
    const info = props.info as MessageInfo | undefined

    if (!info) return

    // Track message role so we can filter user messages in handlePartUpdated
    if (info.id && info.role) {
      this.messageRoles.set(info.id, info.role)
    }

    // Skip user messages - we only want to show assistant responses
    if (info.role === "user") {
      return
    }

    let state = this.states.get(sessionId)
    if (!state) {
      state = this.createState(sessionId)
      this.states.set(sessionId, state)
    }

    // Update token info
    if (info.tokens) {
      state.tokens = info.tokens
    }

    // Update model info
    if (info.model) {
      state.model = info.model
    }

    // Throttled update to Telegram
    await this.maybeUpdateTelegram(sessionId, state, destination)
  }

  /**
   * Handle tool execution start
   */
  private async handleToolExecute(
    sessionId: string,
    event: SSEEvent,
    destination: { chatId: number; topicId: number }
  ): Promise<void> {
    const props = event.properties as {
      sessionID: string
      tool: string
      callID: string
      args: Record<string, unknown>
    }

    let state = this.states.get(sessionId)
    if (!state) {
      state = this.createState(sessionId)
      this.states.set(sessionId, state)
    }

    state.isProcessing = true

    // Add tool to list if not already there
    const existingTool = state.toolsInvoked.find((t) => t.callId === props.callID)
    if (!existingTool) {
      state.toolsInvoked.push({
        name: props.tool,
        callId: props.callID,
        startedAt: new Date(),
        args: props.args,  // Guardar args para mostrar contexto
      })
      
      // Debug: notify tool execution
      const toolInfo = props.args?.path || props.args?.command || props.args?.query || props.args?.[0] || ""
      this.debugCallback?.(`🔧 <b>Tool:</b> ${props.tool} ${toolInfo}`)
    }

    // Force update to show tool is running — only if progress is enabled
    if (this.config.sendProgressToMainTopic !== false) {
      await this.updateTelegram(sessionId, state, destination, true)
    }
  }

  /**
   * Handle tool result
   */
  private async handleToolResult(
    sessionId: string,
    event: SSEEvent,
    destination: { chatId: number; topicId: number }
  ): Promise<void> {
    const props = event.properties as {
      sessionID: string
      tool: string
      callID: string
      title?: string
      metadata?: Record<string, unknown>
    }

    const state = this.states.get(sessionId)
    if (!state) return

    // Mark tool as completed
    const tool = state.toolsInvoked.find((t) => t.callId === props.callID)
    if (tool) {
      tool.completedAt = new Date()
      tool.title = props.title
      
      // Debug: tool completed
      const resultInfo = props.title ? ` - ${props.title.slice(0, 50)}` : ''
      this.debugCallback?.(`✅ <b>Tool done:</b> ${props.tool}${resultInfo}`)
    }

    // Update Telegram to show tool completed
    await this.maybeUpdateTelegram(sessionId, state, destination)
  }

  /**
   * Handle session becoming idle (response complete)
   */
  private async handleSessionIdle(
    sessionId: string,
    destination: { chatId: number; topicId: number }
  ): Promise<void> {
    const state = this.states.get(sessionId)
    if (!state) return

    state.isProcessing = false

    // Send final response - edit the progress message if we have one
    if (state.currentText.trim()) {
      // Convert Markdown to Telegram HTML for proper rendering
      const htmlContent = markdownToTelegramHtml(state.currentText.trim())
      
      // Build final content with summary - Bug #3: calcular espacio antes
      // Dejar ~300 chars para el resumen
      const MAX_CONTENT_LENGTH = 3700
      let finalContent = truncateForTelegram(htmlContent, MAX_CONTENT_LENGTH)
      
      // Agregar resumen de la sesión al final
      const elapsed = Math.round((Date.now() - state.startedAt.getTime()) / 1000)
      const completedTools = state.toolsInvoked.filter((t) => t.completedAt)
      const summaryParts: string[] = []
      
      if (elapsed > 0) {
        const mins = Math.floor(elapsed / 60)
        const secs = elapsed % 60
        summaryParts.push(`⏱️ ${mins > 0 ? `${mins}m ` : ""}${secs}s`)
      }
      
      if (state.tokens) {
        const totalTokens = state.tokens.input + state.tokens.output
        summaryParts.push(`📊 ${this.formatTokenCount(totalTokens)}`)
      }
      
      if (completedTools.length > 0) {
        const toolNames = completedTools.map((t) => t.title || t.name).slice(-5).join(", ")
        const moreTools = completedTools.length > 5 ? ` (+${completedTools.length - 5} más)` : ""
        summaryParts.push(`🔧 ${toolNames}${moreTools}`)
      }
      
      if (summaryParts.length > 0) {
        finalContent += "\n\n" + "─".repeat(20) + "\n" + summaryParts.join(" • ")
      }
      
      // No hacer segundo truncate - el primero ya dejó espacio para el resumen
      
      try {
        if (state.telegramMessageId) {
          // Edit the progress message to show final response
          await this.sendCallback(
            destination.chatId,
            destination.topicId,
            finalContent,
            { 
              parseMode: "HTML",
              editMessageId: state.telegramMessageId,
            }
          )
        } else {
          // No progress message, send new one
          await this.sendCallback(
            destination.chatId,
            destination.topicId,
            finalContent,
            { parseMode: "HTML" }
          )
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error)
        
        // Ignore "message is not modified" - content is already correct
        if (errorMsg.includes('message is not modified')) {
          // Already showing the right content, nothing to do
        } else if (state.telegramMessageId && errorMsg.includes('message to edit not found')) {
          // Original message was deleted, send as new message
          console.log(`[StreamHandler] Original message deleted, sending final as new message`)
          try {
            await this.sendCallback(
              destination.chatId,
              destination.topicId,
              finalContent,
              { parseMode: "HTML" }
            )
          } catch {
            // Give up
          }
        } else if (errorMsg.includes("can't parse entities")) {
          // HTML parsing failed, try sending as plain text
          console.log(`[StreamHandler] HTML parsing failed, falling back to plain text`)
          try {
            await this.sendCallback(
              destination.chatId,
              destination.topicId,
              state.currentText.trim(),
              { editMessageId: state.telegramMessageId }
            )
          } catch {
            // Give up
          }
        } else if (errorMsg.includes('429') || errorMsg.includes('Too Many Requests') || errorMsg.includes('Rate limited')) {
          // Rate limited - wait 5 seconds before retry instead of skipping
          console.log(`[StreamHandler] Rate limited, waiting 5s before retry...`)
          await new Promise(r => setTimeout(r, 5000))
          
          // Retry without returning - now this code will actually execute
          try {
            if (state.telegramMessageId) {
              await this.sendCallback(
                destination.chatId,
                destination.topicId,
                finalContent,
                { 
                  parseMode: "HTML",
                  editMessageId: state.telegramMessageId,
                }
              )
              console.log(`[StreamHandler] Final response sent after rate limit wait`)
            } else {
              await this.sendCallback(
                destination.chatId,
                destination.topicId,
                finalContent,
                { parseMode: "HTML" }
              )
              console.log(`[StreamHandler] Final response sent as new message after rate limit wait`)
            }
          } catch (retryError) {
            // If retry also fails, try sending as a new message
            console.log(`[StreamHandler] Retry failed, sending final response as new message`)
            try {
              await this.sendCallback(
                destination.chatId,
                destination.topicId,
                finalContent,
                { parseMode: "HTML" }
              )
            } catch {
              console.error(`[StreamHandler] Failed to send final response even after retry`)
            }
          }
        } else {
          // For other errors, just log - the progress message already has content
          console.log(`[StreamHandler] Final edit failed (${errorMsg.slice(0, 80)}), keeping progress message`)
        }
      }
    } else if (state.telegramMessageId && this.deleteCallback) {
      // No text response - send informative message before deleting (Bug #9)
      const completedTools = state.toolsInvoked.filter((t) => t.completedAt)
      const elapsed = Math.round((Date.now() - state.startedAt.getTime()) / 1000)
      const msgId = state.telegramMessageId
      
      let infoMessage = "⚠️ Sesión completada sin respuesta de texto."
      
      // Agregar info de tools si hubo
      if (completedTools.length > 0) {
        const toolNames = completedTools.map((t) => t.title || t.name).join(", ")
        infoMessage += `\n🔧 Tools ejecutadas: ${toolNames}`
      }
      
      if (elapsed > 0) {
        infoMessage += `\n⏱️ Tiempo: ${elapsed}s`
      }
      
      if (this.config.deleteProgressOnComplete) {
        // Edit the progress message with info, then delete after delay
        try {
          await this.sendCallback(
            destination.chatId,
            destination.topicId,
            infoMessage,
            { editMessageId: msgId }
          )
          
          // Wait 3 seconds then delete
          setTimeout(async () => {
            try {
              await this.deleteCallback!(destination.chatId, msgId)
            } catch { /* ignore */ }
          }, 3000)
        } catch {
          // If edit fails, try direct delete
          try {
            await this.deleteCallback!(destination.chatId, msgId)
          } catch { /* ignore */ }
        }
      }
    }

    // Clean up state
    this.states.delete(sessionId)
    
    // Clean up message roles and sent user messages (keep maps from growing indefinitely)
    // We can't easily filter by session, so just clear old entries periodically
    if (this.messageRoles.size > 100) {
      // Keep only the most recent 50 entries
      const entries = Array.from(this.messageRoles.entries())
      this.messageRoles.clear()
      for (const [key, value] of entries.slice(-50)) {
        this.messageRoles.set(key, value)
      }
    }
    if (this.sentUserMessages.size > 100) {
      // Keep only the most recent 50 entries
      const entries = Array.from(this.sentUserMessages)
      this.sentUserMessages.clear()
      for (const key of entries.slice(-50)) {
        this.sentUserMessages.add(key)
      }
    }

    // Fire the session idle callback (for topic name updates, etc.)
    if (this.onSessionIdleCallback) {
      try {
        await this.onSessionIdleCallback(sessionId, destination.chatId, destination.topicId)
      } catch (error) {
        console.error(`[StreamHandler] onSessionIdle callback error:`, error)
      }
    }
  }

  /**
   * Handle session error
   */
  private async handleSessionError(
    sessionId: string,
    event: SSEEvent,
    destination: { chatId: number; topicId: number }
  ): Promise<void> {
    const props = event.properties as {
      sessionID: string
      error: string
    }

    const state = this.states.get(sessionId)
    if (state) {
      state.isProcessing = false
      state.error = props.error
    }

    // Delete progress message
    if (
      state?.telegramMessageId &&
      this.deleteCallback
    ) {
      try {
        await this.deleteCallback(destination.chatId, state.telegramMessageId)
      } catch {
        // Ignore delete errors
      }
    }

    // Send error message
    await this.sendCallback(
      destination.chatId,
      destination.topicId,
      `Error: ${props.error}`,
      { parseMode: "HTML" }
    )

    // Clean up state
    this.states.delete(sessionId)
  }

  /**
   * Handle session status update
   */
  private async handleSessionUpdated(
    sessionId: string,
    event: SSEEvent,
    destination: { chatId: number; topicId: number }
  ): Promise<void> {
    const props = event.properties as {
      sessionID: string
      status: "idle" | "running" | "error"
    }

    if (props.status === "running") {
      // Session started processing
      let state = this.states.get(sessionId)
      if (!state) {
        state = this.createState(sessionId)
        this.states.set(sessionId, state)
      }
      state.isProcessing = true
    }
  }

  /**
   * Handle permission request from OpenCode
   */
  private async handlePermissionUpdated(
    event: SSEEvent,
    destination: { chatId: number; topicId: number }
  ): Promise<void> {
    // Handle both permission.updated (in properties) and permission.asked (direct)
    let permission: Permission
    const evt = event as any
    
    console.log(`[StreamHandler] Full event keys:`, Object.keys(evt))
    console.log(`[StreamHandler] Raw event:`, JSON.stringify(evt).slice(0, 300))
    
    // Look for ID in various possible locations
    const possibleId = evt.id || evt.permissionID || evt.properties?.id || evt.properties?.permissionID || ""
    
    if (event.properties && (event.properties as any).type) {
      permission = event.properties as Permission
    } else {
      // permission.asked has direct properties
      const metadata = evt.metadata || {}
      permission = {
        id: possibleId || `perm_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        type: evt.permission || "external_directory",
        pattern: evt.patterns || evt.pattern,  // Bug fix: type uses 'pattern' not 'patterns'
        sessionID: evt.sessionID || "",
        messageID: evt.messageID || "",
        callID: evt.callID,
        title: metadata.filepath || metadata.command || evt.permission || "Permission Request",
        metadata: metadata,
        time: { created: Date.now() }
      }
    }

    // Debug: verify permission.id is set
    console.log(`[StreamHandler] Permission ID: "${permission.id}", type: "${permission.type}", title: "${permission.title}"`)

    console.log(`[StreamHandler] Permission request: ${permission.type} - ${permission.title}`)

    // Format permission message
    const messageText = this.formatPermissionMessage(permission)

    // Create inline keyboard with approve/deny buttons
    const keyboard: InlineKeyboardButton[][] = [
      [
        { text: "✅ Allow Once", callback_data: `perm:once:${permission.id}` },
        { text: "✅ Always Allow", callback_data: `perm:always:${permission.id}` },
      ],
      [
        { text: "❌ Deny", callback_data: `perm:reject:${permission.id}` },
      ],
    ]

    try {
      const result = await this.sendCallback(
        destination.chatId,
        destination.topicId,
        messageText,
        {
          parseMode: "HTML",
          inlineKeyboard: keyboard,
        }
      )

      // Store pending permission for later resolution
      this.pendingPermissions.set(permission.id, {
        permission,
        telegramMessageId: result.messageId,
        chatId: destination.chatId,
        topicId: destination.topicId,
      })
    } catch (error) {
      console.error(`[StreamHandler] Failed to send permission prompt:`, error)
    }
  }

  /**
   * Handle permission reply confirmation
   */
  private async handlePermissionReplied(event: SSEEvent): Promise<void> {
    const props = event.properties as {
      sessionID: string
      permissionID: string
      response: string
    }

    console.log(`[StreamHandler] Permission ${props.permissionID} replied: ${props.response}`)

    // Clean up pending permission
    const pending = this.pendingPermissions.get(props.permissionID)
    if (pending) {
      // Optionally update or delete the permission message
      if (pending.telegramMessageId && this.deleteCallback) {
        try {
          // Edit the message to show it was handled
          const responseText = props.response === "reject" ? "Denied" : "Approved"
          await this.sendCallback(
            pending.chatId,
            pending.topicId,
            `<i>Permission ${responseText}</i>`,
            {
              parseMode: "HTML",
              editMessageId: pending.telegramMessageId,
            }
          )
        } catch {
          // Ignore edit errors
        }
      }
      this.pendingPermissions.delete(props.permissionID)
    }
  }

  /**
   * Format a permission request message for Telegram
   */
  private formatPermissionMessage(permission: Permission): string {
    const parts: string[] = []

    parts.push(`<b>🔐 Permission Required</b>`)
    parts.push("")
    parts.push(`<b>Type:</b> <code>${this.escapeHtml(permission.type ?? "")}</code>`)
    parts.push(`<b>Action:</b> <code>${this.escapeHtml(permission.title ?? "")}</code>`)

    // Show pattern if available (e.g., for bash commands)
    if (permission.pattern) {
      const pattern = Array.isArray(permission.pattern) 
        ? permission.pattern.join(", ") 
        : permission.pattern
      parts.push(`<b>Pattern:</b> <code>${this.escapeHtml(pattern)}</code>`)
    }

    // Show relevant metadata
    if (permission.metadata) {
      const { command, args, path } = permission.metadata as {
        command?: string
        args?: Record<string, unknown>
        path?: string
      }

      if (command) {
        parts.push("")
        parts.push(`<pre>${this.escapeHtml(String(command))}</pre>`)
      }

      if (path) {
        parts.push(`<b>Path:</b> <code>${this.escapeHtml(String(path))}</code>`)
      }
    }

    return parts.join("\n")
  }

  /**
   * Get a pending permission by ID
   */
  getPendingPermission(permissionId: string): PendingPermission | undefined {
    return this.pendingPermissions.get(permissionId)
  }

  /**
   * Remove a pending permission (after it's been handled)
   */
  removePendingPermission(permissionId: string): void {
    this.pendingPermissions.delete(permissionId)
  }

  /**
   * Get all pending permissions
   */
  getAllPendingPermissions(): Map<string, PendingPermission> {
    return this.pendingPermissions
  }

  // ===========================================================================
  // Telegram Updates
  // ===========================================================================

  /**
   * Update Telegram if enough time has passed since last update
   */
  private async maybeUpdateTelegram(
    sessionId: string,
    state: StreamingState,
    destination: { chatId: number; topicId: number }
  ): Promise<void> {
    // Si sendProgressToMainTopic es false, NO enviar updates de progreso al topic principal
    // Solo el session.idle enviara la respuesta final
    if (this.config.sendProgressToMainTopic === false) {
      return
    }
    
    const now = Date.now()
    const lastUpdate = state.lastTelegramUpdateAt?.getTime() ?? 0
    
    // Use longer interval for streaming mode to avoid rate limits
    // Telegram is strict about message edits - max ~20/minute
    const streamingEnabled = this.isStreamingEnabled(sessionId)
    const updateInterval = streamingEnabled ? 3000 : this.config.updateIntervalMs  // 3s for streaming
    
    if (now - lastUpdate >= updateInterval) {
      await this.updateTelegram(sessionId, state, destination, false)
    }
  }

  /**
   * Send/update progress message in Telegram
   */
  private async updateTelegram(
    sessionId: string,
    state: StreamingState,
    destination: { chatId: number; topicId: number },
    force: boolean
  ): Promise<void> {
    // Skip if we're already waiting for a message to be sent
    if (state.pendingSend) {
      return
    }
    
    const progressText = this.formatProgressMessage(state, sessionId)
    
    try {
      if (state.telegramMessageId) {
        // Edit existing message
        await this.sendCallback(
          destination.chatId,
          destination.topicId,
          progressText,
          {
            parseMode: "HTML",
            editMessageId: state.telegramMessageId,
          }
        )
      } else {
        // Mark that we're sending to prevent duplicate sends
        state.pendingSend = true
        try {
          // Send new message
          const result = await this.sendCallback(
            destination.chatId,
            destination.topicId,
            progressText,
            { parseMode: "HTML" }
          )
          state.telegramMessageId = result.messageId
        } finally {
          state.pendingSend = false
        }
      }
      
      state.lastTelegramUpdateAt = new Date()
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      
      // Ignore "message is not modified" errors - this just means content is the same
      if (errorMsg.includes('message is not modified')) {
        state.lastTelegramUpdateAt = new Date()
        return
      }
      
      // For rate limit errors, just skip this update - don't send new message
      if (errorMsg.includes('429') || errorMsg.includes('Too Many Requests')) {
        console.log(`[StreamHandler] Rate limited, skipping update`)
        // Update the timestamp to prevent immediate retry
        state.lastTelegramUpdateAt = new Date()
        return
      }
      
      // Only send new message if the original was deleted (not for other errors)
      // Check for "message to edit not found" or similar
      if (state.telegramMessageId && errorMsg.includes('message to edit not found')) {
        console.log(`[StreamHandler] Original message deleted, sending new one`)
        state.telegramMessageId = undefined // Clear the old ID
        try {
          const result = await this.sendCallback(
            destination.chatId,
            destination.topicId,
            progressText,
            { parseMode: "HTML" }
          )
          state.telegramMessageId = result.messageId
          state.lastTelegramUpdateAt = new Date()
        } catch {
          // Give up on this update
        }
      } else {
        // For other errors, just log and skip
        console.log(`[StreamHandler] Edit failed (${errorMsg.slice(0, 80)}), skipping`)
      }
    }
  }

  /**
   * Format a progress message for Telegram
   */
  private formatProgressMessage(state: StreamingState, sessionId: string): string {
    const streamingEnabled = this.isStreamingEnabled(sessionId)
    const parts: string[] = []

    // Current tool status
    const runningTools = state.toolsInvoked.filter((t) => !t.completedAt)

    // In streaming mode, show status on one line at top
    if (streamingEnabled) {
      const statusParts: string[] = []
      if (runningTools.length > 0 && this.config.showToolNames) {
        const toolName = runningTools[runningTools.length - 1].name
        statusParts.push(`🔧 ${toolName}`)
      } else if (state.isProcessing && !state.currentText.trim()) {
        statusParts.push("💭 Thinking...")
      }
      
      const elapsed = Math.round((Date.now() - state.startedAt.getTime()) / 1000)
      if (elapsed > 0) {
        statusParts.push(`${elapsed}s`)
      }
      
      if (statusParts.length > 0) {
        parts.push(`<i>${statusParts.join(" | ")}</i>`)
        parts.push("")
      }

      // In streaming mode, show full text converted to HTML (truncated to Telegram limit)
      if (state.currentText.trim()) {
        let text = state.currentText.trim()
        // Telegram message limit is ~4096 chars, leave room for status
        const maxLength = 3600
        if (text.length > maxLength) {
          text = text.slice(-maxLength) // Show the END (most recent) text
          text = "..." + text
        }
        // Convert markdown to HTML for proper rendering during streaming
        const htmlText = markdownToTelegramHtml(text)
        parts.push(truncateForTelegram(htmlText, 3800))
      }
    } else {
      // Non-streaming mode: show detailed status with tokens, tools, and text
      
      // === Header: Status + Time + Tokens ===
      const elapsed = Math.round((Date.now() - state.startedAt.getTime()) / 1000)
      const headerParts: string[] = []
      
      // Status indicator
      const toolCount = state.toolsInvoked.length
      const runningCount = runningTools.length
      if (runningCount > 0) {
        headerParts.push(`🔧 ${runningCount}/${toolCount}`)
      } else if (state.isProcessing) {
        headerParts.push("💭 Thinking")
      } else {
        headerParts.push("✅ Done")
      }
      
      // Elapsed time
      if (elapsed > 0) {
        const mins = Math.floor(elapsed / 60)
        const secs = elapsed % 60
        headerParts.push(mins > 0 ? `${mins}m ${secs}s` : `${secs}s`)
      }
      
      // Token count
      if (state.tokens) {
        const totalTokens = state.tokens.input + state.tokens.output
        const tokenStr = this.formatTokenCount(totalTokens)
        headerParts.push(`📊 ${tokenStr}`)
      }
      
      // Model info (if available)
      if (state.model?.modelID) {
        const shortModel = state.model.modelID.length > 20 
          ? state.model.modelID.slice(0, 20) + "..."
          : state.model.modelID
        headerParts.push(`🤖 ${shortModel}`)
      }
      
      parts.push(`<b>${headerParts.join(" • ")}</b>`)
      
      // === Reasoning/Thinking (si el modelo está pensando) ===
      if (state.reasoning && state.reasoning.trim()) {
        parts.push("")
        parts.push("<i>🧠 Pensando:</i>")
        // Show last 200 chars of reasoning (most recent)
        const reasoningPreview = state.reasoning.trim().slice(-300)
        parts.push(`<pre>${this.escapeHtml(reasoningPreview)}</pre>`)
      }
      
      // === Tools Section (limitadas a 10 + más) - Bug #8 ===
      const totalTools = state.toolsInvoked.length
      const toolsToShow = state.toolsInvoked.slice(-10) // Últimas 10
      const moreTools = totalTools > 10 ? totalTools - 10 : 0
      
      if (toolsToShow.length > 0) {
        parts.push("")
        parts.push("<b>Tools:</b>")
        
        // Show limited tools with status + args
        for (const tool of toolsToShow) {
          const icon = tool.completedAt ? "✅" : "⏳"
          
          // Build display name with args for context
          let displayName = this.escapeHtml(tool.name)
          
          // Try to extract useful args (path, query, etc.)
          const args = tool.args
          if (args) {
            // For read tool: show path
            if (args.path && typeof args.path === 'string') {
              const shortPath = args.path.split('/').slice(-2).join('/')
              displayName = `${tool.name} ${shortPath}`
            } 
            // For glob/grep: show query
            else if (args.pattern || args.query) {
              const query = (args.pattern || args.query) as string
              displayName = `${tool.name} "${query.slice(0, 30)}"`
            }
            // For bash: show command preview
            else if (args.command && typeof args.command === 'string') {
              const cmdPreview = args.command.split(' ').slice(0, 3).join(' ')
              displayName = `${tool.name} ${cmdPreview}`
            }
          }
          
          // Show title if available (completed tools often have a title)
          if (tool.title) {
            const title = this.escapeHtml(tool.title.slice(0, 50))
            parts.push(`${icon} <code>${displayName}</code> - ${title}`)
          } else {
            parts.push(`${icon} <code>${displayName}</code>`)
          }
        }
        
        if (moreTools > 0) {
          parts.push(`... y ${moreTools} más`)
        }
      }
      
      // === Response Text (most recent, truncated) ===
      if (state.currentText.trim()) {
        parts.push("")
        parts.push("<b>Response:</b>")
        
        let text = state.currentText.trim()
        
        // Calculate available space for text
        // Telegram limit is 4096, leave room for header/tools section
        const headerLength = parts.join("\n").length
        const maxTextLength = Math.max(500, 3800 - headerLength)
        
        if (text.length > maxTextLength) {
          // Show the END (most recent) text with ellipsis at start
          text = "..." + text.slice(-maxTextLength)
        }
        
        // Convert markdown to HTML for proper rendering
        const htmlText = markdownToTelegramHtml(text)
        parts.push(truncateForTelegram(htmlText, maxTextLength))
      }
    }

    return parts.join("\n") || "<i>Processing...</i>"
  }

  /**
   * Escape HTML special characters
   */
  private escapeHtml(text: string | undefined): string {
    if (!text) return ""
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
  }

  /**
   * Format token count for display (e.g., 1.2k, 15.3k)
   */
  private formatTokenCount(tokens: number): string {
    if (tokens < 1000) {
      return `${tokens} tokens`
    } else if (tokens < 10000) {
      return `${(tokens / 1000).toFixed(1)}k tokens`
    } else {
      return `${Math.round(tokens / 1000)}k tokens`
    }
  }

  // ===========================================================================
  // State Management
  // ===========================================================================

  /**
   * Create initial streaming state for a session
   */
  private createState(sessionId: string): StreamingState {
    return {
      sessionId,
      currentText: "",
      reasoning: "",
      toolsInvoked: [],
      startedAt: new Date(),
      isProcessing: false,
    }
  }

  /**
   * Get current state for a session
   */
  getState(sessionId: string): StreamingState | undefined {
    return this.states.get(sessionId)
  }

  /**
   * Check if a session is currently processing
   */
  isProcessing(sessionId: string): boolean {
    return this.states.get(sessionId)?.isProcessing ?? false
  }

  /**
   * Get all active sessions
   */
  getActiveSessions(): string[] {
    return Array.from(this.states.keys())
  }

  /**
   * Clear all state (for shutdown)
   */
  clear(): void {
    this.states.clear()
    this.sessionToTelegram.clear()
    this.sessionStreamingEnabled.clear()
    this.pendingPermissions.clear()
    this.messageRoles.clear()
    this.sentUserMessages.clear()
    this.messagesFromTelegram.clear()
  }
}

/**
 * Create a stream handler with the given callbacks
 */
export function createStreamHandler(
  sendCallback: TelegramSendCallback,
  deleteCallback?: TelegramDeleteCallback,
  config?: Partial<StreamHandlerConfig>
): StreamHandler {
  return new StreamHandler(sendCallback, deleteCallback, config)
}

import z from "zod"
import { Tool } from "./tool"
import path from "path"
import { LSP } from "../lsp"
import DESCRIPTION from "./symbols.txt"
import { Instance } from "../project/instance"
import { pathToFileURL, fileURLToPath } from "url"
import { assertExternalDirectory } from "./external-directory"
import { Filesystem } from "../util/filesystem"

const SymbolKind: Record<number, string> = {
  1: "File",
  2: "Module",
  3: "Namespace",
  4: "Package",
  5: "Class",
  6: "Method",
  7: "Property",
  8: "Field",
  9: "Constructor",
  10: "Enum",
  11: "Interface",
  12: "Function",
  13: "Variable",
  14: "Constant",
  15: "String",
  16: "Number",
  17: "Boolean",
  18: "Array",
  19: "Object",
  20: "Key",
  21: "Null",
  22: "EnumMember",
  23: "Struct",
  24: "Event",
  25: "Operator",
  26: "TypeParameter",
}

function kindName(kind: number): string {
  return SymbolKind[kind] ?? "Unknown"
}

function kindIcon(kind: number): string {
  switch (kind) {
    case 5:
      return "◆" // Class
    case 6:
      return "▸" // Method
    case 7:
      return "•" // Property
    case 8:
      return "•" // Field
    case 9:
      return "▸" // Constructor
    case 10:
      return "◇" // Enum
    case 11:
      return "◈" // Interface
    case 12:
      return "ƒ" // Function
    case 13:
      return "v" // Variable
    case 14:
      return "c" // Constant
    case 22:
      return "·" // EnumMember
    case 23:
      return "◆" // Struct
    default:
      return "·"
  }
}

type DocSymbol = {
  name: string
  detail?: string
  kind: number
  range: { start: { line: number; character: number }; end: { line: number; character: number } }
  selectionRange: { start: { line: number; character: number }; end: { line: number; character: number } }
  children?: DocSymbol[]
}

function formatDocSymbol(sym: DocSymbol, indent = 0): string {
  const pad = "  ".repeat(indent)
  const line = sym.selectionRange.start.line + 1
  const icon = kindIcon(sym.kind)
  const detail = sym.detail ? ` ${sym.detail}` : ""
  let result = `${pad}${icon} ${sym.name}${detail} :${line}\n`
  if (sym.children) {
    for (const child of sym.children) {
      result += formatDocSymbol(child, indent + 1)
    }
  }
  return result
}

function formatOutline(sym: DocSymbol, indent = 0): string {
  const pad = "  ".repeat(indent)
  const line = sym.selectionRange.start.line + 1
  let result = `${pad}${sym.name} :${line}\n`
  if (sym.children) {
    for (const child of sym.children) {
      result += formatOutline(child, indent + 1)
    }
  }
  return result
}

function formatWorkspaceSymbol(sym: LSP.Symbol): string {
  const uri = sym.location.uri
  const file = uri.startsWith("file://") ? fileURLToPath(uri) : uri
  const rel = path.relative(Instance.worktree, file)
  const line = sym.location.range.start.line + 1
  const icon = kindIcon(sym.kind)
  return `${icon} ${sym.name} (${kindName(sym.kind)}) ${rel}:${line}`
}

export const SymbolsTool = Tool.define("symbols", {
  description: DESCRIPTION,
  parameters: z.object({
    action: z.enum(["file", "workspace", "outline"]).describe("The action to perform"),
    path: z.string().optional().describe("File path (required for 'file' and 'outline' actions)"),
    query: z.string().optional().describe("Search query (required for 'workspace' action)"),
  }),
  execute: async (args, ctx) => {
    await ctx.ask({
      permission: "lsp",
      patterns: ["*"],
      always: ["*"],
      metadata: {},
    })

    if (args.action === "workspace") {
      const query = args.query ?? ""
      const symbols = await LSP.workspaceSymbol(query)
      if (!symbols.length) {
        return {
          title: `symbols workspace "${query}"`,
          metadata: { count: 0 },
          output: `No symbols found matching "${query}"`,
        }
      }
      const output = symbols.map(formatWorkspaceSymbol).join("\n")
      return {
        title: `symbols workspace "${query}"`,
        metadata: { count: symbols.length },
        output,
      }
    }

    if (!args.path) {
      throw new Error("path is required for file/outline actions")
    }

    const file = path.isAbsolute(args.path) ? args.path : path.join(Instance.directory, args.path)
    await assertExternalDirectory(ctx, file)

    const exists = await Filesystem.exists(file)
    if (!exists) {
      throw new Error(`File not found: ${file}`)
    }

    const available = await LSP.hasClients(file)
    if (!available) {
      throw new Error("No LSP server available for this file type.")
    }

    await LSP.touchFile(file, true)
    const uri = pathToFileURL(file).href
    const symbols = await LSP.documentSymbol(uri)
    const rel = path.relative(Instance.worktree, file)

    if (!symbols.length) {
      return {
        title: `symbols ${args.action} ${rel}`,
        metadata: { count: 0 },
        output: `No symbols found in ${rel}`,
      }
    }

    // Check if we have DocumentSymbol (with children) or SymbolInformation
    const isDocSymbol = "selectionRange" in symbols[0]

    if (args.action === "outline") {
      if (!isDocSymbol) {
        // Fallback for SymbolInformation
        const output = (symbols as LSP.Symbol[]).map((s) => `${s.name} :${s.location.range.start.line + 1}`).join("\n")
        return {
          title: `symbols outline ${rel}`,
          metadata: { count: symbols.length },
          output,
        }
      }
      const output = (symbols as DocSymbol[]).map((s) => formatOutline(s)).join("")
      return {
        title: `symbols outline ${rel}`,
        metadata: { count: symbols.length },
        output,
      }
    }

    // action === "file"
    if (!isDocSymbol) {
      // Fallback for SymbolInformation
      const output = (symbols as LSP.Symbol[])
        .map((s) => `${kindIcon(s.kind)} ${s.name} (${kindName(s.kind)}) :${s.location.range.start.line + 1}`)
        .join("\n")
      return {
        title: `symbols file ${rel}`,
        metadata: { count: symbols.length },
        output,
      }
    }

    const output = (symbols as DocSymbol[]).map((s) => formatDocSymbol(s)).join("")
    return {
      title: `symbols file ${rel}`,
      metadata: { count: symbols.length },
      output,
    }
  },
})

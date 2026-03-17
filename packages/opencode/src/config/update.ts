import path from "path"
import {
  applyEdits,
  modify,
  parse as parseJsonc,
  printParseErrorCode,
  type ParseError as JsoncParseError,
} from "jsonc-parser"

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value)
}

export function patchJsonc(input: string, patch: unknown, keys: string[] = []): string {
  if (!isRecord(patch)) {
    const edits = modify(input, keys, patch, {
      formattingOptions: {
        insertSpaces: true,
        tabSize: 2,
      },
    })
    return applyEdits(input, edits)
  }

  return Object.entries(patch).reduce((result, [key, value]) => {
    if (value === undefined) return result
    return patchJsonc(result, value, [...keys, key])
  }, input)
}

export function parseConfig(
  text: string,
  filepath: string,
  parse: (value: unknown) => unknown,
  onJsonError: (data: { path: string; message: string }) => never,
) {
  const errors: JsoncParseError[] = []
  const data = parseJsonc(text, errors, { allowTrailingComma: true })
  if (errors.length) {
    const lines = text.split("\n")
    const detail = errors
      .map((e) => {
        const before = text.substring(0, e.offset).split("\n")
        const line = before.length
        const col = before[before.length - 1].length + 1
        const code = printParseErrorCode(e.error)
        const problem = lines[line - 1]
        if (!problem) return `${code} at line ${line}, column ${col}`
        return `${code} at line ${line}, column ${col}\n   Line ${line}: ${problem}\n${"".padStart(col + 9)}^`
      })
      .join("\n")
    return onJsonError({
      path: filepath,
      message: `\n--- JSONC Input ---\n${text}\n--- Errors ---\n${detail}\n--- End ---`,
    })
  }

  return parse(data)
}

export function globalConfigFile(globalDir: string, exists: (file: string) => boolean) {
  const files = ["opencode.jsonc", "opencode.json", "config.json"].map((file) => path.join(globalDir, file))
  for (const file of files) {
    if (exists(file)) return file
  }
  return files[0]
}

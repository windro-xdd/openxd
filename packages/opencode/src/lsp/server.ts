import type { Handle as HandleT, Info as InfoT, RootFunction as RootFunctionT } from "./server.types"
import {
  Deno as JS_Deno,
  Typescript as JS_Typescript,
  Vue as JS_Vue,
  ESLint as JS_ESLint,
  Oxlint as JS_Oxlint,
  Biome as JS_Biome,
  Svelte as JS_Svelte,
  Astro as JS_Astro,
  YamlLS as JS_YamlLS,
  BashLS as JS_BashLS,
  DockerfileLS as JS_DockerfileLS,
  PHPIntelephense as JS_PHPIntelephense,
  Prisma as JS_Prisma,
} from "./server.javascript"
import { Ty as PY_Ty, Pyright as PY_Pyright } from "./server.python"
import {
  Gopls as SYS_Gopls,
  Rubocop as SYS_Rubocop,
  CSharp as SYS_CSharp,
  FSharp as SYS_FSharp,
  SourceKit as SYS_SourceKit,
  RustAnalyzer as SYS_RustAnalyzer,
  JDTLS as SYS_JDTLS,
  KotlinLS as SYS_KotlinLS,
  Gleam as SYS_Gleam,
  Clojure as SYS_Clojure,
  Nixd as SYS_Nixd,
  HLS as SYS_HLS,
  JuliaLS as SYS_JuliaLS,
  Dart as SYS_Dart,
  Ocaml as SYS_Ocaml,
} from "./server.system"
import {
  ElixirLS as DL_ElixirLS,
  Zls as DL_Zls,
  Clangd as DL_Clangd,
  LuaLS as DL_LuaLS,
  TerraformLS as DL_TerraformLS,
  TexLab as DL_TexLab,
  Tinymist as DL_Tinymist,
} from "./server.download"

export namespace LSPServer {
  export type Handle = HandleT
  export type Info = InfoT
  export type RootFunction = RootFunctionT

  export const Deno = JS_Deno
  export const Typescript = JS_Typescript
  export const Vue = JS_Vue
  export const ESLint = JS_ESLint
  export const Oxlint = JS_Oxlint
  export const Biome = JS_Biome
  export const Gopls = SYS_Gopls
  export const Rubocop = SYS_Rubocop
  export const Ty = PY_Ty
  export const Pyright = PY_Pyright
  export const ElixirLS = DL_ElixirLS
  export const Zls = DL_Zls
  export const CSharp = SYS_CSharp
  export const FSharp = SYS_FSharp
  export const SourceKit = SYS_SourceKit
  export const RustAnalyzer = SYS_RustAnalyzer
  export const Clangd = DL_Clangd
  export const Svelte = JS_Svelte
  export const Astro = JS_Astro
  export const JDTLS = SYS_JDTLS
  export const KotlinLS = SYS_KotlinLS
  export const YamlLS = JS_YamlLS
  export const LuaLS = DL_LuaLS
  export const PHPIntelephense = JS_PHPIntelephense
  export const Prisma = JS_Prisma
  export const Dart = SYS_Dart
  export const Ocaml = SYS_Ocaml
  export const BashLS = JS_BashLS
  export const TerraformLS = DL_TerraformLS
  export const TexLab = DL_TexLab
  export const DockerfileLS = JS_DockerfileLS
  export const Gleam = SYS_Gleam
  export const Clojure = SYS_Clojure
  export const Nixd = SYS_Nixd
  export const Tinymist = DL_Tinymist
  export const HLS = SYS_HLS
  export const JuliaLS = SYS_JuliaLS
}

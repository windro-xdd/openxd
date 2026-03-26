import { describe, expect, test } from "bun:test"
import { __resetLessonGuardForTests, assessLesson, detectCorrection, LessonGuard, matches, relevantLessons } from "../../src/session/lesson"
import { tmpdir } from "../fixture/fixture"
import { Instance } from "../../src/project/instance"
import { KnowledgeSync } from "../../src/knowledge/service"

describe("session.lesson", () => {
  test("detectCorrection ignores no-question and detects true corrections", () => {
    expect(detectCorrection("no why is this happening")).toBe(false)
    expect(detectCorrection("No, this is wrong")).toBe(true)
    expect(detectCorrection("you missed this part")).toBe(true)
  })

  test("relevantLessons ranks matching lesson entries", async () => {
    await using tmp = await tmpdir({
      git: true,
      init: async (dir) => {
        await Bun.write(
          `${dir}/LESSONS.md`,
          [
            "# Lessons Learned",
            "",
            "### 2026-03-20",
            "WRONG: I assumed CORS equals account takeover without checking auth cookies.",
            "RIGHT: Verify auth mechanism before impact claims.",
            "RULE: Check credentials flow before exploit severity.",
            "",
            "### 2026-03-21",
            "WRONG: I skipped typecheck before shipping.",
            "RIGHT: Run typecheck and tests.",
            "RULE: Verify before release.",
            "",
          ].join("\n"),
        )
      },
    })

    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        await KnowledgeSync.write_document({
          path: `${tmp.path}/LESSONS.md`,
          raw: await Bun.file(`${tmp.path}/LESSONS.md`).text(),
        })
        const tips = relevantLessons({ query: "you missed auth cookies and exploit severity", max: 2 })
        expect(tips.length).toBeGreaterThan(0)
        expect(tips[0]).toContain("CORS")
      },
    })
  })

  test("semantic matcher links related phrasing", async () => {
    await using tmp = await tmpdir({
      git: true,
      init: async (dir) => {
        await Bun.write(
          `${dir}/LESSONS.md`,
          [
            "# Lessons Learned",
            "",
            "### 2026-03-20",
            "WRONG: I shipped release artifacts from an older commit after fixing a runtime bug.",
            "RIGHT: Rebuild artifacts from the exact fix commit before publishing.",
            "RULE: Release artifacts must match the fix commit hash.",
            "",
          ].join("\n"),
        )
      },
    })

    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        await KnowledgeSync.write_document({
          path: `${tmp.path}/LESSONS.md`,
          raw: await Bun.file(`${tmp.path}/LESSONS.md`).text(),
        })
        const out = matches("published build used stale binaries not rebuilt after patch", 1)
        expect(out.length).toBeGreaterThan(0)
        expect(out[0].score).toBeGreaterThan(0.08)
      },
    })
  })

  test("assessLesson rejects duplicate/generic lessons", () => {
    const existing = [
      "# Lessons Learned",
      "",
      "### 2026-03-20",
      "WRONG: I used a stale release artifact after a fix commit.",
      "RIGHT: Rebuild before publishing.",
      "RULE: Artifact must match commit.",
      "",
    ].join("\n")

    const generic = assessLesson({ content: "WRONG: x\nRIGHT: y\nRULE: be more careful", existing })
    expect(generic.ok).toBe(false)

    const dup = assessLesson({
      content:
        "WRONG: I used a stale release artifact after a fix commit.\nRIGHT: Rebuild before publishing.\nRULE: Artifact must match commit.",
      existing,
    })
    expect(dup.ok).toBe(false)
    expect(dup.reason).toContain("Duplicate")
  })

  test("LessonGuard tracks repeat-error telemetry and blocks risky repeats", async () => {
    await using tmp = await tmpdir({
      git: true,
      init: async (dir) => {
        await Bun.write(
          `${dir}/LESSONS.md`,
          [
            "# Lessons Learned",
            "",
            "### 2026-03-20",
            "WRONG: I edited source using bash script and broke formatting.",
            "RIGHT: Use apply_patch for source edits and run checks.",
            "RULE: Never use bash for file editing.",
            "",
          ].join("\n"),
        )
      },
    })

    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        await __resetLessonGuardForTests()
        await KnowledgeSync.write_document({
          path: `${tmp.path}/LESSONS.md`,
          raw: await Bun.file(`${tmp.path}/LESSONS.md`).text(),
        })

        await LessonGuard.seed({ sessionID: "s1", text: "you used bash editing again" })
        const two = await LessonGuard.observe({ sessionID: "s1", text: "still using bash for source edits" })
        expect(two.repeats).toBeGreaterThan(0)
        expect(two.rate).toBeGreaterThan(0)

        const block = await LessonGuard.block({
          sessionID: "s1",
          tool: "bash",
          args: { command: "bash -lc 'edit source file'" },
        })
        expect(block).toBeDefined()
        expect(block?.rule).toContain("Never use bash")
      },
    })
  })
})

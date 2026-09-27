import assert from 'node:assert/strict'
import test from 'node:test'

const { buildImprovementPlanPrompt, normalizePlanOutput } = await import('../lib/ai/prompts.ts')

const oneRecord = [{
  id: 'feedback-1',
  rating: 5,
  comment: 'The service provider is so sweet person and gentle.',
  date: '2026-09-27',
}]

test('plan prompt treats one review as one anecdote, not a broad customer theme', () => {
  const prompt = buildImprovementPlanPrompt('Texmart', 'Fashion store', oneRecord)
  assert.match(prompt, /With one record, describe one person's observation/i)
  assert.match(prompt, /do not call it a confirmed or recurring theme/i)
  assert.match(prompt, /do not generalize it into a statement about customers as a group/i)
  assert.match(prompt, /sample size accurately/i)
})

test('plan prompt prohibits unsupported staffing, premises, receipts, and outreach assumptions', () => {
  const prompt = buildImprovementPlanPrompt('Texmart', 'Fashion store', oneRecord)
  assert.match(prompt, /does not prove a physical location, employees, managers, receipts/i)
  assert.match(prompt, /Do not recommend staff huddles/i)
  assert.match(prompt, /marketing consent/i)
  assert.match(prompt, /solo owner or a team, online or offline/i)
  assert.match(prompt, /do not require a new system, paid tool, forced survey, or unsolicited customer outreach/i)
})

test('plan prompt requests four measurable weeks and plain text rather than Markdown', () => {
  const prompt = buildImprovementPlanPrompt('Texmart', 'Fashion store', oneRecord)
  assert.match(prompt, /exactly four sections labeled WEEK 1, WEEK 2, WEEK 3, and WEEK 4/i)
  assert.match(prompt, /include Action, Evidence, and Measure/i)
  assert.match(prompt, /plain text only: no Markdown headings or hash marks/i)
})

test('plan output normalization removes heading, emphasis, quote, rule, and table syntax', () => {
  const input = [
    '**30-Day Plan**',
    '---',
    '### **Observed signal**',
    '> One reviewer praised *gentle service*.',
    '- `Review naturally received feedback`',
    '| Week | Measure |',
    '|---|---|',
    '| 1 | Count mentions |',
  ].join('\n')
  const output = normalizePlanOutput(input)
  assert.match(output, /30-Day Plan/)
  assert.match(output, /Observed signal/)
  assert.match(output, /gentle service/)
  assert.match(output, /Review naturally received feedback/)
  assert.match(output, /1 — Count mentions/)
  assert.doesNotMatch(output, /(^|\n)\s*#+|\*\*|`|\|---\||^---$/m)
})

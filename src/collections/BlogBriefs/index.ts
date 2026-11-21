import type {
  CollectionBeforeChangeHook,
  CollectionAfterChangeHook,
  CollectionConfig,
} from 'payload'

import { authenticated } from '../../access/authenticated'
import { aiBlocker, capBlocker, monthStartUtc } from '../../ai/readiness'
import type { BlogBrief } from '../../payload-types'

export const BRIEF_STATUSES = ['queued', 'researching', 'writing', 'ready', 'failed'] as const

/**
 * Runs before a brief is saved. For a new brief, or one set back to `queued`, it decides whether
 * the draft may run: AI must be enabled and configured and the monthly cap must not be reached.
 * If not, the brief is saved as `failed` with a clear reason and nothing is queued. A manual
 * re-queue also wipes the previous run's research and cost, so the new run starts clean.
 */
const gateBrief: CollectionBeforeChangeHook<BlogBrief> = async ({
  data,
  originalDoc,
  operation,
  req,
}) => {
  if (operation === 'create' && req.user && !data.createdBy) data.createdBy = req.user.id

  const status = data.status ?? originalDoc?.status
  const becomesQueued =
    status === 'queued' && (operation === 'create' || originalDoc?.status !== 'queued')
  if (!becomesQueued) return data

  if (operation === 'update') {
    data.research = null
    data.usage = null
    data.estimatedCostUsd = null
  }
  data.error = null

  const settings = await req.payload.findGlobal({
    slug: 'site-settings',
    depth: 0,
    overrideAccess: true,
    req,
  })
  const startedThisMonth = (
    await req.payload.count({
      collection: 'blog-briefs',
      where: {
        and: [
          { createdAt: { greater_than_equal: monthStartUtc().toISOString() } },
          { status: { not_equals: 'failed' } },
          ...(originalDoc?.id ? [{ id: { not_equals: originalDoc.id } }] : []),
        ],
      },
      overrideAccess: true,
      req,
    })
  ).totalDocs

  const blocker =
    aiBlocker(settings.ai) ?? capBlocker(startedThisMonth, settings.ai?.monthlyDraftCap)
  if (blocker) {
    data.status = 'failed'
    data.error = blocker
  }
  return data
}

/** Queues the draft job once per transition into `queued`, never twice for the same brief. */
const queueDraft: CollectionAfterChangeHook<BlogBrief> = async ({
  doc,
  previousDoc,
  operation,
  req,
}) => {
  const becameQueued =
    doc.status === 'queued' && (operation === 'create' || previousDoc?.status !== 'queued')
  if (!becameQueued) return doc

  const pending = await req.payload.find({
    collection: 'payload-jobs',
    where: {
      and: [
        { taskSlug: { equals: 'generateBlogDraft' } },
        { completedAt: { exists: false } },
        { hasError: { not_equals: true } },
      ],
    },
    limit: 200,
    depth: 0,
    pagination: false,
    overrideAccess: true,
    req,
  })
  const alreadyQueued = pending.docs.some(
    (job) => (job.input as { briefId?: number } | null)?.briefId === doc.id,
  )
  if (alreadyQueued) return doc

  await req.payload.jobs.queue({
    task: 'generateBlogDraft',
    input: { briefId: doc.id },
    queue: 'ai',
    req,
  })
  return doc
}

export const BlogBriefs: CollectionConfig<'blog-briefs'> = {
  slug: 'blog-briefs',
  labels: { singular: 'Blog brief', plural: 'Blog briefs' },
  access: {
    create: authenticated,
    delete: authenticated,
    read: authenticated,
    update: authenticated,
  },
  admin: {
    useAsTitle: 'topic',
    defaultColumns: ['topic', 'status', 'category', 'estimatedCostUsd', 'post', 'createdAt'],
    listSearchableFields: ['topic', 'targetKeyword'],
    description:
      'Creating a brief starts an AI draft (when AI drafts are on in Site settings). The draft is saved as an unpublished post and needs a human review before it can go live.',
  },
  fields: [
    { name: 'topic', type: 'text', required: true },
    {
      type: 'row',
      fields: [
        { name: 'targetKeyword', type: 'text', required: true, admin: { width: '50%' } },
        {
          name: 'category',
          type: 'relationship',
          relationTo: 'categories',
          required: true,
          admin: { width: '50%' },
        },
      ],
    },
    {
      name: 'angle',
      type: 'textarea',
      admin: {
        description:
          'What makes this guide worth reading: the audience, the decision it helps with.',
      },
    },
    {
      name: 'targetWords',
      type: 'number',
      defaultValue: 1500,
      min: 600,
      max: 4000,
      admin: { description: 'The draft must land within 20% of this.' },
    },
    {
      name: 'experienceSource',
      type: 'radio',
      required: true,
      defaultValue: 'ai',
      options: [
        { label: 'I will write the first-hand notes', value: 'human' },
        { label: 'Generate original insight notes from the research', value: 'ai' },
      ],
      admin: {
        description:
          'Human: your own experience or data goes in the notes below. AI: the notes are scenarios, calculations, tips and pitfalls drawn from research, never invented personal experience.',
      },
    },
    {
      name: 'firstHandNotes',
      type: 'textarea',
      admin: {
        description:
          'Required when you write them yourself. When "AI" is chosen, the job fills this in (you may edit it before queueing again).',
        rows: 8,
      },
      validate: (
        value: string | null | undefined,
        { siblingData }: { siblingData?: { experienceSource?: string } },
      ) => {
        if (siblingData?.experienceSource === 'human' && (value ?? '').trim().length < 40) {
          return 'Write your first-hand notes (at least 40 characters), or choose "Generate original insight notes".'
        }
        return true
      },
    },
    {
      name: 'mustLinkTo',
      type: 'relationship',
      relationTo: ['deals', 'categories'],
      hasMany: true,
      admin: { description: 'Pages the guide must link to (live deals and category hubs).' },
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'queued',
      index: true,
      options: BRIEF_STATUSES.map((value) => ({ label: value, value })),
      admin: {
        position: 'sidebar',
        description: 'Set to "queued" to run the draft again after a failure.',
      },
    },
    {
      name: 'post',
      type: 'relationship',
      relationTo: 'posts',
      admin: {
        position: 'sidebar',
        readOnly: true,
        components: { Cell: '@/components/admin/PostLinkCell#PostLinkCell' },
      },
    },
    { name: 'error', type: 'textarea', admin: { position: 'sidebar', readOnly: true } },
    {
      name: 'estimatedCostUsd',
      type: 'number',
      label: 'Estimated cost (USD)',
      admin: { position: 'sidebar', readOnly: true, step: 0.001 },
    },
    {
      name: 'createdBy',
      type: 'relationship',
      relationTo: 'users',
      admin: { position: 'sidebar', readOnly: true, description: "Becomes the draft's author." },
    },
    {
      name: 'research',
      type: 'json',
      admin: {
        description:
          'Search queries, the result pages found (URLs and titles) and our own notes. Raw search snippets are never stored.',
      },
    },
    {
      name: 'usage',
      type: 'json',
      admin: { description: 'Tokens, searches and the estimated cost of this draft.' },
    },
  ],
  hooks: {
    beforeChange: [gateBrief],
    afterChange: [queueDraft],
  },
  timestamps: true,
}

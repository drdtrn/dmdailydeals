import { postgresAdapter } from '@payloadcms/db-postgres'
import sharp from 'sharp'
import path from 'path'
import { buildConfig, PayloadRequest } from 'payload'
import { fileURLToPath } from 'url'

import { BlogBriefs } from './collections/BlogBriefs'
import { Categories } from './collections/Categories'
import { Clicks } from './collections/Clicks'
import { Deals } from './collections/Deals'
import { Drops } from './collections/Drops'
import { Events } from './collections/Events'
import { Media } from './collections/Media'
import { Pages } from './collections/Pages'
import { Posts } from './collections/Posts'
import { PriceSnapshots } from './collections/PriceSnapshots'
import { Stores } from './collections/Stores'
import { Subscribers } from './collections/Subscribers'
import { Users } from './collections/Users'
import { Footer } from './Footer/config'
import { Header } from './Header/config'
import { AlwaysOnOffer } from './globals/AlwaysOnOffer'
import { SiteSettings } from './globals/SiteSettings'
import { generateBlogDraft } from './jobs/generateBlogDraft'
import { pingIndexNow } from './jobs/pingIndexNow'
import { postDropToTelegram } from './jobs/postDropToTelegram'
import { publishDueDrops } from './jobs/publishDueDrops'
import { revalidateDrop } from './jobs/revalidateDrop'
import { migrations } from './migrations'
import { plugins } from './plugins'
import { defaultLexical } from '@/fields/defaultLexical'
import { getServerSideURL } from './utilities/getURL'

/** True for databases managed by migrations (CI, production). See the `db` config below. */
const migrationManaged = process.env.PAYLOAD_DB_PUSH === 'false'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

export default buildConfig({
  admin: {
    components: {
      // The `BeforeLogin` component renders a message that you see while logging into your admin panel.
      // Feel free to delete this at any time. Simply remove the line below.
      beforeLogin: ['@/components/BeforeLogin'],
      // The `BeforeDashboard` component renders the 'welcome' block that you see after logging into your admin panel.
      // Feel free to delete this at any time. Simply remove the line below.
      beforeDashboard: ['@/components/BeforeDashboard'],
      afterNavLinks: ['@/components/admin/ReportsNavLink#ReportsNavLink'],
      views: {
        clicksReport: {
          Component: '@/components/admin/ClicksReportView#ClicksReportView',
          path: '/reports/clicks',
          exact: true,
        },
      },
    },
    importMap: {
      baseDir: path.resolve(dirname),
    },
    user: Users.slug,
    livePreview: {
      breakpoints: [
        {
          label: 'Mobile',
          name: 'mobile',
          width: 375,
          height: 667,
        },
        {
          label: 'Tablet',
          name: 'tablet',
          width: 768,
          height: 1024,
        },
        {
          label: 'Desktop',
          name: 'desktop',
          width: 1440,
          height: 900,
        },
      ],
    },
  },
  // This config helps us configure global or default features that the other editors can inherit
  editor: defaultLexical,
  db: postgresAdapter({
    pool: {
      connectionString: process.env.DATABASE_URL || '',
    },
    // Schema workflow. Push and migrations must never be mixed on one database:
    // - Local dev database (default): `push` auto-syncs the schema; migrations never run.
    // - Migration-managed databases (CI, production, fresh-migration checks): set
    //   PAYLOAD_DB_PUSH=false. Push is off and, in production (NODE_ENV=production), the committed
    //   migrations run on startup via `prodMigrations`.
    // Running `prodMigrations` against a push-managed database makes Payload ask an interactive
    // "data loss" question (it even hangs `next build`), hence the single switch below.
    push: !migrationManaged,
    prodMigrations: migrationManaged ? migrations : undefined,
  }),
  collections: [
    Pages,
    Posts,
    Media,
    Categories,
    Users,
    Stores,
    Deals,
    Drops,
    PriceSnapshots,
    Clicks,
    Events,
    Subscribers,
    BlogBriefs,
  ],
  cors: [getServerSideURL()].filter(Boolean),
  globals: [Header, Footer, SiteSettings, AlwaysOnOffer],
  plugins,
  secret: process.env.PAYLOAD_SECRET,
  sharp,
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  jobs: {
    access: {
      run: ({ req }: { req: PayloadRequest }): boolean => {
        // Allow logged in users to execute this endpoint (default)
        if (req.user) return true

        const secret = process.env.CRON_SECRET
        if (!secret) return false

        // If there is no logged in user, then check
        // for the Vercel Cron secret to be present as an
        // Authorization header:
        const authHeader = req.headers.get('authorization')
        return authHeader === `Bearer ${secret}`
      },
    },
    // No `autoRun` and no `jobs:handle-schedules`: the only runner is the HTTP endpoint
    // GET /api/payload-jobs/run (cron container / `pnpm cron:dev`), which also handles schedules.
    // Queues: `drops` (publishDueDrops), `default` (follow-ups, schedulePublish), `ai` (generateBlogDraft:
    // run by its own cron loop, one job at a time, so a slow AI job can never delay a drop).
    tasks: [publishDueDrops, revalidateDrop, pingIndexNow, postDropToTelegram, generateBlogDraft],
  },
})

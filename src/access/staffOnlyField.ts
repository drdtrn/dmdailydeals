import type { FieldAccess } from 'payload'

/**
 * Field-level read access for internal-only fields: only a logged-in user gets the value. For
 * everyone else Payload leaves the field out of the response entirely (REST, GraphQL and the
 * Local API with `overrideAccess: false`).
 */
export const staffOnlyField: FieldAccess = ({ req }) => Boolean(req.user)

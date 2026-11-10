/**
 * Visitor counter (GoatCounter, free, no cookies).
 *
 * Paste your GoatCounter site code here, e.g. 'wackybuds' for
 * https://wackybuds.goatcounter.com. Leave it empty to turn counting off.
 * (Setup steps are in the README and in the Admin tab.)
 */
const SITE_CODE = ''

export const GOATCOUNTER_CODE: string = (
  (import.meta.env.VITE_GOATCOUNTER_CODE as string | undefined) || SITE_CODE
)
  .trim()
  .toLowerCase()

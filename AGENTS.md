<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

## What Lovable manages

Rules outside this block are the project's own. Change the pieces below in
Lovable, not by hand. With the [Lovable MCP](https://mcp.lovable.dev)
connected, `send_message` asks Lovable to do it; otherwise ask the user to
use the editor.

- **Database.** Do not add or edit `supabase/migrations/` or `drizzle/`.
  Ask Lovable to change the schema.
- **Generated files.** Do not edit a file whose header says it is automatically
  generated.
- **AI gateway.** Keep model calls on Lovable's gateway, and keep
  `LOVABLE_API_KEY` out of browser code.
- **Connectors.** Lovable provides native connectors. `list_connectors` shows
  which are enabled; `add_connector` only returns the dashboard link. When a
  connector is enabled, calls go through the connector gateway and need
  `LOVABLE_API_KEY`. When Lovable does not provide one, users can bring their
  own key and store it in Secrets.
- **Secrets.** Lovable manages them. Do not put secret values in the repo.
<!-- LOVABLE:END -->

- Use the shared Button variants for app actions and questionnaire choices, and global CSS for map interaction and entrance motion; this keeps states consistent without adding animation libraries.
- Disable entrance and score animations for reduced-motion preferences and printing so reports remain readable.
- Admin rights come only from public.user_roles via has_role(); admin emails live in the app-unreachable public.admin_emails table and are granted when a verified email (email confirmation or Google sign-in) matches, so signups can't self-promote.
- The selected roof outline on the map is a plain Leaflet polygon created once per selection and reshaped in place by "Move outline"/"Edit corners" (leaflet-draw vertex editing); feeding edited geometry back through react-leaflet props would detach the corner handles.
- The results before/after preview is two locked, lazily imported Leaflet maps of the saved report outline (each map div isolated so its panes can't paint over the clipped "after" map); never screenshot or canvas-capture map tiles, since cross-origin tiles come out blank.
- The results page computes one solar panel layout from the saved roof outline (lib/panels) and passes it to the before/after preview; the layout's panel count is the roof maximum fed into recommendSolar (lib/impact), and every solar card figure derives from that one recommendation so the card numbers stay consistent.
- The results page holds one solar panel count (the budget default from recommendSolar in lib/impact, or the count set through the coverage field, the Cost tile arrows or the subsidy card's size slider) and derives every solar figure, the pill and the drawn panels from it, so the numbers can't disagree.
- Pages check backendConnected() (lib/backend) before using the database client, because the generated client throws on first use when no database is connected and would blank the page.
- The government subsidy is computed per system size by subsidyFor in lib/impact (never a fixed amount on Assumptions) and the loan EMI by loanEmi; the budget default is sized on cost before subsidy, so changing subsidy rates never moves the suggested size.
- Page text is translated through useI18n: keyed strings in lib/translations, English-keyed strings (tx) in lib/translations-app and lib/translations-results; lib code such as scoring keeps returning English and pages translate at render, so calculations never depend on the language.
- The AI Solar Advisor (/advisor, lib/advisor*) calls Gemini from the server with the shared GEMINI_API_KEY and a response schema, never sends coordinates or stores the photo, and rate-limits per IP in memory (best effort per server instance) to protect the free-tier quota.
- The advisor shares only a short result summary with the chatbot through useAdvisorChat (lib/chat-report); the chat sends it only on /advisor, like the report on /results.

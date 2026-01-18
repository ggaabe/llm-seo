# Cloudflare cache key guidance

When serving HTML and Markdown from the same URL using `Accept: text/markdown`, Cloudflare may cache one variant and serve it to the wrong clients.

Recommended options:

1) Prefer a distinct Markdown URL (`/page.md`). This avoids cache collisions entirely.
2) If you still want `Accept` negotiation on the same URL:
   - Use a Transform Rule to rewrite requests into a distinct URL (append `.md` when the Accept header includes `text/markdown`).
   - Or configure a Custom Cache Key that includes the `Accept` header (Cloudflare supports this with restrictions).

If you rely on `_headers`, note that Pages Functions bypass `_headers` rules, so set `Content-Type` and `Vary` headers in the function.

### Automated setup

The CLI includes a helper to create Cloudflare Transform Rules for Markdown redirects:

```
llm-seo cloudflare:setup --zone-id <ZONE_ID> --token <API_TOKEN>
```

Use `--dry-run` to inspect the ruleset payload before applying.

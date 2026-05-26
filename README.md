# LOOMUS

> *Books, ideas, and gatherings — for the AI era.*

[loomus.ai](https://loomus.ai) · the public-facing site of **LOOMUS Foundation**, a public-interest project at the intersection of AI, design, and culture.

---

## What this repo is

The full source of [loomus.ai](https://loomus.ai) — hand-coded, in 6 languages, with no JS framework. Each page is a self-contained HTML file styled in the LOOMUS cream-paper aesthetic (Fraunces · ochre · forest green).

## Status

- **Live:** [loomus.ai](https://loomus.ai)
- **Languages:** EN · 中文 · ES · FR · IT · DE
- **Book Picks shipped:** 8 of a planned 100+
- **Patron tiers:** Reader · Patron · Benefactor (via Stripe Payment Links)
- **Hosting:** Netlify
- **Built with:** Claude (Cowork mode) + a lot of human taste

## Structure

```
index.html                      → EN homepage
index-{zh,es,fr,it,de}.html     → 5 localized homepages
library.html                    → The Founder's Library (100 books)
library-{lang}.html             → 5 localized libraries
books-{slug}.html               → individual Book Pick (6-frame card format)
books-{slug}-{lang}.html        → translations
soul.html                       → "A Quieter Room" (Easter egg destination)
about.html · gatherings.html · picks.html · data.html · soul.html
mascots.html                    → 5-creature brand asset
sitemap.xml · robots.txt
```

## Design system

The full design system lives in `book-picks-design-system.md` in the project knowledge:
cream `#f5efe4`, ochre `#c19a3e`, forest `#2d4a3e`; Fraunces (display) + system sans (body); 6-frame Book Pick template; sunglasses-creature mascots.

## License

MIT — see [LICENSE](./LICENSE). Code is open, content remains © LOOMUS.

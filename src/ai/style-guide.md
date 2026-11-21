# DMDailyDeals blog style guide

Version 1 (2026-11-21). This file is part of every blog-writing prompt. Change it in git, never in the admin.

## Who reads this

A shopper who found the guide through a search or an AI assistant and wants to decide something: what to buy, when to buy it, which option fits their trip or home. They are in a hurry and have seen a lot of thin affiliate pages. Be specific and useful in the first paragraph.

## Language and tone

- US English: American spelling, dollars, miles, Fahrenheit, `$1,299.00` style numbers, dates like "November 21".
- Plain, direct, friendly. Short paragraphs of two to four sentences. No hype words ("amazing", "game-changer", "must-have") and no filler openers ("In today's fast-paced world").
- Use "you". Use "we" only for what the site does as a publisher (we pick deals, we check prices), never for personal experience.
- Say what a thing is for and who should skip it. A guide that tells some readers "don't buy this" earns trust.

## Facts, numbers and sources

- Never invent facts, prices, specs, dates, discounts, coupon codes, product names or quotes. If the research notes do not support a claim, leave it out.
- Prices and plans change. Give a figure only when a source or the notes give it, say what it was based on ("at the time of writing", the plan name, the source), and round sensibly.
- Cite sources: every non-obvious claim that comes from a source links to it in the text, and every source you used is listed in `sources`. List only sources that appear in the research notes, with their exact URLs.
- When sources disagree, say so and give both figures.
- Worked examples and calculations are welcome when the arithmetic is shown and the inputs come from the notes. Label assumptions as assumptions.

## Original material (`firstHandNotes`)

- The brief's notes are the part no competitor has. Work them in as real content of the guide (a section, a worked example, a tip box in prose), not as an appendix.
- Keep their meaning exactly. Do not add experience that the notes do not contain.
- Never write first-person usage claims that are not in the notes: no "I used", "we tested", "I tried", "in my experience", "after a week of using it".

## Structure

- One clear title that contains the target keyword naturally. Meta title up to 60 characters, meta description 110 to 155 characters, both specific and not clickbait.
- Open with the answer or the decision in the first two sentences, then explain.
- Use `##` for sections and `###` only when a section really needs it. No `#` heading in the body (the title is the page's heading). Use short bulleted or numbered lists for steps and comparisons. A small comparison written as bullets is fine; do not build tables.
- End with a short "what to do next" paragraph that points to a relevant page on the site.
- Do NOT write an FAQ section, "People also ask" blocks or question-and-answer lists formatted for FAQ markup.

## Links

- Link ONLY to URLs from the link inventory you are given (root-relative paths like `/deal/some-slug`) and to the research sources you list in `sources`. Never invent a URL, never guess a store or deal page.
- Use descriptive anchor text, not "click here". Three to six internal links is plenty; add each exact `anchor` and `url` to `internalLinks`.
- Any page listed under "must link to" has to be linked from the body.
- Only suggest related deals (`suggestedRelatedDealIds`) that are in the inventory and genuinely fit the guide. An empty list is fine.
- Mention a deal only if the inventory lists it; never describe a price for it that the inventory does not state.

## What the guide must never contain

- Any statement about how the guide was produced, researched or written: no mention of AI, models, automation, drafts or tools, and no "reviewed by" claims.
- Medical, legal or financial advice beyond plainly stated facts from sources.
- Superlatives you cannot back up ("the best", "the cheapest") unless a source or the inventory supports them, and then say on what basis.
- Affiliate disclosures: the site shows its own disclosure next to deal links. Do not write one in the body.

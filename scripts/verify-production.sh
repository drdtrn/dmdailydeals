#!/bin/sh
# Phase 10: production verification for DMDailyDeals.
# POSIX sh + curl + grep/sed/awk only (no jq, node or python), so it runs on any VPS or laptop.
#
#   BASE_URL=https://dmdailydeals.com sh scripts/verify-production.sh
#
# Optional environment:
#   DEAL_SLUG  deal slug to check        (default: first /deal/ URL in /sitemap/deals.xml)
#   DROP_DATE  drop date YYYY-MM-DD      (default: first /drops/ date in /sitemap/drops.xml)
#   GO_ID      deal id for the /go check (default: first /go/<id> link on the home page)
#   SKIP_GO=1  skip the click-out check. It LOGS A REAL CLICK (flagged as a bot because the UA is curl).
#   TIMEOUT    curl max time in seconds  (default 20)
#
# Exit status: 1 if any check FAILs, else 0. WARN does not fail the run.

BASE_URL=${BASE_URL:-}
if [ -z "$BASE_URL" ]; then
  echo "usage: BASE_URL=https://dmdailydeals.com sh scripts/verify-production.sh" >&2
  exit 2
fi
BASE_URL=${BASE_URL%/}
TIMEOUT=${TIMEOUT:-20}
DEAL_SLUG=${DEAL_SLUG:-}
DROP_DATE=${DROP_DATE:-}
GO_ID=${GO_ID:-}
SKIP_GO=${SKIP_GO:-}

TMP=$(mktemp -d 2>/dev/null || mktemp -d -t verifyprod) || exit 2
trap 'rm -rf "$TMP"' EXIT INT TERM

PASS_N=0
FAIL_N=0
WARN_N=0
pass() {
  PASS_N=$((PASS_N + 1))
  printf 'PASS  %s\n' "$1"
}
fail() {
  FAIL_N=$((FAIL_N + 1))
  printf 'FAIL  %s\n' "$1"
}
warn() {
  WARN_N=$((WARN_N + 1))
  printf 'WARN  %s\n' "$1"
}
section() { printf '\n== %s ==\n' "$1"; }

UA_DEFAULT='Mozilla/5.0 (compatible; dmdd-verify/1.0)'

# fetch NAME URL [UA]: GET without following redirects. Sets STATUS; headers in $TMP/NAME.h, body in $TMP/NAME.b.
fetch() {
  _name=$1
  _url=$2
  _ua=${3:-$UA_DEFAULT}
  STATUS=$(curl -sS --max-time "$TIMEOUT" -A "$_ua" -D "$TMP/$_name.h" -o "$TMP/$_name.b" -w '%{http_code}' "$_url" 2>"$TMP/$_name.err") || STATUS=000
  [ -f "$TMP/$_name.h" ] || : >"$TMP/$_name.h"
  [ -f "$TMP/$_name.b" ] || : >"$TMP/$_name.b"
}

# hdr NAME HEADER: last value of a response header (case-insensitive), CR stripped.
hdr() {
  grep -i "^$2:" "$TMP/$1.h" | tail -n 1 | sed -e 's/^[^:]*:[[:space:]]*//' -e 's/[[:space:]]*$//' | tr -d '\r'
}

# has NAME PATTERN: does the body match the extended regex (case-sensitive)?
has() { grep -Eq -- "$2" "$TMP/$1.b"; }

# path_of URL: the path part of an absolute URL, or the input when already a path.
path_of() { printf '%s\n' "$1" | sed -e 's#^[a-zA-Z][a-zA-Z0-9+.-]*://[^/]*##'; }

# head_of NAME: the body up to the first </head>, on one line. Empty when there is no </head>.
head_of() {
  tr '\n' ' ' <"$TMP/$1.b" | awk '{ i = index($0, "</head>"); if (i > 0) print substr($0, 1, i + 6) }'
}

case $BASE_URL in
  https://*) IS_HTTPS=1 ;;
  *) IS_HTTPS=0 ;;
esac

printf 'Verifying %s\n' "$BASE_URL"
if [ -n "$SKIP_GO" ]; then
  printf 'SKIP_GO is set: the click-out check will be skipped.\n'
else
  printf 'WARNING: the /go check logs one real click (flagged as a bot, UA is curl). Set SKIP_GO=1 to skip it.\n'
fi

# ---------------------------------------------------------------- 1. health
section '1. Health'
fetch health "$BASE_URL/api/health"
if [ "$STATUS" = 200 ] && has health '"ok"[[:space:]]*:[[:space:]]*true'; then
  pass '/api/health 200 {"ok":true}'
else
  fail "/api/health expected 200 with \"ok\":true, got status $STATUS"
fi
cc=$(hdr health cache-control)
case $cc in
  *no-store*) pass '/api/health is no-store' ;;
  *) warn "/api/health Cache-Control is '$cc' (expected no-store)" ;;
esac

# ---------------------------------------------------------------- 2. robots.txt
section '2. robots.txt'
fetch robots "$BASE_URL/robots.txt"
if [ "$STATUS" != 200 ]; then
  fail "/robots.txt status $STATUS"
else
  pass '/robots.txt 200'
  robots_line() { tr -d '\r' <"$TMP/robots.b" | grep -Eiq "^[[:space:]]*$1[[:space:]]*$"; }
  if robots_line 'Allow:[[:space:]]*/api/media/file/'; then
    pass 'Allow: /api/media/file/'
  else
    fail 'robots.txt lacks "Allow: /api/media/file/"'
  fi
  for p in /go/ /admin /api/ /next/ /styleguide; do
    if robots_line "Disallow:[[:space:]]*$p"; then
      pass "Disallow: $p"
    else
      fail "robots.txt lacks \"Disallow: $p\""
    fi
  done
  if robots_line 'User-agent:[[:space:]]*\*'; then
    pass 'wildcard User-agent: * group present'
  else
    fail 'robots.txt has no "User-agent: *" group'
  fi
  if tr -d '\r' <"$TMP/robots.b" | grep -Fxq "Sitemap: $BASE_URL/sitemap.xml"; then
    pass "Sitemap: $BASE_URL/sitemap.xml"
  else
    fail "robots.txt lacks 'Sitemap: $BASE_URL/sitemap.xml'"
  fi
  for bot in GPTBot ClaudeBot PerplexityBot OAI-SearchBot Googlebot; do
    # Prints: absent | blocked | ok  (blocked = the bot's group has a bare "Disallow: /")
    verdict=$(tr -d '\r' <"$TMP/robots.b" | awk -v bot="$bot" '
      function trim(s) { sub(/^[ \t]+/, "", s); sub(/[ \t]+$/, "", s); return s }
      BEGIN { bot = tolower(bot); inrules = 0; ingroup = 0; found = 0; blocked = 0 }
      {
        line = $0
        sub(/#.*/, "", line)
        line = trim(line)
        if (line == "") next
        i = index(line, ":")
        if (i == 0) next
        key = tolower(trim(substr(line, 1, i - 1)))
        val = trim(substr(line, i + 1))
        if (key == "user-agent") {
          if (inrules) { ingroup = 0; inrules = 0 }
          if (tolower(val) == bot) { ingroup = 1; found = 1 }
        } else if (key == "allow" || key == "disallow") {
          inrules = 1
          if (ingroup && key == "disallow" && val == "/") blocked = 1
        } else if (key == "sitemap") {
          ingroup = 0; inrules = 0
        }
      }
      END { if (!found) print "absent"; else if (blocked) print "blocked"; else print "ok" }')
    case $verdict in
      ok) pass "$bot named in robots.txt and not fully disallowed" ;;
      blocked) fail "$bot is fully disallowed (Disallow: /) in robots.txt" ;;
      *) fail "$bot has no group in robots.txt" ;;
    esac
  done
fi

# ---------------------------------------------------------------- 3. sitemaps
section '3. Sitemaps'
fetch sitemap "$BASE_URL/sitemap.xml"
if [ "$STATUS" != 200 ]; then
  fail "/sitemap.xml status $STATUS"
elif ! has sitemap '<sitemapindex'; then
  fail '/sitemap.xml is not a <sitemapindex>'
else
  pass '/sitemap.xml is a sitemap index'
  locs=$(tr '\n' ' ' <"$TMP/sitemap.b" | grep -Eo '<loc>[^<]*</loc>' | sed -e 's#<loc>##' -e 's#</loc>##')
  if [ -z "$locs" ]; then
    fail 'sitemap index lists no child sitemaps'
  else
    if tr '\n' ' ' <"$TMP/sitemap.b" | grep -Eq '<lastmod>'; then
      pass 'sitemap index entries carry <lastmod>'
    else
      warn 'sitemap index entries have no <lastmod>'
    fi
    n=0
    for loc in $locs; do
      n=$((n + 1))
      path=$(path_of "$loc")
      fetch "child$n" "$BASE_URL$path"
      if [ "$STATUS" != 200 ]; then
        fail "child sitemap $path status $STATUS"
        continue
      fi
      problems=''
      has "child$n" '<url>' || problems="$problems no-<url>"
      has "child$n" '<lastmod>' || problems="$problems no-<lastmod>"
      has "child$n" '<changefreq>' && problems="$problems has-changefreq"
      has "child$n" '<priority>' && problems="$problems has-priority"
      if [ -z "$problems" ]; then
        pass "child sitemap $path: 200, <url> + <lastmod>, no changefreq/priority"
      else
        fail "child sitemap $path:$problems"
      fi
    done
  fi
fi

# ---------------------------------------------------------------- discovery
section 'Discovery'
if [ -z "$DEAL_SLUG" ]; then
  fetch sm_deals "$BASE_URL/sitemap/deals.xml"
  if [ "$STATUS" = 200 ]; then
    DEAL_SLUG=$(tr '\n' ' ' <"$TMP/sm_deals.b" | grep -Eo '<loc>[^<]*/deal/[^<]*</loc>' | head -n 1 |
      sed -e 's#.*/deal/##' -e 's#</loc>##' -e 's#/*$##')
  fi
fi
if [ -n "$DEAL_SLUG" ]; then
  printf 'deal slug : %s\n' "$DEAL_SLUG"
else
  warn 'no deal slug (set DEAL_SLUG or add a deal): deal checks skipped'
fi
if [ -z "$DROP_DATE" ]; then
  fetch sm_drops "$BASE_URL/sitemap/drops.xml"
  if [ "$STATUS" = 200 ]; then
    DROP_DATE=$(tr '\n' ' ' <"$TMP/sm_drops.b" | grep -Eo '/drops/[0-9]{4}-[0-9]{2}-[0-9]{2}' | head -n 1 | sed -e 's#/drops/##')
  fi
fi
if [ -n "$DROP_DATE" ]; then
  printf 'drop date : %s\n' "$DROP_DATE"
else
  warn 'no drop date (set DROP_DATE or publish a drop): drop checks skipped'
fi
fetch home "$BASE_URL/"
if [ -z "$GO_ID" ]; then
  GO_ID=$(grep -Eo '/go/[A-Za-z0-9_-]+' "$TMP/home.b" | head -n 1 | sed -e 's#/go/##')
fi
if [ -n "$SKIP_GO" ]; then
  printf 'go id     : skipped\n'
elif [ -n "$GO_ID" ]; then
  printf 'go id     : %s\n' "$GO_ID"
else
  warn 'no /go/<id> link on the home page (set GO_ID): click-out check skipped'
fi

# ---------------------------------------------------------------- 4. llms.txt and feed
section '4. llms.txt and feed'
fetch llms "$BASE_URL/llms.txt"
first=$(head -n 1 "$TMP/llms.b" | tr -d '\r')
case $first in
  '# '*)
    if [ "$STATUS" = 200 ]; then pass "/llms.txt 200, starts with '# '"; else fail "/llms.txt status $STATUS"; fi
    ;;
  *) fail "/llms.txt (status $STATUS) does not start with an H1 '# '" ;;
esac
fetch feed "$BASE_URL/feed.xml"
ct=$(hdr feed content-type)
if [ "$STATUS" != 200 ]; then
  fail "/feed.xml status $STATUS"
else
  if has feed '<rss[^>]*version="2\.0"'; then
    pass '/feed.xml contains <rss version="2.0">'
  else
    fail '/feed.xml lacks <rss version="2.0">'
  fi
  case $ct in
    *rss*xml* | *application/xml* | *text/xml*) pass "/feed.xml content type '$ct'" ;;
    *) fail "/feed.xml content type '$ct' is not RSS/XML" ;;
  esac
fi

# ---------------------------------------------------------------- 5. crawler head check
section '5. Crawler head check'
check_crawler() {
  # $1 label, $2 path, $3 user agent
  _tag=$(printf 'crawl_%s' "$1$2" | tr -c 'A-Za-z0-9\n' '_')
  fetch "$_tag" "$BASE_URL$2" "$3"
  if [ "$STATUS" != 200 ]; then
    fail "$1 $2 status $STATUS"
    return
  fi
  _head=$(head_of "$_tag")
  _bad=''
  [ -n "$_head" ] || _bad="$_bad no-</head>"
  printf '%s' "$_head" | grep -Eq '<title[ >]' || _bad="$_bad title-not-in-head"
  printf '%s' "$_head" | grep -Eq '<link[^>]*rel="canonical"|<link rel="canonical"' || _bad="$_bad canonical-not-in-head"
  has "$_tag" 'application/ld\+json' || _bad="$_bad no-ld+json"
  if [ -z "$_bad" ]; then
    pass "$1 $2: 200, title + canonical in <head>, JSON-LD"
  else
    fail "$1 $2:$_bad"
  fi
}
while IFS='|' read -r label ua; do
  [ -n "$label" ] || continue
  check_crawler "$label" / "$ua"
  [ -n "$DEAL_SLUG" ] && check_crawler "$label" "/deal/$DEAL_SLUG" "$ua"
done <<'EOF_UAS'
GPTBot|Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; GPTBot/1.2; +https://openai.com/gptbot
ClaudeBot|Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; ClaudeBot/1.0; +claudebot@anthropic.com)
PerplexityBot|Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; PerplexityBot/1.0; +https://perplexity.ai/perplexitybot)
OAI-SearchBot|Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; OAI-SearchBot/1.0; +https://openai.com/searchbot
Claude-SearchBot|Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; Claude-SearchBot/1.0; +Claude-SearchBot@anthropic.com)
Googlebot|Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)
Bingbot|Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)
EOF_UAS

# ---------------------------------------------------------------- 6. JSON-LD
section '6. JSON-LD'
if has home '"WebSite"' && has home '"Organization"'; then
  pass 'home page has WebSite + Organization JSON-LD'
else
  fail 'home page lacks "WebSite" and/or "Organization" JSON-LD'
fi
if [ -n "$DEAL_SLUG" ]; then
  fetch deal "$BASE_URL/deal/$DEAL_SLUG"
  if [ "$STATUS" != 200 ]; then
    fail "/deal/$DEAL_SLUG status $STATUS"
  else
    if has deal '"Product"' && has deal '"Offer"'; then
      pass "deal $DEAL_SLUG is live: Product + Offer JSON-LD"
    elif grep -Eqi 'expired|sold out|no longer available|unavailable' "$TMP/deal.b"; then
      warn "deal $DEAL_SLUG looks expired/sold out, so no Product JSON-LD (pick a live deal via DEAL_SLUG to test it)"
    else
      fail "deal $DEAL_SLUG looks live but lacks Product and/or Offer JSON-LD"
    fi
    for bad in AggregateOffer aggregateRating FAQPage HowTo; do
      if has deal "$bad"; then
        fail "deal $DEAL_SLUG contains forbidden $bad"
      else
        pass "deal $DEAL_SLUG has no $bad"
      fi
    done
  fi
fi
if [ -n "$DROP_DATE" ]; then
  fetch drop "$BASE_URL/drops/$DROP_DATE"
  if [ "$STATUS" != 200 ]; then
    fail "/drops/$DROP_DATE status $STATUS"
  elif has drop '"Article"'; then
    pass "drop $DROP_DATE has Article JSON-LD"
  else
    fail "drop $DROP_DATE lacks Article JSON-LD"
  fi
fi

# ---------------------------------------------------------------- 7. /go
section '7. Click-out (/go)'
if [ -n "$SKIP_GO" ]; then
  printf 'skipped (SKIP_GO set)\n'
elif [ -n "$GO_ID" ]; then
  fetch go "$BASE_URL/go/$GO_ID"
  if [ "$STATUS" = 302 ]; then
    pass "/go/$GO_ID 302"
  else
    fail "/go/$GO_ID expected 302, got $STATUS"
  fi
  loc=$(hdr go location)
  case $loc in
    http://* | https://*) pass "Location is absolute ($loc)" ;;
    *) fail "Location is missing or not absolute ('$loc')" ;;
  esac
  case $(hdr go cache-control) in
    *no-store*) pass 'Cache-Control: no-store' ;;
    *) fail "Cache-Control is '$(hdr go cache-control)' (expected no-store)" ;;
  esac
  case $(hdr go x-robots-tag) in
    *noindex*) pass "X-Robots-Tag: $(hdr go x-robots-tag)" ;;
    *) fail "X-Robots-Tag is '$(hdr go x-robots-tag)' (expected noindex)" ;;
  esac
  case $(hdr go referrer-policy) in
    *no-referrer*) fail "/go sends Referrer-Policy: $(hdr go referrer-policy), which hides the referrer from the store" ;;
    *) pass '/go does not send Referrer-Policy: no-referrer' ;;
  esac
fi

# ---------------------------------------------------------------- 8. 404s and redirects
section '8. 404s and redirects'
for p in /deal/__nope__ /nope-__x__ /drops/2000-01-01 /styleguide; do
  fetch nf "$BASE_URL$p"
  if [ "$STATUS" = 404 ]; then
    pass "$p 404"
  else
    fail "$p expected 404, got $STATUS"
  fi
done
fetch posts "$BASE_URL/posts"
loc=$(hdr posts location)
if [ "$STATUS" = 308 ]; then
  case $loc in
    */blog) pass "/posts 308 -> $loc" ;;
    *) fail "/posts 308 but Location '$loc' does not end in /blog" ;;
  esac
else
  fail "/posts expected 308, got $STATUS"
fi

# ---------------------------------------------------------------- 9. headers
section '9. Headers on /'
srv=$(hdr home server)
if [ -z "$srv" ]; then
  pass 'no Server header'
else
  warn "Server header present: '$srv' (Caddy should strip it)"
fi
if [ "$IS_HTTPS" = 1 ]; then
  if [ -n "$(hdr home strict-transport-security)" ]; then
    pass "HSTS: $(hdr home strict-transport-security)"
  else
    warn 'no Strict-Transport-Security header on an HTTPS URL'
  fi
else
  warn 'plain HTTP: HSTS not checked'
fi
case $(hdr home referrer-policy) in
  *no-referrer*) fail "/ sends Referrer-Policy: $(hdr home referrer-policy)" ;;
  *) pass '/ does not send Referrer-Policy: no-referrer' ;;
esac

# ---------------------------------------------------------------- 10. IndexNow
section '10. IndexNow key'
fetch ink "$BASE_URL/indexnow-key.txt"
key=$(tr -d '\r\n' <"$TMP/ink.b")
if [ "$STATUS" = 200 ]; then
  if printf '%s' "$key" | grep -Eq '^[A-Za-z0-9-]{8,128}$'; then
    pass '/indexnow-key.txt 200 with a valid key'
  else
    fail '/indexnow-key.txt 200 but the body is not 8-128 chars of [A-Za-z0-9-]'
  fi
elif [ "$STATUS" = 404 ]; then
  warn '/indexnow-key.txt 404: INDEXNOW_KEY not set'
else
  fail "/indexnow-key.txt status $STATUS"
fi

# ---------------------------------------------------------------- 11. manual checklist
section '11. Manual checks (cannot be scripted)'
deal_url="$BASE_URL/deal/${DEAL_SLUG:-<slug>}"
drop_url="$BASE_URL/drops/${DROP_DATE:-<YYYY-MM-DD>}"
cat <<EOF_MANUAL
[ ] Google Rich Results Test, deal page:
      https://search.google.com/test/rich-results?url=$deal_url
[ ] Google Rich Results Test, drop page:
      https://search.google.com/test/rich-results?url=$drop_url
[ ] Schema.org validator for the home page:
      https://validator.schema.org/#url=$BASE_URL/
[ ] Search Console > URL Inspection > "Test live URL" for / and a deal page (Googlebot fetch succeeds)
[ ] Cloudflare > Security > Bots > AI crawl settings: Search = Allow, Agent = Allow, Training = Allow.
    NEVER Block any of them.
[ ] Search Console and Bing Webmaster Tools: sitemap submitted ($BASE_URL/sitemap.xml)
EOF_MANUAL

# ---------------------------------------------------------------- summary
printf '\nSummary: %s PASS, %s WARN, %s FAIL\n' "$PASS_N" "$WARN_N" "$FAIL_N"
[ "$FAIL_N" -eq 0 ]

import httpx
import time
import xml.etree.ElementTree as ET
from fastapi import APIRouter

router = APIRouter(prefix="/news", tags=["News"])

# Simple in-memory cache
_cache: dict = {}
CACHE_TTL = 300  # 5 minutes

def get_cache(key: str):
    entry = _cache.get(key)
    if entry and time.time() - entry["ts"] < CACHE_TTL:
        return entry["data"]
    return None

def set_cache(key: str, data):
    _cache[key] = {"ts": time.time(), "data": data}

RSS_FEEDS = [
    ("https://news.google.com/rss/search?q=s%E1%BA%A7u+ri%C3%AAng&hl=vi&gl=VN&ceid=VN:vi", "Google News - Sầu riêng"),
    ("https://news.google.com/rss/search?q=durian+Vietnam&hl=vi&gl=VN&ceid=VN:vi", "Google News - Durian"),
]


import re as _re

def parse_rss(xml_text: str) -> list:
    items = []
    try:
        root = ET.fromstring(xml_text)
        channel = root.find("channel")
        if channel is None:
            return items
        for item in channel.findall("item"):
            title   = item.findtext("title", "").strip()
            link    = item.findtext("link", "").strip()
            pub     = item.findtext("pubDate", "").strip()
            source_el = item.find("source")
            source    = source_el.text.strip() if source_el is not None else ""
            source_url = source_el.get("url", "") if source_el is not None else ""
            desc_raw  = item.findtext("description", "").strip()
            desc      = _re.sub(r"<[^>]+>", "", desc_raw).strip()
            # Decode HTML entities (&nbsp; &amp; &lt; &gt; ...)
            import html as _html
            desc  = _html.unescape(desc)
            title = _html.unescape(title)
            # Xóa khoảng trắng thừa sau unescape
            desc  = _re.sub(r"\s{2,}", " ", desc).strip()

            if title and link:
                items.append({
                    "title":      title,
                    "link":       link,
                    "source_url": source_url,  # direct newspaper URL
                    "pubDate":    pub,
                    "source":     source,
                    "summary":    desc[:200] if desc else "",
                })
    except Exception:
        pass
    return items


async def resolve_url(client: httpx.AsyncClient, url: str) -> str:
    """Resolve Google News redirect to actual article URL.
    KHÔNG fetch Google News từ server — Google block IP server.
    Giữ nguyên URL để browser tự redirect khi user mở.
    """
    if "news.google.com" not in url:
        return url
    # Chỉ convert /rss/articles/ → /articles/ (URL browser-friendly)
    # KHÔNG follow redirect — tránh bị Google block IP
    browser_url = url.replace("/rss/articles/", "/articles/")
    browser_url = _re.sub(r'\?oc=\d+.*$', '', browser_url)
    return browser_url


@router.get("/article")
async def get_article(url: str):
    """Fetch và extract nội dung bài báo. Google News URLs → blocked ngay (bot detection)."""
    import re
    cached = get_cache(f"article:{url}")
    if cached:
        return cached

    # Google News URLs không thể fetch từ server (bot detection) → trả blocked ngay
    GOOGLE_DOMAINS = ("news.google.com", "google.com/sorry", "google.com/search")
    if any(d in url for d in GOOGLE_DOMAINS):
        result = {"title": "", "content": "", "url": url, "error": "", "blocked": True}
        set_cache(f"article:{url}", result)
        return result

    async with httpx.AsyncClient(timeout=12, follow_redirects=True,
                                  headers={
                                      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                                      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                                      "Accept-Language": "vi-VN,vi;q=0.9",
                                  }) as client:
        try:
            resp = await client.get(url)
            html = resp.text
            final_url = str(resp.url)
        except Exception as e:
            return {"error": str(e), "content": "", "title": "", "url": url}

    # Nếu redirect về Google Sorry → blocked
    if "google.com/sorry" in final_url:
        result = {"title": "", "content": "", "url": url, "error": "", "blocked": True}
        set_cache(f"article:{url}", result)
        return result

    # Extract title
    title_m = re.search(r"<title[^>]*>([^<]+)</title>", html, re.IGNORECASE)
    title = title_m.group(1).strip() if title_m else ""

    # ── Phát hiện trang bị block / CAPTCHA ──────────────────────
    html_lower = html.lower()
    blocked_signals = [
        "captcha" in html_lower,
        "robot" in html_lower and "verify" in html_lower,
        "access denied" in html_lower,
        "cloudflare" in html_lower and "checking your browser" in html_lower,
        "enable javascript" in html_lower and len(html) < 5000,
        "news.google.com/articles/" in final_url,  # vẫn ở Google, chưa redirect được
    ]
    if any(blocked_signals):
        result = {"title": title or "Bài viết", "content": "", "url": final_url,
                  "error": "", "blocked": True}
        set_cache(f"article:{url}", result)
        return result

    # Try to get article body — prioritize semantic tags
    content = ""
    for tag in ["article", "main", r'div[^>]+class="[^"]*(?:content|body|article|post|entry)[^"]*"',
                r'div[^>]+id="[^"]*(?:content|body|article|post|entry)[^"]*"']:
        m = re.search(fr"<{tag}[^>]*>([\s\S]*?)</{tag.split('[')[0]}>", html, re.IGNORECASE)
        if m:
            content = m.group(1)
            break

    if not content:
        content = html

    # Strip scripts, styles, ads
    content = re.sub(r"<script[\s\S]*?</script>", "", content, flags=re.IGNORECASE)
    content = re.sub(r"<style[\s\S]*?</style>",   "", content, flags=re.IGNORECASE)
    import html as _html_mod
    content = re.sub(r"<[^>]+>", " ", content)
    content = _html_mod.unescape(content)          # decode &nbsp; &amp; &lt; etc.
    content = re.sub(r"\s{2,}", "\n", content).strip()
    content = content[:8000]

    # Kiểm tra content có thực sự readable không
    url_count = len(re.findall(r"https?://", content))
    words     = len(content.split())
    # Nếu quá nhiều URL so với từ → rác
    if words < 60 or (url_count > 5 and url_count / max(words, 1) > 0.1):
        result = {"title": title or "Bài viết", "content": "", "url": final_url,
                  "error": "", "blocked": True}
        set_cache(f"article:{url}", result)
        return result

    result = {"title": title, "content": content, "url": final_url, "error": "", "blocked": False}
    set_cache(f"article:{url}", result)
    return result


@router.get("/search")
async def search_news(q: str):
    """Search Google News RSS for a query."""
    import urllib.parse
    cached = get_cache(f"search:{q}")
    if cached:
        return cached

    encoded = urllib.parse.quote(q)
    url = f"https://news.google.com/rss/search?q={encoded}&hl=vi&gl=VN&ceid=VN:vi"
    items = []
    async with httpx.AsyncClient(timeout=10, follow_redirects=True,
                                  headers={"User-Agent": "Mozilla/5.0"}) as client:
        try:
            resp = await client.get(url)
            if resp.status_code == 200:
                items = parse_rss(resp.text)
        except Exception:
            pass

    # Resolve URLs in parallel (limit 20)
    items = items[:20]
    async with httpx.AsyncClient(timeout=8, follow_redirects=True,
                                  headers={"User-Agent": "Mozilla/5.0"}) as client:
        import asyncio
        resolved = await asyncio.gather(*[resolve_url(client, i["link"]) for i in items])
    for i, item in enumerate(items):
        item["link"] = resolved[i]

    result = {"total": len(items), "items": items, "query": q}
    set_cache(f"search:{q}", result)
    return result


@router.get("/prices")
async def get_prices():
    cached = get_cache("prices")
    if cached:
        return cached
    """Parse giá sầu riêng từ nhiều nguồn RSS."""
    import re, asyncio, urllib.parse

    # Nhiều query RSS để bắt được nhiều loại hơn
    PRICE_RSS_URLS = [
        "https://news.google.com/rss/search?q=gi%C3%A1+s%E1%BA%A7u+ri%C3%AAng+h%C3%B4m+nay&hl=vi&gl=VN&ceid=VN:vi",
        "https://news.google.com/rss/search?q=gi%C3%A1+s%E1%BA%A7u+ri%C3%AAng+Monthong+Musang&hl=vi&gl=VN&ceid=VN:vi",
        "https://news.google.com/rss/search?q=gi%C3%A1+s%E1%BA%A7u+ri%C3%AAng+Th%C3%A1i+VIP&hl=vi&gl=VN&ceid=VN:vi",
    ]

    # Patterns: (regex, label)
    price_patterns = [
        (r"RI[\s-]?6[^\d]*(\d[\d\.,]+)\s*(?:đồng|đ|k|nghìn)?(?:/kg)?",           "Ri6"),
        (r"Musang\s*King[^\d]*(\d[\d\.,]+)\s*(?:đồng|đ)?(?:/kg)?",               "Musang King"),
        (r"Thái\s*VIP[^\d]*(\d[\d\.,]+)\s*(?:đồng|đ)?(?:/kg)?",                  "Thái VIP"),
        (r"Month[oô]ng[^\d]*(\d[\d\.,]+)\s*(?:đồng|đ)?(?:/kg)?",                 "Monthong"),
        (r"Chu[oồ]ng\s*B[oò][^\d]*(\d[\d\.,]+)\s*(?:đồng|đ)?(?:/kg)?",           "Chuồng Bò"),
        (r"S[aá]u\s*H[uữ]u[^\d]*(\d[\d\.,]+)\s*(?:đồng|đ)?(?:/kg)?",            "Sáu Hữu"),
        (r"(?:Thái|thai)[^\d]{0,15}(\d{2,3}[\d\.,]+)\s*(?:nghìn|đồng|đ)?(?:/kg)?", "Sầu Thái"),
    ]

    # Thu thập items từ nhiều RSS song song
    all_items: list = []
    async with httpx.AsyncClient(timeout=10, follow_redirects=True,
                                  headers={"User-Agent": "Mozilla/5.0"}) as client:
        resps = await asyncio.gather(
            *[client.get(u) for u in PRICE_RSS_URLS], return_exceptions=True
        )
    for r in resps:
        if isinstance(r, Exception): continue
        if r.status_code == 200:
            all_items.extend(parse_rss(r.text))

    # Deduplicate bởi title
    seen_titles: set = set()
    items: list = []
    for it in all_items:
        if it["title"] not in seen_titles:
            seen_titles.add(it["title"])
            items.append(it)

    # Extract giá
    prices: dict = {}
    latest_date = ""
    for item in items[:40]:
        text = item["title"] + " " + item.get("summary", "")
        if not latest_date and item.get("pubDate"):
            latest_date = item["pubDate"]
        for pattern, label in price_patterns:
            if label not in prices:
                m = re.search(pattern, text, re.IGNORECASE)
                if m:
                    raw = m.group(1).replace(".", "").replace(",", "")
                    try:
                        val = int(raw)
                        # Xử lý giá dạng "nghìn" (e.g. "85 nghìn" → 85000)
                        if 10 <= val <= 999 and "nghìn" in text.lower():
                            val *= 1000
                        # Giá sầu riêng thực tế tối thiểu 20.000đ/kg
                        if 20_000 <= val <= 500_000:
                            prices[label] = {
                                "price":   val,
                                "link":    item.get("link", ""),
                                "source":  item.get("source", ""),
                                "pubDate": item.get("pubDate", ""),
                            }
                    except ValueError:
                        pass

    # Giá tham khảo mặc định — hiển thị khi không scrape được đủ
    FALLBACK_PRICES = [
        ("Ri6",         55_000),
        ("Monthong",    90_000),
        ("Thái VIP",   145_000),
        ("Musang King",115_000),
        ("Chuồng Bò",   67_000),
    ]
    if len(prices) < 3:
        for label, default_price in FALLBACK_PRICES:
            if label not in prices:
                prices[label] = {
                    "price":   default_price,
                    "link":    "",
                    "source":  "Tham khảo",
                    "pubDate": latest_date,
                }
                if len(prices) >= 3:
                    break

    def make_search_link(variety: str) -> str:
        q = urllib.parse.quote(f"giá sầu riêng {variety} hôm nay")
        return f"https://www.google.com/search?q={q}&tbm=nws"

    result_list = [
        {
            "variety": k,
            "price":   prices[k]["price"],
            "unit":    "đ/kg",
            "link":    prices[k]["link"] or make_search_link(k),
            "source":  prices[k]["source"],
            "pubDate": prices[k]["pubDate"],
        }
        for k in prices
    ]
    result = {"updated": latest_date, "prices": result_list}
    set_cache("prices", result)
    return result


@router.get("")
async def get_news():
    cached = get_cache("news")
    if cached:
        return cached
    import asyncio
    all_items = []
    async with httpx.AsyncClient(timeout=10, follow_redirects=True,
                                  headers={"User-Agent": "Mozilla/5.0"}) as client:
        for url, label in RSS_FEEDS:
            try:
                resp = await client.get(url)
                if resp.status_code == 200:
                    all_items.extend(parse_rss(resp.text))
            except Exception:
                continue

    # deduplicate by title
    seen = set()
    unique = []
    for item in all_items:
        if item["title"] not in seen:
            seen.add(item["title"])
            unique.append(item)
    unique = unique[:30]

    # Resolve actual article URLs in parallel
    async with httpx.AsyncClient(timeout=8, follow_redirects=True,
                                  headers={"User-Agent": "Mozilla/5.0"}) as client:
        resolved = await asyncio.gather(*[resolve_url(client, i["link"]) for i in unique])

    for i, item in enumerate(unique):
        item["link"] = resolved[i]

    result = {"total": len(unique), "items": unique}
    set_cache("news", result)
    return result

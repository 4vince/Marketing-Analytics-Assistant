# Web scraping utility for competitor analysis — fetches competitor websites and extracts
# structured intelligence signals: meta tags, pricing, navigation, features, social proof.
#
# Each function is isolated and handles errors gracefully. The top-level
# scrape_competitor() orchestrator returns whatever it can; partial results are
# better than raising on the first failure.

import re
import logging
from urllib.parse import urljoin, urlparse
from typing import Any

import httpx
from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)

# ── Constants ──

BROWSER_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/131.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.5",
}

TIMEOUT_SECONDS = 15
MAX_PRODUCT_PAGES = 5
MAX_TEXT_CHARS = 2000

# ── Helpers ──

PRICE_PATTERN = re.compile(
    r"\$\s*(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)\s*(?:/mo(?:nth)?|/yr(?:ear)?|/month|/year|\.00)?",
    re.IGNORECASE,
)


def _normalize_url(url: str) -> str:
    """Ensure URL has a scheme. Default to https."""
    url = url.strip()
    if not url.startswith(("http://", "https://")):
        url = "https://" + url
    return url.rstrip("/")


def _soup_from_html(html: str) -> BeautifulSoup:
    return BeautifulSoup(html, "lxml")


# ── Fetch ──


def fetch_page(url: str) -> str | None:
    """HTTP GET a URL and return the response text, or None on failure."""
    try:
        with httpx.Client(headers=BROWSER_HEADERS, timeout=TIMEOUT_SECONDS, follow_redirects=True) as client:
            resp = client.get(url)
            resp.raise_for_status()
            return resp.text
    except Exception as e:
        logger.warning("[scraper] fetch_page failed for %s: %s", url, e)
        return None


# ── Extractors ──


def extract_meta(soup: BeautifulSoup) -> dict[str, Any]:
    """Extract title, meta description, OG tags, twitter cards, and JSON-LD schemas."""
    meta: dict[str, Any] = {}

    title_tag = soup.find("title")
    meta["title"] = title_tag.get_text(strip=True) if title_tag else None

    desc_tag = soup.find("meta", attrs={"name": "description"})
    meta["description"] = desc_tag.get("content", "").strip() if desc_tag else None

    # Open Graph
    og_tags: dict[str, str] = {}
    for og in soup.find_all("meta", attrs={"property": re.compile(r"^og:")}):
        prop = og.get("property", "").replace("og:", "")
        if prop:
            og_tags[prop] = og.get("content", "").strip()
    meta["og_tags"] = og_tags

    # Twitter cards
    twitter_tags: dict[str, str] = {}
    for tc in soup.find_all("meta", attrs={"name": re.compile(r"^twitter:")}):
        name = tc.get("name", "").replace("twitter:", "")
        if name:
            twitter_tags[name] = tc.get("content", "").strip()
    meta["twitter_tags"] = twitter_tags

    # JSON-LD schema detection
    schemas: list[dict[str, Any]] = []
    for script in soup.find_all("script", type="application/ld+json"):
        try:
            import json
            data = json.loads(script.string)
            schemas.append({
                "type": data.get("@type") or data.get("type"),
                "has_product": data.get("@type") == "Product" or any(
                    item.get("@type") == "Product" for item in (data.get("itemListElement", []) if isinstance(data, dict) else [])
                ),
            } if isinstance(data, dict) else {
                "type": data[0].get("@type") if data else None,
                "has_product": any(item.get("@type") == "Product" for item in data) if data else False,
            } if isinstance(data, list) else {"type": None, "has_product": False})
        except Exception:
            continue
    meta["schemas"] = schemas
    meta["has_schema_markup"] = len(schemas) > 0

    return meta


def extract_visible_text(soup: BeautifulSoup) -> str:
    """Extract clean visible text from a page, stripping scripts, styles, and nav."""
    for tag in soup.find_all(["script", "style", "nav", "footer", "header", "noscript"]):
        tag.decompose()
    text = soup.get_text(separator="\n", strip=True)
    # Collapse multiple newlines
    text = re.sub(r"\n\s*\n", "\n\n", text)
    return text[:MAX_TEXT_CHARS]


def extract_pricing(text: str) -> list[dict[str, Any]]:
    """Extract price mentions from text, categorizing by period."""
    prices: list[dict[str, Any]] = []
    for match in PRICE_PATTERN.finditer(text):
        amount_str = match.group(1).replace(",", "")
        try:
            amount = float(amount_str)
        except ValueError:
            continue
        full = match.group(0)
        if re.search(r"/mo(?:nth)?", full, re.IGNORECASE):
            period = "monthly"
        elif re.search(r"/yr(?:ear)?", full, re.IGNORECASE):
            period = "yearly"
        else:
            period = "one_time"
        prices.append({"amount": amount, "period": period, "context_snippet": full})
    return prices


def extract_navigation(soup: BeautifulSoup) -> list[str]:
    """Extract navigation / category links from header nav elements."""
    categories: list[str] = []
    nav = soup.find("nav")
    if nav:
        for a in nav.find_all("a", href=True):
            text = a.get_text(strip=True)
            if text and len(text) < 60:
                categories.append(text)
    # Also try common nav containers
    for selector in [".nav", ".navigation", ".menu", "#nav", "#navigation", ".navbar", "[role='navigation']"]:
        container = soup.select_one(selector)
        if container and container is not nav:
            for a in container.find_all("a", href=True):
                text = a.get_text(strip=True)
                if text and len(text) < 60:
                    categories.append(text)
    return list(dict.fromkeys(categories))  # deduplicate while preserving order


def extract_product_links(soup: BeautifulSoup, base_url: str) -> list[str]:
    """Discover product page URLs from the page.

    Looks for links containing common e-commerce product path patterns.
    """
    links: list[str] = []
    patterns = re.compile(
        r"/(?:product|products|item|items|p|shop|store|buy|detail|view|sku|catalog)/(?:\w|-)+",
        re.IGNORECASE,
    )
    seen = set()
    for a in soup.find_all("a", href=True):
        href = a["href"].strip()
        full_url = urljoin(base_url, href)
        if patterns.search(full_url) and full_url not in seen:
            seen.add(full_url)
            links.append(full_url)
    return links[:MAX_PRODUCT_PAGES]


def extract_features(text: str) -> list[str]:
    """Identify likely feature/benefit statements from bullet lists or checkmark patterns."""
    features: list[str] = []
    # Lines starting with bullet characters or checkmarks
    for line in text.split("\n"):
        line = line.strip()
        if re.match(r"^[•·●‣➤✔✓✅☑]\s+", line):
            features.append(re.sub(r"^[•·●‣➤✔✓✅☑]\s+", "", line))
        # Lines that look like feature snippets (short, start with a verb or benefit word)
        elif re.match(r"^(Free|Unlimited|Get|Access|Includes|Supports|Built-in|Real-time|24/7|No|Up to|Upgrade|Starting at)", line, re.IGNORECASE):
            if len(line) < 120:
                features.append(line)
    return features[:20]


def extract_social_proof(soup: BeautifulSoup) -> dict[str, Any]:
    """Extract reviews, ratings, testimonials, trust badges, and case study signals."""
    proof: dict[str, Any] = {
        "review_count": None,
        "rating": None,
        "has_testimonials": False,
        "has_trust_badges": False,
        "has_case_studies": False,
        "has_logo_cloud": False,
    }

    text = soup.get_text(separator=" ", strip=True).lower()

    # Review count / rating signals
    rating_match = re.search(r"(\d+(?:\.\d+)?)\s*/\s*5\s*(?:stars?)?", text, re.IGNORECASE)
    if rating_match:
        proof["rating"] = float(rating_match.group(1))

    review_count_match = re.search(r"(\d[\d,]*)\s*(?:reviews?|ratings?)", text, re.IGNORECASE)
    if review_count_match:
        proof["review_count"] = int(review_count_match.group(1).replace(",", ""))

    # Presence signals
    proof["has_testimonials"] = bool(re.search(r"(testimonial|what our clients say|success stories)", text))
    proof["has_trust_badges"] = bool(re.search(r"(ssl secure|trusted|bbb|norton|mcafee|secure checkout)", text))
    proof["has_case_studies"] = bool(re.search(r"(case study|case studies|customer stories)", text))
    proof["has_logo_cloud"] = bool(re.search(r"(as seen in|featured in|trusted by|used by)", text))

    return proof


def extract_cta_analysis(soup: BeautifulSoup) -> list[dict[str, Any]]:
    """Extract primary call-to-action buttons and their text."""
    ctas: list[dict[str, Any]] = []
    for btn in soup.find_all(["a", "button"], class_=re.compile(r"(btn|cta|button|action|primary)", re.IGNORECASE)):
        text = btn.get_text(strip=True)
        if text and len(text) < 60:
            href = btn.get("href", "")
            ctas.append({
                "text": text,
                "url": href if href.startswith("http") else None,
                "type": "button" if btn.name == "button" else "link",
            })
    # Also look for any prominent buttons not caught by class
    for btn in soup.find_all(["a", "button"]):
        text = btn.get_text(strip=True)
        if text and len(text) < 60 and any(kw in text.lower() for kw in ["get started", "sign up", "try", "buy", "shop", "start", "free", "demo", "book"]):
            if not any(c["text"] == text for c in ctas):
                href = btn.get("href", "")
                ctas.append({
                    "text": text,
                    "url": href if href.startswith("http") else None,
                    "type": "button" if btn.name == "button" else "link",
                })
    return ctas[:5]


def extract_page_headings(soup: BeautifulSoup) -> list[str]:
    """Extract h1-h3 headings for content structure analysis."""
    headings: list[str] = []
    for tag in ["h1", "h2", "h3"]:
        for el in soup.find_all(tag):
            text = el.get_text(strip=True)
            if text and len(text) < 200:
                headings.append(f"<{tag}>: {text}")
    return headings[:20]


def extract_images(soup: BeautifulSoup, base_url: str) -> dict[str, Any]:
    """Extract image metadata signals."""
    imgs = soup.find_all("img")
    total = len(imgs)
    with_alt = sum(1 for img in imgs if img.get("alt"))
    return {
        "total_images": total,
        "images_with_alt": with_alt,
        "alt_text_ratio": round(with_alt / total, 2) if total else 0,
    }


# ── Page Scraper ──


def scrape_page(url: str) -> dict[str, Any]:
    """Scrape a single page and return structured data."""
    result: dict[str, Any] = {"url": url, "error": None}

    html = fetch_page(url)
    if html is None:
        result["error"] = "Failed to fetch page"
        return result

    try:
        soup = _soup_from_html(html)
        result["meta"] = extract_meta(soup)
        result["pricing"] = extract_pricing(html)
        result["features"] = extract_features(extract_visible_text(soup))
        result["headings"] = extract_page_headings(soup)
        result["images"] = extract_images(soup, url)
        result["cta_buttons"] = extract_cta_analysis(soup)
        result["word_count"] = len(extract_visible_text(soup).split())
        result["navigation"] = extract_navigation(soup)
        result["social_proof"] = extract_social_proof(soup)
        result["page_text_snippet"] = extract_visible_text(soup)[:800]
    except Exception as e:
        logger.warning("[scraper] scrape_page parse error for %s: %s", url, e)
        result["error"] = f"Parse error: {e}"

    return result


# ── Top-Level Orchestrator ──


def scrape_competitor(url: str) -> dict[str, Any]:
    """Scrape a competitor's website for competitive intelligence.

    Fetches the homepage, extracts signals, discovers product pages,
    and fetches up to MAX_PRODUCT_PAGES additional pages.

    Returns a structured dict — partial results on error (never raises).
    """
    url = _normalize_url(url)
    parsed = urlparse(url)
    base_domain = f"{parsed.scheme}://{parsed.netloc}"

    result: dict[str, Any] = {
        "domain": url,
        "homepage": None,
        "product_pages": [],
        "errors": [],
        "scrape_complete": False,
    }

    # 1. Scrape homepage
    homepage = scrape_page(url)
    result["homepage"] = homepage

    if homepage.get("error"):
        result["errors"].append(f"Homepage: {homepage['error']}")

    # 2. Discover product pages from homepage
    product_urls: list[str] = []
    if not homepage.get("error") and homepage.get("navigation"):
        try:
            html = fetch_page(url)
            if html:
                soup = _soup_from_html(html)
                product_urls = extract_product_links(soup, url)
        except Exception as e:
            logger.warning("[scraper] product discovery failed: %s", e)

    # Also try common paths if none found
    if not product_urls:
        common_paths = ["/products", "/shop", "/store", "/catalog", "/all"]
        for path in common_paths:
            candidate = f"{base_domain}{path}"
            html = fetch_page(candidate)
            if html:
                try:
                    soup = _soup_from_html(html)
                    product_urls = extract_product_links(soup, candidate)
                    if product_urls:
                        # Also capture this catalog page
                        result["product_pages"].append({
                            "url": candidate,
                            "type": "catalog",
                            "page_text_snippet": extract_visible_text(soup)[:500],
                        })
                        break
                except Exception:
                    continue

    # 3. Fetch discovered product pages
    scraped_count = 0
    for pu in product_urls[:MAX_PRODUCT_PAGES]:
        if pu == url or any(pp.get("url") == pu for pp in result["product_pages"]):
            continue
        page_data = scrape_page(pu)
        page_data["type"] = "product"
        result["product_pages"].append(page_data)
        scraped_count += 1
        if page_data.get("error"):
            result["errors"].append(f"Product page {pu}: {page_data['error']}")

    # 4. Aggregate pricing across all pages
    all_pricing: list[dict[str, Any]] = list(homepage.get("pricing", []))
    for pp in result["product_pages"]:
        all_pricing.extend(pp.get("pricing", []))
    result["all_pricing"] = all_pricing

    # 5. Estimate product catalog breadth
    result["estimated_product_count"] = len(product_urls) if product_urls else None

    # 6. Aggregate features across pages
    all_features: list[str] = list(homepage.get("features", []))
    for pp in result["product_pages"]:
        all_features.extend(pp.get("features", []))
    result["all_features"] = list(dict.fromkeys(all_features))[:30]

    # 7. Summary
    result["pages_scraped"] = 1 + scraped_count
    result["scrape_complete"] = len(result["errors"]) == 0
    result["has_data"] = not homepage.get("error") or len(result["product_pages"]) > 0

    logger.info(
        "[scraper] scraped %s → %d pages (%d errors)",
        url, result["pages_scraped"], len(result["errors"]),
    )
    return result

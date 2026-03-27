var BASE_URL = "https://requiemtls.com";

function execute(key, page) {
  var query = (key || "").trim();
  if (!query) {
    return Response.success([], null);
  }

  var currentPage = normalizePage(page);
  var url = buildSearchUrl(query, currentPage);

  try {
    var response = fetch(url, {
      headers: {
        Referer: BASE_URL + "/",
      },
    });

    if (!response || !response.ok) {
      return Response.error("Failed to load search results");
    }

    var doc = response.html();
    var items = parseSearchResults(doc);
    var next = getNextPage(doc, currentPage);

    return Response.success(items, next);
  } catch (err) {
    return Response.error("Search failed: " + err);
  }
}

function normalizePage(page) {
  var num = parseInt(page, 10);
  return isNaN(num) || num < 1 ? 1 : num;
}

function buildSearchUrl(query, page) {
  var encoded = encodeURIComponent(query);
  var url = BASE_URL + "/?s=" + encoded + "&post_type=wp-manga";
  if (page > 1) {
    url += "&paged=" + page;
  }
  return url;
}

function parseSearchResults(doc) {
  var results = [];
  var seen = {};

  var selectors = [
    ".listupd .bs .bsx",
    ".listupd .bsx",
    ".bs .bsx",
    ".page-item-detail",
    ".search-page .bsx",
    ".listo .bsx",
  ];

  for (var i = 0; i < selectors.length; i++) {
    var nodes = doc.select(selectors[i]);
    if (nodes && nodes.size() > 0) {
      collectItems(nodes, results, seen);
      if (results.length > 0) {
        return results;
      }
    }
  }

  var fallbackLinks = doc.select('a[href*="/series/"], a[href*="requiemtls.com/series/"]');
  if (fallbackLinks && fallbackLinks.size() > 0) {
    collectFallbackItems(fallbackLinks, results, seen);
  }

  return results;
}

function collectItems(nodes, results, seen) {
  for (var i = 0; i < nodes.size(); i++) {
    var node = nodes.get(i);

    var linkEl = firstOf(node, [
      "a[href].tip",
      ".tt a[href]",
      ".bsx a[href]",
      "a[href]"
    ]);

    if (!linkEl) continue;

    var link = absoluteUrl(linkEl.attr("href"));
    if (!isSeriesUrl(link) || seen[link]) continue;

    var name = extractName(node, linkEl);
    if (!name) continue;

    var cover = extractCover(node);
    var description = extractDescription(node);

    seen[link] = true;
    results.push({
      name: cleanText(name),
      link: link,
      cover: cover,
      description: cleanText(description || "")
    });
  }
}

function collectFallbackItems(links, results, seen) {
  for (var i = 0; i < links.size(); i++) {
    var linkEl = links.get(i);
    var link = absoluteUrl(linkEl.attr("href"));

    if (!isSeriesUrl(link) || seen[link]) continue;

    var name = cleanText(linkEl.text());
    if (!name) continue;

    seen[link] = true;
    results.push({
      name: name,
      link: link,
      cover: "",
      description: ""
    });
  }
}

function extractName(node, linkEl) {
  var candidates = [
    textOf(node, ".tt"),
    textOf(node, ".tt h2"),
    textOf(node, ".bsx .tt"),
    textOf(node, ".bsx .bigor .tt"),
    textOf(node, ".tooltip")
  ];

  for (var i = 0; i < candidates.length; i++) {
    if (cleanText(candidates[i])) {
      return candidates[i];
    }
  }

  var titleAttr = linkEl.attr("title");
  if (cleanText(titleAttr)) return titleAttr;

  return linkEl.text();
}

function extractCover(node) {
  var img = firstOf(node, ["img"]);
  if (!img) return "";

  var attrs = ["src", "data-src", "data-lazy-src", "data-cfsrc"];
  for (var i = 0; i < attrs.length; i++) {
    var value = img.attr(attrs[i]);
    if (value) return absoluteUrl(value);
  }

  return "";
}

function extractDescription(node) {
  var parts = [];

  var descSelectors = [
    ".epxs",
    ".numscore",
    ".bigor .adds",
    ".limit",
    ".typez",
    ".status"
  ];

  for (var i = 0; i < descSelectors.length; i++) {
    var text = textOf(node, descSelectors[i]);
    text = cleanText(text);
    if (text) parts.push(text);
  }

  return uniqueJoin(parts, " • ");
}

function getNextPage(doc, currentPage) {
  var nextLink = firstOf(doc, [
    ".pagination .next",
    ".pagination a.next",
    ".nav-previous a",
    "a.next.page-numbers"
  ]);

  if (nextLink) {
    var href = nextLink.attr("href");
    if (href) return String(currentPage + 1);
  }

  var current = doc.select(".pagination .current, .pagination .page-numbers.current");
  if (current && current.size() > 0) {
    var last = doc.select(".pagination a.page-numbers");
    if (last && last.size() > 0) {
      var maxPage = currentPage;
      for (var i = 0; i < last.size(); i++) {
        var text = cleanText(last.get(i).text());
        var num = parseInt(text, 10);
        if (!isNaN(num) && num > maxPage) {
          maxPage = num;
        }
      }
      if (currentPage < maxPage) {
        return String(currentPage + 1);
      }
    }
  }

  return null;
}

function firstOf(root, selectors) {
  for (var i = 0; i < selectors.length; i++) {
    var el = root.select(selectors[i]).first();
    if (el) return el;
  }
  return null;
}

function textOf(root, selector) {
  var el = root.select(selector).first();
  return el ? el.text() : "";
}

function absoluteUrl(url) {
  if (!url) return "";
  if (url.indexOf("http://") === 0 || url.indexOf("https://") === 0) {
    return url;
  }
  if (url.indexOf("//") === 0) {
    return "https:" + url;
  }
  if (url.charAt(0) === "/") {
    return BASE_URL + url;
  }
  return BASE_URL + "/" + url;
}

function isSeriesUrl(url) {
  return url.indexOf("/series/") >= 0;
}

function cleanText(text) {
  if (!text) return "";
  return String(text)
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function uniqueJoin(items, separator) {
  var out = [];
  var map = {};

  for (var i = 0; i < items.length; i++) {
    var value = cleanText(items[i]);
    if (!value || map[value]) continue;
    map[value] = true;
    out.push(value);
  }

  return out.join(separator);
}

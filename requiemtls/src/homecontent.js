var BASE_URL = "https://requiemtls.com";

function execute(url, page) {
  var state = parseState(url, page);
  var targetUrl = state.pageUrl || state.url || BASE_URL;
  var section = state.section || detectSectionFromUrl(targetUrl);

  try {
    var response = fetch(targetUrl, {
      headers: {
        Referer: BASE_URL + "/",
        "User-Agent": UserAgent.android(),
      },
    });

    if (!response || !response.ok) {
      return Response.error(
        "Failed to load home content: HTTP " +
          (response ? response.status : "unknown"),
      );
    }

    var doc = response.html();
    var items = parseSectionItems(doc, section);

    if (items.length === 0 && section !== "latest") {
      items = parseSectionItems(doc, "latest");
    }

    var next = buildNextState(doc, state, section, items.length > 0);

    return Response.success(items, next);
  } catch (e) {
    return Response.error("Home parser error: " + e);
  }
}

function parseState(url, page) {
  var state = {
    url: BASE_URL,
    pageUrl: null,
    pageNumber: 1,
    section: "",
  };

  var initial = String(url || "").trim();
  if (initial) {
    if (initial.charAt(0) === "{") {
      try {
        var inputObj = JSON.parse(initial);
        state.url = normalizeUrl(inputObj.url || BASE_URL);
        state.pageUrl = normalizeUrl(inputObj.pageUrl || "");
        state.pageNumber = parseInt(inputObj.pageNumber, 10) || 1;
        state.section = cleanText(inputObj.section || "");
      } catch (e) {
        state.url = normalizeUrl(initial);
      }
    } else {
      state.url = normalizeUrl(initial);
    }
  }

  if (page) {
    var raw = String(page).trim();

    if (raw.charAt(0) === "{") {
      try {
        var obj = JSON.parse(raw);
        state.pageUrl = normalizeUrl(obj.pageUrl || "");
        state.pageNumber =
          parseInt(obj.pageNumber, 10) || state.pageNumber || 1;
        state.section = cleanText(obj.section || state.section || "");
        if (obj.url) state.url = normalizeUrl(obj.url);
      } catch (e) {}
    } else if (/^https?:\/\//i.test(raw)) {
      state.pageUrl = raw;
      state.pageNumber = extractPageNumber(raw) || 2;
    } else if (/^\d+$/.test(raw)) {
      state.pageNumber = parseInt(raw, 10);
    }
  }

  if (!state.pageUrl) {
    state.pageUrl = state.url || BASE_URL;
  }

  return state;
}

function detectSectionFromUrl(url) {
  url = String(url || "").toLowerCase();

  if (url.indexOf("/series/") >= 0) return "series_updates";
  if (url.indexOf("popular_weekly") >= 0) return "popular_weekly";
  if (url.indexOf("popular_monthly") >= 0) return "popular_monthly";
  if (url.indexOf("popular_all") >= 0) return "popular_all";
  if (url.indexOf("new_series") >= 0) return "new_series";

  return "latest";
}

function parseSectionItems(doc, section) {
  if (section === "series_updates") {
    return parseCards(doc, [".listupd .bs .bsx", ".listupd .bsx", ".bs .bsx"]);
  }

  if (section === "new_series") {
    return parseCards(doc, [
      ".listupd .bs .bsx",
      ".listupd .bsx",
      ".bs .bsx",
      ".listo .bsx",
    ]);
  }

  if (section === "popular_weekly") {
    return parseLinks(doc, [
      ".ts-wpop-weekly li",
      ".popular .weekly li",
      ".wpop-weekly li",
      ".serieslist.pop ul li",
    ]);
  }

  if (section === "popular_monthly") {
    return parseLinks(doc, [
      ".ts-wpop-monthly li",
      ".popular .monthly li",
      ".wpop-monthly li",
      ".serieslist.pop ul li",
    ]);
  }

  if (section === "popular_all") {
    return parseLinks(doc, [
      ".ts-wpop-alltime li",
      ".popular .all li",
      ".wpop-all li",
      ".serieslist.pop ul li",
    ]);
  }

  return parseLatest(doc);
}

function parseLatest(doc) {
  var items = parseLinks(doc, [
    ".listupd .utao .uta .luf ul li",
    ".utao .uta .luf ul li",
    ".releases ul li",
    ".bxcl ul li",
  ]);

  if (items.length > 0) return items;

  return parseCards(doc, [".listupd .bs .bsx", ".listupd .bsx", ".bs .bsx"]);
}

function parseCards(doc, selectors) {
  var items = [];
  var seen = {};

  for (var s = 0; s < selectors.length; s++) {
    var nodes = doc.select(selectors[s]);
    if (!nodes || nodes.size() === 0) continue;

    for (var i = 0; i < nodes.size(); i++) {
      var node = nodes.get(i);
      var item = cardToItem(node);
      if (!item || !item.link || seen[item.link]) continue;
      seen[item.link] = true;
      items.push(item);
    }

    if (items.length > 0) return items;
  }

  return items;
}

function parseLinks(doc, selectors) {
  var items = [];
  var seen = {};

  for (var s = 0; s < selectors.length; s++) {
    var nodes = doc.select(selectors[s]);
    if (!nodes || nodes.size() === 0) continue;

    for (var i = 0; i < nodes.size(); i++) {
      var node = nodes.get(i);
      var item = linkItemToEntry(node);
      if (!item || !item.link || seen[item.link]) continue;
      seen[item.link] = true;
      items.push(item);
    }

    if (items.length > 0) return items;
  }

  return items;
}

function cardToItem(node) {
  var linkEl =
    node.selectFirst(".tt a[href]") ||
    node.selectFirst("a[href].tip") ||
    node.selectFirst("a[href]");

  if (!linkEl) return null;

  var link = normalizeUrl(linkEl.attr("href"));
  if (!link || link.indexOf("/series/") < 0) return null;

  var name =
    textOf(node.selectFirst(".tt")) ||
    textOf(node.selectFirst("h2")) ||
    textOf(node.selectFirst("h3")) ||
    cleanText(linkEl.attr("title")) ||
    textOf(linkEl);

  if (!name) return null;

  var cover = getImage(node);
  var description = uniqueJoin(
    [
      textOf(node.selectFirst(".epxs")),
      textOf(node.selectFirst(".numscore")),
      textOf(node.selectFirst(".typez")),
      textOf(node.selectFirst(".adds")),
      textOf(node.selectFirst(".limit")),
    ],
    " • ",
  );

  return {
    name: name,
    link: link,
    cover: cover,
    description: description,
  };
}

function linkItemToEntry(node) {
  var linkEl = node.selectFirst("a[href]");
  if (!linkEl) return null;

  var link = normalizeUrl(linkEl.attr("href"));
  if (!link || link.indexOf("/series/") < 0) return null;

  var name =
    textOf(node.selectFirst("h2")) ||
    textOf(node.selectFirst("h3")) ||
    textOf(node.selectFirst("h4")) ||
    textOf(node.selectFirst(".tt")) ||
    textOf(linkEl);

  if (!name) return null;

  var cover = getImage(node);
  var description = uniqueJoin(
    [
      textOf(node.selectFirst(".genre")),
      textOf(node.selectFirst(".epxs")),
      textOf(node.selectFirst(".numscore")),
      textOf(node.selectFirst(".chapter")),
      textOf(node.selectFirst(".adds")),
    ],
    " • ",
  );

  return {
    name: name,
    link: link,
    cover: cover,
    description: description,
  };
}

function buildNextState(doc, state, section, hasItems) {
  if (!hasItems) return null;
  if (section !== "series_updates" && section !== "new_series") return null;

  var nextUrl =
    attrOf(doc.selectFirst(".pagination a.next"), "href") ||
    attrOf(doc.selectFirst("a.next.page-numbers"), "href") ||
    attrOf(doc.selectFirst(".nav-links a.next"), "href");

  if (!nextUrl) return null;

  return JSON.stringify({
    url: state.url || BASE_URL,
    pageUrl: normalizeUrl(nextUrl),
    pageNumber: (state.pageNumber || 1) + 1,
    section: section,
  });
}

function getImage(node) {
  var img = node.selectFirst("img");
  if (!img) return "";

  var src =
    attrOf(img, "src") ||
    attrOf(img, "data-src") ||
    attrOf(img, "data-lazy-src") ||
    attrOf(img, "data-cfsrc");

  return normalizeUrl(src);
}

function extractPageNumber(url) {
  var match = String(url || "").match(/\/page\/(\d+)\//i);
  return match ? parseInt(match[1], 10) : 0;
}

function normalizeUrl(url) {
  if (!url) return "";
  url = String(url).trim();

  if (/^https?:\/\//i.test(url)) return url;
  if (url.indexOf("//") === 0) return "https:" + url;
  if (url.charAt(0) === "/") return BASE_URL + url;

  return BASE_URL + "/" + url.replace(/^\/+/, "");
}

function textOf(el) {
  if (!el) return "";
  return cleanText(el.text());
}

function attrOf(el, name) {
  if (!el) return "";
  var value = el.attr(name);
  return value ? String(value).trim() : "";
}

function cleanText(text) {
  if (!text) return "";
  return String(text)
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function uniqueJoin(values, separator) {
  var out = [];
  var seen = {};

  for (var i = 0; i < values.length; i++) {
    var value = cleanText(values[i]);
    if (!value || seen[value]) continue;
    seen[value] = true;
    out.push(value);
  }

  return out.join(separator || " ");
}

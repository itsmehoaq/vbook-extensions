function textOf(element) {
  return element ? element.text().trim() : "";
}

function attrOf(element, name) {
  if (!element) return "";
  var value = element.attr(name);
  return value ? value.trim() : "";
}

function absoluteUrl(url) {
  if (!url) return "";
  if (/^https?:\/\//i.test(url)) return url;
  if (url.indexOf("//") === 0) return "https:" + url;
  if (url.charAt(0) === "/") return "https://requiemtls.com" + url;
  return "https://requiemtls.com/" + url.replace(/^\/+/, "");
}

function cleanText(text) {
  return (text || "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractLabelValue(doc, label) {
  var nodes = doc.select(".spe span, .tsinfo .imptdt span, .infox .spe span");
  for (var i = 0; i < nodes.size(); i++) {
    var item = nodes.get(i);
    var raw = cleanText(item.text());
    if (!raw) continue;

    var lower = raw.toLowerCase();
    var target = label.toLowerCase();
    if (lower.indexOf(target) !== 0) continue;

    var value = raw
      .substring(label.length)
      .replace(/^[:\s-]+/, "")
      .trim();
    if (!value) {
      var links = item.select("a");
      if (links && links.size() > 0) {
        var parts = [];
        for (var j = 0; j < links.size(); j++) {
          var t = cleanText(links.get(j).text());
          if (t) parts.push(t);
        }
        value = parts.join(", ");
      }
    }
    if (value) return value;
  }
  return "";
}

function extractGenres(doc) {
  var genres = [];
  var seen = {};

  var selectors = [
    ".genxed a",
    ".infox .mgen a",
    ".seriestugenre a",
    ".wd-full .mgen a",
  ];

  for (var s = 0; s < selectors.length; s++) {
    var links = doc.select(selectors[s]);
    for (var i = 0; i < links.size(); i++) {
      var a = links.get(i);
      var title = cleanText(a.text());
      var href = absoluteUrl(attrOf(a, "href"));
      if (!title || !href || seen[href]) continue;
      seen[href] = true;
      genres.push({
        title: title,
        input: href,
        script: "search.js",
      });
    }
    if (genres.length > 0) break;
  }

  if (genres.length === 0) {
    var genreText = extractLabelValue(doc, "Genres");
    if (genreText) {
      var parts = genreText.split(",");
      for (var p = 0; p < parts.length; p++) {
        var title = cleanText(parts[p]);
        if (!title) continue;
        genres.push({
          title: title,
          input: title,
          script: "search.js",
        });
      }
    }
  }

  return genres;
}

function extractRecommendations(doc) {
  var items = [];
  var seen = {};

  var cards = doc.select(
    ".releases.recommend ul li, .serieslist ul li, .listupd .bs .bsx, .recommended .bsx",
  );
  for (var i = 0; i < cards.size(); i++) {
    var card = cards.get(i);
    var linkEl = card.select("a").first();
    if (!linkEl) continue;

    var link = absoluteUrl(attrOf(linkEl, "href"));
    var name =
      cleanText(textOf(card.select("h2").first())) ||
      cleanText(textOf(card.select(".tt").first())) ||
      cleanText(textOf(linkEl));

    if (!link || !name || seen[link]) continue;
    seen[link] = true;

    var cover =
      absoluteUrl(attrOf(card.select("img").first(), "src")) ||
      absoluteUrl(attrOf(card.select("img").first(), "data-src"));

    var description =
      cleanText(textOf(card.select(".limit").first())) ||
      cleanText(textOf(card.select(".epxs").first()));

    items.push({
      name: name,
      link: link,
      host: "https://requiemtls.com",
      cover: cover,
      description: description,
    });
  }

  return items;
}

function extractDescription(doc) {
  var synopsis = doc
    .select(".entry-content, .desc, .wd-full .entry-content")
    .first();
  if (synopsis) {
    return cleanText(synopsis.text());
  }

  var headers = doc.select("h2, h3");
  for (var i = 0; i < headers.size(); i++) {
    var h = headers.get(i);
    var title = cleanText(h.text()).toLowerCase();
    if (title.indexOf("synopsis") >= 0) {
      var next = h.nextElementSibling();
      if (next) return cleanText(next.text());
    }
  }

  return "";
}

function extractTitle(doc) {
  return (
    cleanText(textOf(doc.select("h1.entry-title").first())) ||
    cleanText(textOf(doc.select("h1").first())) ||
    cleanText(textOf(doc.select("title").first()))
  );
}

function extractCover(doc) {
  var selectors = [
    ".thumbook img",
    ".thumb img",
    ".bigcontent img",
    ".infox img",
  ];

  for (var i = 0; i < selectors.length; i++) {
    var img = doc.select(selectors[i]).first();
    var src =
      absoluteUrl(attrOf(img, "src")) ||
      absoluteUrl(attrOf(img, "data-src")) ||
      absoluteUrl(attrOf(img, "data-lazy-src"));
    if (src) return src;
  }

  return "";
}

function buildDetailText(doc) {
  var fields = [];
  var labels = [
    "Status",
    "Released",
    "Native Language",
    "Posted by",
    "Posted on",
    "Updated on",
    "View",
  ];

  for (var i = 0; i < labels.length; i++) {
    var value = extractLabelValue(doc, labels[i]);
    if (value) fields.push(labels[i] + ": " + value);
  }

  return fields.join("\n");
}

function isOngoing(doc) {
  var status = extractLabelValue(doc, "Status");
  if (!status) return true;

  status = status.toLowerCase();
  if (status.indexOf("ongoing") >= 0) return true;
  if (status.indexOf("completed") >= 0 || status.indexOf("complete") >= 0)
    return false;

  return true;
}

// url: url của truyện, url sẽ tự động được bỏ ký tự / ở cuối
function execute(url) {
  try {
    var response = fetch(url);
    if (!response || !response.ok) {
      return Response.error("Failed to load series detail: " + url);
    }

    var doc = response.html();
    var name = extractTitle(doc);
    var cover = extractCover(doc);
    var description = extractDescription(doc);
    var detail = buildDetailText(doc);
    var genres = extractGenres(doc);

    return Response.success({
      name: name,
      cover: cover,
      host: "https://requiemtls.com",
      author: extractLabelValue(doc, "Posted by") || "Requiem Translations",
      description: description,
      detail: detail,
      ongoing: isOngoing(doc),
      genres: genres,
    });
  } catch (e) {
    return Response.error("Detail parser error: " + e);
  }
}

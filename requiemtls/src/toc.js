function execute(url) {
  var doc = fetch(normalizeUrl(url)).html();
  var chapters = [];
  var seen = {};

  var items = doc.select(".eplister li, .bxcl li");
  if (items && items.size() > 0) {
    for (var i = items.size() - 1; i >= 0; i--) {
      var item = items.get(i);
      var linkEl = firstSelect(item, "a[href]");
      if (!linkEl) continue;

      var chapterUrl = absoluteUrl(linkEl.attr("href"));
      if (!chapterUrl || seen[chapterUrl]) continue;
      seen[chapterUrl] = true;

      var name = textOf(firstSelect(item, ".epl-title"));
      if (!name) {
        name = textOf(linkEl);
      }

      var number = textOf(firstSelect(item, ".epl-num"));
      if (number) {
        if (name && name.toLowerCase().indexOf(number.toLowerCase()) !== 0) {
          name = number + " - " + name;
        } else if (!name) {
          name = number;
        }
      }

      chapters.push({
        name: cleanText(name) || chapterUrl,
        url: chapterUrl,
      });
    }
  }

  if (chapters.length === 0) {
    var fallbackLinks = doc.select("a[href*='episode-'], a[href*='chapter-']");
    for (var j = fallbackLinks.size() - 1; j >= 0; j--) {
      var a = fallbackLinks.get(j);
      var href = absoluteUrl(a.attr("href"));
      if (!href || seen[href]) continue;
      seen[href] = true;

      var title = cleanText(textOf(a));
      if (!title) continue;

      chapters.push({
        name: title,
        url: href,
      });
    }
  }

  if (chapters.length === 0) {
    return Response.error("No chapters found");
  }

  return Response.success(chapters);
}

function normalizeUrl(url) {
  if (!url) return "https://requiemtls.com";
  return String(url).replace(/\/+$/, "") + "/";
}

function absoluteUrl(url) {
  if (!url) return "";
  url = String(url).trim();
  if (url.indexOf("http://") === 0 || url.indexOf("https://") === 0) {
    return url;
  }
  if (url.indexOf("//") === 0) {
    return "https:" + url;
  }
  if (url.charAt(0) === "/") {
    return "https://requiemtls.com" + url;
  }
  return "https://requiemtls.com/" + url.replace(/^\/+/, "");
}

function firstSelect(root, selector) {
  if (!root) return null;
  var result = root.select(selector);
  if (!result || result.size() === 0) return null;
  return result.first();
}

function textOf(el) {
  if (!el) return "";
  return cleanText(el.text());
}

function cleanText(text) {
  if (!text) return "";
  return String(text)
    .replace(/\s+/g, " ")
    .replace(/\u00a0/g, " ")
    .trim();
}

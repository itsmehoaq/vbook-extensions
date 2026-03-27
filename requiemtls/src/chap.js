function execute(url) {
  var response = fetch(url, {
    headers: {
      Referer: "https://requiemtls.com/",
      "User-Agent": UserAgent.android()
    }
  });

  if (!response.ok) {
    return Response.error("Failed to load chapter: HTTP " + response.status);
  }

  var doc = response.html();
  var contentEl =
    doc.selectFirst(".epcontent") ||
    doc.selectFirst(".entry-content") ||
    doc.selectFirst("article .entry-content") ||
    doc.selectFirst(".rdminimal") ||
    doc.selectFirst(".reading-content");

  if (contentEl == null) {
    return Response.error("Chapter content not found");
  }

  contentEl.select(
    "script, style, iframe, form, button, .sharedaddy, .post-tags, .post-nav, .nav_apb, .eplister, .bixbox, .commentx, .comment-respond, .adsbygoogle, .code-block, .wp-block-buttons"
  ).remove();

  var html = contentEl.html();

  html = html
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, "");

  html = Html.clean(html, ["p", "br", "div", "span", "strong", "em", "b", "i", "u", "blockquote", "h3", "h4"]);

  if (html == null || html.trim() === "") {
    var text = contentEl.text();
    if (text == null || text.trim() === "") {
      return Response.error("Chapter content is empty");
    }
    return Response.success(text.trim());
  }

  return Response.success(html);
}

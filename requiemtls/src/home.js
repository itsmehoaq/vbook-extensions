function execute() {
  return Response.success([
    {
      title: "Latest Release",
      input: '{"url":"https://requiemtls.com/","section":"latest"}',
      script: "homecontent.js",
    },
    {
      title: "Popular - Weekly",
      input: '{"url":"https://requiemtls.com/","section":"popular_weekly"}',
      script: "homecontent.js",
    },
    {
      title: "Popular - Monthly",
      input: '{"url":"https://requiemtls.com/","section":"popular_monthly"}',
      script: "homecontent.js",
    },
    {
      title: "Popular - All",
      input: '{"url":"https://requiemtls.com/","section":"popular_all"}',
      script: "homecontent.js",
    },
    {
      title: "New Series",
      input: '{"url":"https://requiemtls.com/","section":"new_series"}',
      script: "homecontent.js",
    },
    {
      title: "Series Updates",
      input:
        '{"url":"https://requiemtls.com/series/?status=&order=update","section":"series_updates"}',
      script: "homecontent.js",
    },
  ]);
}

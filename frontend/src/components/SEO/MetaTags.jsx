import { Helmet } from "react-helmet-async";

function MetaTags({
  tabTitle,
  tabDescription,
  tabKeywords,
  tabCanonicalHref,
  authorName,
  appName,
  tabOgTitle,
  tabOgDescription,
  tabOgImg,
  tabOgUrl,
  tabOgType = "website",
  tabOgSitename,
  twitterSummaryCard,
  twitterTitle,
  twitterDescription,
  twitterImage,
}) {
  return (
    <div>
      <Helmet>
        <title>{tabTitle}</title>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="description" content={tabDescription} />
        <meta name="robots" content="index, follow" />
        <meta name="keywords" content={tabKeywords} />
        <link rel="canonical" href={tabCanonicalHref} />
        <meta name="author" content={authorName} />
        <meta name="application-name" content={appName} />
        <meta property="og:title" content={tabOgTitle} />
        <meta property="og:description" content={tabOgDescription} />
        <meta property="og:image" content={tabOgImg} />
        <meta property="og:url" content={tabOgUrl} />
        <meta property="og:type" content={tabOgType} />
        <meta property="og:site_name" content={tabOgSitename} />
        <meta name="twitter:card" content={twitterSummaryCard} />
        <meta name="twitter:title" content={twitterTitle} />
        <meta name="twitter:description" content={twitterDescription} />
        <meta name="twitter:image" content={twitterImage} />
      </Helmet>
    </div>
  );
}

export default MetaTags;

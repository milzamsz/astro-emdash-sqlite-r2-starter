import rss from "@astrojs/rss";
import { siteConfig } from "../config/site.config";
import { getAllPosts } from "../lib/cms";

export async function GET() {
  // Published posts from EmDash, newest first.
  const publishedPosts = await getAllPosts();

  return rss({
    title: siteConfig.name,
    description: siteConfig.description,
    site: siteConfig.url,
    items: publishedPosts.map((post) => ({
      title: post.data.title,
      description: post.data.description,
      link: `/blog/${post.id}`,
      pubDate: new Date(post.data.publishDate),
      categories: post.data.tags ?? [],
      author: post.data.author,
      customData: post.data.featured ? "<featured>true</featured>" : "",
    })),
    customData: `<language>${siteConfig.i18n.defaultLocale}</language>`,
  });
}

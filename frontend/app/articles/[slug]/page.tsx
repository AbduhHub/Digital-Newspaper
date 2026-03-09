import Header from "../../../components/Header";
import Link from "next/link";
import HomeAd from "../../../components/HomeAd";
import ArticleLayout from "../../../components/layouts/ArticleLayout";
import ArticleCard from "components/ArticleCard";

async function getArticle(slug: string) {
  const API = process.env.NEXT_PUBLIC_API;

  try {
    const res = await fetch(`${API}/articles/${slug}`, {
      next: { revalidate: 60 },
    });

    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export default async function ArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const article = await getArticle(slug);

  const relatedArticlesRes = await fetch(
    `${process.env.NEXT_PUBLIC_API}/articles?page=1&limit=6`,
    { cache: "no-store" },
  );

  const allArticles = relatedArticlesRes.ok
    ? await relatedArticlesRes.json()
    : [];

  if (!article) {
    return <div style={{ padding: 20 }}>خبر دستیاب نہیں</div>;
  }

  return (
    <>
      <Header />

      <ArticleLayout sidebar={<HomeAd placement="sidebar" />}>
        <article className="article-container">
          <h1
            style={{ fontSize: "42px", marginBottom: "20px" }}
            className="article-title"
          >
            {article.title}
          </h1>

          {article.image && (
            <img
              src={article.image}
              className="article-image"
              alt={article.title}
            />
          )}

          <p className="article-body">{article.content}</p>

          <HomeAd placement="between_pages" />

          <Link href="/" className="primary-btn">
            آج کا اخبار پڑھیں
          </Link>
        </article>

        <section className="related-section">
          <h2>دیگر خبریں</h2>
          <div className="related-grid">
            {allArticles
              .filter((a: any) => a.slug !== slug)
              .slice(0, 6)
              .map((a: any) => (
                <ArticleCard key={a.slug} article={a} />
              ))}
          </div>
        </section>
      </ArticleLayout>
    </>
  );
}

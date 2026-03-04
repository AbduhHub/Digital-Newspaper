import Link from "next/link";

export default function ArticleCard({ article }: any) {
  return (
    <Link href={`/articles/${article.slug}`} className="article-card">
      {article.image && (
        <img
          src={article.image}
          alt={article.title}
          className="article-card-img"
          loading="lazy"
        />
      )}

      <div className="article-card-body">
        <h3>{article.title}</h3>
        <p>{article.content.slice(0, 120)}...</p>
        <span className="read-more">مزید پڑھیں →</span>
      </div>
    </Link>
  );
}

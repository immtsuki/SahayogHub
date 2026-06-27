import type { ProfilePost } from '../types';

interface Props { post: ProfilePost }

export default function ProfilePostCard({ post }: Props) {
  const isLost = post.status === 'LOST';

  return (
    <article className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow duration-200 cursor-pointer">
      <div className="relative">
        <img
          src={post.image}
          alt={post.title}
          className="w-full h-44 md:h-48 object-cover"
          loading="lazy"
        />
        <span
          className={`absolute top-2.5 left-2.5 text-white text-[10px] font-bold px-2.5 py-1 rounded-full tracking-wide ${
            isLost ? 'bg-red-500' : 'bg-green-500'
          }`}
        >
          {post.status}
        </span>
      </div>
      <div className="px-3 pt-3 pb-3.5">
        <p className="text-sm font-bold text-gray-900 leading-snug">{post.title}</p>
        {/* Desktop: date | Mobile: location · postedAgo */}
        <p className="hidden md:block text-xs text-gray-400 mt-1">{post.date}</p>
        <p className="md:hidden text-[11px] text-gray-400 mt-0.5">{post.location} · {post.postedAgo}</p>
      </div>
    </article>
  );
}

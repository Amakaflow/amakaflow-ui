import { useState } from 'react';
import { Avatar, AvatarFallback } from '../ui/avatar';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader } from '../ui/card';
import { Badge } from '../ui/badge';
import { Dumbbell, Heart, MessageCircle, Share2 } from 'lucide-react';

interface Post {
  id: string;
  author: string;
  initials: string;
  time: string;
  workout: string;
  description: string;
  likes: number;
  comments: number;
  liked: boolean;
  tags: string[];
}

const MOCK_POSTS: Post[] = [
  {
    id: '1',
    author: 'Jade Okonkwo',
    initials: 'JO',
    time: '2h ago',
    workout: 'Zone 2 Long Run — 14 km',
    description: 'Felt smooth today. Kept HR under 145 the whole way. Recovery week vibes.',
    likes: 18,
    comments: 4,
    liked: false,
    tags: ['running', 'zone2'],
  },
  {
    id: '2',
    author: 'Marcus Levin',
    initials: 'ML',
    time: '4h ago',
    workout: 'Strength — Upper Push',
    description: 'New bench PR: 102.5 kg x3. Deload week paid off. Ready for the next block.',
    likes: 34,
    comments: 11,
    liked: true,
    tags: ['strength', 'PR'],
  },
  {
    id: '3',
    author: 'Sofia Herrera',
    initials: 'SH',
    time: '6h ago',
    workout: 'Swim — 3 km Open Water',
    description: 'First open water swim of the season. Cold but so worth it.',
    likes: 22,
    comments: 6,
    liked: false,
    tags: ['swimming', 'triathlon'],
  },
  {
    id: '4',
    author: 'Kwame Asante',
    initials: 'KA',
    time: '8h ago',
    workout: 'Cycling — 40 km Tempo',
    description: 'Average power 245W. Wind was brutal on the way back. Solid effort.',
    likes: 15,
    comments: 3,
    liked: false,
    tags: ['cycling', 'tempo'],
  },
];

export function SocialFeedPage() {
  const [posts, setPosts] = useState<Post[]>(MOCK_POSTS);

  function toggleLike(id: string) {
    setPosts(prev =>
      prev.map(p =>
        p.id === id
          ? { ...p, liked: !p.liked, likes: p.liked ? p.likes - 1 : p.likes + 1 }
          : p,
      ),
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Community Feed</h1>
          <p className="text-muted-foreground text-sm">See what your crew has been up to</p>
        </div>
        <Button size="sm" className="gap-2">
          <Share2 className="w-4 h-4" />
          Share Workout
        </Button>
      </div>

      <div className="space-y-4">
        {posts.map(post => (
          <Card key={post.id}>
            <CardHeader className="pb-3">
              <div className="flex items-start gap-3">
                <Avatar className="w-9 h-9">
                  <AvatarFallback className="text-xs font-semibold">{post.initials}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm">{post.author}</span>
                    <span className="text-xs text-muted-foreground">{post.time}</span>
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <Dumbbell className="w-3 h-3 text-primary shrink-0" />
                    <span className="text-sm font-medium text-primary truncate">{post.workout}</span>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0 space-y-3">
              <p className="text-sm">{post.description}</p>
              <div className="flex flex-wrap gap-1.5">
                {post.tags.map(tag => (
                  <Badge key={tag} variant="secondary" className="text-xs">
                    #{tag}
                  </Badge>
                ))}
              </div>
              <div className="flex items-center gap-4 pt-1 border-t">
                <button
                  onClick={() => toggleLike(post.id)}
                  className={`flex items-center gap-1.5 text-sm transition-colors ${
                    post.liked ? 'text-red-500' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Heart className={`w-4 h-4 ${post.liked ? 'fill-current' : ''}`} />
                  {post.likes}
                </button>
                <button className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
                  <MessageCircle className="w-4 h-4" />
                  {post.comments}
                </button>
                <button className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors ml-auto">
                  <Share2 className="w-4 h-4" />
                  Share
                </button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

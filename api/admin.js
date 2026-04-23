import { createClient } from '@libsql/client';
import { parse, serialize } from 'cookie';

const client = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

export default async function handler(req, res) {
  const cookies = parse(req.headers.cookie || '');
  const isAuthorized = cookies.session === process.env.ADMIN_SESSION_SECRET;

  // HANDLE POST REQUESTS
  if (req.method === 'POST') {
    const body = JSON.parse(req.body);

    if (body.action === 'login') {
      if (body.code === process.env.ADMIN_ACCESS_CODE) {
        res.setHeader('Set-Cookie', serialize('session', process.env.ADMIN_SESSION_SECRET, {
          path: '/',
          httpOnly: true,
          secure: true,
          sameSite: 'strict',
          maxAge: 60 * 60 * 24 // 24 Jam
        }));
        return res.status(200).json({ success: true });
      }
      return res.status(401).json({ message: 'Unauthorized' });
    }

    if (!isAuthorized) return res.status(403).json({ message: 'Forbidden' });

    if (body.action === 'addTrack') {
      try {
        // Otomatis ekstrak Video ID dari URL YouTube
        let videoId = "";
        const urlObj = new URL(body.youtube_url);
        if (urlObj.hostname.includes('youtu.be')) {
          videoId = urlObj.pathname.slice(1);
        } else {
          videoId = urlObj.searchParams.get('v');
        }

        await client.execute({
          sql: `INSERT INTO tracks (genre_id, title, artist, youtube_url, youtube_video_id, cover_url, accent_color) 
                VALUES (?, ?, ?, ?, ?, ?, ?)`,
          args: [body.genre_id, body.title, body.artist, body.youtube_url, videoId, body.cover_url, body.accent_color]
        });
        return res.status(200).json({ success: true });
      } catch (err) {
        return res.status(500).json({ error: err.message });
      }
    }
  }

  // HANDLE GET REQUESTS
  if (req.method === 'GET') {
    const { action } = req.query;

    if (action === 'check') {
      return isAuthorized ? res.status(200).json({ ok: true }) : res.status(401).end();
    }

    if (action === 'getGenres' && isAuthorized) {
      const result = await client.execute("SELECT id, name FROM genres ORDER BY name ASC");
      return res.status(200).json(result.rows);
    }
  }

  return res.status(405).end();
}

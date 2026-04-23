import { createClient } from '@libsql/client';
import { parse, serialize } from 'cookie';

const client = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

export default async function handler(req, res) {
  const cookies = parse(req.headers.cookie || '');
  const isAuth = cookies.session === process.env.ADMIN_SESSION_SECRET;

  // HANDLE POST
  if (req.method === 'POST') {
    const body = JSON.parse(req.body);

    if (body.action === 'login') {
      if (body.code === process.env.ADMIN_ACCESS_CODE) {
        res.setHeader('Set-Cookie', serialize('session', process.env.ADMIN_SESSION_SECRET, {
          path: '/',
          httpOnly: true,
          secure: true,
          sameSite: 'strict',
          maxAge: 3600 // Logout otomatis dalam 1 jam (3600 detik)
        }));
        return res.status(200).json({ ok: true });
      }
      return res.status(401).end();
    }

    if (!isAuth) return res.status(403).end();

    if (body.action === 'addTrack') {
      try {
        const urlObj = new URL(body.youtube_url);
        const videoId = urlObj.hostname.includes('youtu.be') ? urlObj.pathname.slice(1) : urlObj.searchParams.get('v');

        await client.execute({
          sql: `INSERT INTO tracks (genre_id, title, artist, youtube_url, youtube_video_id, cover_url, accent_color) 
                VALUES (?, ?, ?, ?, ?, ?, ?)`,
          args: [body.genre_id, body.title, body.artist, body.youtube_url, videoId, body.cover_url, body.accent_color]
        });
        return res.status(200).json({ ok: true });
      } catch (e) {
        return res.status(500).json({ error: e.message });
      }
    }
  }

  // HANDLE GET
  if (req.method === 'GET') {
    const { action, url } = req.query;

    if (action === 'check') {
      return isAuth ? res.status(200).json({ ok: true }) : res.status(401).end();
    }

    if (action === 'logout') {
      res.setHeader('Set-Cookie', serialize('session', '', {
        path: '/',
        expires: new Date(0),
        maxAge: -1 
      }));
      return res.status(200).json({ ok: true });
    }

    if (action === 'fetchYoutube' && isAuth) {
        try {
            const yt = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`);
            const data = await yt.json();
            return res.status(200).json({ title: data.title });
        } catch (e) { return res.status(500).end(); }
    }

    if (action === 'getGenres' && isAuth) {
      const result = await client.execute("SELECT id, name FROM genres ORDER BY name ASC");
      return res.status(200).json(result.rows);
    }
  }

  return res.status(405).end();
}

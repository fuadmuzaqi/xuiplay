import { createClient } from '@libsql/client';
import { parse, serialize } from 'cookie';

const client = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

export default async function handler(req, res) {
  const cookies = parse(req.headers.cookie || '');
  const isAuth = cookies.session === process.env.ADMIN_SESSION_SECRET;

  if (req.method === 'POST') {
    const body = JSON.parse(req.body);

    if (body.action === 'login') {
      if (body.code === process.env.ADMIN_ACCESS_CODE) {
        res.setHeader('Set-Cookie', serialize('session', process.env.ADMIN_SESSION_SECRET, {
          path: '/', httpOnly: true, secure: true, sameSite: 'strict', maxAge: 3600 
        }));
        return res.status(200).json({ ok: true });
      }
      return res.status(401).end();
    }

    if (!isAuth) return res.status(403).end();

    // GENRE CRUD & ORDER
    if (body.action === 'addGenre') {
      await client.execute({ 
        sql: "INSERT INTO genres (name, slug, sort_order) VALUES (?, ?, (SELECT IFNULL(MAX(sort_order),0)+1 FROM genres))", 
        args: [body.name, body.slug] 
      });
      return res.status(200).json({ ok: true });
    }
    if (body.action === 'updateGenre') {
      await client.execute({ sql: "UPDATE genres SET name = ?, slug = ? WHERE id = ?", args: [body.name, body.slug, body.id] });
      return res.status(200).json({ ok: true });
    }
    if (body.action === 'deleteGenre') {
      await client.execute({ sql: "DELETE FROM genres WHERE id = ?", args: [body.id] });
      return res.status(200).json({ ok: true });
    }
    if (body.action === 'updateGenreOrder') {
      const queries = body.items.map(item => ({
        sql: "UPDATE genres SET sort_order = ? WHERE id = ?",
        args: [item.sort_order, item.id]
      }));
      await client.batch(queries, "write");
      return res.status(200).json({ ok: true });
    }

    // TRACK CRUD & ORDER
    if (body.action === 'addTrack') {
      const url = new URL(body.youtube_url);
      const vid = url.hostname.includes('youtu.be') ? url.pathname.slice(1) : url.searchParams.get('v');
      await client.execute({
        sql: `INSERT INTO tracks (genre_id, title, artist, youtube_url, youtube_video_id, accent_color, sort_order) 
              VALUES (?, ?, ?, ?, ?, ?, (SELECT IFNULL(MAX(sort_order),0)+1 FROM tracks WHERE genre_id = ?))`,
        args: [body.genre_id, body.title, body.artist, body.youtube_url, vid, body.accent_color, body.genre_id]
      });
      return res.status(200).json({ ok: true });
    }
    if (body.action === 'deleteTrack') {
      await client.execute({ sql: "DELETE FROM tracks WHERE id = ?", args: [body.id] });
      return res.status(200).json({ ok: true });
    }
    if (body.action === 'updateOrder') {
      const queries = body.items.map(item => ({
        sql: "UPDATE tracks SET sort_order = ? WHERE id = ?",
        args: [item.sort_order, item.id]
      }));
      await client.batch(queries, "write");
      return res.status(200).json({ ok: true });
    }
  }

  if (req.method === 'GET') {
    const { action, url } = req.query;
    if (action === 'check') return isAuth ? res.status(200).json({ ok: true }) : res.status(401).end();
    if (action === 'logout') {
      res.setHeader('Set-Cookie', serialize('session', '', { path: '/', expires: new Date(0), maxAge: -1 }));
      return res.status(200).json({ ok: true });
    }
    if (action === 'fetchYoutube' && isAuth) {
      try {
        const yt = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`);
        const data = await yt.json();
        return res.status(200).json({ title: data.title });
      } catch (e) { return res.status(500).end(); }
    }
    if (action === 'getMasterData' && isAuth) {
      const genres = await client.execute("SELECT * FROM genres ORDER BY sort_order ASC, name ASC");
      const tracks = await client.execute("SELECT * FROM tracks ORDER BY sort_order ASC");
      return res.status(200).json({ genres: genres.rows, tracks: tracks.rows });
    }
  }
  return res.status(405).end();
}
